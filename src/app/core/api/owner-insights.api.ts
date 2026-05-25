import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.models';
import {
  OwnerInsightsRequest,
  PostCheckoutModificationsResult,
  TopPayingCustomersResult,
  GrowthTrendsResult,
  ItemsNotPaidResult,
  RevenueLeakageSummaryDto,
  OrderLifecycleDelaysDto,
  StaffScorecardDto,
} from '../models/owner-insights.models';

/**
 * Wraps `/api/OwnerInsights/*` plus the three existing
 * `/api/BusinessIntelligence/*` endpoints we surface inside the
 * Owner Insights group. Every response carries a bilingual
 * `conclusion` / `insight` field that names the recommended action.
 */
@Injectable({ providedIn: 'root' })
export class OwnerInsightsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api/OwnerInsights`;
  private readonly biBase = `${environment.apiBaseUrl}/api/BusinessIntelligence`;

  // ── /api/OwnerInsights/* ─────────────────────────────────────────────

  postCheckoutModifications(req: OwnerInsightsRequest): Observable<PostCheckoutModificationsResult> {
    return this.post<PostCheckoutModificationsResult>(`${this.base}/PostCheckoutModifications`, req);
  }

  topPayingCustomers(req: OwnerInsightsRequest): Observable<TopPayingCustomersResult> {
    return this.post<TopPayingCustomersResult>(`${this.base}/TopPayingCustomers`, req);
  }

  growthTrends(req: OwnerInsightsRequest): Observable<GrowthTrendsResult> {
    return this.post<GrowthTrendsResult>(`${this.base}/GrowthTrends`, req);
  }

  itemsNotPaid(req: OwnerInsightsRequest): Observable<ItemsNotPaidResult> {
    return this.post<ItemsNotPaidResult>(`${this.base}/ItemsNotPaid`, req);
  }

  // ── /api/BusinessIntelligence/* wrappers ─────────────────────────────

  revenueLeakageSummary(req: OwnerInsightsRequest): Observable<RevenueLeakageSummaryDto> {
    return this.post<RevenueLeakageSummaryDto>(`${this.biBase}/RevenueLeakageSummary`, req);
  }

  orderLifecycleDelays(req: OwnerInsightsRequest): Observable<OrderLifecycleDelaysDto> {
    return this.post<OrderLifecycleDelaysDto>(`${this.biBase}/OrderLifecycleDelays`, req);
  }

  staffAccountabilityScorecard(req: OwnerInsightsRequest): Observable<StaffScorecardDto> {
    return this.post<StaffScorecardDto>(`${this.biBase}/StaffAccountabilityScorecard`, req);
  }

  // ── transport ────────────────────────────────────────────────────────

  private post<TResp>(url: string, body: unknown): Observable<TResp> {
    return this.http
      .post<ApiResponse<TResp>>(url, body)
      .pipe(map((res) => {
        if (res && res.success === false && res.succeeded === false) {
          const msg = res.message
                   || (res.errors && res.errors.length ? res.errors.join('; ') : '')
                   || `${url} request failed`;
          throw new Error(msg);
        }
        return res.data;
      }));
  }
}
