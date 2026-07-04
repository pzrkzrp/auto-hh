import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule],
  template: `
    <div class="page-container" style="max-width:600px;">
      <h1>Профиль</h1>
      @if (loading) { <div class="loading-container"><mat-spinner></mat-spinner></div> }
      @else {
        <mat-card style="margin-bottom:16px;"><mat-card-header><mat-card-title>Профиль</mat-card-title></mat-card-header><mat-card-content><p><strong>Email:</strong> {{ profile?.email }}</p><p><strong>Имя:</strong> {{ profile?.name }}</p></mat-card-content></mat-card>
        <mat-card style="margin-bottom:16px;"><mat-card-header><mat-card-title>Сменить пароль</mat-card-title></mat-card-header><mat-card-content>
          <form [formGroup]="pwForm" (ngSubmit)="changePassword()" style="display:flex; flex-direction:column; gap:8px;">
            <mat-form-field appearance="outline"><mat-label>Текущий пароль</mat-label><input matInput type="password" formControlName="currentPassword" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Новый пароль</mat-label><input matInput type="password" formControlName="newPassword" /></mat-form-field>
            <button mat-raised-button color="primary" type="submit" [disabled]="pwForm.invalid">Сменить</button>
          </form>
        </mat-card-content></mat-card>
        <mat-card><mat-card-header><mat-card-title>API ключи</mat-card-title></mat-card-header><mat-card-content>
          <p style="color:rgba(0,0,0,0.6);">Ключи шифруются.</p>
          <form [formGroup]="keyForm" (ngSubmit)="saveKeys()" style="display:flex; flex-direction:column; gap:8px;">
            <mat-form-field appearance="outline"><mat-label>OpenAI Key {{ hasKeys ? '(есть)' : '' }}</mat-label><input matInput type="password" formControlName="openai" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Anthropic Key {{ hasKeys ? '(есть)' : '' }}</mat-label><input matInput type="password" formControlName="anthropic" /></mat-form-field>
            <button mat-raised-button color="primary" type="submit">Сохранить ключи</button>
          </form>
        </mat-card-content></mat-card>
      }
    </div>
  `,
})
export class SettingsPageComponent implements OnInit {
  pwForm: FormGroup; keyForm: FormGroup;
  profile: any = null; hasKeys = false; loading = true;

  constructor(private http: HttpClient, private fb: FormBuilder, private snackBar: MatSnackBar) {
    this.pwForm = this.fb.group({ currentPassword: ['', Validators.required], newPassword: ['', [Validators.required, Validators.minLength(6)]] });
    this.keyForm = this.fb.group({ openai: [''], anthropic: [''] });
  }

  ngOnInit() {
    this.http.get<any>('http://localhost:3001/api/users/me').subscribe({ next: p => { this.profile = p; this.hasKeys = p.hasApiKeys; this.loading = false; }, error: () => this.loading = false });
  }

  changePassword() {
    if (this.pwForm.invalid) return;
    this.http.put('http://localhost:3001/api/users/me/password', this.pwForm.value).subscribe({ next: () => { this.snackBar.open('Пароль изменён', 'OK', { duration: 2000 }); this.pwForm.reset(); }, error: (e) => this.snackBar.open(e.error?.message || 'Ошибка', 'OK', { duration: 2000 }) });
  }

  saveKeys() {
    const keys: any = {};
    if (this.keyForm.value.openai) keys.openai = this.keyForm.value.openai;
    if (this.keyForm.value.anthropic) keys.anthropic = this.keyForm.value.anthropic;
    if (!keys.openai && !keys.anthropic) return;
    this.http.put('http://localhost:3001/api/users/me/api-keys', keys).subscribe({ next: () => { this.snackBar.open('Ключи сохранены', 'OK', { duration: 2000 }); this.keyForm.reset(); this.hasKeys = true; } });
  }
}
