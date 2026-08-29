import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of, throwError } from 'rxjs';
import { ResumeDoc } from '../models/types';

@Injectable({ providedIn: 'root' })
export class ResumeService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3001/api/resumes';

  loadResumes() {
    return this.http.get<ResumeDoc[]>(this.apiUrl).pipe(
      catchError((err) => {
        console.error('[ResumeService] loadResumes failed:', err);
        return of([]);
      }),
    );
  }

  uploadResume(file: File, name: string) {
    const form = new FormData();
    form.append('file', file);
    form.append('name', name);
    return this.http.post<ResumeDoc>(this.apiUrl, form).pipe(
      catchError((err) => {
        console.error('[ResumeService] uploadResume failed:', err);
        return throwError(() => err);
      }),
    );
  }

  deleteResume(id: string) {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      catchError((err) => {
        console.error('[ResumeService] deleteResume failed:', err);
        return throwError(() => err);
      }),
    );
  }

  // Байты файла резюме — для кнопки «Скачать» на карточке.
  downloadResume(id: string) {
    return this.http.get(`${this.apiUrl}/${id}/download`, { responseType: 'blob' }).pipe(
      catchError((err) => {
        console.error('[ResumeService] downloadResume failed:', err);
        return throwError(() => err);
      }),
    );
  }
}