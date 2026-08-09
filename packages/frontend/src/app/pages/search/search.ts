import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatChipsModule, MatFormFieldModule, MatInputModule],
  template: `
    <div class="page-container">
      <h1>Поиск вакансий</h1>

      <mat-card class="trigger-card">
        <mat-card-content style="display:flex; gap:12px; align-items:center;">
          <mat-form-field appearance="outline" style="flex:1;">
            <mat-label>Запрос</mat-label>
            <input matInput #query placeholder="Например: React разработчик" (keyup.enter)="runSearch(query.value)">
          </mat-form-field>
          <button mat-raised-button color="primary" [disabled]="running" (click)="runSearch(query.value)">
            Запустить поиск
          </button>
          @if (running) { <mat-spinner diameter="24" style="margin-left:4px;"></mat-spinner> }
        </mat-card-content>
      </mat-card>

      @if (loading) { <div class="loading-container"><mat-spinner></mat-spinner></div> }
      @else if (error) { <div class="error-state"><mat-icon>error</mat-icon><p>{{ error }}</p></div> }
      @else if (!results?.items?.length) {
        <div class="empty-state"><mat-icon>search_off</mat-icon><h3>Нет результатов</h3><p>Запустите поиск — результаты появятся здесь</p></div>
      } @else {
        <p>Найдено: {{ results.total }} | Отбраковано: {{ results.rejectedTotal || 0 }}</p>
        @for (entry of results.items; track entry.id) {
          <mat-card class="vacancy-card">
            <mat-card-content>
              <div style="display:flex; align-items:center; gap:12px;">
                <div class="score-badge" [class]="entry.score >= 8 ? 'high' : entry.score >= 6 ? 'medium' : 'low'">{{ entry.score }}</div>
                <div style="flex:1;">
                  <strong>{{ entry.title }}</strong>
                  <p>{{ entry.employer }} · {{ entry.area }} · {{ entry.salary }}</p>
                  <div class="matched-skills">@for (skill of entry.matchedSkills; track skill) { <mat-chip-row>{{ skill }}</mat-chip-row> }</div>
                </div>
                <button mat-raised-button color="primary" (click)="addToQueue(entry)">В очередь</button>
              </div>
            </mat-card-content>
          </mat-card>
        }
      }
    </div>
  `,
})
export class SearchPageComponent implements OnInit {
  results: any = null;
  loading = true;
  error = '';
  running = false;
  private timer: any = null;

  constructor(private http: HttpClient, private snackBar: MatSnackBar) {}

  ngOnInit() { this.load(); }

  load() {
    this.http.get<any>('http://localhost:3001/api/search/results').subscribe({
      next: r => { this.results = r; this.loading = false; },
      error: () => { this.error = 'Ошибка загрузки'; this.loading = false; },
    });
  }

  // Запуск поиска: backend ставит джобу в BullMQ, CLI-воркер (auto-hh search --worker) выполняет.
  runSearch(text: string) {
    if (!text?.trim() || this.running) return;
    this.running = true;
    this.error = '';
    this.http.post<any>('http://localhost:3001/api/search/jobs', {
      config: { search: { text: text.trim() } },
    }).subscribe({
      next: job => this.pollJob(job.jobId),
      error: () => {
        this.running = false;
        this.error = 'Не удалось запустить поиск';
        this.snackBar.open('Ошибка запуска поиска', 'OK', { duration: 3000 });
      },
    });
  }

  // Поллинг статуса джобы каждые ~3с до completed/failed.
  private pollJob(jobId: string) {
    const check = () => {
      this.http.get<any>(`http://localhost:3001/api/search/jobs/${jobId}`).subscribe({
        next: job => {
          if (job.status === 'completed' || job.status === 'failed') {
            this.running = false;
            if (job.status === 'failed') {
              this.snackBar.open(`Поиск завершился с ошибкой: ${job.result?.error || 'неизвестно'}`, 'OK', { duration: 5000 });
            } else {
              this.load();
            }
          } else {
            this.timer = setTimeout(check, 3000);
          }
        },
        error: () => {
          this.running = false;
          this.error = 'Ошибка при проверке статуса';
        },
      });
    };
    check();
  }

  addToQueue(entry: any) {
    this.http.post('http://localhost:3001/api/apply-queue', { items: [entry] }).subscribe({
      next: () => this.snackBar.open('Добавлено', 'OK', { duration: 2000 }),
    });
  }
}
