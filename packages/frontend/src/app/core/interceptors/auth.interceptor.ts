import { Injectable, inject, NgZone } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private zone = inject(NgZone);

  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.authService.getAccessToken();
    let authReq = req;
    if (token && !req.url.includes('/auth/')) {
      authReq = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    }
    return next.handle(authReq).pipe(
      catchError(err => {
        if (err.status === 401 && !req.url.includes('/auth/')) {
          // Заворачиваем цепочку refresh → retry в NgZone,
          // чтобы колбэки компонентов исполнялись внутри зоны
          return new Observable<HttpEvent<unknown>>(subscriber => {
            this.zone.run(() => {
              this.authService.refreshToken().pipe(
                switchMap(() => {
                  const newToken = this.authService.getAccessToken();
                  const retryReq = req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } });
                  return next.handle(retryReq);
                }),
                catchError(() => {
                  this.authService.logout();
                  return throwError(() => err);
                }),
              ).subscribe(subscriber);
            });
          });
        }
        return throwError(() => err);
      }),
    );
  }
}
