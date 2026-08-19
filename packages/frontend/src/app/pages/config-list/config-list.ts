import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ConfigService } from '../../core/services/config.service';
import { ConfigSummary } from '../../core/models/types';

// Страница /config — список конфигов пользователя. «Добавить» ведёт на форму
// (/config/new), карточка — на редактирование (/config/:id).
@Component({
  selector: 'app-config-list',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './config-list.html',
  styleUrls: ['./config-list.scss'],
})
export class ConfigListPageComponent implements OnInit {
  items = signal<ConfigSummary[]>([]);
  loading = signal(true);
  error = signal('');

  private configService = inject(ConfigService);

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
