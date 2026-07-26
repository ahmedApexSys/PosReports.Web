/**
 * Models for the Sales-reports migration. These reports are POST endpoints on the
 * POS API that return a flat row list + a totals object. A single generic
 * tabular-report engine renders them all — each report is just a column config.
 */

export type CellType = 'text' | 'int' | 'number' | 'money' | 'date' | 'time';

/** One column in a tabular report. */
export interface ReportColumn {
  /** property name on the row object (camelCase, as the API returns). */
  key: string;
  labelEn: string;
  labelAr: string;
  type?: CellType;            // default 'text'
  /** key on the Totals object for the footer cell (optional). */
  totalKey?: string;
  /** start hidden in the column picker. */
  defaultHidden?: boolean;
  /** right-align (numbers default to right automatically). */
  alignEnd?: boolean;
  /** approx character width — used to size export columns. */
  width?: number;
  /** for text columns, render the sentinel value "0" as a dash (e.g. promo code / mobile). */
  dashIfZero?: boolean;
  /** truncate the cell text to this many chars + "…" (used on the narrow receipt). */
  maxLen?: number;
}

/**
 * Which filter dropdowns a report's filter bar offers. Maps 1:1 to the
 * shared DailySalesRequestFilterDto fields. Branch + date live in the header.
 */
export type ReportFilterKey =
  | 'payment'      // payway (payment-method name)
  | 'transaction'  // transactionId
  | 'shift'        // shiftId
  | 'discount'     // discountId
  | 'promo'        // promoCodeDiscountId
  | 'voucher'      // voucherName
  | 'onlineApp'    // onlineApp
  | 'user'         // userId (cashier / user)
  | 'waiter'       // waiterId
  | 'pilot';       // poiltId

/** Mirrors the shared DailySalesRequestFilterDto the sales reports accept. */
export interface SalesReportFilter {
  fromDate: string;
  toDate: string;
  branchId: number | null;
  ordersFilter: 'Paid' | 'UnPaid' | 'All';
  payway?: string;
  transactionId?: number;
  shiftId?: number;
  userId?: string;
  waiterId?: string;
  poiltId?: string;
  onlineApp?: number;
  discountId?: number;
  promoCodeDiscountId?: number;
  voucherName?: string;
  posId?: number;
}

/** Normalised report payload — rows + an optional totals object. */
export interface SalesReportResult {
  rows: Record<string, unknown>[];
  totals: Record<string, unknown>;
}

/**
 * One payment-method row in the bottom payment-summary bar. `totalKey` is the
 * key on the report's `totals` object that holds this method's amount
 * (e.g. 'cash', 'visa', 'cl', 'otherPayment').
 */
export interface PaymentSummaryRow {
  key: string;
  labelEn: string;
  labelAr: string;
  totalKey: string;
  /** always render this row even when its total is 0 (e.g. Cash / Visa). */
  always?: boolean;
}

/**
 * Config for the bottom PayWay summary bar (Cash / Visa / Ledge / Other ×
 * Total · Reservations · Customer Payment · Expenses · Tip · Net), recreated
 * from the legacy Cashier-Orders report footer. Total + Net come from the
 * report's `totals`; the rest are 0 unless the API exposes them.
 */
export interface PaymentSummaryConfig {
  rows: PaymentSummaryRow[];
}

/**
 * One column on the narrow thermal receipt (Flash / POS 72 / POS 80). References
 * an existing report column by `key`; `en`/`ar` give a SHORT header for the
 * narrow roll (e.g. "C.Disc" instead of "Commercial Discount"). When omitted the
 * column's normal label is used. The receipt renders exactly this curated set —
 * the legacy layout — instead of every visible column.
 */
export interface ReceiptColumn {
  key: string;
  en?: string;
  ar?: string;
  /** Truncate the cell text to this many chars + "…" on the receipt (narrow roll). */
  maxLen?: number;
}

/** One line in the receipt totals block (value pulled from the report's `totals`). */
export interface ReceiptTotal {
  /** key on the report's `totals` object. */
  key: string;
  en: string;
  ar: string;
  /** render bold/red, with a top divider (e.g. the Net line). */
  emphasize?: boolean;
}

/** A full report definition consumed by the generic tabular shell. */
/**
 * Row-level drill-down: clicking a row opens `route` with `{ [param]: row[rowKey] }`
 * as a query param. Kept declarative so a report only has to name the id column.
 */
export interface RowDrilldown {
  /** absolute route path, e.g. '/journey'. */
  route: string;
  /** query-param name the target page reads, e.g. 'orderId'. */
  param: string;
  /** row property carrying the id, e.g. 'orderId'. */
  rowKey: string;
  /** tooltip shown on hoverable rows. */
  titleEn?: string;
  titleAr?: string;
}

