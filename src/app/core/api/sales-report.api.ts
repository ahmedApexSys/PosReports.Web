import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, forkJoin, of, catchError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.models';
import { SalesReportFilter, SalesReportResult } from '../models/sales-report.models';

type Obj = Record<string, unknown>;
const asArr = (v: unknown): Obj[] => (Array.isArray(v) ? (v as Obj[]) : []);
const pick = (o: Obj, ...keys: string[]): unknown => {
  for (const k of keys) if (o && o[k] !== undefined) return o[k];
  return undefined;
};
const cap = (k: string) => k.charAt(0).toUpperCase() + k.slice(1);
/** Normalise a date string ("dd/mm/yyyy" or "yyyy-mm-dd", any separators) to "yyyy-mm-dd"
 *  so two reports' date columns can be joined regardless of their display format. */
const canonDate = (v: unknown): string => {
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return s;
};

/** Optional context handed to transforms (e.g. the branch id / names to keep). */
interface TransformCtx { branchNames?: string[]; branchId?: number | null; }

/** Numeric fields summed when aggregating Sales-Period rows into group totals. */
const SALES_SUM_FIELDS = [
  'guestNo', 'printNo', 'totalSales', 'totalCommercialDiscount', 'totalTax',
  'totalItemDiscount', 'extraDiscount', 'services', 'minimumChargeValue', 'additionValue',
  'cash', 'visa', 'cl', 'voucherAmount', 'otherPayment', 'paymentAmount', 'promoCodeValue', 'total', 'net',
];

/** Keep only rows belonging to the selected branch (the API branch filter leaks
 *  "Call Center" rows into every branch — drop the mismatches client-side).
 *  Prefer matching on branchId (robust against name drift / localisation); fall
 *  back to name matching only for rows that carry no id. Never discard a row on
 *  a pure name mismatch when an id-based decision was possible. */
