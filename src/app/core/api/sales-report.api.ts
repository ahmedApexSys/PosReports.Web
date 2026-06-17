import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.models';
import { SalesReportFilter, SalesReportResult } from '../models/sales-report.models';

type Obj = Record<string, unknown>;
const asArr = (v: unknown): Obj[] => (Array.isArray(v) ? (v as Obj[]) : []);
const pick = (o: Obj, ...keys: string[]): unknown => {
  for (const k of keys) if (o && o[k] !== undefined) return o[k];
  return undefined;
};

/** Optional context handed to transforms (e.g. the branch names to keep). */
interface TransformCtx { branchNames?: string[]; }

/** Numeric fields summed when aggregating Sales-Period rows into group totals. */
const SALES_SUM_FIELDS = [
  'guestNo', 'printNo', 'totalSales', 'totalCommercialDiscount', 'totalTax',
  'totalItemDiscount', 'extraDiscount', 'services', 'minimumChargeValue', 'additionValue',
  'cash', 'visa', 'cl', 'voucherAmount', 'otherPayment', 'paymentAmount', 'promoCodeValue', 'net',
];

/** Keep only rows belonging to the selected branch (the API branch filter leaks
 *  "Call Center" rows into every branch — drop the mismatches client-side). */
function filterByBranch(rows: Obj[], ctx?: TransformCtx): Obj[] {
  const names = ctx?.branchNames?.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  if (!names || !names.length) return rows;
  const set = new Set(names);
  return rows.filter((r) => r['branchName'] == null || set.has(String(r['branchName']).trim().toLowerCase()));
}

/** dd/MM/yyyy → epoch ms for chronological sorting (0 if unparseable). */
function parseDmy(s: unknown): number {
  const m = String(s ?? '').split('/');
  return m.length === 3 ? new Date(+m[2], +m[1] - 1, +m[0]).getTime() : 0;
}

/**
 * Aggregate Sales-Period per-order rows into one summary row per group key.
 * `byDay` adds the order date to the key → one row per (day × keyField),
 * sorted by date then category.
 */
function groupSales(d: Obj, keyField: string, ctx?: TransformCtx, byDay = false): SalesReportResult {
  const rows = filterByBranch(asArr(pick(d, 'reportData', 'ReportData')), ctx);
  const map = new Map<string, Obj>();
  for (const r of rows) {
    const cat = String(r[keyField] ?? '-') || '-';
    const day = byDay ? String(r['orderDate'] ?? '-') : '';
    const k = byDay ? `${day}|${cat}` : cat;
    let g = map.get(k);
    if (!g) {
      g = byDay ? { orderDate: day, [keyField]: cat, ordersCount: 0 } : { [keyField]: cat, ordersCount: 0 };
      for (const f of SALES_SUM_FIELDS) g[f] = 0;
      map.set(k, g);
    }
    (g['ordersCount'] as number)++;
    for (const f of SALES_SUM_FIELDS) (g[f] as number) += Number(r[f]) || 0;
  }
  const groups = [...map.values()];
  if (byDay) {
    groups.sort((a, b) =>
      parseDmy(a['orderDate']) - parseDmy(b['orderDate']) ||
      String(a[keyField]).localeCompare(String(b[keyField])));
  }
  const totals: Obj = { ordersCount: rows.length };
  for (const f of SALES_SUM_FIELDS) totals[f] = groups.reduce((a, g) => a + (Number(g[f]) || 0), 0);
  return { rows: groups, totals };
}

/** Aggregate per-order rows into one summary row per DAY (sorted by date). */
function groupByDate(d: Obj, ctx?: TransformCtx): SalesReportResult {
  const rows = filterByBranch(asArr(pick(d, 'reportData', 'ReportData')), ctx);
  const map = new Map<string, Obj>();
  for (const r of rows) {
    const day = String(r['orderDate'] ?? '-') || '-';
    let g = map.get(day);
    if (!g) { g = { orderDate: day, ordersCount: 0 }; for (const f of SALES_SUM_FIELDS) g[f] = 0; map.set(day, g); }
    (g['ordersCount'] as number)++;
    for (const f of SALES_SUM_FIELDS) (g[f] as number) += Number(r[f]) || 0;
  }
  const groups = [...map.values()].sort((a, b) => parseDmy(a['orderDate']) - parseDmy(b['orderDate']));
  const totals: Obj = { ordersCount: rows.length };
  for (const f of SALES_SUM_FIELDS) totals[f] = groups.reduce((a, g) => a + (Number(g[f]) || 0), 0);
  return { rows: groups, totals };
}

/** Return the per-order rows ordered by a field then by OrderId, keeping the
 *  API totals — used by the order-by-order "Daily Sales by …" reports. */
function sortOrders(d: Obj, keyField: string, ctx?: TransformCtx): SalesReportResult {
  const rows = filterByBranch(asArr(pick(d, 'reportData', 'ReportData')), ctx);
  const sorted = [...rows].sort((a, b) =>
    String(a[keyField] ?? '').localeCompare(String(b[keyField] ?? '')) ||
    (Number(a['orderId']) || 0) - (Number(b['orderId']) || 0));
  const totals = pick(d, 'totals', 'Totals');
  return { rows: sorted, totals: (totals && typeof totals === 'object' ? totals : {}) as Obj };
}

