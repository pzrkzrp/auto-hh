import { Injectable, signal } from '@angular/core';

const THEME_KEY = 'auto-hh-theme';

// Тема приложения: light/dark. Выбор хранится в localStorage; при первом запуске
// (без сохранённого значения) берётся системная тема. Класс .dark-theme
// вешается на <html> — на него завязаны Material-тема и переопределения в styles.scss.
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly dark = signal<boolean>(this.loadInitial());

  constructor() {
    this.apply();
  }

  toggle() {
    this.dark.set(!this.dark());
    localStorage.setItem(THEME_KEY, this.dark() ? 'dark' : 'light');
    this.apply();
  }

  private apply() {
    document.documentElement.classList.toggle('dark-theme', this.dark());
  }

  private loadInitial(): boolean {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }
}
