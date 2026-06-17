// One-off generator: turns the workflow spec JSON into report-registry.ts
const fs = require('fs');
const path = require('path');

const SRC = process.argv[2];
const OUT = path.join(__dirname, 'src', 'app', 'core', 'reports', 'report-registry.ts');

const data = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const reports = (data.result && data.result.reports) || data.reports || [];

// Verified live against the API responses — keys are taken as the agents
// extracted them (the camelCase the API actually emits, e.g. SalePeriod → 'cl').
const KEY_FIX = {};
const fixKey = (k) => KEY_FIX[k] || k;

const q = (s) => JSON.stringify(s);

function colLiteral(c) {
  const key = fixKey(c.key);
  const parts = [`key: ${q(key)}`, `labelEn: ${q(c.labelEn)}`, `labelAr: ${q(c.labelAr)}`, `type: ${q(c.type || 'text')}`];
  if (c.totalKey) parts.push(`totalKey: ${q(fixKey(c.totalKey))}`);
  if (c.defaultHidden || /Id$/.test(key)) parts.push('defaultHidden: true');
  if (c.dashIfZero) parts.push('dashIfZero: true');
  return `      { ${parts.join(', ')} },`;
}

function defLiteral(r) {
  const filters = Array.isArray(r.filters)
    ? `[${r.filters.map(q).join(', ')}]`
    : '[]';
  const L = [];
  L.push(`  ${q(r.id)}: {`);
  L.push(`    id: ${q(r.id)},`);
  L.push(`    titleEn: ${q(r.titleEn)}, titleAr: ${q(r.titleAr)},`);
  if (r.subtitleEn) L.push(`    subtitleEn: ${q(r.subtitleEn)},`);
  if (r.subtitleAr) L.push(`    subtitleAr: ${q(r.subtitleAr)},`);
  if (r.rowUnitEn) L.push(`    rowUnitEn: ${q(r.rowUnitEn)}, rowUnitAr: ${q(r.rowUnitAr || '')},`);
  L.push(`    endpoint: ${q(r.endpoint)},`);
  L.push(`    rowsKey: ${q(r.rowsKey || '')}, totalsKey: ${r.totalsKey == null ? 'null' : q(r.totalsKey)},`);
  if (r.transform) L.push(`    transform: ${q(r.transform)},`);
  if (r.requestExtra && Object.keys(r.requestExtra).length) L.push(`    requestExtra: ${JSON.stringify(r.requestExtra)},`);
  if (r.defaultOrdersFilter) L.push(`    defaultOrdersFilter: ${q(r.defaultOrdersFilter)},`);
  L.push(`    filters: ${filters},`);
  L.push(`    columns: [`);
  L.push(r.columns.map(colLiteral).join('\n'));
  L.push(`    ],`);
  if (r.paymentSummary) L.push(`    paymentSummary: ${JSON.stringify(r.paymentSummary)},`);
  L.push(`  },`);
  return L.join('\n');
}

// ── Overrides from live verification ──────────────────────────────────────
// daily-transactions: the time variant (getDailySalesTimeReport) 500s on the
// server ("Nullable object must have a value" — a null DateTime in its time
// projection). Repoint to the proven getDailySalesReport (per-order, names
// resolved). Columns = the working Daily Sales shape (DailySalesDto).
// The PayWay summary bar (Cash/Visa/Ledge/Other × Total..Net) is derived from
// the report `totals` — recreated from the legacy Cashier-Orders footer.
const PAYMENT_SUMMARY = {
  rows: [
    { key: 'cash', labelEn: 'Cash', labelAr: 'نقدي', totalKey: 'cash', always: true },
    { key: 'visa', labelEn: 'Visa', labelAr: 'فيزا', totalKey: 'visa', always: true },
    { key: 'cl', labelEn: 'Ledge', labelAr: 'آجل', totalKey: 'cl' },
    { key: 'other', labelEn: 'Other', labelAr: 'دفع آخر', totalKey: 'otherPayment' },
  ],
};

