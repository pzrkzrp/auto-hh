import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [MatCardModule, MatIconModule, MatTableModule, MatProgressSpinnerModule, DatePipe],
  template: `
    <div class="page-container">
      <h1>История</h1>
      @if (loading) { <div class="loading-container"><mat-spinner></mat-spinner></div> }
      @else if (!items.length) { <div class="empty-state"><mat-icon>history</mat-icon><h3>История пуста</h3></div> }
      @else {
        <table mat-table [dataSource]="items" style="width:100%;">
          <ng-container matColumnDef="vacancyId"><th mat-header-cell *matHeaderCellDef>ID</th><td mat-cell *matCellDef="let row">{{ row.vacancyId }}</td></ng-container>
          <ng-container matColumnDef="status"><th mat-header-cell *matHeaderCellDef>Статус</th><td mat-cell *matCellDef="let row"><span class="status-badge" [class.success]="row.status==='applied'" [class.queued]="row.status==='seen'">{{ row.status === 'applied' ? 'Отклик' : 'Просмотр' }}</span></td></ng-container>
          <ng-container matColumnDef="title"><th mat-header-cell *matHeaderCellDef>Вакансия</th><td mat-cell *matCellDef="let row">{{ row.meta?.title || '—' }}</td></ng-container>
          <ng-container matColumnDef="employer"><th mat-header-cell *matHeaderCellDef>Компания</th><td mat-cell *matCellDef="let row">{{ row.meta?.employer || '—' }}</td></ng-container>
          <ng-container matColumnDef="at"><th mat-header-cell *matHeaderCellDef>Дата</th><td mat-cell *matCellDef="let row">{{ row.at | date:'short' }}</td></ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns;"></tr>
        </table>
      }
    </div>
  `,
})
export class HistoryPageComponent implements OnInit {
  items: any[] = []; loading = true; columns = ['vacancyId', 'status', 'title', 'employer', 'at'];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.http.get<any>('http://localhost:3001/api/history').subscribe({ next: r => { this.items = r.items || []; this.loading = false; }, error: () => this.loading = false });
  }
}
