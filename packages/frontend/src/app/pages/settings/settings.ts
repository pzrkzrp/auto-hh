import { Component, OnInit, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { catchError, forkJoin, of } from 'rxjs';
import { form, required, pattern, FormRoot, FormField } from '@angular/forms/signals';

import { SettingsService, HhLoginPayload, HhSessionInfo } from '../../core/services/settings.service';
import { ThemeService } from '../../core/services/theme.service';
import { AuthService } from '../../core/services/auth.service';

// Аккаунт + вычисленный статус сессии: valid=true — «Активен», false — «Ошибка
// авторизации». Статус проверяется через check-эндпоинт (headless-браузер).
type HhAccount = HhSessionInfo & { valid: boolean };

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [MatIconModule, MatTooltipModule, MatSlideToggleModule, FormRoot, FormField],
  templateUrl: './settings.html',
  styleUrls: ['./settings.scss'],
})
export class SettingsPageComponent implements OnInit {
  readonly theme = inject(ThemeService);

  accounts = signal<HhAccount[]>([]);
  loading = signal(true);
  notice = signal('');

  // Единое поле входа — вход всегда по коду. Переключатель «Телефон/Email»
  // задаёт режим явно (в дизайне это метка «Телефон или Email»), от него
  // зависят placeholder, inputmode и поле payload.
  loginMode = signal<'phone' | 'email'>('phone');
  loginInput = signal({ login: '' });
  loginForm = form(this.loginInput, (f) => {
    required(f.login);
    // Валидация зависит от режима: полная маска телефона или простой email.
    if (this.loginMode() === 'email') {
      pattern(f.login, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    } else {
      pattern(f.login, /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/);
    }
  });

  // Шаг подтверждения кодом из смс/почты.
  awaitingCode = signal(false);
  pendingAccountId = signal<string | null>(null);
  codeInput = signal({ code: '' });
  codeForm = form(this.codeInput, (f) => {
    required(f.code);
    pattern(f.code, /^\d{4,8}$/);
  });

  private settingsService = inject(SettingsService);
  private authService = inject(AuthService);

  ngOnInit() {
    this.loadAccounts();
  }

  loadAccounts() {
    this.loading.set(true);
    this.settingsService.getSessions().subscribe({
      next: (res) => {
        const sessions = res.sessions;
        // Сначала показываем все как активные, затем фоновые check-запросы
        // уточняют реальный статус (каждая проверка — headless-браузер).
        this.accounts.set(sessions.map((s) => ({ ...s, valid: true })));
        this.loading.set(false);
        if (!sessions.length) return;

        forkJoin(
          sessions.map((s) =>
            this.settingsService.checkSession(s._id).pipe(catchError(() => of({ valid: true }))),
          ),
        ).subscribe((checks) => {
          this.accounts.set(sessions.map((s, i) => ({ ...s, valid: checks[i].valid })));
        });
      },
      error: (err) => {
        console.error('[Settings] load sessions failed:', err);
        this.notice.set('Не удалось загрузить подключённые аккаунты');
        this.loading.set(false);
      },
    });
  }

  onSubmit(event: Event) {
    event.preventDefault();
    const login = this.loginForm().value().login.trim();
    if (!login) return;

    this.notice.set('');
    const payload: HhLoginPayload = { wait_code: true };
    if (this.loginMode() === 'email') payload.email = login;
    else payload.phone = login.replace(/\D/g, ''); // бэкенд ждёт цифры: 7XXXXXXXXXX

    this.settingsService.login(payload).subscribe({
      next: (res) => {
        if (res.waitSmsCode && res.accountId) {
          this.pendingAccountId.set(res.accountId);
          this.awaitingCode.set(true);
        } else if (!res.success) {
          this.notice.set(res.message);
        }
      },
      error: (err) => {
        this.notice.set(err?.error?.message || err?.message || 'Не удалось отправить код');
      },
    });
  }

  submitCode() {
    const code = this.codeForm().value().code.trim();
    const accountId = this.pendingAccountId();
    if (!code || !accountId) return;

    this.notice.set('');
    this.settingsService.sendCode(accountId, code).subscribe({
      next: (res) => {
        if (res.success) {
          this.awaitingCode.set(false);
          this.pendingAccountId.set(null);
          this.codeForm().reset();
          this.loadAccounts();
        } else {
          this.notice.set(res.message);
        }
      },
      error: (err) => {
        this.notice.set(err?.error?.message || err?.message || 'Не удалось подтвердить код');
      },
    });
  }

  cancelCode() {
    this.awaitingCode.set(false);
    this.pendingAccountId.set(null);
    this.codeForm().reset();
    this.loginForm().reset();
  }

  // ── Маски ввода ──────────────────────────────────────────────────────
  // Телефон: +7 (XXX) XXX-XX-XX — форматируем по мере ввода цифр.
  formatPhone(raw: string): string {
    let digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    // «8» в начале — российский формат, приводим к +7.
    if (digits.startsWith('8')) digits = '7' + digits.slice(1);
    if (digits.startsWith('7')) digits = digits.slice(1);
    digits = digits.slice(0, 10);

    let result = '+7';
    if (digits.length) result += ` (${digits.slice(0, 3)}`;
    if (digits.length >= 3) result += ')';
    if (digits.length > 3) result += ` ${digits.slice(3, 6)}`;
    if (digits.length > 6) result += `-${digits.slice(6, 8)}`;
    if (digits.length > 8) result += `-${digits.slice(8, 10)}`;
    return result;
  }

  // Email-маска: только допустимые символы, в нижнем регистре, без пробелов.
  formatEmail(raw: string): string {
    return raw.replace(/[^\w.@%+\-]/g, '').toLowerCase().slice(0, 64);
  }

  // Ввод под маску: форматируем сразу в DOM (чтобы не прыгал курсор) и в сигнал.
  onLoginInput(event: Event) {
    const el = event.target as HTMLInputElement;
    const formatted = this.loginMode() === 'email' ? this.formatEmail(el.value) : this.formatPhone(el.value);
    el.value = formatted;
    this.loginInput.update((v) => ({ ...v, login: formatted }));
  }

  // Смена режима сбрасывает поле, чтобы маска/валидация не конфликтовали.
  switchLoginMode(mode: 'phone' | 'email') {
    this.loginMode.set(mode);
    this.loginInput.set({ login: '' });
  }

  removeAccount(id: string) {
    this.settingsService.removeSession(id).subscribe({
      next: () => this.loadAccounts(),
      error: (err) => this.notice.set(err?.error?.message || err?.message || 'Не удалось удалить аккаунт'),
    });
  }

  // Повторная авторизация / изменение аккаунта: подставляем телефон/почту в
  // форму подключения и скроллим к ней. Старую сессию пользователь удаляет сам.
  reconnect(account: HhAccount) {
    const mode: 'phone' | 'email' = account.email ? 'email' : 'phone';
    this.loginMode.set(mode);
    // Сохранённое значение форматируем под маску выбранного режима.
    this.loginInput.set({
      login: mode === 'email' ? this.formatEmail(account.email || '') : this.formatPhone(account.phone || ''),
    });
    this.awaitingCode.set(false);
    this.pendingAccountId.set(null);
    this.notice.set('');
    document.getElementById('connect-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // «Выйти» из настроек — завершает сессию веб-приложения и ведёт на /login.
  logout() {
    this.authService.logout();
  }
}
