import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ResumeService } from '../../core/services/resume.service';
import { ResumeDoc } from '../../core/models/types';
import {AuthService} from '../../core/services/auth.service';

@Component({
  selector: 'app-resumes',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './resumes.html',
  styleUrls: ['./resumes.scss'],
})
export class ResumeListPageComponent implements OnInit {
  items = signal<ResumeDoc[]>([]);
  loading = signal(true);
  error = signal('');
  activeResumeId = signal<string | undefined>(undefined);

  private resumeService = inject(ResumeService);
  private authService = inject(AuthService);

  ngOnInit() {
    // Получаем активное резюме из текущего пользователя
    const user = this.authService.currentUser$.getValue();
    this.activeResumeId.set(user?.activeResumeId);
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.resumeService.loadResumes().subscribe({
      next: (resumes) => {
        this.items.set(resumes);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Ошибка загрузки резюме');
        this.loading.set(false);
      },
    });
  }

  activate(id: string) {
    this.resumeService.activateResume(id).subscribe({
      next: () => {
        this.activeResumeId.set(id);
        this.load();
      },
      error: (err) => {
        this.error.set(err?.message || 'Ошибка активации');
      },
    });
  }

  upload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.resumeService.uploadResume(file).subscribe({
      next: () => {
        input.value = '';
        this.load();
      },
      error: (err) => {
        this.error.set(err?.message || 'Ошибка загрузки файла');
      },
    });
  }

  remove(id: string) {
    this.resumeService.deleteResume(id).subscribe({
      next: () => this.load(),
      error: (err) => {
        this.error.set(err?.message || 'Ошибка удаления');
      },
    });
  }
}
