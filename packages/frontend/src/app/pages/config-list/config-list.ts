import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { ConfigService } from '../../core/services/config.service';
import { ConfigSummary } from '../../core/models/types';

// Страница /config — список конфигов по дизайну Figma: бенто-сетка карточек
// (круглая иконка, имя, бейдж-тег, «Последний запуск», статус Активен/Пауза)
// + плейсхолдер «Создать новый конфиг». Карточка ведёт на /config/:id,
// меню «…» — открыть/удалить.
@Component({
  selector: 'app-config-list',
  standalone: true,
  imports: [RouterLink, MatIconModule, MatTooltipModule, MatMenuModule],
  templateUrl: './config-list.html',
  styleUrls: ['./config-list.scss'],
})
export class ConfigListPageComponent implements OnInit {
  items = signal<ConfigSummary[]>([]);
  loading = signal(true);
  error = signal('');

  private configService = inject(ConfigService);

  // Палитра круглых иконок карточки — цвет циклится по индексу (в дизайне
  // у карточек cyan/blue и т.д.).
  private palette = ['#00d2fd', '#0288d1', '#466aeb', '#7b1fa2', '#00695c'];

  private months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.configService.listConfigs().subscribe({
      next: (res) => {
        this.items.set(res.configs);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Ошибка загрузки конфигов');
        this.loading.set(false);
      },
    });
  }

  // Цвет иконки карточки по индексу в сетке.
  iconColor(i: number): string {
    return this.palette[i % this.palette.length];
  }

  // Бейдж-тег карточки — короткая версия search.text. В дизайне это место/тег
  // («Remote», «Moscow»), у нас единственный реальный текст конфига — его запрос.
  badgeText(c: ConfigSummary): string {
    const t = (c.searchText || '').trim();
    if (!t) return '';
    return t.length > 22 ? `${t.slice(0, 22).trimEnd()}…` : t;
  }

  // Относительное время: «только что», «5 мин назад», «2 часа назад», «вчера»,
  // «3 дня назад» или дата «24 окт 2025». Как в дизайне («2 часа назад»/«вчера»).
  relativeTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const min = Math.floor((Date.now() - d.getTime()) / 60000);
    if (min < 1) return 'только что';
    if (min < 60) return `${min} ${this.plural(min, 'минуту', 'минуты', 'минут')} назад`;
    const hours = Math.floor(min / 60);
    if (hours < 24) return `${hours} ${this.plural(hours, 'час', 'часа', 'часов')} назад`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'вчера';
    if (days < 7) return `${days} ${this.plural(days, 'день', 'дня', 'дней')} назад`;
    return `${d.getDate()} ${this.months[d.getMonth()]} ${d.getFullYear()}`;
  }

  // Русская плюрализация: 1 час / 2 часа / 5 часов.
  private plural(n: number, one: string, few: string, many: string): string {
    const n10 = n % 10;
    const n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
    return many;
  }

  remove(id: string) {
    if (!confirm('Удалить конфиг?')) return;
    this.configService.deleteConfig(id).subscribe({
      next: () => this.load(),
      error: (err) => {
        this.error.set(err?.message || 'Ошибка удаления');
      },
    });
  }
}
