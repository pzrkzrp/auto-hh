import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatChipsModule],
  template: `
    <div class="page-container">
      <h1>Поиск вакансий</h1>
      @if (loading) { <div class="loading-container"><mat-spinner></mat-spinner></div> }
      @else if (error) { <div class="error-state"><mat-icon>error</mat-icon><p>{{ error }}</p></div> }
      @else if (!results?.items?.length) {
        <div class="empty-state"><mat-icon>search_off</mat-icon><h3>Нет результатов</h3><p>Настройте поиск и запустите CLI</p></div>
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

  constructor(private http: HttpClient, private snackBar: MatSnackBar) {}

  ngOnInit() { this.load(); }

  load() {
    this.http.get<any>('http://localhost:3001/api/search/results').subscribe({
      next: r => { this.results = r; this.loading = false; },
      error: () => { this.error = 'Ошибка загрузки'; this.loading = false; },
    });
  }

  addToQueue(entry: any) {
    this.http.post('http://localhost:3001/api/apply-queue', { items: [entry] }).subscribe({
      next: () => this.snackBar.open('Добавлено', 'OK', { duration: 2000 }),
    });
  }
}
