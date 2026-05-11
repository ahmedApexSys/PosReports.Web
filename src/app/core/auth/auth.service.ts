import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, map, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, AuthenticationModel, LoginRequest, UserProfile } from '../models/api.models';
import { CryptoService } from '../crypto/crypto.service';

const TOKEN_KEY = 'pos-reports.jwt';
const REFRESH_KEY = 'pos-reports.refresh';
const PROFILE_KEY = 'pos-reports.profile';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly crypto = inject(CryptoService);

  readonly token = signal<string | null>(this.readStored(TOKEN_KEY));
  readonly profile = signal<UserProfile | null>(this.readProfile());
  readonly isAuthenticated = computed(() => !!this.token());

  /**
   * POST /api/User/Login — mirrors the server's TokenRequestModel.
   * Returns true on success, false otherwise. The auth state is updated
   * as a side-effect.
   *
   * The password (or PIN — same field server-side) is RSA-encrypted with
   * the server's public key before transit, matching the existing
   * desktop POS client behaviour the server already supports.
   */
  login(payload: LoginRequest): Observable<{ ok: boolean; message: string }> {
    const encrypted: LoginRequest = {
      ...payload,
      password: this.crypto.encryptPassword(payload.password),
    };
    return this.http
      .post<AuthenticationModel | ApiResponse<AuthenticationModel>>(
        `${environment.apiBaseUrl}/api/User/Login`,
        encrypted,
      )
      .pipe(
        // The server returns AuthenticationModel directly (not wrapped) on
        // success; failures may come wrapped depending on the path.
        map((res) => this.normalise(res)),
        tap((auth) => {
          if (auth.isAuthenticated && auth.token) {
            this.persistToken(auth.token, auth.refreshToken);
            const prof = auth.userProfile ?? null;
            this.persistProfile(prof);
            this.token.set(auth.token);
            this.profile.set(prof);
          }
        }),
        map((auth) => ({
          ok: !!auth.isAuthenticated,
          message: auth.message ?? '',
        })),
        catchError((err) => {
          const msg =
            err?.error?.message ||
            err?.error?.errors?.[0] ||
            err?.message ||
            'Login failed.';
          return of({ ok: false, message: msg });
        }),
      );
  }

  logout(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(PROFILE_KEY);
    } catch { /* noop */ }
    this.token.set(null);
    this.profile.set(null);
    this.router.navigate(['/login']);
  }

  private normalise(res: AuthenticationModel | ApiResponse<AuthenticationModel>): AuthenticationModel {
    // Server may return either the raw AuthenticationModel or a wrapped one.
    if (res && typeof res === 'object' && 'data' in res && (res as ApiResponse<AuthenticationModel>).data) {
      return (res as ApiResponse<AuthenticationModel>).data;
    }
    return res as AuthenticationModel;
  }

  private persistToken(token: string, refresh?: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    } catch { /* noop */ }
  }

  private persistProfile(profile: UserProfile | null): void {
    try {
      if (profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      else localStorage.removeItem(PROFILE_KEY);
    } catch { /* noop */ }
  }

  private readStored(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  private readProfile(): UserProfile | null {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      return raw ? JSON.parse(raw) as UserProfile : null;
    } catch { return null; }
  }
}
