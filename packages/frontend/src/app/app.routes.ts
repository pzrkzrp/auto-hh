import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { MainLayoutComponent } from './layout/main-layout/main-layout';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login').then(m => m.LoginPageComponent) },
  { path: 'register', loadComponent: () => import('./pages/register/register').then(m => m.RegisterPageComponent) },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.DashboardPageComponent) },
      { path: 'search', loadComponent: () => import('./pages/search/search').then(m => m.SearchPageComponent) },
      { path: 'digest', loadComponent: () => import('./pages/digest/digest').then(m => m.DigestPageComponent) },
      { path: 'apply-queue', loadComponent: () => import('./pages/apply-queue/apply-queue').then(m => m.ApplyQueuePageComponent) },
      { path: 'history', loadComponent: () => import('./pages/history/history').then(m => m.HistoryPageComponent) },
      { path: 'resumes', loadComponent: () => import('./pages/resumes/resumes').then(m => m.ResumeListPageComponent) },
      { path: 'grade', loadComponent: () => import('./pages/grade/grade').then(m => m.GradePageComponent) },
      { path: 'config', loadComponent: () => import('./pages/config/config').then(m => m.ConfigPageComponent) },
      { path: 'settings', loadComponent: () => import('./pages/settings/settings').then(m => m.SettingsPageComponent) },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
