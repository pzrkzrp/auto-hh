import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-apply-queue',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="page-container">
      <h1>Очередь откликов</h1>
      <p style="color:rgba(0,0,0,0.6);">Отклики через CLI: <code>auto-hh apply --queue</code></p>
      @if (loading) { <div class="loading-container"><mat-spinner></mat-spinner></div> }
      @else if (error) { <div class="error-state"><mat-icon>error</mat-icon><p>{{ error }}</p></div> }
      @else if (!items.length) { <div class="empty-state"><mat-icon>send</mat-icon><h3>Очередь пуста</h3></div> }
      @else {
        @for (item of items; track item._id) {
          <mat-card class="vacancy-card">
            <mat-card-content>
              <div style="display:flex; align-items:center; gap:12px;">
                <span class="status-badge" [class]="item.status">{{ statusLabels[item.status] || item.status }}</span>
                <div style="flex:1;"><strong>{{ item.title }}</strong><p>{{ item.employer }} · {{ item.salary }}</p></div>
                <button mat-icon-button color="warn" (click)="remove(item._id)"><mat-icon>delete</mat-icon></button>
              </div>
            </mat-card-content>
          </mat-card>
        }
      }
    </div>
  `,
})
export class ApplyQueuePageComponent implements OnInit {
  items: any[] = []; loading = true; error = '';
  statusLabels: Record<string, string> = { queued: 'Ожидает', processing: 'В процессе', success: 'Успех', failed: 'Ошибка', skipped: 'Пропущено' };

  constructor(private http: HttpClient) {}

  ngOnInit() { this.load(); }

  load() {
    this.http.get<any[]>('http://localhost:3001/api/apply-queue').subscribe({ next: r => { this.items = r; this.loading = false; }, error: () => { this.error = 'Ошибка'; this.loading = false; } });
  }

  remove(id: string) {
    this.http.delete(`http://localhost:3001/api/apply-queue/${id}`).subscribe(() => this.load());
  }
}
