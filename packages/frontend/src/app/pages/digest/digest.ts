import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-digest',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTabsModule],
  template: `
    <div class="page-container">
      <h1>Дайджест</h1>
      <mat-tab-group>
        <mat-tab label="Подходящие">
          @if (loading) { <div class="loading-container"><mat-spinner></mat-spinner></div> }
          @else if (!digests.length) { <div class="empty-state"><mat-icon>inbox</mat-icon><h3>Нет дайджестов</h3></div> }
          @else {
            @for (d of digests; track d.date) {
              <h3>{{ d.date }} ({{ d.entries.length }})</h3>
              @for (e of d.entries; track e.id) {
                <mat-card class="vacancy-card">
                  <mat-card-content>
                    <div style="display:flex; align-items:center; gap:12px;">
                      <div class="score-badge" [class]="e.score >= 8 ? 'high' : e.score >= 6 ? 'medium' : 'low'">{{ e.score }}</div>
                      <div style="flex:1;"><strong>{{ e.title }}</strong><p>{{ e.employer }} · {{ e.salary }}</p></div>
                      <button mat-raised-button color="primary" (click)="addToQueue(e)">В очередь</button>
                    </div>
                  </mat-card-content>
                </mat-card>
              }
            }
          }
        </mat-tab>
        <mat-tab label="Отбракованные">
          @for (d of rejected; track d.date) {
            <h3>{{ d.date }} ({{ d.entries.length }})</h3>
            @for (e of d.entries; track e.id) {
              <mat-card class="vacancy-card"><mat-card-content><strong>{{ e.title }}</strong> @ {{ e.employer }}<p style="color:#d32f2f;">{{ e.reason }}</p></mat-card-content></mat-card>
            }
          }
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
})
export class DigestPageComponent implements OnInit {
  digests: any[] = []; rejected: any[] = []; loading = true;

  constructor(private http: HttpClient, private snackBar: MatSnackBar) {}

  ngOnInit() {
    this.http.get<any[]>('http://localhost:3001/api/digest').subscribe({ next: r => { this.digests = r; this.loading = false; }, error: () => this.loading = false });
    this.http.get<any[]>('http://localhost:3001/api/digest/rejected').subscribe({ next: r => this.rejected = r });
  }

  addToQueue(entry: any) {
    this.http.post('http://localhost:3001/api/apply-queue', { items: [entry] }).subscribe({
      next: () => this.snackBar.open('Добавлено', 'OK', { duration: 2000 }),
    });
  }
}