const dt = reports.find((r) => r.id === 'daily-transactions');
if (dt) {
  dt.endpoint = 'DailySalesController/getDailySalesReport';
  dt.rowsKey = 'reportData'; dt.totalsKey = 'totals';
  dt.columns = [
    { key: 'orderId', labelEn: 'Order #', labelAr: 'رقم الأوردر', type: 'int', totalKey: null },
    { key: 'transaction', labelEn: 'Transaction', labelAr: 'المعاملة', type: 'text', totalKey: null },
    { key: 'orderDate', labelEn: 'Date', labelAr: 'التاريخ', type: 'text', totalKey: null },
    { key: 'orderTime', labelEn: 'Time', labelAr: 'الوقت', type: 'text', totalKey: null },
    { key: 'guestNo', labelEn: 'Guests', labelAr: 'ضيوف', type: 'int', totalKey: 'guestNo' },
    { key: 'printNo', labelEn: 'Prints', labelAr: 'طباعات', type: 'int', totalKey: 'printNo' },
    { key: 'totalSales', labelEn: 'Sub Total', labelAr: 'الإجمالي الفرعي', type: 'money', totalKey: 'totalSales' },
    { key: 'totalCommercialDiscount', labelEn: 'Commercial Disc', labelAr: 'خصم تجاري', type: 'money', totalKey: 'totalCommercialDiscount' },
    { key: 'services', labelEn: 'Service', labelAr: 'خدمة', type: 'money', totalKey: 'services' },
    { key: 'totalTax', labelEn: 'Tax', labelAr: 'ضريبة', type: 'money', totalKey: 'totalTax' },
    { key: 'totalItemDiscount', labelEn: 'Item Discount', labelAr: 'خصم أصناف', type: 'money', totalKey: 'totalItemDiscount' },
    { key: 'extraDiscount', labelEn: 'Extra Discount', labelAr: 'خصم إضافي', type: 'money', totalKey: 'extraDiscount' },
    { key: 'promoCodeValue', labelEn: 'Promo Value', labelAr: 'قيمة البرومو', type: 'money', totalKey: 'promoCodeAmount' },
    { key: 'voucherAmount', labelEn: 'Voucher', labelAr: 'قسيمة', type: 'money', totalKey: 'voucher' },
    { key: 'total', labelEn: 'Total', labelAr: 'الإجمالي', type: 'money', totalKey: null },
    { key: 'net', labelEn: 'Net', labelAr: 'صافي', type: 'money', totalKey: 'net' },
    { key: 'cash', labelEn: 'Cash', labelAr: 'كاش', type: 'money', totalKey: 'cash' },
    { key: 'visa', labelEn: 'Visa', labelAr: 'فيزا', type: 'money', totalKey: 'visa' },
    { key: 'cl', labelEn: 'Ledge', labelAr: 'آجل', type: 'money', totalKey: 'cl' },
    { key: 'otherPayment', labelEn: 'Other Pay', labelAr: 'دفع آخر', type: 'money', totalKey: 'otherPayment' },
    { key: 'paymentStatus', labelEn: 'Pay Way', labelAr: 'طريقة الدفع', type: 'text', totalKey: null },
    { key: 'waiterName', labelEn: 'Waiter', labelAr: 'الويتر', type: 'text', totalKey: null },
    { key: 'tableName', labelEn: 'Table', labelAr: 'الطاولة', type: 'text', totalKey: null },
  ];
  dt.paymentSummary = PAYMENT_SUMMARY;
}

// ── Live-verified overrides (see report-registry.ts for the full rationale) ──
// salesPeriod also carries the PayWay summary bar.
const sp = reports.find((r) => r.id === 'salesPeriod');
if (sp) sp.paymentSummary = PAYMENT_SUMMARY;

