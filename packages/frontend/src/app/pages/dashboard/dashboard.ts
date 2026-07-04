import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardService } from '../../core/services/dashboard.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
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
}