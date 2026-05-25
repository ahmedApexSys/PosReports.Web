import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.models';
import {
  AuditNarrativeRow,
  AuditReportFilterRequest,
  AuditReportPagedResult,
  AuditTotalsResult,
  DailyDigestResult,
  DeliveryReportRequest,
  DineInReportRequest,
  OrderJourneyLookupRequest,
  OrderJourneyLookupResult,
  OrderJourneyRequest,
  OrderJourneyResult,
  SuspiciousActivityResult,
  TakeAwayReportRequest,
  TransactionReportResult,
  UserSessionRequest,
  UserSessionResult,
} from '../models/audit.models';

/**
 * Wraps the 9 Phase 6 `/api/AuditNarrativeReport/*` endpoints. Six of
 * them take the generic `AuditReportFilterRequest`; the per-transaction
 * trio (DineIn / TakeAway / Delivery) takes its OWN focused request DTO
 * because their `groupBy` enum is different (ByTable / ByWaiter / etc.,
 * not the time-bucket Daily / Weekly / Monthly). The dedicated request
 * methods for OrderJourney and UserSession take their narrow request
 * DTOs that demand an explicit order/user identifier.
 */
@Injectable({ providedIn: 'root' })
export class AuditApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api/AuditNarrativeReport`;

  // ── Generic-filter endpoints ─────────────────────────────────────
  daily(req: AuditReportFilterRequest): Observable<AuditReportPagedResult<AuditNarrativeRow>> {
    return this.post<AuditReportPagedResult<AuditNarrativeRow>>('Daily', req);
  }
  totals(req: AuditReportFilterRequest): Observable<AuditTotalsResult> {
    return this.post<AuditTotalsResult>('Totals', req);
  }
  suspiciousActivity(req: AuditReportFilterRequest): Observable<SuspiciousActivityResult> {
    return this.post<SuspiciousActivityResult>('SuspiciousActivity', req);
  }
  dailyDigest(req: AuditReportFilterRequest): Observable<DailyDigestResult> {
    return this.post<DailyDigestResult>('DailyDigest', req);
  }

  // ── Identifier-driven endpoints ──────────────────────────────────
  orderJourney(req: OrderJourneyRequest): Observable<OrderJourneyResult> {
    return this.post<OrderJourneyResult>('OrderJourney', req);
  }
  /** List-mode lookup for the Order Journey screen — returns candidate
   *  orders matching a table-name / mobile-phone search so the operator
   *  can pick one before loading the full journey. */
  orderJourneyLookup(req: OrderJourneyLookupRequest): Observable<OrderJourneyLookupResult> {
    return this.post<OrderJourneyLookupResult>('OrderJourney/Lookup', req);
  }
  userSession(req: UserSessionRequest): Observable<UserSessionResult> {
    return this.post<UserSessionResult>('UserSession', req);
  }

  // ── Per-transaction endpoints (each has its own DTO) ─────────────
  dineIn(req: DineInReportRequest): Observable<TransactionReportResult> {
    return this.post<TransactionReportResult>('DineIn', req);
  }
  takeAway(req: TakeAwayReportRequest): Observable<TransactionReportResult> {
    return this.post<TransactionReportResult>('TakeAway', req);
  }
  delivery(req: DeliveryReportRequest): Observable<TransactionReportResult> {
    return this.post<TransactionReportResult>('Delivery', req);
  }

  private post<TResp>(path: string, body: unknown): Observable<TResp> {
    return this.http
      .post<ApiResponse<TResp>>(`${this.base}/${path}`, body)
      .pipe(map((res) => {
        // The server returns 200 + BaseQueryResponse on BOTH success and
        // most validation/business failures. Distinguish them so the
        // page-shell catchError gets a real message instead of `null`.
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