// TotalPOS: posName is a GUID (no friendly name in the data) and orderNo
// duplicates totalOrderNum → default-hide both.
const tp = reports.find((r) => r.id === 'total-pos');
if (tp) for (const c of tp.columns) { if (c.key === 'posName' || c.key === 'orderNo') c.defaultHidden = true; }

// promo / vouchers come back nested (days[].promoCodes[] / .voucherCodes[]).
// Flatten to one row per code, with the real per-code columns.
const promo = reports.find((r) => r.id === 'promo-code-details');
if (promo) {
  promo.transform = 'promoFlatten';
  promo.columns = [
    { key: 'day', labelEn: 'Day', labelAr: 'اليوم', type: 'date', totalKey: null },
    { key: 'promoCodeName', labelEn: 'Promo Code', labelAr: 'كود الخصم', type: 'text', totalKey: null },
    { key: 'discountName', labelEn: 'Discount', labelAr: 'الخصم', type: 'text', totalKey: null },
    { key: 'ordersCount', labelEn: 'Orders Count', labelAr: 'عدد الطلبات', type: 'int', totalKey: 'ordersCount' },
    { key: 'total', labelEn: 'Promo Value', labelAr: 'قيمة الخصم', type: 'money', totalKey: 'total' },
    { key: 'cash', labelEn: 'Cash', labelAr: 'نقدي', type: 'money', totalKey: 'cash' },
    { key: 'visa', labelEn: 'Visa', labelAr: 'فيزا', type: 'money', totalKey: 'visa' },
    { key: 'ledge', labelEn: 'Ledge', labelAr: 'آجل', type: 'money', totalKey: 'ledge' },
  ];
}
const vouchers = reports.find((r) => r.id === 'vouchers-details');
if (vouchers) {
  vouchers.transform = 'voucherFlatten';
  vouchers.columns = [
    { key: 'day', labelEn: 'Day', labelAr: 'اليوم', type: 'date', totalKey: null },
    { key: 'voucherCode', labelEn: 'Voucher Code', labelAr: 'كود القسيمة', type: 'text', totalKey: null },
    { key: 'vouchersCount', labelEn: 'Vouchers Count', labelAr: 'عدد القسائم', type: 'int', totalKey: 'vouchersCount' },
    { key: 'distinctOrders', labelEn: 'Distinct Orders', labelAr: 'عدد الطلبات', type: 'int', totalKey: 'distinctOrders' },
    { key: 'totalVoucherAmount', labelEn: 'Total Voucher Amount', labelAr: 'إجمالي قيمة القسائم', type: 'money', totalKey: 'totalVoucherAmount' },
    { key: 'cash', labelEn: 'Cash', labelAr: 'نقدي', type: 'money', totalKey: 'cash' },
    { key: 'visa', labelEn: 'Visa', labelAr: 'فيزا', type: 'money', totalKey: 'visa' },
    { key: 'ledge', labelEn: 'Ledge', labelAr: 'آجل', type: 'money', totalKey: 'ledge' },
  ];
}

// salesPeriod: promoCode "0"→dash, hide the broken promoName (API stuffs voucher
// names there), mobile "0"→dash. Footer shows order count ("N orders"); guestNo
// total dropped (API has no guest total — it leaked the order count there).
if (sp) {
  sp.rowUnitEn = 'orders'; sp.rowUnitAr = 'طلب';
  for (const c of sp.columns) {
    if (c.key === 'promoCode' || c.key === 'mobilePhone') c.dashIfZero = true;
    if (c.key === 'promoName') c.defaultHidden = true;
    if (c.key === 'guestNo') delete c.totalKey;
  }
}

