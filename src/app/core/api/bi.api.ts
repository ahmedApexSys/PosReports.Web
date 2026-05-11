import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.models';
import { BiPanel, BiReportRequest } from '../models/bi.models';

/**
 * Wraps the 13 BusinessIntelligence + Insights endpoints from
 * Phase 8 (PR #101) and Phase 8 Part 2 (PR #102). Every endpoint
 * follows the same shape: POST a BiReportRequest, get a BiPanel back
 * inside the ApiResponse envelope.
 */
@Injectable({ providedIn: 'root' })
export class BiApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api`;

  // ── Phase 8 Part 1 — BusinessIntelligence (5) ─────────────────────
  dashboard(req: BiReportRequest): Observable<BiPanel>           { return this.post('BusinessIntelligence/Dashboard',         req); }
  kpiSummary(req: BiReportRequest): Observable<BiPanel>          { return this.post('BusinessIntelligence/KpiSummary',        req); }
  peakHours(req: BiReportRequest): Observable<BiPanel>           { return this.post('BusinessIntelligence/PeakHours',         req); }
  averageOrderValue(req: BiReportRequest): Observable<BiPanel>   { return this.post('BusinessIntelligence/AverageOrderValue', req); }
  paymentMix(req: BiReportRequest): Observable<BiPanel>          { return this.post('BusinessIntelligence/PaymentMix',        req); }

  // ── Phase 8 Part 2 — BusinessIntelligence (3) ─────────────────────
  staffProductivity(req: BiReportRequest): Observable<BiPanel>   { return this.post('BusinessIntelligence/StaffProductivity', req); }
  customerRetention(req: BiReportRequest): Observable<BiPanel>   { return this.post('BusinessIntelligence/CustomerRetention', req); }
  modifierPopularity(req: BiReportRequest): Observable<BiPanel>  { return this.post('BusinessIntelligence/ModifierPopularity', req); }

  // ── Phase 8 Part 2 — /Insights endpoints (5) ──────────────────────
  itemInsights(body: unknown): Observable<BiPanel>               { return this.post('ItemRanking/Insights',                   body); }
  highlySalesInsights(body: unknown): Observable<BiPanel>        { return this.post('HighlySales/Insights',                   body); }
  lowSalesInsights(body: unknown): Observable<BiPanel>           { return this.post('LowSales/Insights',                      body); }
  serviceSpeedInsights(body: unknown): Observable<BiPanel>       { return this.post('ServiceSpeed/Insights',                  body); }
  serviceSpeedByPilotInsights(body: unknown): Observable<BiPanel> { return this.post('SerrviceSpeedByPilot/Insights',         body); }

  private post(path: string, body: unknown): Observable<BiPanel> {
    return this.http
      .post<ApiResponse<BiPanel>>(`${this.base}/${path}`, body)
      .pipe(map((res) => {
        // Server returns 200 + BaseQueryResponse on both success and
        // business failures. Distinguish them so the page shell's
        // catchError surfaces a real message.
        if (res && res.success === false && res.succeeded === false) {
          const msg = res.message
                   || (res.errors && res.errors.length ? res.errors.join('; ') : '')
                   || `${path} request failed`;
          throw new Error(msg);
        }
        return res.data;
      }));
  }
}
