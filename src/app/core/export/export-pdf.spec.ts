import { ExportService, ExportColumn, ExportMeta } from './export.service';

type Row = Record<string, unknown>;

describe('ExportService PDF download (Arabic)', () => {
  const svc = new ExportService();
  const cols: ExportColumn<Row>[] = [
    { headerEn: 'Category', headerAr: 'التصنيف', key: 'categoryName', value: (r) => (r['categoryName'] as string) || '—' },
    { headerEn: 'Item', headerAr: 'الصنف', key: 'itemName', value: (r) => (r['itemName'] as string) || '—' },
    { headerEn: 'Total Sales', headerAr: 'إجمالي المبيعات', key: 'totalSales', numeric: true, value: (r) => String(r['totalSales']) },
  ];
  const rows: Row[] = [
    { __level: 0, __key: 'c1', categoryName: 'مشروبات ساخنة', totalSales: 1500 },
    { __level: 2, __parent: 'c1', categoryName: '', itemName: 'قهوة تركي', totalSales: 1500 },
  ];
  const meta = (lang: 'en' | 'ar'): ExportMeta => ({
    titleEn: 'Top Items', titleAr: 'أكثر الأصناف مبيعاً', lang, fileBase: 'TopItems', branch: 'فرع المعادي',
  });

  for (const lang of ['en', 'ar'] as const) {
    it(`draws every string in the embedded Cairo font, never Helvetica (${lang})`, async () => {
      const doc = await svc.buildPdf(rows, cols, meta(lang));
      const pdf = doc.output();
      const cairo = ['normal', 'bold'].map((s) => '/' + (doc.internal as unknown as { getFont(f: string, s: string): { id: string } }).getFont('Cairo', s).id);
      // Every font selection in the page content ("/Fn size Tf") is a Cairo face. Helvetica has no
      // Arabic glyphs: selecting it is exactly where the "þòþ'þ®" mojibake came from.
      const used = [...new Set([...pdf.matchAll(/(\/F\d+) [\d.]+ Tf/g)].map((m) => m[1]))];
      expect(used.length).toBeGreaterThan(0);
      for (const f of used) expect(cairo).toContain(f);
    });
  }

  it('gives the font a glyph for every isolated Arabic letter form (none silently dropped)', async () => {
    const doc = await svc.buildPdf(rows, cols, meta('ar'));
    doc.setFont('Cairo', 'normal');
    const map = (doc.getFont() as unknown as { metadata: { cmap: { unicode: { codeMap: Record<number, number> } } } })
      .metadata.cmap.unicode.codeMap;
    // و ت ب إ ة standing alone: the forms Cairo itself lacks.
    for (const c of [0xFEED, 0xFE95, 0xFE8F, 0xFE87, 0xFE93]) expect(map[c]).withContext(c.toString(16)).toBeGreaterThan(0);
  });
});