// Two grouped Sales reports built client-side from the Sales-Period rows.
const SALES_GROUP_COLS = (keyCol) => [
  keyCol,
  { key: 'ordersCount', labelEn: 'Orders', labelAr: 'عدد الطلبات', type: 'int', totalKey: 'ordersCount' },
  { key: 'guestNo', labelEn: 'Guests', labelAr: 'عدد الضيوف', type: 'int', totalKey: 'guestNo' },
  { key: 'totalSales', labelEn: 'Total Sales', labelAr: 'إجمالي المبيعات', type: 'money', totalKey: 'totalSales' },
  { key: 'totalCommercialDiscount', labelEn: 'Commercial Discount', labelAr: 'الخصم التجاري', type: 'money', totalKey: 'totalCommercialDiscount' },
  { key: 'totalItemDiscount', labelEn: 'Item Discount', labelAr: 'خصم الأصناف', type: 'money', totalKey: 'totalItemDiscount' },
  { key: 'extraDiscount', labelEn: 'Extra Discount', labelAr: 'خصم إضافي', type: 'money', totalKey: 'extraDiscount' },
  { key: 'services', labelEn: 'Services', labelAr: 'الخدمة', type: 'money', totalKey: 'services' },
  { key: 'totalTax', labelEn: 'Tax', labelAr: 'الضريبة', type: 'money', totalKey: 'totalTax' },
  { key: 'cash', labelEn: 'Cash', labelAr: 'نقدي', type: 'money', totalKey: 'cash' },
  { key: 'visa', labelEn: 'Visa', labelAr: 'فيزا', type: 'money', totalKey: 'visa' },
  { key: 'cl', labelEn: 'Ledge', labelAr: 'آجل', type: 'money', totalKey: 'cl' },
  { key: 'voucherAmount', labelEn: 'Voucher', labelAr: 'قسيمة', type: 'money', totalKey: 'voucherAmount' },
  { key: 'otherPayment', labelEn: 'Other Payment', labelAr: 'دفع آخر', type: 'money', totalKey: 'otherPayment' },
  { key: 'net', labelEn: 'Net', labelAr: 'الصافي', type: 'money', totalKey: 'net' },
];
const SALES_GROUP_FILTERS = ['payment', 'transaction', 'shift', 'discount', 'promo', 'voucher', 'onlineApp', 'user', 'waiter', 'pilot'];
if (!reports.find((r) => r.id === 'sales-by-transaction')) {
  reports.splice(reports.findIndex((r) => r.id === 'salesPeriod') + 1, 0,
    { id: 'sales-by-transaction', titleEn: 'Sales by Transaction', titleAr: 'المبيعات حسب نوع المعاملة',
      subtitleEn: 'Total day sales grouped by transaction type', subtitleAr: 'إجمالي مبيعات الفترة مجمّعة حسب نوع المعاملة',
      endpoint: 'SalePeriod/GetPeriodSalesByOrderDate', transform: 'groupByTransaction', defaultOrdersFilter: 'Paid',
      filters: SALES_GROUP_FILTERS, columns: SALES_GROUP_COLS({ key: 'transactionName', labelEn: 'Transaction', labelAr: 'نوع المعاملة', type: 'text', totalKey: null }) },
    { id: 'sales-by-payment', titleEn: 'Sales by Payment', titleAr: 'المبيعات حسب طريقة الدفع',
      subtitleEn: 'Total day sales grouped by payment method', subtitleAr: 'إجمالي مبيعات الفترة مجمّعة حسب طريقة الدفع',
      endpoint: 'SalePeriod/GetPeriodSalesByOrderDate', transform: 'groupByPayment', defaultOrdersFilter: 'Paid',
      filters: SALES_GROUP_FILTERS, columns: SALES_GROUP_COLS({ key: 'paymentStatus', labelEn: 'Payment Method', labelAr: 'طريقة الدفع', type: 'text', totalKey: null }) });
}

