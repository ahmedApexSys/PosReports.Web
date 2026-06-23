/**
 * "Daily Transactions" — the legacy multi-section daily summary from
 * `TotalsReport/TotalReport`. Unlike the flat tabular reports this is a fixed
 * set of named sections (Sale Transactions · POS · Sales Group · Items No ·
 * Category Sales · Online Apps · Void · Deleted · Discount · Total · Tax ·
 * Service · PayWay · Order Number · Reservation · Information).
 *
 * `buildTotalBlocks` maps the raw API object into an ordered list of render
 * blocks shared by BOTH the on-screen page and the thermal-receipt builder, so
 * the layout is defined once.
 */

export interface TotalReportData {
  reportDate?: string; fromDate?: string; toDate?: string;
  companyName?: string; branchName?: string;
  posSales?: { posDetailsId?: string; posName?: string; totalSales?: number }[];
  onlineAppsSales?: { name?: string; totalSales?: number }[];
  categorySales?: {
    categoryName?: string; categoryTotalSales?: number; count?: number;
    subCategorySales?: { subCategoryName?: string; count?: number; subCategoryTotalSales?: number }[];
  }[];
  voidItems?: { itemName?: string; itemNo?: number; qty?: number }[];
  information?: { minOrderNo?: number; maxOrderNo?: number; guestNo?: number; avg?: number };
  payWay?: Record<string, number>;
  cl?: number;
  salesGroup?: { cateagoryGroupList?: { categoryName?: string; totalSales?: number; percentage?: number }[] };
  saleTransaction?: { tables?: number; delivery?: number; takeAway?: number };
  itemsNo?: { itemNoList?: { categoryName?: string; itemNo?: number }[] };
  service?: { tablesService?: number; delivery?: number; takeAway?: number };
  tax?: { tables?: number; delivery?: number; takeAway?: number };
  discountTransactions?: { tables?: number; delivery?: number; takeAway?: number };
  total?: { service?: number; tax?: number; discount?: number };
  orderNo?: { tables?: number; delivery?: number; takeAway?: number };
  orderNumberOverAll?: { ordersNumber?: number; totalSales?: number };
  deleted?: { totalSaleDeletedOrders?: number; deletedOrdersNo?: number };
  reservationOverAll?: { reservationsNumber?: number; totalSales?: number; totalDeposit?: number };
}

export interface TotalRow { label: string; value: string; strong?: boolean }
export interface TotalBlock {
  title: string;
  /** render as a bare section heading (e.g. "Category Sales"). */
  heading?: boolean;
  /** render the rows inside a bordered box (the category summary). */
  boxed?: boolean;
  rows?: TotalRow[];
  table?: { head: string[]; rows: string[][] };
}

