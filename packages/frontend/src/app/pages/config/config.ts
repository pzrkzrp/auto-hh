import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormBuilder, ReactiveFormsModule, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-config',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTabsModule, MatFormFieldModule, MatInputModule, MatSlideToggleModule, ReactiveFormsModule],
  template: `
    <div class="page-container">
      <h1>Конфигурация</h1>
      @if (loading) { <div class="loading-container"><mat-spinner></mat-spinner></div> }
      @else if (error) { <div class="error-state"><mat-icon>error</mat-icon><p>{{ error }}</p></div> }
      @else {
        <mat-tab-group>
          <mat-tab label="Поиск"><form [formGroup]="searchForm" style="padding:16px; display:flex; flex-direction:column; gap:8px; max-width:600px;">
            <mat-form-field appearance="outline"><mat-label>Запрос</mat-label><input matInput formControlName="text" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Страниц</mat-label><input matInput type="number" formControlName="max_pages" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>На странице</mat-label><input matInput type="number" formControlName="per_page" /></mat-form-field>
            <button mat-raised-button color="primary" (click)="saveSection('search', searchForm.value)">Сохранить</button>
          </form></mat-tab>
          <mat-tab label="Фильтр"><form [formGroup]="filterForm" style="padding:16px; display:flex; flex-direction:column; gap:8px; max-width:600px;">
            <mat-form-field appearance="outline"><mat-label>Навыки (через запятую)</mat-label><input matInput formControlName="requiredSkills" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Исключённые слова</mat-label><input matInput formControlName="excludedKeywords" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Исключённые компании</mat-label><input matInput formControlName="excludedCompanies" /></mat-form-field>
            <mat-slide-toggle formControlName="excludeArchived">Исключать архивные</mat-slide-toggle>
            <button mat-raised-button color="primary" (click)="saveSection('filter', filterForm.value)">Сохранить</button>
          </form></mat-tab>
          <mat-tab label="Отклик"><form [formGroup]="applyForm" style="padding:16px; display:flex; flex-direction:column; gap:8px; max-width:600px;">
            <mat-form-field appearance="outline"><mat-label>Макс. в дайджест</mat-label><input matInput type="number" formControlName="maxPerRun" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Мин. AI-score</mat-label><input matInput type="number" formControlName="minClaudeScore" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Шаблон письма</mat-label><textarea matInput formControlName="coverLetterTemplate" rows="4"></textarea></mat-form-field>
            <button mat-raised-button color="primary" (click)="saveSection('apply', applyForm.value)">Сохранить</button>
          </form></mat-tab>
        </mat-tab-group>
      }
    </div>
  `,
})
export class ConfigPageComponent implements OnInit {
  searchForm: FormGroup; filterForm: FormGroup; applyForm: FormGroup;
  loading = true; error = '';

  constructor(private http: HttpClient, private fb: FormBuilder, private snackBar: MatSnackBar) {
    this.searchForm = this.fb.group({ text: [''], max_pages: [5], per_page: [50] });
    this.filterForm = this.fb.group({ requiredSkills: [''], excludedKeywords: [''], excludedCompanies: [''], excludeArchived: [true] });
    this.applyForm = this.fb.group({ maxPerRun: [50], minClaudeScore: [7], coverLetterTemplate: [''] });
  }

  ngOnInit() {
    this.http.get<any>('http://localhost:3001/api/config').subscribe({
      next: cfg => {
        this.searchForm.patchValue(cfg.search || {});
        this.filterForm.patchValue({ requiredSkills: (cfg.filter?.requiredSkills || []).join(', '), excludedKeywords: (cfg.filter?.excludedKeywords || []).join(', '), excludedCompanies: (cfg.filter?.excludedCompanies || []).join(', '), excludeArchived: cfg.filter?.excludeArchived ?? true });
        this.applyForm.patchValue(cfg.apply || {});
        this.loading = false;
      },
      error: () => { this.error = 'Ошибка'; this.loading = false; },
    });
  }

  saveSection(section: string, value: any) {
    if (section === 'filter') {
      value.requiredSkills = value.requiredSkills.split(',').map((s: string) => s.trim()).filter(Boolean);
      value.excludedKeywords = value.excludedKeywords.split(',').map((s: string) => s.trim()).filter(Boolean);
      value.excludedCompanies = value.excludedCompanies.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
    this.http.put(`http://localhost:3001/api/config/${section}`, value).subscribe({ next: () => this.snackBar.open('Сохранено', 'OK', { duration: 2000 }) });
  }
}
