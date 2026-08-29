import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { DashboardService } from '../../core/services/dashboard.service';

type StatCard = { label: string; value: string; accent?: boolean };

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, MatIconModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
})
export class DashboardPageComponent implements OnInit {
  stats = { totalSeen: 0, totalApplied: 0, todaySeen: 0, todayApplied: 0 };
  latestDigest: any = null;
  queueCount = 0;
  loading = true;
  error = '';
  private dashboard = inject(DashboardService);

  ngOnInit() {
    this.dashboard.loadDashboard().subscribe({
      next: ({ queue, digest, stats }) => {
        this.queueCount = queue.length;
        this.latestDigest = digest;
        this.stats = stats;
        this.loading = false;
      },
      error: (err: any) => {
        this.error = err?.message || 'Ошибка загрузки дашборда';
        this.loading = false;
      },
    });
  }

  get statCards(): StatCard[] {
    const fmt = (n?: number) => (n ?? 0).toLocaleString('ru-RU');
    return [
      { label: 'Просмотрено', value: fmt(this.stats.totalSeen) },
      { label: 'Откликов', value: fmt(this.stats.totalApplied) },
      { label: 'Сегодня', value: `+${fmt(this.stats.todayApplied)}`, accent: true },
      { label: 'В очереди', value: fmt(this.queueCount) },
    ];
  }
}
