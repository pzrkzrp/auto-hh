import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface HhLoginPayload {
  phone?: string;
  email?: string;
  password?: string;
  wait_sms_code?: boolean;
}

export interface HhLoginResult {
  success: boolean;
  message: string;
  waitSmsCode?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3001/api/hh-auth';

  login(payload: HhLoginPayload): Observable<HhLoginResult> {
    return this.http.post<HhLoginResult>(`${this.apiUrl}/login`, payload);
  }

  sendCode(code: string): Observable<HhLoginResult> {
    return this.http.post<HhLoginResult>(`${this.apiUrl}/send-code`, { code });
  }
}
