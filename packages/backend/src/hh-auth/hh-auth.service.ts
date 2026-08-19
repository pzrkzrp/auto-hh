import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { HhSession } from './hh-session.schema';
import { encryptSecret, decryptSecret } from '../common/crypto.util';
import { HhLoginDto } from './dto/hh-auth.dto';

const HH_LOGIN_URL = 'https://hh.ru/account/login';
const HH_AUTH_CHECK_URL = 'https://hh.ru/applicant/resumes';

// Селекторы формы входа hh.ru (React-страница, проверено 08.2026).
// Заполнение best-effort: если селектор не найден (капча, изменение вёрстки),
// пользователь дополняет форму вручную в открывшемся браузере.
const SEL = {
  // Первый экран — выбор типа аккаунта
  submitButton: '[data-qa="submit-button"]',
  // Второй экран — телефон/почта. У выбранного radio к data-qa дописан суффикс
  // ' checked', поэтому ищем по префиксу. Сам radio перекрыт span-лэйблом,
  // переключать нужно кликом по label-обёртке (см. switchCredentialType).
  credentialType: 'input[data-qa^="credential-type-"]',
  segmentWrapper: 'label[class*="magritte-segment-wrapper"]',
  phoneNational: '[data-qa="magritte-phone-input-national-number-input"]',
  emailInput: '[data-qa="applicant-login-input-email"]',
  // Вход с паролем
  expandPassword: '[data-qa="expand-login-by-password"]',
  passwordInput: '[data-qa="applicant-login-input-password"]',
  // Ввод кода из смс/почты
  pincodeInput: '[data-qa="magritte-pincode-input-field"]',
};

interface LoginSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  phone: string | null;
  email: string | null;
  startedAt: number;
}

// Вход на hh.ru через Playwright.
//  - С паролем: открывается headful-браузер, данные подставляются автоматически,
//    капчу/остальное пользователь доделывает сам, после редиректа с /account/login
//    сервис сохраняет storageState().
//  - По коду (wait_code): браузер тоже открывается, телефон/почта подставляются
//    и отправляется запрос кода; сам код пользователь вводит НЕ в браузере, а на
//    фронтенде — он приходит в sendCode(), где подставляется в поле кода на hh.ru.
//    Сессия Playwright при этом живёт между двумя HTTP-запросами (sessions).
@Injectable()
export class HhAuthService {
  constructor(@InjectModel(HhSession.name) private hhSessionModel: Model<HhSession>) {}

  // Live-входы по коду. Ключ userId:accountId — у юзера может быть несколько
  // параллельных входов в разные аккаунты.
  private sessions = new Map<string, LoginSession>();

  private liveKey(userId: string, accountId: string): string {
    return `${userId}:${accountId}`;
  }

  async login(userId: string, dto: HhLoginDto = {}): Promise<{ success: boolean; message: string; waitSmsCode?: boolean; accountId?: string }> {
    const { phone, email, password, wait_code } = dto;
    if (!phone && !email) {
      throw new BadRequestException('Укажите телефон или email.');
    }
    if (!wait_code && !password) {
      throw new BadRequestException('Пароль обязателен, если вход не по коду из смс.');
    }
    const accountId = email || phone!;
    const key = this.liveKey(userId, accountId);
    if (this.sessions.has(key)) {
      throw new ConflictException('Вход на hh.ru в этот аккаунт уже выполняется. Дождитесь завершения.');
    }

    const timeoutSec = Number(process.env.HH_LOGIN_TIMEOUT_SEC || 300);
    let browser: Browser | null = null;
    let stored = false;
    try {
      browser = await chromium.launch({ headless: false});
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();

      await page.goto(HH_LOGIN_URL, { waitUntil: 'domcontentloaded' });
      await this.prefillLogin(page, dto);

      if (wait_code) {
        // hh.ru отправил код — сессия остаётся открытой до прихода кода с фронтенда.
        this.sessions.set(key, { browser, context, page, phone: phone ?? null, email: email ?? null, startedAt: Date.now() });
        stored = true;
        const timer = setTimeout(() => this.closeSession(userId, accountId), timeoutSec * 1000);
        timer.unref?.();
        return { success: true, waitSmsCode: true, accountId, message: 'Код отправлен. Введите его на форме.' };
      }

      const ok = await this.waitForLogin(page, context, timeoutSec * 1000);
      if (!ok) {
        return { success: false, accountId, message: 'Вход на hh.ru не выполнен (браузер закрыт или истёк таймаут).' };
      }
      await this.saveSession(userId, accountId, phone ?? null, email ?? null, context);
      return { success: true, accountId, message: 'hh.ru подключён: сессия сохранена.' };
    } catch (err: any) {
      throw new BadRequestException(`Не удалось открыть браузер для входа: ${err?.message || err}`);
    } finally {
      // В режиме кода браузер живёт до sendCode()/таймаута, здесь его не закрываем.
      if (browser && !stored) await browser.close().catch(() => {});
    }
  }

