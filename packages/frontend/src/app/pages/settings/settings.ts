import { Component, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import  { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { form, required, email, pattern, minLength, applyWhen, FormRoot, FormField } from '@angular/forms/signals';

import { SettingsService, HhLoginPayload } from '../../core/services/settings.service';

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
    FormRoot,
    FormField,
  ],
  templateUrl: './settings.html',
  styleUrls: ['./settings.scss'],
})
export class SettingsPageComponent {
  loginType = signal<'phone' | 'email'>('phone');
  loginBySmsCode = signal<boolean>(false);
  awaitingSmsCode = signal<boolean>(false);
  private settingsService = inject(SettingsService);

  formGroup = form(
    signal({ phone: '', email: '', password: '', smsCode: '' }),
    (f) => {
      pattern(f.phone, /^[0-9]{10,15}$/);
      email(f.email);
      // Пароль нужен только когда вход не по коду из смс.
      applyWhen(f.password, () => !this.loginBySmsCode(), (field) => {
        required(field);
        minLength(field, 6);
      });
      // Код обязателен на шаге подтверждения (4–8 цифр).
      applyWhen(f.smsCode, () => this.awaitingSmsCode(), (field) => {
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

    if (this.loginBySmsCode()) {
      payload.wait_sms_code = true;
    } else {
      payload.password = password;
    }

    this.settingsService.login(payload).subscribe({
      next: (res) => {
        console.log('[Settings] HH login:', res);
        if (res.waitSmsCode) {
          this.awaitingSmsCode.set(true);
        }
      },
      error: (err) => console.error('[Settings] HH login failed:', err),
    });
  }

  submitSmsCode() {
    const { smsCode } = this.formGroup().value();
    this.settingsService.sendCode(smsCode).subscribe({
      next: (res) => {
        console.log('[Settings] SMS code:', res);
        if (res.success) {
          this.awaitingSmsCode.set(false);
        }
      },
      error: (err) => console.error('[Settings] SMS code failed:', err),
    });
  }
}
