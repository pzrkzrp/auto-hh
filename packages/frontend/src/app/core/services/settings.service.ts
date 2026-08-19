import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface HhLoginPayload {
  phone?: string;
  email?: string;
  password?: string;
  wait_code?: boolean;
}

export interface HhLoginResult {
  success: boolean;
  message: string;
  waitSmsCode?: boolean;
  accountId?: string;
}

export interface HhSessionInfo {
  _id: string;
  accountId: string;
  phone?: string | null;
  email?: string | null;
  loginAt: string | null;
}

export interface HhStatusResult {
  sessions: HhSessionInfo[];
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3001/api/hh-auth';

  login(payload: HhLoginPayload): Observable<HhLoginResult> {
    return this.http.post<HhLoginResult>(`${this.apiUrl}/login`, payload);
  }

  sendCode(accountId: string, code: string): Observable<HhLoginResult> {
    return this.http.post<HhLoginResult>(`${this.apiUrl}/send-code`, { accountId, code });
  }

  getSessions(): Observable<HhStatusResult> {
    return this.http.get<HhStatusResult>(`${this.apiUrl}/status`);
  }

  removeSession(sessionId: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.apiUrl}`, { body: { sessionId } });
  }
}