  /**
   * Пользователь ввёл код на фронтенде — подставляем его в поле hh.ru.
   * Активная сессия хранится в this.sessions и закрывается после успешного входа.
   * accountId (email/телефон входа) указывает, к какому аккаунту относится код.
   */
  async sendCode(userId: string, accountId: string, code: string): Promise<{ success: boolean; message: string }> {
    const session = this.sessions.get(this.liveKey(userId, accountId));
    if (!session) {
      throw new BadRequestException('Нет активного входа по коду. Начните вход заново.');
    }
    const { page, context, phone, email } = session;

    const pincode = page.locator(SEL.pincodeInput);
    if (!(await pincode.count())) {
      throw new BadRequestException('Поле ввода кода не появилось на странице hh.ru.');
    }
    try {
      await pincode.first().fill(code, { timeout: 10000 });
      await pincode.first().press('Enter').catch(() => {});
    } catch {
      throw new BadRequestException('Не удалось ввести код на странице hh.ru.');
    }
    const ok = await this.waitForLogin(page, context, 30000);
    if (!ok) {
      // Код не принят — оставляем сессию, пользователь может ввести код ещё раз.
      return { success: false, message: 'Код не принят. Проверьте код и попробуйте снова.' };
    }
    await this.saveSession(userId, accountId, phone, email, context);
    this.closeSession(userId, accountId);
    return { success: true, message: 'hh.ru подключён: сессия сохранена.' };
  }

  /**
   * Best-effort заполнение формы входа. Все шаги в try/catch: при любой ошибке
   * пользователь просто вводит данные вручную, общий флоу не ломается.
   */
    private async prefillLogin(page: Page, dto: HhLoginDto): Promise<void> {
    const { phone, email, password, wait_code } = dto;

    // Первый экран: выбор типа аккаунта → «Войти». Если форма уже открыта — пропускаем.
    const hasCredentialForm = (await page.locator(SEL.credentialType).count()) > 0;
    if (!hasCredentialForm) {
      await this.click(page, SEL.submitButton);
      await page.waitForTimeout(1500);
    }

    // Телефон или почта — переключаем вкладку кликом по лэйблу сегмента.
    if (phone) {
      await this.switchCredentialType(page, 'phone');
      await this.fillPhone(page, phone);
    } else if (email) {
      await this.switchCredentialType(page, 'email');
      await page.waitForTimeout(500);
      await this.fill(page, SEL.emailInput, email);
    }

    if (wait_code) {
      // «Дальше» — hh.ru пришлёт код на телефон/почту.
      await this.click(page, SEL.submitButton);
    } else if (password) {
      await this.click(page, SEL.expandPassword);
      await page.waitForTimeout(800);
      await this.fill(page, SEL.passwordInput, password);
      await this.click(page, SEL.submitButton);
    }
  }

