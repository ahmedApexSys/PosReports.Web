import { TestBed } from '@angular/core/testing';
import { ExportService, ExportColumn, ExportPaper } from './export.service';
import { REPORT_REGISTRY } from '../reports/report-registry';
import { ReportColumn } from '../models/sales-report.models';
import { receiptColumnsFor, isNumericColumn } from '../../shared/tabular-report-page/receipt-columns';
import { CC_RECEIPT_COLUMNS } from '../reports/callcenter-agents.model';
import { buildTotalBlocks, TotalReportData } from '../reports/total-report.model';

/**
 * Every report's Flash / POS 72 / POS 80 roll, in English and Arabic, with stub rows of the
 * widest realistic values: no header or cell may overflow its own column (measured on the
 * rendered page, bounding boxes, not by eye), no figure or date may wrap, and no header word
 * may be broken in the middle.
 */
type Row = Record<string, unknown>;

const STUB: Record<string, (i: number, ar: boolean) => string> = {
  money: (i) => [123456.78, 9876.5, 0][i % 3].toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  number: (i) => [12345, 7, 0][i % 3].toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  int: (i) => [12345, 42, 0][i % 3].toLocaleString('en'),
  date: (i) => ['2026-11-01', '2026-11-15', '2026-11-30'][i % 3],
  time: (i) => ['13:45', '09:05', '23:59'][i % 3],
  id: (i) => ['1234567', '88', '4501'][i % 3],
  text: (i, ar) => (ar ? ['مارجريتا كبيرة بالجبنة', 'كولا', 'توصيل المنزل'] : ['Margherita Large Cheese', 'Cola', 'Home Delivery'])[i % 3],
};

interface Problem { report: string; lang: string; paper: string; what: string }

function rollHtml(svc: ExportService, cols: ExportColumn<Row>[], rows: Row[], ar: boolean, paper: ExportPaper): string {
  let html = '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (svc as any).printHtml = (h: string) => (html = h);
  svc.pdf(rows, cols, {
    titleEn: 'T', titleAr: 'ت', lang: ar ? 'ar' : 'en', fileBase: 'x', paper,
    fromDate: '2026-11-01T00:00:00', toDate: '2026-11-30T23:59:59',
    footer: cols.map((c) => (c.numeric ? '1,234,567.89' : '')),
  });
  return html;
}

/** Owner, 2026-11-10: Sold Items by Waiter keeps the item name on the roll and accepts smaller
 *  type at 72 mm only. Every other roll, and this one at 80 mm / Flash, stays at the normal size. */
const SMALL_TYPE_OK = new Set(['sold-item-waiter/pos72']);

