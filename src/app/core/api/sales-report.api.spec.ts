import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SalesReportApi } from './sales-report.api';
import { SalesReportFilter } from '../models/sales-report.models';

type Row = Record<string, unknown>;
const BODY = { fromDate: '2026-11-01', toDate: '2026-11-10', branchId: 1 } as SalesReportFilter;

describe('SalesReportApi item trees', () => {
  let api: SalesReportApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(SalesReportApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const run = (path: string, data: unknown, opts: Parameters<SalesReportApi['run']>[2]): Row[] => {
    let rows: Row[] = [];
    api.run(path, BODY, opts).subscribe((r) => (rows = r.rows as Row[]));
    http.expectOne((req) => req.url.endsWith(path)).flush({ data });
    return rows;
  };

  const ITEMS = [
    { categoryId: 2, categoryName: 'Pizza', categoryNameAr: 'بيتزا', subCategoryId: 21, subCategoryName: 'Small', subCategoryNameAr: 'صغير', itemName: 'Veggie', quantity: 1, netAmount: 50, totalSales: 50 },
    { categoryId: 1, categoryName: 'Drinks', categoryNameAr: 'مشروبات', subCategoryId: 11, subCategoryName: 'Cold', subCategoryNameAr: '', itemName: 'Water', quantity: 3, netAmount: 15, totalSales: 15 },
    { categoryId: 2, categoryName: 'Pizza', categoryNameAr: 'بيتزا', subCategoryId: 22, subCategoryName: 'Large', subCategoryNameAr: 'كبير', itemName: 'Margherita', quantity: 2, netAmount: 240, totalSales: 240 },
    { categoryId: 1, categoryName: 'Drinks', categoryNameAr: 'مشروبات', subCategoryId: 11, subCategoryName: 'Cold', subCategoryNameAr: '', itemName: 'Cola', quantity: 4, netAmount: 40, totalSales: 40 },
  ];

  it('Sold Items: categories and sub-categories by name, items by net sales', () => {
    const rows = run('DailySoldItemsReports/DailySoldItemsReport', { items: ITEMS, totals: {} },
      { rowsKey: 'items', totalsKey: 'totals', transform: 'categoryItemsTree', sortTree: true });
    const outline = rows.map((r) => `${r['__level']}:${r['categoryName'] || r['subCategoryName'] || r['itemName']}`);
    expect(outline).toEqual([
      '0:Drinks', '1:Cold', '2:Cola', '2:Water',
      '0:Pizza', '1:Large', '2:Margherita', '1:Small', '2:Veggie',
    ]);
    // Item rows repeat no category; group rows carry their sums.
    expect(rows[2]['categoryName']).toBe('');
    expect(rows[0]['netAmount']).toBe(55);
  });

  it('Sold Items in Arabic: Arabic names, a blank Arabic name falls back to English', () => {
    const rows = run('DailySoldItemsReports/DailySoldItemsReport', { items: ITEMS, totals: {} },
      { rowsKey: 'items', totalsKey: 'totals', transform: 'categoryItemsTree', sortTree: true, ar: true });
    const groups = rows.filter((r) => r['__key'] != null).map((r) => r['categoryName'] || r['subCategoryName']);
    expect(groups).toContain('بيتزا');
    expect(groups).toContain('Cold');
  });

  it('the rankings keep the server order', () => {
    const rows = run('ItemRanking/TopItems', ITEMS, { rowsKey: '', totalsKey: null, transform: 'categoryItemsTree' });
    expect(rows[0]['categoryName']).toBe('Pizza');
  });

  it('Sold Items Summary: depth as __level, names without box-drawing characters', () => {
    const data = {
      categories: [{
        categoryName: 'Drinks', categoryNameAr: 'مشروبات', totalQuantity: 4, totalSales: 40,
        subCategories: [{
          subCategoryName: 'Cold', subCategoryNameAr: 'باردة', totalQuantity: 4, totalSales: 40,
          items: [{ itemName: 'Cola', itemNameAr: 'كولا', totalQuantity: 4, totalSales: 40 }],
        }],
      }],
      totals: { totalQuantity: 4, total: 40 },
    };
    const rows = run('SoldItem/GetSoldItemsSummary', data, { rowsKey: 'categories', totalsKey: 'totals', ar: true });
    expect(rows.map((r) => r['__level'])).toEqual([0, 1, 2]);
    expect(rows.map((r) => r['categoryName'])).toEqual(['مشروبات', 'باردة', 'كولا']);
    for (const r of rows) expect(String(r['categoryName'])).not.toMatch(/[└├─│]/);
  });
});
