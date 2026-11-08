/**
 * "Call centre sales by agent" — `CallCenterAgentSales/CallCenterAgentSalesReport`
 * (API permission 572 `CallCenterAgentSalesPage`, owner 2026-11-08).
 *
 * One API call returns every section: per agent (with a total row), agent × branch,
 * per day, per day × agent, and the order list. `ccSections` turns it into labelled
 * tables shared by the page AND the Excel / A4 exports, so the columns are defined once.
 */

export interface CcOption { id: string; nameEn: string; nameAr: string }

interface CcFigures {
  orders: number; netSales: number; averageOrder: number;
  cancelledOrders: number; cancelledValue: number;
}

export interface CcAgentRow extends CcFigures {
  agentId: string; agentName: string; agentNameAr: string;
  totalSales: number; services: number; discounts: number; tax: number; sharePercent: number;
}
export interface CcAgentBranchRow extends CcFigures {
  agentId: string; agentName: string; agentNameAr: string;
  branchId: number; branchName: string; branchNameAr: string; sharePercent: number;
}
export interface CcDayRow extends CcFigures { date: string; agents: number; sharePercent: number }
export interface CcAgentDayRow extends CcFigures { date: string; agentId: string; agentName: string; agentNameAr: string }
export interface CcOrderRow {
  orderId: number; orderNo: number; receiptNumber: number; orderDate: string; orderTime: string;
  branchId: number; branchName: string; branchNameAr: string;
  agentId: string; agentName: string; agentNameAr: string;
  customerPhone: string; customerName: string; transactionId: number; orderType: string;
  totalSales: number; discounts: number; services: number; tax: number; net: number;
  paymentMethod: string; status: string; isCancelled: boolean;
}

export interface CcReportData {
  fromDate?: string; toDate?: string;
  totals?: CcAgentRow;
  agents?: CcAgentRow[];
  agentBranches?: CcAgentBranchRow[];
  days?: CcDayRow[];
  agentDays?: CcAgentDayRow[];
  orders?: CcOrderRow[];
  agentOptions?: CcOption[];
  branchOptions?: CcOption[];
}

export const CC_PERMISSION = 'CallCenterAgentSalesPage';
export const CC_ENDPOINT = 'CallCenterAgentSales/CallCenterAgentSalesReport';

/** Order types the filter offers (OrderHeader.TransactionId). */
export const CC_ORDER_TYPES: { id: number; en: string; ar: string }[] = [
  { id: 2, en: 'Delivery', ar: 'دليفري' },
  { id: 3, en: 'Pickup', ar: 'استلام من الفرع' },
  { id: 1, en: 'Dine In', ar: 'صالة' },
];

export interface CcColumn<T> {
  en: string; ar: string;
  value: (row: T, ar: boolean) => string | number;
  numeric?: boolean;
}
export interface CcSection<T = any> {
  key: 'agents' | 'agentBranches' | 'days' | 'agentDays' | 'orders';
  titleEn: string; titleAr: string;
  columns: CcColumn<T>[];
  rows: T[];
  /** Total row, one cell per column, when the section has one. */
  footer?: (string | number)[];
}

