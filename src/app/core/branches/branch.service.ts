import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap, catchError, of, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.models';
import { Branch } from '../models/branch.models';

/**
 * Loads + caches the branches available to the current user from
 * GET /api/Home/GetAllAvailableBranches. The reports module REQUIRES
 * a selected branch before any data fetch — this service is the
 * source of truth for which branches are eligible.
 *
 * Caches in-memory for the session; refreshable via `reload()`.
 */
@Injectable({ providedIn: 'root' })
export class BranchService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api`;

  private readonly _branches = signal<Branch[] | null>(null);
  private readonly _loading  = signal<boolean>(false);
  private readonly _error    = signal<string>('');

  readonly branches = this._branches.asReadonly();
  readonly loading  = this._loading.asReadonly();
  readonly error    = this._error.asReadonly();

  /** True when we've at least attempted to load and have data. */
  readonly hasBranches = computed(() => {
    const b = this._branches();
    return Array.isArray(b) && b.length > 0;
  });

  /** Active (non-stopped) branches. Use for the picker dropdown. */
  readonly activeBranches = computed(() =>
    (this._branches() ?? []).filter(b => !b.isStopped));

  private cached$: Observable<Branch[]> | null = null;

  /** Fetches branches once and caches. Refresh via `reload()`. */
  load(): Observable<Branch[]> {
    if (this.cached$) return this.cached$;
    this._loading.set(true);
    this._error.set('');

    this.cached$ = this.http
      .get<ApiResponse<Branch[]>>(`${this.base}/Home/GetAllAvailableBranches`)
      .pipe(
        map((res) => Array.isArray(res?.data) ? res.data : []),
        tap((list) => {
          this._branches.set(list);
          this._loading.set(false);
        }),
        catchError((err) => {
          const msg =
            err?.error?.message ||
            err?.error?.errors?.[0] ||
            err?.message ||
            'Failed to load branches.';
          this._error.set(msg);
          this._loading.set(false);
          this._branches.set([]);
          // Clear the cache so next call retries.
          this.cached$ = null;
          return of([] as Branch[]);
        }),
        shareReplay(1),
      );

    return this.cached$;
  }

  /** Discard cache + reload. */
  reload(): Observable<Branch[]> {
    this.cached$ = null;
    this._branches.set(null);
    return this.load();
  }

  /** Find a branch by id from the cached list. */
  findById(id: number | null | undefined): Branch | undefined {
    if (id == null) return undefined;
    return (this._branches() ?? []).find(b => b.id === id);
  }
}
