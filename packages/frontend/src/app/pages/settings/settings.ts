import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';

import { form, required, email, pattern, minLength, applyWhen, FormRoot, FormField } from '@angular/forms/signals';

import { SettingsService, HhLoginPayload, HhSessionInfo } from '../../core/services/settings.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatIconModule,
    FormRoot,
    FormField,
    DatePipe,
  ],
  templateUrl: './settings.html',
  styleUrls: ['./settings.scss'],
})
export class SettingsPageComponent implements OnInit {
  loginType = signal<'phone' | 'email'>('phone');
  loginByCode = signal<boolean>(false);
  awaitingCode = signal<boolean>(false);
  pendingAccountId = signal<string | null>(null);
  sessions = signal<HhSessionInfo[]>([]);
  private settingsService = inject(SettingsService);

  ngOnInit() {
    this.loadSessions();
  }

  loadSessions() {
    this.settingsService.getSessions().subscribe({
      next: (res) => this.sessions.set(res.sessions),
      error: (err) => console.error('[Settings] load sessions failed:', err),
    });
  }

  formGroup = form(
    signal({ phone: '', email: '', password: '', smsCode: '' }),
    (f) => {
      pattern(f.phone, /^[0-9]{10,15}$/);
      email(f.email);
      // Пароль нужен только когда вход не по коду.
      applyWhen(f.password, () => !this.loginByCode(), (field) => {
        required(field);
        minLength(field, 6);
      });
      // Код обязателен на шаге подтверждения (4–8 цифр).
      applyWhen(f.smsCode, () => this.awaitingCode(), (field) => {
        required(field);
        pattern(field, /^\d{4,8}$/);
      });
    }
  );

  onSubmit(event: Event) {
    event.preventDefault();
    const { phone, email, password } = this.formGroup().value();

    const payload: HhLoginPayload = {};
    if (this.loginType() === 'phone') {
      payload.phone = phone;
    } else {
      payload.email = email;
    }

    if (this.loginByCode()) {
      payload.wait_code = true;
    } else {
      payload.password = password;
    }

    this.settingsService.login(payload).subscribe({
      next: (res) => {
        console.log('[Settings] HH login:', res);
        if (res.accountId) this.pendingAccountId.set(res.accountId);
        if (res.waitSmsCode) {
          this.awaitingCode.set(true);
        } else {
          // Вход по паролю завершён — сессия сохранена, обновляем список.
          this.awaitingCode.set(false);
          this.formGroup().reset();
          this.loadSessions();
        }
      },
      error: (err) => console.error('[Settings] HH login failed:', err),
    });
  }

  submitCode() {
    const { smsCode } = this.formGroup().value();
    const accountId = this.pendingAccountId();
    if (!accountId) return;
    this.settingsService.sendCode(accountId, smsCode).subscribe({
      next: (res) => {
        console.log('[Settings] Code:', res);
        if (res.success) {
          this.awaitingCode.set(false);
          this.pendingAccountId.set(null);
          this.formGroup().reset();
          this.loadSessions();
        }
      },
      error: (err) => console.error('[Settings] SMS code failed:', err),
    });
  }

  removeSession(id: string) {
    this.settingsService.removeSession(id).subscribe({
      next: () => this.loadSessions(),
      error: (err) => console.error('[Settings] remove session failed:', err),
    });
  }
}
