import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';

@Component({
  selector: 'app-grade',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatSelectModule, MatFormFieldModule],
  template: `
    <div class="page-container">
      <h1>Оценка резюме</h1>
      @if (loading) { <div class="loading-container"><mat-spinner></mat-spinner></div> }
      @else if (!resumes.length) { <div class="empty-state"><mat-icon>description</mat-icon><h3>Нет резюме</h3></div> }
      @else if (!result && !grading) {
        <mat-form-field appearance="outline" style="width:100%; max-width:400px;"><mat-label>Резюме</mat-label><mat-select [(value)]="selectedId">@for (r of resumes; track r.resumeId) { <mat-option [value]="r.resumeId">{{ r.name }}</mat-option> }</mat-select></mat-form-field>
        <br/><button mat-raised-button color="primary" [disabled]="!selectedId" (click)="grade()">Оценить</button>
      } @else if (grading) { <div class="loading-container"><mat-spinner></mat-spinner><p>AI анализирует...</p></div> }
      @else if (result) {
        <mat-card><mat-card-content>
          <h2>Общая оценка: {{ result.overallScore }}/100</h2>
          <p>{{ result.overallAssessment }}</p>
          @if (result.strengths?.length) { <h3>Сильные стороны</h3><ul>@for (s of result.strengths; track s) { <li>{{ s }}</li> }</ul> }
          @if (result.weaknesses?.length) { <h3>Слабые стороны</h3><ul>@for (w of result.weaknesses; track w) { <li>{{ w }}</li> }</ul> }
        </mat-card-content></mat-card>
      }
    </div>
  `,
})
export class GradePageComponent implements OnInit {
  resumes: any[] = []; selectedId = ''; result: any = null; grading = false; loading = true;

  constructor(private http: HttpClient) {}

  ngOnInit() { this.http.get<any[]>('http://localhost:3001/api/resumes').subscribe({ next: r => { this.resumes = r; this.loading = false; } }); }

  grade() { this.grading = true; this.http.post('http://localhost:3001/api/grade', { resumeId: this.selectedId }).subscribe({ next: () => this.grading = false, error: () => this.grading = false }); }
}
