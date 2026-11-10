import { ReportColumn, ReportDef } from '../../core/models/sales-report.models';

export const isNumericColumn = (c: ReportColumn): boolean =>
  c.type === 'money' || c.type === 'number' || c.type === 'int' || !!c.alignEnd;

/**
 * Columns of the thermal roll (Flash / POS 72 / POS 80) for a report: its curated
 * `receiptColumns` when it has them, else the visible columns capped to what fits the roll
 * (leading identity columns + the Net/Total column). Every column prints its short label
 * (`shortEn` / `shortAr`) where the report defines one — "Total", not "Total Reservation Amount".
 */
export function receiptColumnsFor(def: ReportDef, visible: ReportColumn[], paper: 'pos72' | 'pos80' | 'flash'): ReportColumn[] {
  const short = (c: ReportColumn): ReportColumn =>
    ({ ...c, labelEn: c.shortEn ?? c.labelEn, labelAr: c.shortAr ?? c.labelAr });
  const rc = def.receiptColumns;
  if (rc && rc.length) {
    const byKey = new Map(def.columns.map((c) => [c.key, c]));
    return rc
      .map((r) => {
        const base = byKey.get(r.key);
        if (!base) return null;
        const ml = r.maxLen ?? base.maxLen;
        return {
          ...base,
          labelEn: r.en ?? base.shortEn ?? base.labelEn,
          labelAr: r.ar ?? base.shortAr ?? base.labelAr,
          ...(ml != null ? { maxLen: ml } : {}),
        };
      })
      .filter((c): c is ReportColumn => !!c);
  }
  const max = paper === 'pos72' ? 5 : 6;
  if (visible.length <= max) return visible.map(short);
  const isKey = (c: ReportColumn) => /\bnet\b|الصاف|\btotal\b|الإجمال|الاجمال/i.test(`${c.labelEn}|${c.labelAr}`);
  const keyCol = [...visible].reverse().find((c) => isNumericColumn(c) && isKey(c));
  const base = visible.slice(0, keyCol ? max - 1 : max);
  return (keyCol && !base.includes(keyCol) ? [...base, keyCol] : base).map(short);
}
