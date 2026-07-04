import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, catchError, of, map } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3001/api/';

  loadDashboard() {
    return forkJoin([
      this.loadQueue(),
      this.loadDigest(),
      this.loadStatistics(),
    ]).pipe(
      map(([queue, digest, stats]) => ({ queue, digest, stats })),
      catchError((err) => {
        console.error('[DashboardService] loadDashboard failed:', err);
        return of({ queue: [], digest: [], stats: null });
      }),
    );
  }

  private loadQueue() {
    return this.http.get<any[]>(`${this.apiUrl}apply-queue?status=queued`).pipe(
      catchError((err) => {
        console.error('[DashboardService] loadQueue failed:', err);
        return of([]);
      }),
    );
  }

  private loadDigest() {
    return this.http.get<any[]>(`${this.apiUrl}digest/latest`).pipe(
      catchError((err) => {
        console.error('[DashboardService] loadDigest failed:', err);
        return of([]);
      }),
    );
  }

  private loadStatistics() {
    return this.http.get<any>(`${this.apiUrl}history/stats`).pipe(
      catchError((err) => {
        console.error('[DashboardService] loadStatistics failed:', err);
        return of(null);
      }),
    );
  }
}