// Day-grouped variants: one row per (day × transaction) / (day × payment).
const DAY_GROUP_COLS = (keyCol) => [
  { key: 'orderDate', labelEn: 'Date', labelAr: 'التاريخ', type: 'date', totalKey: null },
  ...SALES_GROUP_COLS(keyCol),
];
if (!reports.find((r) => r.id === 'daily-sales-by-transaction')) {
  reports.splice(reports.findIndex((r) => r.id === 'sales-by-payment') + 1, 0,
    { id: 'daily-sales-by-transaction', titleEn: 'Daily Sales by Transaction', titleAr: 'المبيعات اليومية حسب نوع المعاملة',
      subtitleEn: 'Per-day breakdown — one row per day × transaction type', subtitleAr: 'تفصيل يومي — صف لكل يوم × نوع معاملة',
      endpoint: 'SalePeriod/GetPeriodSalesByOrderDate', transform: 'groupByDayTransaction', defaultOrdersFilter: 'Paid',
      filters: SALES_GROUP_FILTERS, columns: DAY_GROUP_COLS({ key: 'transactionName', labelEn: 'Transaction', labelAr: 'نوع المعاملة', type: 'text', totalKey: null }) },
    { id: 'daily-sales-by-payment', titleEn: 'Daily Sales by Payment', titleAr: 'المبيعات اليومية حسب طريقة الدفع',
      subtitleEn: 'Per-day breakdown — one row per day × payment method', subtitleAr: 'تفصيل يومي — صف لكل يوم × طريقة دفع',
      endpoint: 'SalePeriod/GetPeriodSalesByOrderDate', transform: 'groupByDayPayment', defaultOrdersFilter: 'Paid',
      filters: SALES_GROUP_FILTERS, columns: DAY_GROUP_COLS({ key: 'paymentStatus', labelEn: 'Payment Method', labelAr: 'طريقة الدفع', type: 'text', totalKey: null }) });
}

const NAV = [
  { titleEn: 'Sales',                  titleAr: 'المبيعات',          ids: ['salesPeriod', 'daily-transactions', 'total-pos'] },
  { titleEn: 'Daily',                  titleAr: 'اليومي',            ids: ['daily-sales-by-transaction', 'daily-sales-by-payment'] },
  { titleEn: 'Totals',                 titleAr: 'الإجماليات',        ids: ['sales-by-transaction', 'sales-by-payment'] },
  { titleEn: 'Items',                  titleAr: 'الأصناف',           ids: ['sold-items', 'sold-item-waiter', 'sold-items-details', 'SoldItemsSummary', 'TopItems', 'worst-Items'] },
  { titleEn: 'Orders',                 titleAr: 'الطلبات',           ids: ['cancelled-order-report', 'void-items-report'] },
  { titleEn: 'Discounts & Vouchers',   titleAr: 'الخصومات والقسائم', ids: ['total-discount', 'promo-code-details', 'vouchers-details'] },
  { titleEn: 'Expenses & Settlements', titleAr: 'المصروفات والتسويات', ids: ['sales-expenses', 'total-expenses', 'sales-settlements', 'total-settlements'] },
  { titleEn: 'Reservations & Deferred', titleAr: 'الحجوزات والآجل',   ids: ['sales-reservations', 'total-reservations', 'sales-deferred', 'total-deferred'] },
];
// Drop any nav id that has no matching spec (defensive).
const ids = new Set(reports.map((r) => r.id));
for (const g of NAV) g.ids = g.ids.filter((id) => ids.has(id));

const ts = `import { ReportDef } from '../models/sales-report.models';

/**
 * Auto-generated registry of the legacy 999-order reports, recreated on the
 * generic tabular engine. Each entry is a config the TabularReportPage renders.
 * Regenerate with: node gen-registry.cjs <workflow-output.json>
 */
export const REPORT_REGISTRY: Record<string, ReportDef> = {
${reports.map(defLiteral).join('\n')}
};

export interface ReportNavGroup { titleEn: string; titleAr: string; ids: string[]; }

/** Sidebar grouping for the migrated reports. */
export const REPORT_NAV: ReportNavGroup[] = ${JSON.stringify(NAV, null, 2)};
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, ts, 'utf8');
console.log(`Wrote ${OUT}`);
console.log(`Reports: ${reports.length}`);
console.log(`Nav groups: ${NAV.length}, total nav ids: ${NAV.reduce((n, g) => n + g.ids.length, 0)}`);
