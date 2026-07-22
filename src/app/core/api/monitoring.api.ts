import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.models';
import {
  AuditLogFilter,
  AuditSummary,
  EntityChangeSummary,
  OrderActionLogRow,
  OrderActionQuery,
  PaginatedAudit,
  UnifiedAuditLog,
  UserActivitySummary,
} from '../models/monitoring.models';
import { OrderJourney, OrderJourneyRequest } from '../models/journey.models';
import { ApiTraffic, ApiTrafficRequest } from '../models/api-traffic.models';

type ParamValue = string | number | boolean | null | undefined;

/**
 * Wraps the raw action-log / monitoring endpoints:
 *   - /api/AuditReport/*    — unified timeline + summary + user activity + entity history/change
 *   - /api/OrderActionLog/* — every order/table mutation with before/after snapshots
 *
 * Same response-envelope handling as AuditApi: the server returns HTTP 200 +
 * BaseQueryResponse on both success and business failure, so we distinguish
 * them and throw a real message on failure (the page-shell catchError shows it).
 * Auth (Bearer JWT) is added by the global interceptor — no headers here.
 */
@Injectable({ providedIn: 'root' })
export class MonitoringApi {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  // ── Unified audit timeline (Order + System + Menu) ───────────────
  timeline(filter: AuditLogFilter): Observable<PaginatedAudit<UnifiedAuditLog>> {
    return this.post<PaginatedAudit<UnifiedAuditLog>>('/api/AuditReport/Timeline', filter);
  }

  summary(branchId: number, fromDate: string, toDate: string): Observable<AuditSummary[]> {
    return this.get<AuditSummary[]>('/api/AuditReport/Summary', { branchId, fromDate, toDate });
  }

  userActivity(branchId: number, fromDate: string, toDate: string): Observable<UserActivitySummary[]> {
    return this.get<UserActivitySummary[]>('/api/AuditReport/UserActivity', { branchId, fromDate, toDate });
  }

  entityHistory(entityType: string, entityId: string, fromDate: string, toDate: string): Observable<UnifiedAuditLog[]> {
    return this.get<UnifiedAuditLog[]>('/api/AuditReport/EntityHistory', { entityType, entityId, fromDate, toDate });
  }

  entityChangeSummary(
    branchId: number, fromDate: string, toDate: string, logSource?: string | null,
  ): Observable<EntityChangeSummary[]> {
    return this.get<EntityChangeSummary[]>('/api/AuditReport/EntityChangeSummary', {
      branchId, fromDate, toDate, logSource,
    });
  }

  // ── Order action log (order + table mutations) ───────────────────
  orderByBranch(q: OrderActionQuery): Observable<PaginatedAudit<OrderActionLogRow>> {
    return this.get<PaginatedAudit<OrderActionLogRow>>('/api/OrderActionLog/ByBranchAndDate', {
      branchId: q.branchId, fromDate: q.fromDate, toDate: q.toDate,
      actionType: q.actionType, transactionType: q.transactionType, userId: q.userId,
      tableName: q.tableName, receiptNumber: q.receiptNumber, machineId: q.machineId,
      successOnly: q.successOnly, page: q.page, pageSize: q.pageSize,
    });
  }

  orderByOrderId(
    branchId: number, orderId: number, page: number, pageSize: number,
  ): Observable<PaginatedAudit<OrderActionLogRow>> {
    return this.get<PaginatedAudit<OrderActionLogRow>>('/api/OrderActionLog/ByOrderId', {
      branchId, orderId, page, pageSize,
    });
  }

  /** ByReceipt returns the full (unpaginated) list for one receipt. */
  orderByReceipt(branchId: number, receiptNumber: number): Observable<OrderActionLogRow[]> {
    return this.get<OrderActionLogRow[]>('/api/OrderActionLog/ByReceipt', { branchId, receiptNumber });
  }

  orderByTable(
    branchId: number, tableName: string, fromDate: string, toDate: string, page: number, pageSize: number,
  ): Observable<PaginatedAudit<OrderActionLogRow>> {
    return this.get<PaginatedAudit<OrderActionLogRow>>('/api/OrderActionLog/ByTableName', {
      branchId, tableName, fromDate, toDate, page, pageSize,
    });
  }

  // ── Itemized order journey (full lifecycle of one order) ─────────
  orderJourney(req: OrderJourneyRequest): Observable<OrderJourney> {
    return this.post<OrderJourney>('/api/activity-log/order-timeline', req);
  }

  /**
   * API traffic — call volume, durations, the endpoints that eat the server's
   * day, and the individual calls that took too long. Always resolves: when the
   * log table has nothing on this database the server returns a filled-in
   * `unavailableReason*` instead of an error.
   */
  apiTraffic(req: ApiTrafficRequest): Observable<ApiTraffic> {
    return this.post<ApiTraffic>('/api/activity-log/api-traffic', req);
  }

  // ── helpers ──────────────────────────────────────────────────────
  private get<T>(path: string, params: Record<string, ParamValue>): Observable<T> {
    let hp = new HttpParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== null && v !== undefined && v !== '') hp = hp.set(k, String(v));
    }
    return this.http
      .get<ApiResponse<T>>(`${this.base}${path}`, { params: hp })
      .pipe(map((res) => this.unwrap(res, path)));
  }

  private post<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .post<ApiResponse<T>>(`${this.base}${path}`, body)
      .pipe(map((res) => this.unwrap(res, path)));
  }

  private unwrap<T>(res: ApiResponse<T>, path: string): T {
    if (res && res.success === false && res.succeeded === false) {
      const msg = res.message
               || (res.errors && res.errors.length ? res.errors.join('; ') : '')
               || `${path} request failed`;
      throw new Error(msg);
    }
    return res.data;
  }
}
