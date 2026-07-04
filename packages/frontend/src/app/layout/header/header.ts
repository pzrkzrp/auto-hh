import { Component } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../../core/services/auth.service';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [MatToolbarModule, MatButtonModule, MatIconModule, MatMenuModule, AsyncPipe],
  template: `
    <mat-toolbar color="primary">
      <span>auto-hh</span>
      <span class="spacer"></span>
      @if (authService.currentUser$ | async; as user) {
        <button mat-button [matMenuTriggerFor]="menu">
          <mat-icon>account_circle</mat-icon>
          {{ user.name }}
        </button>
        <mat-menu #menu="matMenu">
          <button mat-menu-item routerLink="/settings">
            <mat-icon>settings</mat-icon> Настройки
          </button>
          <button mat-menu-item (click)="authService.logout()">
            <mat-icon>logout</mat-icon> Выйти
          </button>
        </mat-menu>
      }
    </mat-toolbar>
  `,
})
export class HeaderComponent {
  constructor(public authService: AuthService) {}
}
