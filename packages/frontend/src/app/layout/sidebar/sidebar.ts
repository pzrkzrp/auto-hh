import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [MatSidenavModule, MatListModule, MatIconModule, RouterLink, RouterLinkActive],
  template: `
    <div class="sidebar-header">
      <h2>🤖 auto-hh</h2>
    </div>
    <mat-nav-list>
      <a mat-list-item routerLink="/dashboard" routerLinkActive="active-link">
        <mat-icon matListItemIcon>dashboard</mat-icon>
        <span matListItemTitle>Дашборд</span>
      </a>
      <a mat-list-item routerLink="/search" routerLinkActive="active-link">
        <mat-icon matListItemIcon>search</mat-icon>
        <span matListItemTitle>Поиск</span>
      </a>
      <a mat-list-item routerLink="/digest" routerLinkActive="active-link">
        <mat-icon matListItemIcon>assignment</mat-icon>
        <span matListItemTitle>Дайджест</span>
      </a>
      <a mat-list-item routerLink="/apply-queue" routerLinkActive="active-link">
        <mat-icon matListItemIcon>send</mat-icon>
        <span matListItemTitle>Отклики</span>
      </a>
      <a mat-list-item routerLink="/history" routerLinkActive="active-link">
        <mat-icon matListItemIcon>history</mat-icon>
        <span matListItemTitle>История</span>
      </a>
      <mat-divider></mat-divider>
      <a mat-list-item routerLink="/resumes" routerLinkActive="active-link">
        <mat-icon matListItemIcon>description</mat-icon>
        <span matListItemTitle>Резюме</span>
      </a>
      <a mat-list-item routerLink="/grade" routerLinkActive="active-link">
        <mat-icon matListItemIcon>stars</mat-icon>
        <span matListItemTitle>Оценка</span>
      </a>
      <mat-divider></mat-divider>
      <a mat-list-item routerLink="/config" routerLinkActive="active-link">
        <mat-icon matListItemIcon>settings</mat-icon>
        <span matListItemTitle>Конфиг</span>
      </a>
      <a mat-list-item routerLink="/settings" routerLinkActive="active-link">
        <mat-icon matListItemIcon>person</mat-icon>
        <span matListItemTitle>Профиль</span>
      </a>
    </mat-nav-list>
  `,
  styles: [`
    .sidebar-header { padding: 16px; text-align: center; border-bottom: 1px solid rgba(0,0,0,0.12); }
    .sidebar-header h2 { margin: 0; font-size: 18px; }
    .active-link { background: rgba(63, 81, 181, 0.12) !important; }
  `],
})
export class SidebarComponent {}
