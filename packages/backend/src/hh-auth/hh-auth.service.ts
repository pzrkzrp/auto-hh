import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { User } from '../auth/user.schema';
import { encryptSecret, decryptSecret } from '../common/crypto.util';

const HH_LOGIN_URL = 'https://hh.ru/account/login';
const HH_AUTH_CHECK_URL = 'https://hh.ru/applicant/resumes';

// Вход на hh.ru через Playwright. Как и в CLI, вход ручной: сервис открывает
// headful-браузер на страницу логина, пользователь вводит данные (и капчу) сам,
// после редиректа с /account/login сервис снимает storageState() и сохраняет его
// зашифрованным в документе пользователя (по аналогии с apiKeys).
@Injectable()
export class HhAuthService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  private loginInProgress = false;

  async login(userId: string): Promise<{ success: boolean; message: string }> {
    if (this.loginInProgress) {
      throw new ConflictException('Вход на hh.ru уже выполняется. Дождитесь завершения.');
    }
    this.loginInProgress = true;

    const timeoutSec = Number(process.env.HH_LOGIN_TIMEOUT_SEC || 300);
    let browser: Browser | null = null;
    try {
      browser = await chromium.launch({ headless: false });
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();

      await page.goto(HH_LOGIN_URL, { waitUntil: 'domcontentloaded' });

      const ok = await this.waitForLogin(page, context, timeoutSec * 1000);
      if (!ok) {
        return { success: false, message: 'Вход на hh.ru не выполнен (браузер закрыт или истёк таймаут).' };
      }

      const storageState = await context.storageState();
      const encrypted = encryptSecret(JSON.stringify(storageState));
      await this.userModel.updateOne(
        { _id: userId },
        { $set: { hhStorageState: encrypted, hhLoginAt: new Date() } },
      );
      return { success: true, message: 'hh.ru подключён: сессия сохранена.' };
    } catch (err: any) {
      throw new BadRequestException(`Не удалось открыть браузер для входа: ${err?.message || err}`);
    } finally {
      if (browser) await browser.close().catch(() => {});
      this.loginInProgress = false;
    }
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
    const user = await this.userModel.findById(userId).lean().exec();
    return {
      connected: !!(user?.hhStorageState),
      loginAt: user?.hhLoginAt || null,
    };
  }

  async check(userId: string): Promise<{ valid: boolean }> {
    const user = await this.userModel.findById(userId).lean().exec();
    if (!user?.hhStorageState) return { valid: false };

    const stateRaw = decryptSecret(user.hhStorageState);
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
    await this.userModel.updateOne(
      { _id: userId },
      { $set: { hhStorageState: null, hhLoginAt: null } },
    );
    return { ok: true };
  }
}