function measure(frame: HTMLIFrameElement, html: string, smallOk = false): string[] {
  const doc = frame.contentDocument!;
  doc.open(); doc.write(html); doc.close();
  const bad: string[] = [];
  const body = doc.body.getBoundingClientRect();
  // Every table (Daily Transactions prints one per section).
  for (const table of Array.from(doc.querySelectorAll('table'))) {
    const tr = table.getBoundingClientRect();
    if (tr.right > body.right + 0.5 || tr.left < body.left - 0.5) bad.push(`table ${tr.width.toFixed(0)}px wider than the roll ${body.width.toFixed(0)}px`);
  }
  // Label → value lines (meta, totals, Daily Transactions sections): the two never run into each other.
  for (const line of Array.from(doc.querySelectorAll('.kv, .m-row, .t-row'))) {
    const [a, b] = Array.from(line.children).map((e) => e.getBoundingClientRect());
    if (!a || !b) continue;
    const lo = a.left < b.left ? a : b; const hi = lo === a ? b : a;
    if (lo.right > hi.left + 0.5 && lo.bottom > hi.top + 0.5 && hi.bottom > lo.top + 0.5) bad.push(`"${line.textContent!.trim()}" label and value overlap`);
    if (Math.max(a.right, b.right) > body.right + 0.5 || Math.min(a.left, b.left) < body.left - 0.5) bad.push(`"${line.textContent!.trim()}" runs off the roll`);
  }
  for (const cell of Array.from(doc.querySelectorAll('th, td')) as HTMLTableCellElement[]) {
    if (cell.colSpan > 1 || !cell.textContent!.trim()) continue;
    const box = cell.getBoundingClientRect();
    const range = doc.createRange();
    range.selectNodeContents(cell);
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0);
    const text = cell.textContent!.trim();
    for (const r of rects) {
      if (r.left < box.left - 0.5 || r.right > box.right + 0.5) {
        bad.push(`"${text}" overflows its column (${r.width.toFixed(0)}px in ${box.width.toFixed(0)}px)`);
        break;
      }
    }
    const lines = new Set(rects.map((r) => Math.round(r.top))).size;
    const noWrap = cell.tagName === 'TD' && (cell.classList.contains('num') || cell.classList.contains('nw'));
    if (noWrap && lines > 1) bad.push(`"${text}" wraps`);
    // A header may wrap only between words: never more lines than words.
    if (cell.tagName === 'TH' && lines > text.split(/\s+/).length) bad.push(`header "${text}" breaks inside a word`);
  }
  const size = (sel: string, dflt: number) => Math.min(dflt, ...Array.from(doc.querySelectorAll(sel))
    .map((e) => parseFloat(frame.contentWindow!.getComputedStyle(e).fontSize)));
  // Every roll prints at the normal type size (owner, 2026-11-10): a roll that only fits by
  // shrinking carries too many columns — trim its receiptColumns instead.
  const px = size('tbody td:not(.empty)', 10);
  const hpx = size('thead th', 9.5);
  if (!smallOk && (px < 10 || hpx < 9.5)) bad.push(`type stepped down to ${px}px (headers ${hpx}px)`);
  if (smallOk && (px < 7 || hpx < 7)) bad.push(`type below 7px (${px}px, headers ${hpx}px)`);
  if (px < 10) shrunk.push(`${px}px`);
  return bad;
}
let shrunk: string[] = [];

