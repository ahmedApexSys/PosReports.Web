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
}

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

/** A full report definition consumed by the generic tabular shell. */
export interface ReportDef {
  titleEn: string;
  titleAr: string;
  subtitleEn?: string;
  subtitleAr?: string;
  /** API path after /api/ — e.g. 'SalePeriod/GetPeriodSalesByOrderDate'. */
  endpoint: string;
  columns: ReportColumn[];
  /** default OrdersFilter when the report opens. */
  defaultOrdersFilter?: 'Paid' | 'UnPaid' | 'All';
}
