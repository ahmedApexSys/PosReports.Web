import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.models';
import { SalesReportFilter, SalesReportResult } from '../models/sales-report.models';

/**
 * Generic runner for the POS "Sales reports" — every one is a POST that takes the
 * shared DailySalesRequestFilterDto and returns BaseQueryResponse { data: { ReportData[], Totals } }.
 * The server uses DashedReportJson on several of these (empty strings → "-"), and the
 * global resolver camelCases keys; we read both casings defensively.
 */
@Injectable({ providedIn: 'root' })
export class SalesReportApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api`;

  run(path: string, body: SalesReportFilter): Observable<SalesReportResult> {
    return this.http
      .post<ApiResponse<Record<string, unknown>>>(`${this.base}/${path}`, body)
      .pipe(map((res) => {
        if (res && res.success === false && res.succeeded === false) {
          throw new Error(res.message || (res.errors && res.errors.length ? res.errors.join('; ') : `${path} failed`));
        }
        const d = (res?.data ?? {}) as Record<string, unknown>;
        const rows = (d['reportData'] ?? d['ReportData'] ?? d['discounts'] ?? d['data'] ?? []) as Record<string, unknown>[];
        const totals = (d['totals'] ?? d['Totals'] ?? {}) as Record<string, unknown>;
        return { rows: Array.isArray(rows) ? rows : [], totals: totals ?? {} };
      }));
  }
}
