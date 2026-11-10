import { TestBed } from '@angular/core/testing';
import { ExportService, ExportColumn, ExportMeta } from './export.service';

type Row = Record<string, unknown>;

/** Sold Items, as the category tree hands it to the roll: group rows carry the sums. */
const ROWS: Row[] = [
  { __level: 0, __key: 'c1', categoryName: 'Pizza', quantity: 5, netAmount: 500 },
  { __level: 1, __key: 'c1|s1', subCategoryName: 'Large', quantity: 3, netAmount: 360 },
  { __level: 2, itemId: 7, itemName: 'Margherita', quantity: 2, netAmount: 240 },
  { __level: 2, itemId: 8, itemName: 'Pepperoni', quantity: 1, netAmount: 120 },
  { __level: 1, __key: 'c1|s2', subCategoryName: 'Small', quantity: 2, netAmount: 140 },
  { __level: 2, itemId: 9, itemName: 'Veggie', quantity: 2, netAmount: 140 },
  { __level: 0, __key: 'c2', categoryName: 'Drinks', quantity: 4, netAmount: 40 },
  { __level: 1, __key: 'c2|s3', subCategoryName: 'Cold', quantity: 4, netAmount: 40 },
  { __level: 2, itemId: 11, itemName: 'Cola', quantity: 4, netAmount: 40 },
];

const COLS: ExportColumn<Row>[] = [
  { headerEn: 'Item', headerAr: 'الصنف', value: (r) => (r['itemName'] as string) ?? '' },
  { headerEn: 'Qty', headerAr: 'كمية', numeric: true, value: (r) => String(r['quantity']) },
  { headerEn: 'Net', headerAr: 'الصافي', numeric: true, value: (r) => String(r['netAmount']) },
];

const label = (r: Row) => String(r['categoryName'] ?? r['subCategoryName'] ?? '');

describe('ExportService roll', () => {
  let svc: ExportService;
  let html: string;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(ExportService);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    spyOn(svc as any, 'printHtml').and.callFake((h: string) => (html = h));
  });

  const meta = (extra: Partial<ExportMeta>): ExportMeta => ({
    titleEn: 'Sold Items', titleAr: 'الأصناف المباعة', lang: 'en', fileBase: 'sold-items', paper: 'flash',
    footer: ['Total', '9', '540'], ...extra,
  });

  it('prints a grouped roll: headings, items, subtotals, grand total last', () => {
    svc.pdf(ROWS, COLS, meta({
      groupOf: (r: Row) => (r['__key'] != null ? { level: Number(r['__level']), label: label(r) } : null),
    }));
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const lines = [...doc.querySelectorAll('tbody tr')].map((tr) =>
      `${tr.className}:${[...tr.querySelectorAll('td')].map((td) => td.textContent!.trim()).join('|')}`);
    expect(lines).toEqual([
      'g g0:Pizza',
      'g g1:Large',
      'it:Margherita|2|240',
      'it:Pepperoni|1|120',
      'st st1:Total Large|3|360',
      'g g1:Small',
      'it:Veggie|2|140',
      'st st1:Total Small|2|140',
      'st st0:Total Pizza|5|500',
      'g g0:Drinks',
      'g g1:Cold',
      'it:Cola|4|40',
      'st st1:Total Cold|4|40',
      'st st0:Total Drinks|4|40',
    ]);
    // Grand total sits below the table, never as the first line.
    expect(doc.querySelector('.r-totals .t-title')!.textContent).toBe('Grand total');
    expect(doc.querySelector('.r-totals')!.textContent).toContain('540');
    // Records counts items only.
    expect(html).toContain('<b>4</b>');
  });

  it('never prints a group row as an item ("0" / "—")', () => {
    svc.pdf(ROWS, COLS, meta({
      groupOf: (r: Row) => (r['__key'] != null ? { level: Number(r['__level']), label: label(r) } : null),
    }));
    const doc = new DOMParser().parseFromString(html, 'text/html');
    for (const td of doc.querySelectorAll('tbody td')) {
      expect(['0', '—', '-']).not.toContain(td.textContent!.trim());
    }
  });

  it('labels the subtotals in Arabic', () => {
    svc.pdf(ROWS, COLS, meta({
      lang: 'ar',
      groupOf: (r: Row) => (r['__key'] != null ? { level: Number(r['__level']), label: label(r) } : null),
    }));
    expect(html).toContain('إجمالي Large');
    expect(html).toContain('الإجمالي العام');
    expect(html).toContain('dir="rtl"');
  });

  it('prints an outline by indentation and weight, never box-drawing characters', () => {
    const rows: Row[] = [
      { __level: 0, itemName: 'مشروبات', quantity: 4, netAmount: 40 },
      { __level: 1, itemName: 'باردة', quantity: 4, netAmount: 40 },
      { __level: 2, itemName: 'كولا', quantity: 4, netAmount: 40 },
    ];
    svc.pdf(rows, COLS, meta({ lang: 'ar', levelOf: (r: Row) => Number(r['__level']) }));
    expect(html).not.toMatch(/[└├─│]/);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const names = [...doc.querySelectorAll('tbody td.name')].map((td) => td.className);
    expect(names).toEqual(['name l0', 'name l1', 'name l2']);
  });

  it('keeps the plain roll unchanged without groups or levels', () => {
    svc.pdf(ROWS.filter((r) => r['__key'] == null), COLS, meta({}));
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelectorAll('tbody tr').length).toBe(4);
    expect(doc.querySelector('tbody td.name')).toBeNull();
    // Every roll sizes its columns from content now (roll-layout.ts).
    expect(doc.querySelectorAll('colgroup col').length).toBe(COLS.length);
  });
});
