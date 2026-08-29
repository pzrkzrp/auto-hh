import { Component, OnInit, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { catchError, forkJoin, of } from 'rxjs';
import { form, required, pattern, FormRoot, FormField } from '@angular/forms/signals';

import { SettingsService, HhLoginPayload, HhSessionInfo } from '../../core/services/settings.service';
import { ThemeService } from '../../core/services/theme.service';

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

  // Единое поле входа «Телефон или Email» (как в дизайне) — вход всегда по коду.
  loginInput = signal({ login: '' });
  loginForm = form(this.loginInput, (f) => required(f.login));

  // Шаг подтверждения кодом из смс/почты.
  awaitingCode = signal(false);
  pendingAccountId = signal<string | null>(null);
  codeInput = signal({ code: '' });
  codeForm = form(this.codeInput, (f) => {
    required(f.code);
    pattern(f.code, /^\d{4,8}$/);
  });

  private settingsService = inject(SettingsService);

  ngOnInit() {
    this.loadAccounts();
  }

  // Если значение содержит '@' — это почта, иначе телефон.
  get loginType(): 'phone' | 'email' {
    return this.loginForm().value().login.includes('@') ? 'email' : 'phone';
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
    if (login.includes('@')) payload.email = login;
    else payload.phone = login;

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

  removeAccount(id: string) {
    this.settingsService.removeSession(id).subscribe({
      next: () => this.loadAccounts(),
      error: (err) => this.notice.set(err?.error?.message || err?.message || 'Не удалось удалить аккаунт'),
    });
  }

  // Повторная авторизация / изменение аккаунта: подставляем телефон/почту в
  // форму подключения и скроллим к ней. Старую сессию пользователь удаляет сам.
  reconnect(account: HhAccount) {
    this.loginInput.set({ login: account.phone || account.email || '' });
    this.awaitingCode.set(false);
    this.pendingAccountId.set(null);
    this.notice.set('');
    document.getElementById('connect-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
