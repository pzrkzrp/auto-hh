import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Применяем тему до первого рендера, чтобы не мигнула светлая. Логика та же,
// что в ThemeService (localStorage, иначе системная) — на экране логина
// (без сайдбара с переключателем) тема уже корректная.
const saved = localStorage.getItem('auto-hh-theme');
const dark =
  saved === 'dark' ||
  (saved !== 'light' && (window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false));
document.documentElement.classList.toggle('dark-theme', dark);

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