function filterByBranch(rows: Obj[], ctx?: TransformCtx): Obj[] {
  const names = ctx?.branchNames?.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  const id = ctx?.branchId;
  const hasId = id != null && Number.isFinite(Number(id));
  if ((!names || !names.length) && !hasId) return rows;
  const set = new Set(names ?? []);
  return rows.filter((r) => {
    const rowId = r['branchId'];
    // Row exposes an id → decide on the id alone (id mismatch ⇒ drop; match ⇒ keep).
    if (hasId && rowId != null && String(rowId).trim() !== '') {
      return Number(rowId) === Number(id);
    }
    // No id available on this row → fall back to the (fragile) name match.
    if (!set.size) return true;
    return r['branchName'] == null || set.has(String(r['branchName']).trim().toLowerCase());
  });
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

/** Indent prefix for a flattened tree level (depth 0 = no indent). A leading
 *  glyph (no leading whitespace) keeps the depth marker intact through any
 *  downstream label trimming / i18n. */
const indent = (depth: number, name: unknown): string =>
  (depth > 0 ? '└' + '─'.repeat(depth - 1) + ' ' : '') + String(name ?? '');

/**
 * Flatten TotalPOS/GetTotalPosSales into indented rows. The flat engine already
 * shows the top-level posSales[]; we ALSO explode the nested categorySales[]
 * (Category → SubCategory) the engine otherwise discards, mapping each node onto
 * the report's existing text/qty/sales columns (transactionName / totalOrderNum
 * / totalSales) with a depth prefix so the on-screen table + receipt both render
 * the breakdown. Totals come back at the response root → keep them.
 */
function totalPosTree(d: Obj, ctx?: TransformCtx): SalesReportResult {
  const posRows = filterByBranch(asArr(pick(d, 'posSales', 'PosSales')), ctx);
  const rows: Obj[] = [...posRows];
  for (const c of asArr(pick(d, 'categorySales', 'CategorySales'))) {
    rows.push({
      transactionName: indent(0, pick(c, 'categoryName', 'CategoryName')),
      totalOrderNum: Number(pick(c, 'count', 'Count')) || 0,
      totalSales: Number(pick(c, 'categoryTotalSales', 'CategoryTotalSales')) || 0,
      net: Number(pick(c, 'categoryTotalSales', 'CategoryTotalSales')) || 0,
    });
    for (const s of asArr(pick(c, 'subCategorySales', 'SubCategorySales'))) {
      rows.push({
        transactionName: indent(1, pick(s, 'subCategoryName', 'SubCategoryName')),
        totalOrderNum: Number(pick(s, 'count', 'Count')) || 0,
        totalSales: Number(pick(s, 'subCategoryTotalSales', 'SubCategoryTotalSales')) || 0,
        net: Number(pick(s, 'subCategoryTotalSales', 'SubCategoryTotalSales')) || 0,
      });
    }
  }
  const totals = pick(d, 'totals', 'Totals');
  return { rows, totals: (totals && typeof totals === 'object' ? totals : {}) as Obj };
}

/**
 * Flatten SoldItem/GetSoldItemsSummary's category → subCategory → item → variant
 * tree into indented rows mapped onto the report's existing columns
 * (categoryName / totalQuantity / totalSales). Each level carries its own
 * qty + sales; deeper levels are prefixed so the hierarchy reads top-down. If a
 * level's array is absent it's simply skipped (graceful for partial responses).
 */
function soldItemsTree(d: Obj, ctx?: TransformCtx): SalesReportResult {
  const cats = filterByBranch(asArr(pick(d, 'categories', 'Categories')), ctx);
  const rows: Obj[] = [];
  const qty = (o: Obj) => Number(pick(o, 'totalQuantity', 'TotalQuantity', 'quantity', 'Quantity', 'qty', 'Qty')) || 0;
  const sales = (o: Obj) => Number(pick(o, 'totalSales', 'TotalSales', 'total', 'Total')) || 0;
  // __depth drives the tier styling in the shared table so a category header (0) reads distinctly
  // from its sub-categories (1) / items (2) / variants (3) — otherwise the flat, indented list runs
  // together and a bucket like "Other" is hard to pick out by eye.
  const push = (depth: number, name: unknown, o: Obj) =>
    rows.push({ categoryName: indent(depth, name), totalQuantity: qty(o), totalSales: sales(o), __depth: depth });
  for (const c of cats) {
    push(0, pick(c, 'categoryName', 'CategoryName'), c);
    for (const sc of asArr(pick(c, 'subCategories', 'SubCategories'))) {
      push(1, pick(sc, 'subCategoryName', 'SubCategoryName'), sc);
      for (const it of asArr(pick(sc, 'items', 'Items'))) {
        push(2, pick(it, 'itemName', 'ItemName'), it);
        for (const v of asArr(pick(it, 'variants', 'Variants'))) {
          push(3, pick(v, 'variantName', 'VariantName', 'name', 'Name'), v);
        }
      }
    }
  }
  const totals = pick(d, 'totals', 'Totals');
  return { rows, totals: (totals && typeof totals === 'object' ? totals : {}) as Obj };
}

/**
 * Named client-side transforms for report responses the flat rowsKey/totalsKey
 * can't express. promo / vouchers come back as days[] each holding a per-code
 * array (exploded to one row per code); the groupBy* variants aggregate the
 * Sales-Period per-order rows into per-transaction / per-payment summaries;
 * the *Tree variants explode nested category/item hierarchies into indented rows.
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
  // TotalDiscount returns discounts[] each with a nested days[] — explode into one
  // row per (discount × day) so the report reads DAILY (Date column) instead of one
  // aggregate row per discount. The discount-level dimension strings (branch /
  // transaction / online-app / user / pay-way) are comma-joined aggregates, so we
  // carry them onto each of that discount's day rows. Totals come from the server
  // grandTotals (data.totals) verbatim — its keys already match the column totalKeys
  // (note: the grand-total of "total" is keyed "totalDiscount"). Never re-sum the
  // flattened rows: per-day cash/visa/ledge are de-duped per order server-side.
  discountDaily: (d) => {
    const groups = asArr(pick(d, 'discounts', 'Discounts'));
    const rows: Obj[] = [];
    for (const g of groups) {
      const base = {
        discountId: pick(g, 'discountId', 'DiscountId'),
        discountName: pick(g, 'discountName', 'DiscountName'),
        branchName: pick(g, 'branchName', 'BranchName'),
        transactionName: pick(g, 'transactionName', 'TransactionName'),
        onlineAppName: pick(g, 'onlineAppName', 'OnlineAppName'),
        userName: pick(g, 'userName', 'UserName'),
        payWay: pick(g, 'payWay', 'PayWay'),
      };
      for (const day of asArr(pick(g, 'days', 'Days'))) {
        rows.push({
          ...base,
          day: pick(day, 'day', 'Day'),
          totalCommercialItemDiscount: pick(day, 'totalCommercialItemDiscount', 'TotalCommercialItemDiscount'),
          totalItemDiscount: pick(day, 'totalItemDiscount', 'TotalItemDiscount'),
          service: pick(day, 'service', 'Service'),
          tax: pick(day, 'tax', 'Tax'),
          cash: pick(day, 'cash', 'Cash'),
          visa: pick(day, 'visa', 'Visa'),
          ledge: pick(day, 'ledge', 'Ledge'),
          total: pick(day, 'total', 'Total'),
        });
      }
    }
    // Date-led ordering so the merged Date cell groups each day's discounts together.
    rows.sort((a, b) =>
      canonDate(a['day']).localeCompare(canonDate(b['day'])) ||
      String(a['discountName'] ?? '').localeCompare(String(b['discountName'] ?? '')));
    const totals = pick(d, 'totals', 'Totals');
    return { rows, totals: (totals && typeof totals === 'object' ? totals : {}) as Obj };
  },

  // ── Expandable per-day TREE transforms (one summary row per day → its detail
  //    rows). __level 0 = day summary, __level 1 = detail under __parent=dayKey.
  //    The engine collapses children until the day row is clicked. ──
  discountDailyTree: (d) => {
    const groups = asArr(pick(d, 'discounts', 'Discounts'));
    const F = ['totalCommercialItemDiscount', 'totalItemDiscount', 'service', 'tax', 'cash', 'visa', 'ledge', 'total'];
    const dayMap = new Map<string, { dayVal: unknown; sums: Obj; children: Obj[] }>();
    for (const g of groups) {
      const dname = pick(g, 'discountName', 'DiscountName');
      const did = pick(g, 'discountId', 'DiscountId');
      for (const day of asArr(pick(g, 'days', 'Days'))) {
        const dayVal = pick(day, 'day', 'Day');
        const k = canonDate(dayVal);
        let e = dayMap.get(k);
        if (!e) { e = { dayVal, sums: Object.fromEntries(F.map((f) => [f, 0])) as Obj, children: [] }; dayMap.set(k, e); }
        const child: Obj = { discountId: did, discountName: dname };
        for (const f of F) { const v = Number(pick(day, f, cap(f))) || 0; child[f] = v; (e.sums[f] as number) += v; }
        e.children.push(child);
      }
    }
    const rows: Obj[] = [];
    for (const k of [...dayMap.keys()].sort()) {
      const e = dayMap.get(k)!;
      rows.push({ __level: 0, __key: k, __expandable: true, day: e.dayVal, discountName: '', ...e.sums });
      e.children.sort((a, b) => String(a['discountName'] ?? '').localeCompare(String(b['discountName'] ?? '')));
      for (const c of e.children) rows.push({ __level: 1, __parent: k, day: '', ...c });
    }
    const totals = pick(d, 'totals', 'Totals');
    return { rows, totals: (totals && typeof totals === 'object' ? totals : {}) as Obj };
  },
  promoDailyTree: (d) => {
    const rows: Obj[] = [];
    for (const day of asArr(pick(d, 'days', 'Days'))) {
      const dayVal = pick(day, 'day', 'Day');
      const k = canonDate(dayVal);
      const t = (pick(day, 'totals', 'Totals') ?? {}) as Obj;
      rows.push({
        __level: 0, __key: k, __expandable: true, day: dayVal, promoCodeName: '',
        ordersCount: Number(pick(t, 'ordersCount', 'OrdersCount')) || 0,
        cash: Number(pick(t, 'cash', 'Cash')) || 0, visa: Number(pick(t, 'visa', 'Visa')) || 0,
        ledge: Number(pick(t, 'ledge', 'Ledge')) || 0, total: Number(pick(t, 'total', 'Total')) || 0,
      });
      for (const code of asArr(pick(day, 'promoCodes', 'PromoCodes'))) rows.push({ __level: 1, __parent: k, day: '', ...code });
    }
    const totals = pick(d, 'grandTotals', 'GrandTotals');
    return { rows, totals: (totals && typeof totals === 'object' ? totals : {}) as Obj };
  },
  voucherDailyTree: (d) => {
    const rows: Obj[] = [];
    for (const day of asArr(pick(d, 'days', 'Days'))) {
      const dayVal = pick(day, 'day', 'Day');
      const k = canonDate(dayVal);
      const t = (pick(day, 'totals', 'Totals') ?? {}) as Obj;
      rows.push({
        __level: 0, __key: k, __expandable: true, day: dayVal, voucherCode: '',
        vouchersCount: Number(pick(t, 'vouchersCount', 'VouchersCount')) || 0,
        distinctOrders: Number(pick(t, 'distinctOrders', 'DistinctOrders')) || 0,
        totalVoucherAmount: Number(pick(t, 'totalVoucherAmount', 'TotalVoucherAmount')) || 0,
        cash: Number(pick(t, 'cash', 'Cash')) || 0, visa: Number(pick(t, 'visa', 'Visa')) || 0, ledge: Number(pick(t, 'ledge', 'Ledge')) || 0,
      });
      for (const code of asArr(pick(day, 'voucherCodes', 'VoucherCodes'))) rows.push({ __level: 1, __parent: k, day: '', ...code });
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
  totalPosTree,
  soldItemsTree,
};

/**
 * Endpoint-driven nested-tree transforms. The flat rowsKey engine discards the
 * category/sub-category/item/variant levels these two reports nest under their
 * top-level rows, so we detect them by endpoint here (the report id/registry is
 * owned elsewhere) and explode the tree into indented flat rows.
 */
const TREE_BY_ENDPOINT: Record<string, 'totalPosTree' | 'soldItemsTree'> = {
  // total-pos shows per-POS rows only — its category breakdown does NOT belong in
  // the Transaction column, so it's not tree-expanded here. (soldItemsTree stays.)
  'solditem/getsolditemssummary': 'soldItemsTree',
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
                | 'orderByTransaction' | 'orderByPayment'
                | 'totalPosTree' | 'soldItemsTree' | 'discountDaily'
                | 'discountDailyTree' | 'promoDailyTree' | 'voucherDailyTree';
      branchNames?: string[];
      branchId?: number | null;
      /** Fetch a second per-date endpoint and merge one numeric value onto each row by date. */
      mergeByDate?: {
        endpoint: string; rowsKey: string;
        srcDateKey: string; srcValueKey: string;
        dstDateKey: string; dstKey: string;
      };
    },
  ): Observable<SalesReportResult> {
    const primary$ = this.http
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
        const at = (obj: Record<string, unknown>, key: string) => obj[key] ?? obj[cap(key)];

        const ctx: TransformCtx = { branchNames: opts?.branchNames, branchId: opts?.branchId };

        // Nested responses (promo / vouchers group days[] → codes[]) or
        // aggregations (groupBy*) that the flat rowsKey/totalsKey can't express
        // get a named client-side transform. A couple of reports nest a
        // category/item tree under their flat rows → detect them by endpoint
        // (registry-owned id lives elsewhere) and flatten that too.
        const treeName = TREE_BY_ENDPOINT[path.trim().toLowerCase()];
        const transformName = opts?.transform ?? treeName;
        if (transformName && TRANSFORMS[transformName]) {
          return TRANSFORMS[transformName](d, ctx);
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
          rows: filterByBranch(Array.isArray(rows) ? rows as Record<string, unknown>[] : [], ctx),
          totals: (totals && typeof totals === 'object' ? totals : {}) as Record<string, unknown>,
        };
      }));

    // Optional secondary per-date merge (e.g. expenses totals-by-date → a Total
    // Expenses column on the daily Sales Period totals). The expenses endpoint may
    // legitimately have no data → swallow and treat as zeros, never fail the report.
    const mb = opts?.mergeByDate;
    if (!mb) return primary$;

    const merge$ = this.http
      .post<ApiResponse<Record<string, unknown>>>(`${this.base}/${mb.endpoint}`, body)
      .pipe(
        map((res) => {
          const data = res?.data as unknown;
          const d = ((data != null && typeof data === 'object' ? data : res) ?? {}) as Obj;
          return asArr(pick(d, mb.rowsKey, cap(mb.rowsKey)));
        }),
        catchError(() => of([] as Obj[])),
      );

    return forkJoin([primary$, merge$]).pipe(map(([result, mrows]) => {
      const byDate = new Map<string, number>();
      for (const r of mrows) {
        const k = canonDate(pick(r, mb.srcDateKey, cap(mb.srcDateKey)));
        byDate.set(k, (byDate.get(k) ?? 0) + (Number(pick(r, mb.srcValueKey, cap(mb.srcValueKey))) || 0));
      }
      let sum = 0;
      for (const row of result.rows) {
        const v = byDate.get(canonDate(row[mb.dstDateKey])) ?? 0;
        row[mb.dstKey] = v;
        sum += v;
      }
      (result.totals as Obj)[mb.dstKey] = sum;
      return result;
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
        // A 200 envelope that explicitly failed (succeeded/success === false) and
        // carries no data is a real error here (raw reports have no empty-state).
        if (res && (res.succeeded === false || res.success === false) && data == null) {
          throw new Error(res.message || 'Request failed');
        }
        return (data != null && typeof data === 'object' ? data : res) as T;
      }));
  }
}