export interface ReportDef {
  /** stable id — keys the per-user saved column layout in localStorage. */
  id: string;
  titleEn: string;
  titleAr: string;
  subtitleEn?: string;
  subtitleAr?: string;
  /** API path after /api/ — e.g. 'DailySalesController/getDailySalesReport'. */
  endpoint: string;
  columns: ReportColumn[];
  /** default OrdersFilter when the report opens. */
  defaultOrdersFilter?: 'Paid' | 'UnPaid' | 'All';
  /** which filter dropdowns to offer. Omit → show the full set, `[]` → none. */
  filters?: ReportFilterKey[];
  /**
   * Where the row array lives inside the API response `data` object (camelCase
   * key) — e.g. 'items', 'reportData', 'totals', 'data'. Omit → the runner's
   * heuristic (reportData/items/data/…). `''` → `data` itself is the array.
   */
  rowsKey?: string;
  /** Where the totals OBJECT lives inside `data` (e.g. 'summary', 'grand', 'totals'). null → no totals. */
  totalsKey?: string | null;
  /** Extra fixed body fields merged into every request (beyond date/branch/ordersFilter). */
  requestExtra?: Record<string, unknown>;
  /**
   * Named client-side transform the flat rowsKey/totalsKey can't express.
   * - promoFlatten / voucherFlatten: explode days[].promoCodes[] / .voucherCodes[]
   *   into flat per-code rows (+ grandTotals footer).
   * - groupByTransaction / groupByPayment: aggregate the Sales-Period per-order
   *   rows into one summary row per transaction type / payment method.
   * - groupByDayTransaction / groupByDayPayment: aggregate into one row per
   *   (day × transaction) / (day × payment).
   * - discountDaily: explode TotalDiscount discounts[].days[] into one row per
   *   (discount × day) with a Date column (grandTotals footer).
   */
  transform?: 'promoFlatten' | 'voucherFlatten' | 'groupByTransaction' | 'groupByPayment'
            | 'groupByDate' | 'groupByDayTransaction' | 'groupByDayPayment'
            | 'orderByTransaction' | 'orderByPayment' | 'discountDaily'
            | 'discountDailyTree' | 'discountOrdersTree' | 'promoDailyTree' | 'voucherDailyTree'
            | 'discountDayOrdersTree' | 'promoOrdersTree' | 'promoDayOrdersTree'
            | 'voucherOrdersTree' | 'voucherDayOrdersTree' | 'groupRowsByWaiter';
  /**
   * Expandable per-day tree: the transform emits one summary row per day
   * (`__level: 0`) followed by its detail rows (`__level: 1`, `__parent: <dayKey>`).
   * The table shows day rows collapsed; clicking a day row reveals its details.
   */
  expandable?: boolean;
  /**
   * Makes each row clickable, opening a detail page for that row. Used to go
   * from a per-order report straight into that order's journey.
   * Rows whose `rowKey` value is missing/0 stay inert (no cursor, no navigation).
   */
  drilldown?: RowDrilldown;
  /** Optional bottom PayWay summary bar derived from the report's `totals`. */
  paymentSummary?: PaymentSummaryConfig;
  /**
   * Curated, short-named column set for the thermal receipt (Flash / POS 72/80)
   * — matches the legacy receipt layout so it fits the roll instead of dumping
   * every column. Omit → the receipt auto-caps the visible columns to what fits.
   */
  receiptColumns?: ReceiptColumn[];
  /**
   * Curated totals block for the receipt (e.g. Cash / Visa / Ledge / Net on the
   * cashier daily report). Omit → the receipt sums the numeric `receiptColumns`
   * (Net emphasized); failing that, the payment summary.
   */
  receiptTotals?: ReceiptTotal[];
  /** Footer row-count unit label (default "rows"/"صف"); e.g. "orders"/"طلب". */
  rowUnitEn?: string;
  rowUnitAr?: string;
  /**
   * Column key whose consecutive equal values are merged into one cell
   * (rowspan) so the value isn't repeated — e.g. 'orderDate' on the
   * date × transaction / date × payment totals. Rows must already be ordered
   * so equal values are adjacent.
   */
  mergeColumn?: string;
  /**
   * Optionally fetch a second per-date endpoint and merge one numeric value onto
   * each row of this report by matching date — lets the single-endpoint engine
   * surface a cross-report column (e.g. Total Expenses on the daily Sales Period totals).
   */
  mergeByDate?: {
    endpoint: string; rowsKey: string;
    srcDateKey: string; srcValueKey: string;
    dstDateKey: string; dstKey: string;
  };
}

/** Saved per-user column layout for one report. */
export interface SavedColumnLayout {
  /** column keys in display order. */
  order: string[];
  /** column keys hidden by the user. */
  hidden: string[];
}