const money = (v: unknown): string => {
  const n = Number(v); return (Number.isFinite(n) ? n : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const intf = (v: unknown): string => {
  const n = Number(v); return (Number.isFinite(n) ? n : 0).toLocaleString();
};

/** Section/row label helper — picks Arabic or English. */
function buildTotalBlocks(d: TotalReportData, ar: boolean): TotalBlock[] {
  const L = (en: string, arr: string) => (ar ? arr : en);
  const out: TotalBlock[] = [];
  const st = d.saleTransaction ?? {};
  out.push({ title: L('Sale Transactions', 'حركة المبيعات'), rows: [
    { label: L('Delivery', 'دليفري'), value: money(st.delivery) },
    { label: L('TakeAway', 'تيك أواي'), value: money(st.takeAway) },
    { label: L('Tables', 'صالة'), value: money(st.tables) },
  ] });

  out.push({ title: L('POS', 'نقاط البيع'), table: {
    head: [L('POS', 'نقطة البيع'), L('Total Sales', 'إجمالي المبيعات')],
    rows: (d.posSales ?? []).map((p) => [String(p.posName ?? p.posDetailsId ?? '—'), money(p.totalSales)]),
  } });

  out.push({ title: L('Sales Group', 'مجموعات المبيعات'), table: {
    head: [L('Name', 'الاسم'), L('%', '%'), L('Total Sales', 'إجمالي المبيعات')],
    rows: (d.salesGroup?.cateagoryGroupList ?? []).map((g) => [String(g.categoryName ?? ''), `${intf(g.percentage)}%`, money(g.totalSales)]),
  } });

  out.push({ title: L('Items No', 'عدد الأصناف'), table: {
    head: [L('Category', 'الفئة'), L('Count', 'العدد')],
    rows: (d.itemsNo?.itemNoList ?? []).map((i) => [String(i.categoryName ?? ''), intf(i.itemNo)]),
  } });

  // Category Sales — a heading then, per category, a boxed Quantity/Total + a sub-item table.
  out.push({ title: L('Category Sales', 'مبيعات الفئات'), heading: true });
  for (const c of (d.categorySales ?? [])) {
    out.push({
      title: String(c.categoryName ?? ''),
      boxed: true,
      rows: [
        { label: L('Quantity', 'الكمية'), value: intf(c.count) },
        { label: L('Total', 'الإجمالي'), value: money(c.categoryTotalSales), strong: true },
      ],
      table: {
        head: [L('Name', 'الاسم'), L('Count', 'العدد'), L('Total', 'الإجمالي')],
        rows: (c.subCategorySales ?? []).map((s) => [String(s.subCategoryName ?? ''), intf(s.count), money(s.subCategoryTotalSales)]),
      },
    });
  }

  out.push({ title: L('Online Apps', 'تطبيقات التوصيل'), table: {
    head: [L('Name', 'الاسم'), L('Total Sales', 'إجمالي المبيعات')],
    rows: (d.onlineAppsSales ?? []).map((a) => [String(a.name ?? ''), money(a.totalSales)]),
  } });

  out.push({ title: L('Void Items', 'الأصناف الملغاة'), table: {
    head: [L('Name', 'الاسم'), L('ID', 'المعرّف'), L('Count', 'العدد')],
    rows: (d.voidItems ?? []).map((v) => [String(v.itemName ?? ''), intf(v.itemNo), intf(v.qty)]),
  } });

  const del = d.deleted ?? {};
  out.push({ title: L('Deleted Orders', 'الطلبات المحذوفة'), rows: [
    { label: L('Deleted Orders No', 'عدد الطلبات المحذوفة'), value: intf(del.deletedOrdersNo) },
    { label: L('Total Sales Deleted', 'إجمالي مبيعات المحذوف'), value: money(del.totalSaleDeletedOrders) },
  ] });

  const dt = d.discountTransactions ?? {};
  out.push({ title: L('Discount Transactions', 'خصومات المعاملات'), rows: [
    { label: L('Delivery', 'دليفري'), value: money(dt.delivery) },
    { label: L('TakeAway', 'تيك أواي'), value: money(dt.takeAway) },
    { label: L('Tables', 'صالة'), value: money(dt.tables) },
  ] });

  const tt = d.total ?? {};
  out.push({ title: L('Total', 'الإجمالي'), rows: [
    { label: L('Discount', 'الخصم'), value: money(tt.discount) },
    { label: L('Service', 'الخدمة'), value: money(tt.service) },
    { label: L('Tax', 'الضريبة'), value: money(tt.tax) },
  ] });

  const tx = d.tax ?? {};
  out.push({ title: L('Tax', 'الضريبة'), rows: [
    { label: L('Delivery', 'دليفري'), value: money(tx.delivery) },
    { label: L('Tables', 'صالة'), value: money(tx.tables) },
    { label: L('TakeAway', 'تيك أواي'), value: money(tx.takeAway) },
  ] });

  const sv = d.service ?? {};
  out.push({ title: L('Service', 'الخدمة'), rows: [
    { label: L('Delivery', 'دليفري'), value: money(sv.delivery) },
    { label: L('Tables', 'صالة'), value: money(sv.tablesService) },
    { label: L('TakeAway', 'تيك أواي'), value: money(sv.takeAway) },
  ] });

  const pw = d.payWay ?? {};
  out.push({ title: L('PayWay', 'طرق الدفع'), rows: [
    { label: L('Cash', 'نقدي'), value: money(pw['cash']) },
    { label: L('Visa', 'فيزا'), value: money(pw['visa']) },
    { label: L('Vodafone Cash', 'فودافون كاش'), value: money(pw['vodafoneCash']) },
    { label: L('Ledge', 'آجل'), value: money(pw['ledge']) },
    { label: L('Credit (Ledge) Sales', 'مبيعات آجلة'), value: money(d.cl) },
    { label: L('Customer Payments', 'مدفوعات العملاء'), value: money(pw['customerPayments']) },
    { label: L('Difference', 'الفرق'), value: money(pw['difference']) },
    { label: L('Expenses', 'المصروفات'), value: money(pw['expenses']) },
    { label: L('Hospitality', 'ضيافة'), value: money(pw['hospitality']) },
    { label: L('Officer', 'أوفيسر'), value: money(pw['officer']) },
    { label: L('Drawer', 'الدرج'), value: money(pw['drawer']) },
    { label: L('Net Cash', 'صافي النقدية'), value: money(pw['netCash']) },
    { label: L('Total Payments', 'إجمالي المدفوعات'), value: money(pw['allPayment']), strong: true },
  ] });

  const on = d.orderNo ?? {};
  out.push({ title: L('Order Number', 'عدد الطلبات'), rows: [
    { label: L('Delivery', 'دليفري'), value: intf(on.delivery) },
    { label: L('TakeAway', 'تيك أواي'), value: intf(on.takeAway) },
    { label: L('Tables', 'صالة'), value: intf(on.tables) },
  ] });

  const rv = d.reservationOverAll ?? {};
  out.push({ title: L('Reservation Details', 'تفاصيل الحجوزات'), rows: [
    { label: L('Reservations Number', 'عدد الحجوزات'), value: intf(rv.reservationsNumber) },
    { label: L('Total Deposit', 'إجمالي العربون'), value: money(rv.totalDeposit) },
    { label: L('Total Sales', 'إجمالي المبيعات'), value: money(rv.totalSales) },
  ] });

  const oo = d.orderNumberOverAll ?? {};
  out.push({ title: L('Orders', 'إجمالي الطلبات'), rows: [
    { label: L('Orders Number', 'عدد الطلبات'), value: intf(oo.ordersNumber) },
    { label: L('Total Sale', 'إجمالي البيع'), value: money(oo.totalSales), strong: true },
  ] });

  const inf = d.information ?? {};
  out.push({ title: L('Information', 'معلومات'), rows: [
    { label: L('Avg', 'المتوسط'), value: money(inf.avg) },
    { label: L('Guest Number', 'عدد الضيوف'), value: intf(inf.guestNo) },
    { label: L('Max Order Number', 'أعلى رقم طلب'), value: intf(inf.maxOrderNo) },
    { label: L('Min Order Number', 'أقل رقم طلب'), value: intf(inf.minOrderNo) },
  ] });

  return out;
}

export { buildTotalBlocks };
