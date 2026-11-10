import { REPORT_REGISTRY } from '../../core/reports/report-registry';
import { pdfColumnsFor } from './receipt-columns';

describe('A4 PDF columns (pdfColumns)', () => {
  const def = REPORT_REGISTRY['cancelled-order-report'];
  const visible = def.columns.filter((c) => !c.defaultHidden);

  it('Cancelled Orders prints its curated set, not every column', () => {
    const cols = pdfColumnsFor(def, visible);
    expect(visible.length).toBeGreaterThan(30);
    expect(cols.length).toBeGreaterThanOrEqual(12);
    expect(cols.length).toBeLessThanOrEqual(15);
    // Every curated key is a real column of the report (a typo would silently drop it).
    const keys = new Set(def.columns.map((c) => c.key));
    for (const k of def.pdfColumns!) expect(keys).withContext(k).toContain(k);
    for (const k of ['cancelReason', 'cancelOrderBy', 'branchName', 'orderDate', 'net']) {
      expect(cols.map((c) => c.key)).toContain(k);
    }
  });

  it('keeps the user\'s visibility and order, and falls back to every visible column', () => {
    const reordered = [...visible].reverse().filter((c) => c.key !== 'waiterName');
    const cols = pdfColumnsFor(def, reordered).map((c) => c.key);
    expect(cols).not.toContain('waiterName');
    expect(cols).toEqual(reordered.map((c) => c.key).filter((k) => def.pdfColumns!.includes(k)));
    const other = visible.filter((c) => !def.pdfColumns!.includes(c.key));
    expect(pdfColumnsFor(def, other)).toEqual(other);
  });

  it('leaves reports without pdfColumns untouched', () => {
    const plain = Object.values(REPORT_REGISTRY).find((d) => !d.pdfColumns)!;
    const v = plain.columns.filter((c) => !c.defaultHidden);
    expect(pdfColumnsFor(plain, v)).toEqual(v);
  });
});
