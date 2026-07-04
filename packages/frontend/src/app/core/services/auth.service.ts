import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError, throwError } from 'rxjs';
import { AuthResponse, User } from '../models/types';
import { Router } from '@angular/router';

const STORAGE_KEYS = {
  accessToken: 'auth_access_token',
  refreshToken: 'auth_refresh_token',
} as const;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = 'http://localhost:3001/api/auth';
  private usersUrl = 'http://localhost:3001/api/users';
  private accessToken: string | null = null;
  private refreshTokenValue: string | null = null;
  private http = inject(HttpClient);
  private router = inject(Router);
  currentUser$ = new BehaviorSubject<User | null>(null);

  constructor() {
    this.restoreSession();
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, { email, password }).pipe(
      tap(res => this.handleTokens(res)),
    );
  }

  register(email: string, password: string, name: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, { email, password, name }).pipe(
      tap(res => this.handleTokens(res)),
    );
  }

  refreshToken(): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/refresh`, {
      refreshToken: this.refreshTokenValue,
    }).pipe(
      tap(res => this.handleTokens(res)),
      catchError(err => {
        this.logout();
        return throwError(() => err);
      }),
    );
  }

  fetchProfile(): Observable<User> {
    return this.http.get<User>(`${this.usersUrl}/me`).pipe(
      tap(user => this.currentUser$.next(user)),
    );
  }

  logout(): void {
    this.accessToken = null;
    this.refreshTokenValue = null;
    this.currentUser$.next(null);
    sessionStorage.removeItem(STORAGE_KEYS.accessToken);
    sessionStorage.removeItem(STORAGE_KEYS.refreshToken);
    this.router.navigate(['/login']);
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  isLoggedIn(): boolean {
    return !!this.accessToken;
  }

  private handleTokens(res: AuthResponse): void {
    this.accessToken = res.accessToken;
    this.refreshTokenValue = res.refreshToken;
    this.currentUser$.next(res.user);
    sessionStorage.setItem(STORAGE_KEYS.accessToken, res.accessToken);
    sessionStorage.setItem(STORAGE_KEYS.refreshToken, res.refreshToken);
  }

  private restoreSession(): void {
    const accessToken = sessionStorage.getItem(STORAGE_KEYS.accessToken);
    const refreshToken = sessionStorage.getItem(STORAGE_KEYS.refreshToken);

    if (accessToken && refreshToken) {
      this.accessToken = accessToken;
      this.refreshTokenValue = refreshToken;
      // setTimeout разрывает циклическую зависимость:
      // AuthService → HttpClient → AuthInterceptor → AuthService
      setTimeout(() => {
        this.fetchProfile().subscribe({
          error: (err) => console.error('[AuthService] fetchProfile failed:', err),
        });
      });
    }
  }
}
