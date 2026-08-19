import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { form, required, FormRoot, FormField } from '@angular/forms/signals';
import { ResumeService } from '../../core/services/resume.service';
import { ConfigService } from '../../core/services/config.service';
import { ResumeDoc } from '../../core/models/types';

// Форма конфига: /config/new — создание (имя + «Создать»), /config/:id —
// редактирование (имя + 4 вкладки секций). После создания — редирект на /config/:id.
@Component({
  selector: 'app-config',
  standalone: true,
  imports: [RouterLink, MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTabsModule, MatFormFieldModule, MatInputModule, MatSlideToggleModule, MatSelectModule, FormRoot, FormField],
  templateUrl: './config.html',
  styleUrls: ['./config.scss'],
})
export class ConfigPageComponent implements OnInit {
  // id === 'new' — режим создания; иначе редактирование существующего конфига.
  configId = signal<string>('new');
  isNew = signal(false);

  private nameModel = signal({ name: '' });
  nameForm = form(this.nameModel, (f) => required(f.name));

  // Сигнальные формы (@angular/forms/signals): model — WritableSignal, form()
  // оборачивает его в FieldTree для привязки в шаблоне через [formRoot]/[formField].
  private searchModel = signal({ text: '', max_pages: 5, per_page: 50 });
  private filterModel = signal({ requiredSkills: '', excludedKeywords: '', excludedCompanies: '', excludeArchived: true });
  private applyModel = signal({ maxPerRun: 50, minClaudeScore: 7, coverLetterTemplate: '' });

  searchForm = form(this.searchModel);
  filterForm = form(this.filterModel);
  applyForm = form(this.applyModel);

  loading = signal(false);
  creating = signal(false);
  error = signal('');

  // Резюме: список доступных + выбранное (resumeId из коллекции resumes).
  resumes = signal<ResumeDoc[]>([]);
  selectedResumeId = signal<string>('');

  private configService = inject(ConfigService);
  private resumeService = inject(ResumeService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id') || 'new';
      this.configId.set(id);
      this.isNew.set(id === 'new');
      if (id === 'new') {
        this.loading.set(false);
      } else {
        this.loadConfig(id);
      }
    });
    this.resumeService.loadResumes().subscribe({
      next: (resumes) => this.resumes.set(resumes),
    });
  }

  loadConfig(id: string) {
    this.loading.set(true);
    this.error.set('');
    this.configService.getConfig(id).subscribe({
      next: cfg => {
        this.nameModel.set({ name: cfg.name || '' });
        this.searchModel.set({ ...this.searchModel(), ...(cfg.search || {}) });
        this.filterModel.set({
          requiredSkills: (cfg.filter?.requiredSkills || []).join(', '),
          excludedKeywords: (cfg.filter?.excludedKeywords || []).join(', '),
          excludedCompanies: (cfg.filter?.excludedCompanies || []).join(', '),
          excludeArchived: cfg.filter?.excludeArchived ?? true,
        });
        this.applyModel.set({ ...this.applyModel(), ...(cfg.apply || {}) });
        if (cfg.resume) this.selectedResumeId.set(cfg.resume);
        this.loading.set(false);
      },
      error: () => { this.error.set('Ошибка загрузки конфига'); this.loading.set(false); },
    });
  }

  // Создание: POST /api/config → редирект на /config/:id.
  createConfig() {
    const name = this.nameForm().value().name.trim();
    if (!name) return;
    this.creating.set(true);
    this.configService.createConfig(name).subscribe({
      next: (created) => {
        this.snackBar.open('Создано', 'OK', { duration: 2000 });
        this.router.navigate(['/config', created._id]);
      },
      error: () => { this.error.set('Ошибка создания конфига'); this.creating.set(false); },
    });
  }

  saveName() {
    const name = this.nameForm().value().name.trim();
    if (!name) return;
    this.configService.updateConfig(this.configId(), { name }).subscribe({
      next: () => this.snackBar.open('Сохранено', 'OK', { duration: 2000 }),
      error: () => this.error.set('Ошибка сохранения имени'),
    });
  }

  saveResume() {
    const resumeId = this.selectedResumeId();
    if (!resumeId) return;
    this.configService.updateResume(this.configId(), resumeId).subscribe({
      next: () => this.snackBar.open('Сохранено', 'OK', { duration: 2000 }),
      error: (err) =>{
        console.log(err)
      },
    });
  }

  saveSection(section: 'search' | 'filter' | 'apply', value: any) {
    // Для filter строки превращаем обратно в массивы. Копируем объект, чтобы
    // не мутировать модель сигнальной формы (searchForm().value() отдаёт ссылку).
    if (section === 'filter') {
      value = {
        ...value,
        requiredSkills: (value.requiredSkills as string).split(',').map((s: string) => s.trim()).filter(Boolean),
        excludedKeywords: (value.excludedKeywords as string).split(',').map((s: string) => s.trim()).filter(Boolean),
        excludedCompanies: (value.excludedCompanies as string).split(',').map((s: string) => s.trim()).filter(Boolean),
      };
    }
    this.configService.updateSection(this.configId(), section, value).subscribe({
      next: () => this.snackBar.open('Сохранено', 'OK', { duration: 2000 }),
      error: () => this.error.set('Ошибка сохранения'),
    });
  }
}