export const money = (v: unknown): string => {
  const n = Number(v);
  return (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const int = (v: unknown): string => {
  const n = Number(v);
  return (Number.isFinite(n) ? n : 0).toLocaleString('en-US');
};
const pct = (v: unknown): string => `${(Number(v) || 0).toFixed(2)}%`;

const agentName = (r: { agentName: string; agentNameAr: string }, ar: boolean): string =>
  (ar ? r.agentNameAr || r.agentName : r.agentName || r.agentNameAr) || '—';
const branchName = (r: { branchName: string; branchNameAr: string }, ar: boolean): string =>
  (ar ? r.branchNameAr || r.branchName : r.branchName || r.branchNameAr) || '—';

/** Order type label, by the id the filter uses, else the name stamped on the order. */
export function orderTypeLabel(transactionId: number, stamped: string, ar: boolean): string {
  const t = CC_ORDER_TYPES.find((x) => x.id === transactionId);
  return t ? (ar ? t.ar : t.en) : (stamped || '—');
}

function figureCols<T extends CcFigures>(): CcColumn<T>[] {
  return [
    { en: 'Orders', ar: 'عدد الطلبات', value: (r) => int(r.orders), numeric: true },
    { en: 'Net Sales', ar: 'صافي المبيعات', value: (r) => money(r.netSales), numeric: true },
    { en: 'Avg Order', ar: 'متوسط الطلب', value: (r) => money(r.averageOrder), numeric: true },
  ];
}
function cancelCols<T extends CcFigures>(): CcColumn<T>[] {
  return [
    { en: 'Cancelled', ar: 'ملغي', value: (r) => int(r.cancelledOrders), numeric: true },
    { en: 'Cancelled Value', ar: 'قيمة الملغي', value: (r) => money(r.cancelledValue), numeric: true },
  ];
}

/** Every section of the report, in reading order. */
export function ccSections(d: CcReportData, ar: boolean): CcSection[] {
  const t = d.totals;
  const L = (en: string, a: string) => (ar ? a : en);

  const agentCols: CcColumn<CcAgentRow>[] = [
    { en: 'Agent', ar: 'الموظف', value: (r) => agentName(r, ar) },
    ...figureCols<CcAgentRow>(),
    { en: 'Delivery / Service', ar: 'التوصيل / الخدمة', value: (r) => money(r.services), numeric: true },
    { en: 'Discounts', ar: 'الخصومات', value: (r) => money(r.discounts), numeric: true },
    ...cancelCols<CcAgentRow>(),
    { en: 'Share %', ar: 'النسبة %', value: (r) => pct(r.sharePercent), numeric: true },
  ];

  const sections: CcSection[] = [
    {
      key: 'agents', titleEn: 'Sales by agent', titleAr: 'المبيعات حسب الموظف',
      columns: agentCols, rows: d.agents ?? [],
      footer: t ? agentCols.map((c, i) => (i === 0 ? L('Total', 'الإجمالي') : c.value(t, ar))) : undefined,
    },
    {
      key: 'agentBranches', titleEn: 'Agent × branch', titleAr: 'الموظف × الفرع',
      columns: [
        { en: 'Agent', ar: 'الموظف', value: (r: CcAgentBranchRow) => agentName(r, ar) },
        { en: 'Branch', ar: 'الفرع', value: (r: CcAgentBranchRow) => branchName(r, ar) },
        ...figureCols<CcAgentBranchRow>(),
        ...cancelCols<CcAgentBranchRow>(),
        { en: 'Share %', ar: 'النسبة %', value: (r: CcAgentBranchRow) => pct(r.sharePercent), numeric: true },
      ],
      rows: d.agentBranches ?? [],
    },
    {
      key: 'days', titleEn: 'Per day', titleAr: 'لكل يوم',
      columns: [
        { en: 'Date', ar: 'التاريخ', value: (r: CcDayRow) => r.date },
        { en: 'Agents', ar: 'عدد الموظفين', value: (r: CcDayRow) => int(r.agents), numeric: true },
        ...figureCols<CcDayRow>(),
        ...cancelCols<CcDayRow>(),
      ],
      rows: d.days ?? [],
    },
    {
      key: 'agentDays', titleEn: 'Per day × agent', titleAr: 'لكل يوم × الموظف',
      columns: [
        { en: 'Date', ar: 'التاريخ', value: (r: CcAgentDayRow) => r.date },
        { en: 'Agent', ar: 'الموظف', value: (r: CcAgentDayRow) => agentName(r, ar) },
        ...figureCols<CcAgentDayRow>(),
        ...cancelCols<CcAgentDayRow>(),
      ],
      rows: d.agentDays ?? [],
    },
    {
      key: 'orders', titleEn: 'Orders', titleAr: 'الطلبات',
      columns: [
        { en: 'Order No.', ar: 'رقم الطلب', value: (r: CcOrderRow) => r.orderNo || r.orderId },
        { en: 'Date', ar: 'التاريخ', value: (r: CcOrderRow) => r.orderDate },
        { en: 'Time', ar: 'الوقت', value: (r: CcOrderRow) => r.orderTime || '—' },
        { en: 'Branch', ar: 'الفرع', value: (r: CcOrderRow) => branchName(r, ar) },
        { en: 'Agent', ar: 'الموظف', value: (r: CcOrderRow) => agentName(r, ar) },
        { en: 'Customer Phone', ar: 'تليفون العميل', value: (r: CcOrderRow) => r.customerPhone || '—' },
        { en: 'Order Type', ar: 'نوع الطلب', value: (r: CcOrderRow) => orderTypeLabel(r.transactionId, r.orderType, ar) },
        { en: 'Net', ar: 'الصافي', value: (r: CcOrderRow) => money(r.net), numeric: true },
        { en: 'Payment', ar: 'طريقة الدفع', value: (r: CcOrderRow) => r.paymentMethod || '—' },
        { en: 'Status', ar: 'الحالة', value: (r: CcOrderRow) => (r.isCancelled ? L('Cancelled', 'ملغي') : (r.status || '—')) },
      ],
      rows: d.orders ?? [],
    },
  ];
  return sections;
}

/** The order list with EVERY column, for Excel ("all columns"). */
export function ccOrderExcelColumns(ar: boolean): CcColumn<CcOrderRow>[] {
  const base = ccSections({}, ar).find((s) => s.key === 'orders')!.columns as CcColumn<CcOrderRow>[];
  return [
    { en: 'Order ID', ar: 'معرّف الطلب', value: (r) => r.orderId },
    ...base.slice(0, 5),
    { en: 'Customer Name', ar: 'اسم العميل', value: (r) => r.customerName || '—' },
    ...base.slice(5, 7),
    { en: 'Receipt No.', ar: 'رقم الإيصال', value: (r) => r.receiptNumber || '—' },
    { en: 'Total Sales', ar: 'إجمالي المبيعات', value: (r) => money(r.totalSales), numeric: true },
    { en: 'Discounts', ar: 'الخصومات', value: (r) => money(r.discounts), numeric: true },
    { en: 'Delivery / Service', ar: 'التوصيل / الخدمة', value: (r) => money(r.services), numeric: true },
    { en: 'Tax', ar: 'الضريبة', value: (r) => money(r.tax), numeric: true },
    ...base.slice(7),
  ];
}

/** The short per-agent table for the POS 72 / 80 roll: summary only. */
export const CC_RECEIPT_COLUMNS: CcColumn<CcAgentRow>[] = [
  { en: 'Agent', ar: 'الموظف', value: (r, ar) => agentName(r, ar) },
  { en: 'Orders', ar: 'طلبات', value: (r) => int(r.orders), numeric: true },
  { en: 'Net', ar: 'الصافي', value: (r) => money(r.netSales), numeric: true },
  { en: '%', ar: '%', value: (r) => pct(r.sharePercent), numeric: true },
];

/** Totals block under the roll. */
export function ccReceiptTotals(t: CcAgentRow | undefined, ar: boolean): { label: string; value: string; emphasize?: boolean }[] {
  if (!t) return [];
  const L = (en: string, a: string) => (ar ? a : en);
  return [
    { label: L('Orders', 'عدد الطلبات'), value: int(t.orders) },
    { label: L('Avg Order', 'متوسط الطلب'), value: money(t.averageOrder) },
    { label: L('Delivery / Service', 'التوصيل / الخدمة'), value: money(t.services) },
    { label: L('Discounts', 'الخصومات'), value: money(t.discounts) },
    { label: L('Cancelled', 'ملغي'), value: `${int(t.cancelledOrders)} · ${money(t.cancelledValue)}` },
    { label: L('Net Sales', 'صافي المبيعات'), value: money(t.netSales), emphasize: true },
  ];
}