describe('Flash / POS roll layout, every report', () => {
  let svc: ExportService;
  let frame: HTMLIFrameElement;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(ExportService);
    frame = document.createElement('iframe');
    Object.assign(frame.style, { width: '420px', height: '900px', position: 'absolute', left: '-2000px' });
    document.body.appendChild(frame);
  });
  afterEach(() => frame.remove());

  it('has no overlapping header or cell at 72 and 80 mm, in English and Arabic', () => {
    const problems: Problem[] = [];
    const checked: string[] = [];
    const papers: ExportPaper[] = ['pos72', 'pos80', 'flash'];
    for (const def of Object.values(REPORT_REGISTRY)) {
      const visible = def.columns.filter((c) => !c.defaultHidden);
      for (const ar of [false, true]) {
        for (const paper of papers) {
          const cols = receiptColumnsFor(def, visible, paper as 'pos72' | 'pos80' | 'flash');
          const rows: Row[] = [0, 1, 2].map((i) =>
            Object.fromEntries(cols.map((c: ReportColumn) => [c.key, STUB[c.type ?? 'text'](i, ar)])));
          const exp: ExportColumn<Row>[] = cols.map((c) => ({
            headerEn: c.labelEn, headerAr: c.labelAr, numeric: isNumericColumn(c), key: c.key,
            value: (r: Row) => String(r[c.key] ?? ''),
          }));
          shrunk = [];
          for (const what of measure(frame, rollHtml(svc, exp, rows, ar, paper), SMALL_TYPE_OK.has(`${def.id}/${paper}`))) {
            problems.push({ report: def.id, lang: ar ? 'ar' : 'en', paper, what });
          }
          if (shrunk.length) console.log(`SMALL ${def.id} ${ar ? 'ar' : 'en'} ${paper} ${cols.length} cols: ${shrunk[0]}`);
          checked.push(`${def.id}/${ar ? 'ar' : 'en'}/${paper}`);
        }
      }
    }
    // Call centre by agent prints its own summary roll.
    for (const ar of [false, true]) {
      for (const paper of papers) {
        const rows = [0, 1, 2].map((i) => ({
          agentName: ar ? 'سارة محمد عبد الله' : 'Sara Mohamed Abdullah', agentNameAr: 'سارة محمد عبد الله',
          orders: [1234, 5, 0][i], netSales: [123456.78, 99.5, 0][i], sharePercent: [87.25, 12.75, 0][i],
        }));
        const exp: ExportColumn<Row>[] = CC_RECEIPT_COLUMNS.map((c) => ({
          headerEn: c.en, headerAr: c.ar, numeric: c.numeric,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          value: (r: Row) => c.value(r as any, ar),
        }));
        for (const what of measure(frame, rollHtml(svc, exp, rows, ar, paper))) {
          problems.push({ report: 'callcenter-agents', lang: ar ? 'ar' : 'en', paper, what });
        }
        checked.push(`callcenter-agents/${ar ? 'ar' : 'en'}/${paper}`);
      }
    }
    // Daily Transactions prints its own multi-section roll (label → value lines + small tables).
    for (const ar of [false, true]) {
      const name = (i: number) => (ar ? ['مشروبات ساخنة ومثلجة', 'وجبات الدجاج الكبيرة', 'كولا'] : ['Hot And Iced Beverages', 'Large Chicken Meals', 'Cola'])[i % 3];
      const big = [1234567.89, 98765.4, 0]; // company-wide day: seven figures
      const d: TotalReportData = {
        companyName: ar ? 'شركة أبكس للمطاعم' : 'Apex Restaurants Company',
        posSales: [0, 1, 2].map((i) => ({ posName: ar ? `كاشير الصالة ${i + 1}` : `Hall Cashier ${i + 1}`, totalSales: big[i] })),
        onlineAppsSales: [0, 1, 2].map((i) => ({ name: name(i), totalSales: big[i] })),
        salesGroup: { cateagoryGroupList: [0, 1, 2].map((i) => ({ categoryName: name(i), percentage: [100, 45, 0][i], totalSales: big[i] })) },
        itemsNo: { itemNoList: [0, 1, 2].map((i) => ({ categoryName: name(i), itemNo: [12345, 42, 0][i] })) },
        categorySales: [0, 1].map((i) => ({ categoryName: name(i), count: 12345, categoryTotalSales: big[i],
          subCategorySales: [0, 1, 2].map((k) => ({ subCategoryName: name(k), count: [123456, 42, 0][k], subCategoryTotalSales: big[k] })) })),
        voidItems: [0, 1, 2].map((i) => ({ itemName: name(i), itemNo: [1234567, 88, 4501][i], qty: [12345, 42, 0][i] })),
        payWay: { cash: 1234567.89, visa: 987654.32, allPayment: 12345678.9, netCash: 1234567.89 },
        deleted: { deletedOrdersNo: 12345, totalSaleDeletedOrders: 1234567.89 },
        reservationOverAll: { reservationsNumber: 12345, totalDeposit: 1234567.89, totalSales: 1234567.89 },
        orderNumberOverAll: { ordersNumber: 12345, totalSales: 12345678.9 },
        information: { avg: 1234.56, guestNo: 12345, maxOrderNo: 1234567, minOrderNo: 1000001 },
      };
      for (const paper of papers) {
        let html = '';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (svc as any).printHtml = (h: string) => (html = h);
        svc.totalReport(buildTotalBlocks(d, ar), {
          titleEn: 'Daily Transactions', titleAr: 'حركة المبيعات اليومية', companyName: d.companyName,
          branchName: ar ? 'كل الفروع' : 'All Branches', fromDate: '2026-11-01T00:00:00', toDate: '2026-11-30T23:59:59',
          lang: ar ? 'ar' : 'en', fileBase: 'daily-transactions',
        }, paper);
        if ((html.match(/<table/g) ?? []).length !== 7) problems.push({ report: 'total-report', lang: ar ? 'ar' : 'en', paper, what: 'section tables missing' });
        for (const what of measure(frame, html)) problems.push({ report: 'total-report', lang: ar ? 'ar' : 'en', paper, what });
        checked.push(`total-report/${ar ? 'ar' : 'en'}/${paper}`);
      }
    }
    console.log(`ROLLS CHECKED: ${checked.length}; PROBLEMS: ${problems.length}`);
    for (const p of problems) console.log(`ROLL ${p.report} ${p.lang} ${p.paper}: ${p.what}`);
    expect(problems).toEqual([]);
  });
});
