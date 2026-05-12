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
    return this.get('Pilots', branchId);
  }
  users(branchId?: number | null): Observable<PickerItem[]> {
    return this.get('Users', branchId);
  }
  waiters(branchId?: number | null): Observable<PickerItem[]> {
    return this.get('Waiters', branchId);
  }
  cashiers(branchId?: number | null): Observable<PickerItem[]> {
    return this.get('Cashiers', branchId);
  }

  private get(path: string, branchId?: number | null): Observable<PickerItem[]> {
    const qs = branchId != null && branchId > 0 ? `?branchId=${branchId}` : '';
    return this.http.get<ApiResponse<PickerItem[]>>(`${this.base}/${path}${qs}`).pipe(
      map((res) => (res?.success || res?.succeeded ? (res.data || []) : [])),
      catchError(() => of([] as PickerItem[])),
    );
  }
}