/**
 * Named client-side transforms for report responses the flat rowsKey/totalsKey
 * can't express. promo / vouchers come back as days[] each holding a per-code
 * array (exploded to one row per code); the groupBy* variants aggregate the
 * Sales-Period per-order rows into per-transaction / per-payment summaries.
 */
const TRANSFORMS: Record<string, (d: Obj, ctx?: TransformCtx) => SalesReportResult> = {
  promoFlatten: (d) => {
    const days = asArr(pick(d, 'days', 'Days'));
    const rows: Obj[] = [];
    for (const day of days) {
      const dayVal = pick(day, 'day', 'Day');
      for (const code of asArr(pick(day, 'promoCodes', 'PromoCodes'))) rows.push({ day: dayVal, ...code });
    }
    const totals = pick(d, 'grandTotals', 'GrandTotals');
    return { rows, totals: (totals && typeof totals === 'object' ? totals : {}) as Obj };
  },
  voucherFlatten: (d) => {
    const days = asArr(pick(d, 'days', 'Days'));
    const rows: Obj[] = [];
    for (const day of days) {
      const dayVal = pick(day, 'day', 'Day');
      for (const code of asArr(pick(day, 'voucherCodes', 'VoucherCodes'))) rows.push({ day: dayVal, ...code });
    }
    const totals = pick(d, 'grandTotals', 'GrandTotals');
    return { rows, totals: (totals && typeof totals === 'object' ? totals : {}) as Obj };
  },
  // getDailySalesReport (per-order) uses `transaction`; SalePeriod uses `transactionName`.
  groupByTransaction: (d, ctx) => groupSales(d, 'transaction', ctx),
  groupByPayment: (d, ctx) => groupSales(d, 'paymentStatus', ctx),
  groupByDate: (d, ctx) => groupByDate(d, ctx),
  groupByDayTransaction: (d, ctx) => groupSales(d, 'transaction', ctx, true),
  groupByDayPayment: (d, ctx) => groupSales(d, 'paymentStatus', ctx, true),
  orderByTransaction: (d, ctx) => sortOrders(d, 'transaction', ctx),
  orderByPayment: (d, ctx) => sortOrders(d, 'paymentStatus', ctx),
};

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

  run(
    path: string,
    body: SalesReportFilter,
    opts?: {
      rowsKey?: string; totalsKey?: string | null;
      transform?: 'promoFlatten' | 'voucherFlatten' | 'groupByTransaction' | 'groupByPayment'
                | 'groupByDate' | 'groupByDayTransaction' | 'groupByDayPayment'
                | 'orderByTransaction' | 'orderByPayment';
      branchNames?: string[];
    },
  ): Observable<SalesReportResult> {
    return this.http
      .post<ApiResponse<Record<string, unknown>>>(`${this.base}/${path}`, body)
      .pipe(map((res) => {
        // Only a populated `errors` array is a real failure. A 200 with
        // success:false + a message (e.g. "No Expenses Found.") just means
        // empty data → fall through and let the empty-state render.
        if (res && Array.isArray(res.errors) && res.errors.length) {
          throw new Error(res.message || res.errors.join('; '));
        }
        const data = res?.data as unknown;
        // Most reports wrap rows under `data`; a few (TotalPOS) return the dto
        // at the response root with no `data` envelope → fall back to `res`.
        const d = ((data != null && typeof data === 'object' ? data : res) ?? {}) as Record<string, unknown>;
        const cap = (k: string) => k.charAt(0).toUpperCase() + k.slice(1);
        const at = (obj: Record<string, unknown>, key: string) => obj[key] ?? obj[cap(key)];

        // Nested responses (promo / vouchers group days[] → codes[]) or
        // aggregations (groupBy*) that the flat rowsKey/totalsKey can't express
        // get a named client-side transform.
        if (opts?.transform && TRANSFORMS[opts.transform]) {
          return TRANSFORMS[opts.transform](d, { branchNames: opts.branchNames });
        }

        // ── rows ──
        let rows: unknown;
        if (opts && opts.rowsKey !== undefined) {
          rows = opts.rowsKey === '' ? (Array.isArray(data) ? data : d) : at(d, opts.rowsKey);
        } else {
          rows = d['reportData'] ?? d['ReportData'] ?? d['items'] ?? d['Items']
              ?? d['discounts'] ?? d['vouchers'] ?? d['data'] ?? [];
        }

        // ── totals ──
        let totals: unknown;
        if (opts && opts.totalsKey !== undefined) {
          totals = opts.totalsKey == null ? {} : at(d, opts.totalsKey);
        } else {
          totals = d['totals'] ?? d['Totals'] ?? d['summary'] ?? d['Summary'] ?? {};
        }

        return {
          rows: filterByBranch(Array.isArray(rows) ? rows as Record<string, unknown>[] : [], { branchNames: opts?.branchNames }),
          totals: (totals && typeof totals === 'object' ? totals : {}) as Record<string, unknown>,
        };
      }));
  }

  /**
   * Raw POST for reports that don't fit the rows+totals shape (e.g. the
   * multi-section TotalsReport/TotalReport). Returns the response `data`
   * object (falls back to the response root). Throws on a populated `errors`.
   */
  raw<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .post<ApiResponse<T>>(`${this.base}/${path}`, body)
      .pipe(map((res) => {
        if (res && Array.isArray(res.errors) && res.errors.length) {
          throw new Error(res.message || res.errors.join('; '));
        }
        const data = res?.data as unknown;
        return (data != null && typeof data === 'object' ? data : res) as T;
      }));
  }
}
