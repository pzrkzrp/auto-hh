import { Component, OnInit, WritableSignal, computed, inject, signal } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import { form, required, FormRoot, FormField } from '@angular/forms/signals';
import { ResumeService } from '../../core/services/resume.service';
import { ConfigService } from '../../core/services/config.service';
import { ResumeDoc } from '../../core/models/types';

// Чип-поле конструктора запроса (вкладка «Конструктор запроса»).
type ChipField = 'title' | 'description' | 'excludedWords' | 'excludedCompanies';

// Форма конфига: /config/new — создание (имя + «Создать»), /config/:id —
// редактирование (имя + панель с вкладками «Параметры запуска»/«Конструктор
// запроса»). После создания — редирект на /config/:id.
@Component({
  selector: 'app-config',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatFormFieldModule, MatInputModule, MatSelectModule, FormRoot, FormField],
  templateUrl: './config.html',
  styleUrls: ['./config.scss'],
})
export class ConfigPageComponent implements OnInit {
  // id === 'new' — режим создания; иначе редактирование существующего конфига.
  configId = signal<string>('new');
  isNew = signal(false);

  // Активная вкладка панели. По умолчанию «Конструктор запроса» — как в дизайне.
  activeTab = signal<'launch' | 'query'>('query');

  private nameModel = signal({ name: '' });
  nameForm = form(this.nameModel, (f) => required(f.name));

  // Сигнальные формы (@angular/forms/signals): model — WritableSignal, form()
  // оборачивает его в FieldTree для привязки в шаблоне через [formRoot]/[formField].
  private searchModel = signal({ text: '', max_pages: 5, per_page: 50 });
  private applyModel = signal({ maxPerRun: 50, minClaudeScore: 7, coverLetterTemplate: '' });

  searchForm = form(this.searchModel);
  applyForm = form(this.applyModel);

  loading = signal(false);
  creating = signal(false);
  error = signal('');

  // Резюме: список доступных + выбранное (resumeId из коллекции resumes).
  resumes = signal<ResumeDoc[]>([]);
  selectedResumeId = signal<string>('');

  // ── Конструктор запроса ──────────────────────────────────────────────
  // Четыре чип-группы по дизайну. Сохраняются в filter.*, а собранный
  // hh-запрос — в search.text (реально уходит в hh.ru как text-параметр).
  titleKeywords = signal<string[]>([]);        // → NAME:(...)
  descriptionKeywords = signal<string[]>([]);  // → DESCRIPTION:(...)
  excludedWords = signal<string[]>([]);        // → NOT (...) + filter.excludedKeywords
  excludedCompanies = signal<string[]>([]);    // → filter.excludedCompanies (локальный фильтр)
  excludeArchived = signal(true);              // контрола в дизайне нет — значение сохраняем молча

  drafts = signal<Record<ChipField, string>>({
    title: '',
    description: '',
    excludedWords: '',
    excludedCompanies: '',
  });

  private chipSignals: Record<ChipField, WritableSignal<string[]>> = {
    title: this.titleKeywords,
    description: this.descriptionKeywords,
    excludedWords: this.excludedWords,
    excludedCompanies: this.excludedCompanies,
  };

  // Превью запроса hh.ru: собирается из чипсов на лету (как в дизайне).
  readonly queryPreview = computed(() => {
    const parts: string[] = [];
    const title = this.titleKeywords();
    const desc = this.descriptionKeywords();
    const excluded = this.excludedWords();
    if (title.length) parts.push(`NAME:(${title.join(' OR ')})`);
    if (desc.length) parts.push(`DESCRIPTION:(${desc.join(' OR ')})`);
    if (excluded.length) parts.push(`NOT (${excluded.join(' OR ')})`);
    return parts.join(' AND ');
  });

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
        this.applyModel.set({ ...this.applyModel(), ...(cfg.apply || {}) });
        if (cfg.resume) this.selectedResumeId.set(cfg.resume);

        const filter = cfg.filter || {};
        this.titleKeywords.set(filter.titleKeywords || []);
        // Легаси: старый requiredSkills (мёртвое поле) переносим в descriptionKeywords.
        this.descriptionKeywords.set(filter.descriptionKeywords ?? filter.requiredSkills ?? []);
        this.excludedWords.set(filter.excludedKeywords || []);
        this.excludedCompanies.set(filter.excludedCompanies || []);
        this.excludeArchived.set(filter.excludeArchived ?? true);
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
      error: (err) => {
        console.log(err);
      },
    });
  }

  // Сохранение секции «Параметры запуска» (search/apply). Значение отдаёт
  // сигнальная форма целиком — чтобы $set не затёр остальные поля секции.
  saveSection(section: 'search' | 'apply', value: any) {
    this.configService.updateSection(this.configId(), section, value).subscribe({
      next: () => this.snackBar.open('Сохранено', 'OK', { duration: 2000 }),
      error: () => this.error.set('Ошибка сохранения'),
    });
  }

  // ── Конструктор запроса: действия ────────────────────────────────────
  addChip(field: ChipField, raw: string) {
    const value = raw.trim();
    if (!value) return;
    const current = this.chipSignals[field]();
    if (current.some((c) => c.toLowerCase() === value.toLowerCase())) return;
    this.chipSignals[field].update((list) => [...list, value]);
    this.drafts.update((d) => ({ ...d, [field]: '' }));
  }

  removeChip(field: ChipField, index: number) {
    this.chipSignals[field].update((list) => list.filter((_, i) => i !== index));
  }

  onDraftInput(field: ChipField, event: Event) {
    this.drafts.update((d) => ({ ...d, [field]: (event.target as HTMLInputElement).value }));
  }

  // Enter в поле «Добавить слово/компанию...» добавляет чип.
  onDraftEnter(field: ChipField, event: Event) {
    event.preventDefault();
    this.addChip(field, (event.target as HTMLInputElement).value);
  }

  // «Сбросить» — очищает локальное состояние конструктора (без сохранения).
  resetBuilder() {
    for (const field of Object.keys(this.chipSignals) as ChipField[]) {
      this.chipSignals[field].set([]);
    }
    this.drafts.set({ title: '', description: '', excludedWords: '', excludedCompanies: '' });
  }

  // «Сохранить запрос»: filter-секция + собранный hh-запрос в search.text.
  saveBuilder() {
    const filter = {
      titleKeywords: this.titleKeywords(),
      descriptionKeywords: this.descriptionKeywords(),
      excludedKeywords: this.excludedWords(),
      excludedCompanies: this.excludedCompanies(),
      excludeArchived: this.excludeArchived(),
    };
    // Полный search-объект (не только text), чтобы не затереть остальные поля.
    const search = { ...this.searchForm().value(), text: this.queryPreview() };
    forkJoin([
      this.configService.updateSection(this.configId(), 'filter', filter),
      this.configService.updateSection(this.configId(), 'search', search),
    ]).subscribe({
      next: () => this.snackBar.open('Запрос сохранён', 'OK', { duration: 2000 }),
      error: () => this.error.set('Ошибка сохранения запроса'),
    });
  }
}
