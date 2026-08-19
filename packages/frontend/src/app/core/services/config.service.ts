import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigSummary, ConfigDoc } from '../models/types';

// REST-клиент для множественных конфигов: список, CRUD по :id, секции.
// Резюме привязывается к конфигу (вкладка «Резюме» формы).
@Injectable({ providedIn: 'root' })
export class ConfigService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3001/api/config';

  listConfigs(): Observable<{ configs: ConfigSummary[] }> {
    return this.http.get<{ configs: ConfigSummary[] }>(`${this.apiUrl}/list`);
  }

  createConfig(name: string): Observable<ConfigDoc> {
    return this.http.post<ConfigDoc>(this.apiUrl, { name });
  }

  getConfig(id: string): Observable<ConfigDoc> {
    return this.http.get<ConfigDoc>(`${this.apiUrl}/${id}`);
  }

  // Полное обновление (в т.ч. name).
  updateConfig(id: string, data: Partial<ConfigDoc>): Observable<ConfigDoc> {
    return this.http.put<ConfigDoc>(`${this.apiUrl}/${id}`, data);
  }

  updateSection(id: string, section: 'search' | 'filter' | 'apply', data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}/${section}`, data);
  }

  updateResume(id: string, resumeId: string): Observable<ConfigDoc> {
    return this.http.put<ConfigDoc>(`${this.apiUrl}/${id}/resume`, { resumeId });
  }

  deleteConfig(id: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.apiUrl}/${id}`);
  }
}
