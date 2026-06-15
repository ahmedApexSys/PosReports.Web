import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, expand, reduce, EMPTY } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.models';
import { aggregateOrders, aggregateDays, round2 } from '../audit/order-aggregate';
import {
  AuditNarrativeRow,
  AuditReportFilterRequest,
  AuditReportPagedResult,
  AuditTotalsResult,
  BilingualText,
  OrderSummaryRow,
  OrderTotalsByDayResult,
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

  /**
   * Per-ORDER daily summary — the owner wants ONE row per order (its totals),
   * not one row per action and no repeated orders. Pulls the full action feed
   * for the window (loops pages, capped) and collapses it to OrderSummaryRow[]
   * client-side, returned in the paged-result shape the page-shell expects.
   */
  dailyPerOrder(req: AuditReportFilterRequest): Observable<AuditReportPagedResult<OrderSummaryRow>> {
    const PAGE = 200;
    const MAX_PAGES = 40;                       // safety cap (~8000 actions)
    const fetchPage = (page: number) => this.daily({ ...req, page, pageSize: PAGE });
    return fetchPage(1).pipe(
      expand(res => (res.hasNextPage && res.page < MAX_PAGES) ? fetchPage(res.page + 1) : EMPTY),
      reduce((acc, res) => {
        acc.rows.push(...(res.data || []));
        acc.conclusion = res.conclusion;
        if (res.hasNextPage && res.page >= MAX_PAGES) acc.truncated = true;
        return acc;
      }, { rows: [] as AuditNarrativeRow[], conclusion: undefined as BilingualText | undefined, truncated: false }),
      map(acc => {
        const orders = aggregateOrders(acc.rows);
        return {
          data: orders,
          totalCount: orders.length,
          page: 1,
          pageSize: Math.max(1, orders.length),
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
          conclusion: acc.conclusion ?? { description: '', descriptionEn: '', descriptionAr: '' },
          buckets: [],
        } as AuditReportPagedResult<OrderSummaryRow>;
      }),
    );
  }

  /** Per-DAY rollup of order totals (GroupBy date, summed) — reuses the
   *  per-order aggregation so an order is never double-counted across actions. */
  totalsByDay(req: AuditReportFilterRequest): Observable<OrderTotalsByDayResult> {
    return this.dailyPerOrder(req).pipe(map(paged => {
      const orders = paged.data;
      return {
        days: aggregateDays(orders),
        summary: {
          uniqueOrders: orders.length,
          paidOrders: orders.filter(o => o.wasPaid).length,
          totalNet: round2(orders.reduce((s, o) => s + (o.finalNet || 0), 0)),
          totalDiscount: round2(orders.reduce((s, o) => s + (o.discount || 0), 0)),
          voidedOrders: orders.filter(o => o.wasVoided).length,
          cancelledOrders: orders.filter(o => o.wasCancelled).length,
        },
        conclusion: paged.conclusion,
      } as OrderTotalsByDayResult;
    }));
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
