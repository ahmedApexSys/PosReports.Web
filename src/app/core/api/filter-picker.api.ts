import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of } from 'rxjs';
import { catchError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.models';
import { PickerItem } from '../models/picker.models';

/**
 * Wraps the `/api/FilterPickers/*` endpoints — small read-only
 * dropdown-friendly lists that report pages use to populate their
 * filter selectors (pilot, user, waiter, cashier).
 *
 * Each method takes an optional `branchId` to scope the list. When
 * the server responds with `success=false`, the observable emits an
 * empty array so dropdowns render "no items" instead of erroring.
 */
@Injectable({ providedIn: 'root' })
export class FilterPickerApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api/FilterPickers`;

  pilots(branchId?: number | null): Observable<PickerItem[]> {
    return this.get('Pilots', { branchId });
  }
  /**
   * Users picker.
   *  • `branchId`            → narrow to one branch (mutually exclusive with `scope`).
   *  • `scope`               → "all" (default) / "branch" / "callcenter".
   *  • `transactionTypeId`   → 1=DineIn (Waiters+Cashiers) / 2=Delivery (Pilots+Cashiers) / 3=TakeAway (Cashiers).
   */
  users(opts?: {
    branchId?: number | null;
    scope?: 'all' | 'branch' | 'callcenter';
    transactionTypeId?: number | null;
  } | number | null): Observable<PickerItem[]> {
    // Backwards-compat: callers that passed a bare branchId number still work.
    const o = typeof opts === 'number' || opts === null
      ? { branchId: opts as number | null }
      : (opts ?? {});
    return this.get('Users', {
      branchId: o.branchId,
      scope: o.scope,
      transactionTypeId: o.transactionTypeId,
    });
  }
  waiters(branchId?: number | null): Observable<PickerItem[]> {
    return this.get('Waiters', { branchId });
  }
  cashiers(branchId?: number | null): Observable<PickerItem[]> {
    return this.get('Cashiers', { branchId });
  }

  private get(path: string, params: {
    branchId?: number | null;
    scope?: string | null;
    transactionTypeId?: number | null;
  }): Observable<PickerItem[]> {
    const qs: string[] = [];
    if (params.branchId != null && params.branchId > 0) qs.push(`branchId=${params.branchId}`);
    if (params.scope) qs.push(`scope=${encodeURIComponent(params.scope)}`);
    if (params.transactionTypeId != null && params.transactionTypeId > 0)
      qs.push(`transactionTypeId=${params.transactionTypeId}`);
    const url = qs.length ? `${this.base}/${path}?${qs.join('&')}` : `${this.base}/${path}`;
    return this.http.get<ApiResponse<PickerItem[]>>(url).pipe(
      map((res) => (res?.success || res?.succeeded ? (res.data || []) : [])),
      catchError(() => of([] as PickerItem[])),
    );
  }
}
