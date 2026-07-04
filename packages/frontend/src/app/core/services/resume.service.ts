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

  uploadResume(file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<ResumeDoc>(this.apiUrl, form).pipe(
      catchError((err) => {
        console.error('[ResumeService] uploadResume failed:', err);
        return throwError(() => err);
      }),
    );
  }

  activateResume(id: string) {
    return this.http.put<ResumeDoc>(`${this.apiUrl}/${id}/activate`, {}).pipe(
      catchError((err) => {
        console.error('[ResumeService] activateResume failed:', err);
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
}