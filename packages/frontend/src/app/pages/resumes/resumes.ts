import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { ResumeService } from '../../core/services/resume.service';
import { ResumeDoc } from '../../core/models/types';
import { ResumeNameDialogComponent } from './resume-name-dialog';

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

  private resumeService = inject(ResumeService);
  private dialog = inject(MatDialog);

  ngOnInit() {
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

  upload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Имя файла без расширения — подсказка по умолчанию, пользователь может его поправить.
    const suggested = file.name.replace(/\.[^.]+$/, '') || 'Резюме';
    const dialogRef = this.dialog.open(ResumeNameDialogComponent, {
      width: '380px',
      data: { suggestedName: suggested },
    });

    dialogRef.afterClosed().subscribe((name?: string) => {
      input.value = '';
      if (!name) return;
      this.resumeService.uploadResume(file, name).subscribe({
        next: () => this.load(),
        error: (err) => {
          this.error.set(err?.message || 'Ошибка загрузки файла');
        },
      });
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
