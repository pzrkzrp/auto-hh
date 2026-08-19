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
  // Второй экран — телефон/почта
  credentialTypePhone: '[data-qa="credential-type-phone"]',
  credentialTypeEmail: '[data-qa="credential-type-email"]',
  phoneNational: '[data-qa="magritte-phone-input-national-number-input"]',
  emailInput: '[data-qa="applicant-login-input-email"]',
  // Вход с паролем
  expandPassword: '[data-qa="expand-login-by-password"]',
  passwordInput: '[data-qa="applicant-login-input-password"]',
  // Вход по коду из смс
  pincodeInput: '[data-qa="magritte-pincode-input-field"]',
};

interface LoginSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  startedAt: number;
}

// Вход на hh.ru через Playwright.
//  - С паролем: открывается headful-браузер, данные подставляются автоматически,
//    капчу/остальное пользователь доделывает сам, после редиректа с /account/login
//    сервис сохраняет storageState().
//  - По коду (wait_sms_code): браузер тоже открывается, телефон/почта подставляются
//    и отправляется запрос кода; сам код пользователь вводит НЕ в браузере, а на
//    фронтенде — он приходит в sendCode(), где подставляется в поле кода на hh.ru.
//    Сессия Playwright при этом живёт между двумя HTTP-запросами (sessions).
@Injectable()
export class HhAuthService {
  constructor(@InjectModel(HhSession.name) private hhSessionModel: Model<HhSession>) {}

  private sessions = new Map<string, LoginSession>();

  async login(userId: string, dto: HhLoginDto = {}): Promise<{ success: boolean; message: string; waitSmsCode?: boolean }> {
    const { phone, email, password, wait_sms_code } = dto;
    if (!phone && !email) {
      throw new BadRequestException('Укажите телефон или email.');
    }
    if (!wait_sms_code && !password) {
      throw new BadRequestException('Пароль обязателен, если вход не по коду из смс.');
    }
    if (this.sessions.has(userId)) {
      throw new ConflictException('Вход на hh.ru уже выполняется. Дождитесь завершения.');
    }

    const timeoutSec = Number(process.env.HH_LOGIN_TIMEOUT_SEC || 300);
    let browser: Browser | null = null;
    let stored = false;
    try {
      browser = await chromium.launch({ headless:  true});
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();

      await page.goto(HH_LOGIN_URL, { waitUntil: 'domcontentloaded' });
      await this.prefillLogin(page, dto);

      if (wait_sms_code) {
        // hh.ru отправил код — сессия остаётся открытой до прихода кода с фронтенда.
        this.sessions.set(userId, { browser, context, page, startedAt: Date.now() });
        stored = true;
        const timer = setTimeout(() => this.closeSession(userId), timeoutSec * 1000);
        timer.unref?.();
        return { success: true, waitSmsCode: true, message: 'Код отправлен. Введите его на форме.' };
      }

      const ok = await this.waitForLogin(page, context, timeoutSec * 1000);
      if (!ok) {
        return { success: false, message: 'Вход на hh.ru не выполнен (браузер закрыт или истёк таймаут).' };
      }
      await this.saveSession(userId, context);
      return { success: true, message: 'hh.ru подключён: сессия сохранена.' };
    } catch (err: any) {
      throw new BadRequestException(`Не удалось открыть браузер для входа: ${err?.message || err}`);
    } finally {
      // В режиме кода браузер живёт до sendCode()/таймаута, здесь его не закрываем.
      if (browser && !stored) await browser.close().catch(() => {});
    }
  }

  /**
   * Пользователь ввёл код из смс на фронтенде — подставляем его в поле hh.ru.
   * Активная сессия хранится в this.sessions и закрывается после успешного входа.
   */
  async sendCode(userId: string, code: string): Promise<{ success: boolean; message: string }> {
    const session = this.sessions.get(userId);
    if (!session) {
      throw new BadRequestException('Нет активного входа по коду. Начните вход заново.');
    }
    const { page, context } = session;

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
    await this.saveSession(userId, context);
    this.closeSession(userId);
    return { success: true, message: 'hh.ru подключён: сессия сохранена.' };
  }

  /**
   * Best-effort заполнение формы входа. Все шаги в try/catch: при любой ошибке
   * пользователь просто вводит данные вручную, общий флоу не ломается.
   */
  private async prefillLogin(page: Page, dto: HhLoginDto): Promise<void> {
    const { phone, email, password, wait_sms_code } = dto;

    // Первый экран: выбор типа аккаунта → «Войти». Если форма уже открыта — пропускаем.
    const hasCredentialForm = (await page.locator(SEL.credentialTypePhone).count()) > 0;
    if (!hasCredentialForm) {
      await this.click(page, SEL.submitButton);
      await page.waitForTimeout(1500);
    }

    // Телефон или почта
    if (phone) {
      await this.checkRadio(page, SEL.credentialTypePhone);
      await this.fillPhone(page, phone);
    } else if (email) {
      await this.checkRadio(page, SEL.credentialTypeEmail);
      await page.waitForTimeout(500);
      await this.fill(page, SEL.emailInput, email);
    }

    if (wait_sms_code) {
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

  private async checkRadio(page: Page, selector: string): Promise<void> {
    try {
      await page.locator(selector).first().check({ timeout: 5000 });
    } catch {
      // игнорируем — пользователь завершит вход вручную
    }
  }

  private async saveSession(userId: string, context: BrowserContext): Promise<void> {
    const storageState = await context.storageState();
    const encrypted = encryptSecret(JSON.stringify(storageState));
    await this.hhSessionModel.updateOne(
      { userId },
      { $set: { storageState: encrypted, loginAt: new Date() } },
      { upsert: true },
    );
  }

  private closeSession(userId: string): void {
    const session = this.sessions.get(userId);
    if (!session) return;
    this.sessions.delete(userId);
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
    const session = await this.hhSessionModel.findOne({ userId }).lean().exec();
    return {
      connected: !!(session?.storageState),
      loginAt: session?.loginAt || null,
    };
  }

  async check(userId: string): Promise<{ valid: boolean }> {
    const session = await this.hhSessionModel.findOne({ userId }).lean().exec();
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

  async remove(userId: string) {
    this.closeSession(userId);
    await this.hhSessionModel.deleteOne({ userId });
    return { ok: true };
  }
}