  private async fillPhone(page: Page, phone: string): Promise<void> {
    // Поле кода страны уже заполнено («+7»), поэтому отправляем только национальный номер.
    let national = phone;
    if (phone.length === 11 && (phone.startsWith('7') || phone.startsWith('8'))) {
      national = phone.slice(1); // 7/8XXXXXXXXXX → XXXXXXXXXX
    }
    await this.fill(page, SEL.phoneNational, national);
  }

  private async click(page: Page, selector: string): Promise<void> {
    try {
      await page.locator(selector).first().click({ timeout: 1000  });
    } catch {
      // игнорируем — пользователь завершит вход вручную
    }
  }

  private async fill(page: Page, selector: string, value: string): Promise<void> {
    try {
      await page.locator(selector).first().fill(value, { timeout: 1000 });
    } catch {
      // игнорируем — пользователь завершит вход вручную
    }
  }

  // Переключатель «Телефон / Почта» на hh.ru. Radio-инпут перекрыт span-лэйблом
  // (magritte-segment) и клик по нему перехватывается, поэтому кликаем по
  // label-обёртке с текстом сегмента — как это делает пользователь.
  private async switchCredentialType(page: Page, type: 'phone' | 'email'): Promise<void> {
    const label = type === 'phone' ? 'Телефон' : 'Почта';
    try {
      await page.locator(SEL.segmentWrapper).filter({ hasText: label }).first().click({ timeout: 1000 });
    } catch (e) {
      console.error(e); // клик не прошёл (капча/изменение вёрстки) — пользователь переключит вручную
    }
  }

  private async saveSession(userId: string, accountId: string, phone: string | null, email: string | null, context: BrowserContext): Promise<void> {
    const storageState = await context.storageState();
    const encrypted = encryptSecret(JSON.stringify(storageState))!;
    // Каждый вход создаёт новую сессию — у аккаунта может быть несколько сессий.
    await this.hhSessionModel.create({
      userId,
      accountId,
      phone,
      email,
      storageState: encrypted,
      loginAt: new Date(),
    });
  }

  private closeSession(userId: string, accountId: string): void {
    const key = this.liveKey(userId, accountId);
    const session = this.sessions.get(key);
    if (!session) return;
    this.sessions.delete(key);
    session.browser.close().catch(() => {});
  }

  private waitForLogin(page: Page, context: BrowserContext, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const isLoggedIn = () =>
        !/\/account\/login/.test(page.url()) && !/captcha/i.test(page.url());
      const started = Date.now();
      const timer = setInterval(() => {
        if (isLoggedIn()) {
          clearInterval(timer);
          resolve(true);
        } else if (Date.now() - started > timeoutMs) {
          clearInterval(timer);
          resolve(false);
        }
      }, 1000);
      context.once('close', () => {
        clearInterval(timer);
        resolve(isLoggedIn());
      });
    });
  }

  async status(userId: string) {
    const sessions = await this.hhSessionModel
      .find({ userId })
      .sort({ loginAt: -1 })
      .select({ _id: 1, accountId: 1, phone: 1, email: 1, loginAt: 1 })
      .lean()
      .exec();
    return { sessions };
  }

  async check(userId: string, sessionId: string): Promise<{ valid: boolean }> {
    const session = await this.hhSessionModel.findOne({ _id: sessionId, userId }).lean().exec().catch(() => null);
    if (!session?.storageState) return { valid: false };

    const stateRaw = decryptSecret(session.storageState);
    if (!stateRaw) return { valid: false };

    let browser: Browser | null = null;
    try {
      const state = JSON.parse(stateRaw);
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({ storageState: state });
      const page = await context.newPage();
      await page.goto(HH_AUTH_CHECK_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
      return { valid: !/\/account\/login/.test(page.url()) };
    } catch {
      return { valid: false };
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }

  async remove(userId: string, sessionId: string) {
    // Невалидный sessionId (битый ObjectId) считаем уже удалённым.
    await this.hhSessionModel.deleteOne({ _id: sessionId, userId }).catch(() => {});
    return { ok: true };
  }
}
