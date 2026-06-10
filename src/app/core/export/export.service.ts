import { Injectable } from '@angular/core';

/**
 * Zero-dependency, bilingual, *styled* export for tabular report data.
 *
 * Three formats, one column spec:
 *  - Excel  → a styled HTML table served as `.xls` (Excel opens it with the
 *             brand colours, borders, widths and RTL intact). No library, so
 *             no new npm vulnerabilities and no bundler/polyfill risk.
 *  - PDF    → the same styled report printed via a hidden iframe (the browser
 *             engine renders Arabic + RTL perfectly → "Save as PDF").
 *  - CSV    → clean UTF-8 (+BOM so Excel shows Arabic) with bilingual headers.
 *
 * Replaces the old raw English CSV dump (cryptic enums, Old/New columns,
 * no styling) that prompted this rewrite.
 */

export type ExportLang = 'en' | 'ar';

/** One column in the export. `value` formats a row into its display string. */
export interface ExportColumn<T> {
  /** Bilingual header. */
  headerEn: string;
  headerAr: string;
  /** Cell value for a row, already localised. */
  value: (row: T, lang: ExportLang) => string | number | null | undefined;
  /** Approx Excel column width (characters). Default 18. */
  width?: number;
  /** Right-align + treat as number (Excel number cell). */
  numeric?: boolean;
  /** Optional per-cell tone for colouring (e.g. success/fail). */
  tone?: (row: T) => 'good' | 'bad' | 'muted' | null;
}

export interface ExportMeta {
  titleEn: string;
  titleAr: string;
  subtitleEn?: string;
  subtitleAr?: string;
  branch?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  lang: ExportLang;
  /** File name base (no extension), e.g. "activity-feed". */
  fileBase: string;
}

const BRAND = '#0F766E';
const BRAND_DARK = '#0b5a52';
const HEAD_TEXT = '#ffffff';
const HEAD_TINT = '#e6f1f0';
const ZEBRA = '#f5f7f9';
const BORDER = '#d8dee4';
const GOOD_BG = '#dcfce7';
const GOOD_TX = '#166534';
const BAD_BG = '#fee2e2';
const BAD_TX = '#991b1b';

@Injectable({ providedIn: 'root' })
export class ExportService {

  // ── public API ─────────────────────────────────────────────────────
  excel<T>(rows: T[], cols: ExportColumn<T>[], meta: ExportMeta): void {
    const html = this.buildHtml(rows, cols, meta, /*forExcel*/ true);
    const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    this.download(blob, `${meta.fileBase}-${this.stamp()}.xls`);
  }

  csv<T>(rows: T[], cols: ExportColumn<T>[], meta: ExportMeta): void {
    const esc = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const head = cols.map(c => esc(`${meta.lang === 'ar' ? c.headerAr : c.headerEn}${c.headerEn && c.headerAr ? ` / ${meta.lang === 'ar' ? c.headerEn : c.headerAr}` : ''}`));
    const lines = [head.join(',')];
    for (const r of rows) lines.push(cols.map(c => esc(c.value(r, meta.lang))).join(','));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    this.download(blob, `${meta.fileBase}-${this.stamp()}.csv`);
  }

  pdf<T>(rows: T[], cols: ExportColumn<T>[], meta: ExportMeta): void {
    const html = this.buildHtml(rows, cols, meta, /*forExcel*/ false);
    // Print via a hidden iframe → avoids popup blockers; the browser renders
    // Arabic/RTL perfectly, and the user picks "Save as PDF" in the dialog.
    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    document.body.appendChild(frame);
    const doc = frame.contentWindow?.document;
    if (!doc) { frame.remove(); return; }
    doc.open();
    doc.write(html);
    doc.close();
    const win = frame.contentWindow;
    const go = () => {
      try { win?.focus(); win?.print(); } catch { /* noop */ }
      // Give the print dialog time to grab the document before cleanup.
      setTimeout(() => frame.remove(), 60000);
    };
    if (doc.readyState === 'complete') setTimeout(go, 300);
    else frame.onload = () => setTimeout(go, 300);
  }

  // ── shared styled-HTML builder ─────────────────────────────────────
  private buildHtml<T>(rows: T[], cols: ExportColumn<T>[], meta: ExportMeta, forExcel: boolean): string {
    const ar = meta.lang === 'ar';
    const dir = ar ? 'rtl' : 'ltr';
    const title = ar ? meta.titleAr : meta.titleEn;
    const subtitle = ar ? (meta.subtitleAr || meta.subtitleEn) : (meta.subtitleEn || meta.subtitleAr);
    const L = (en: string, arr: string) => (ar ? arr : en);

    // Print legibility: a colour-filled header with white text vanishes when the
    // browser's "Save as PDF" drops backgrounds (and muddies on a mono printer).
    // For the PDF path use dark ink on a light tint — it degrades cleanly to
    // dark-on-white; the Excel path keeps the bold filled header.
    const headBg = forExcel ? BRAND : HEAD_TINT;
    const headTx = forExcel ? HEAD_TEXT : BRAND_DARK;

    const metaBits: string[] = [];
    if (meta.branch) metaBits.push(`${L('Branch', 'الفرع')}: <b>${esc(meta.branch)}</b>`);
    if (meta.fromDate || meta.toDate)
      metaBits.push(`${L('Period', 'الفترة')}: <b>${esc((meta.fromDate || '').slice(0, 10))} → ${esc((meta.toDate || '').slice(0, 10))}</b>`);
    metaBits.push(`${L('Rows', 'عدد السجلات')}: <b>${rows.length}</b>`);
    metaBits.push(`${L('Generated', 'تاريخ التصدير')}: <b>${esc(this.nowLabel())}</b>`);

    const headCells = cols.map(c => {
      const h1 = ar ? c.headerAr : c.headerEn;
      const h2 = ar ? c.headerEn : c.headerAr;
      const sub = (h2 && h2 !== h1) ? `<div style="font-weight:400;font-size:10px;opacity:.8">${esc(h2)}</div>` : '';
      return `<th style="background:${headBg};color:${headTx};border:1px solid ${forExcel ? BRAND_DARK : BORDER};border-bottom:2px solid ${BRAND};padding:8px 10px;text-align:center;font-weight:700;white-space:nowrap">${esc(h1)}${sub}</th>`;
    }).join('');

    const body = rows.map((r, i) => {
      const zebra = i % 2 ? ` background:${ZEBRA};` : '';
      const tds = cols.map(c => {
        const raw = c.value(r, meta.lang);
        const t = c.tone?.(r);
        let cell = '';
        if (t === 'good') cell = `background:${GOOD_BG};color:${GOOD_TX};font-weight:600;`;
        else if (t === 'bad') cell = `background:${BAD_BG};color:${BAD_TX};font-weight:600;`;
        else if (t === 'muted') cell = 'color:#64748b;';
        const align = c.numeric ? 'right' : (ar ? 'right' : 'left');
        return `<td style="border:1px solid ${BORDER};padding:6px 10px;text-align:${align};vertical-align:top;${zebra}${cell}">${esc(raw)}</td>`;
      }).join('');
      return `<tr>${tds}</tr>`;
    }).join('');

    // <col> widths help Excel size columns sensibly.
    const colgroup = cols.map(c => `<col style="width:${(c.width ?? 18) * 7}px">`).join('');

    const printCss = forExcel ? '' : `
      @page { size: A4 landscape; margin: 12mm; }
      @media print { .noprint { display:none } body { -webkit-print-color-adjust:exact; print-color-adjust:exact } }
      body { font-family: 'Tajawal','Segoe UI',Arial,sans-serif; color:#0f172a; }
      .hint { margin: 10px 0 16px; color:#475569; font-size:12px }
    `;

    return `<!doctype html>
<html dir="${dir}" lang="${meta.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  body { font-family:'Tajawal','Segoe UI',Arial,sans-serif; margin:0; padding:18px; }
  table { border-collapse:collapse; width:100%; font-size:12px; }
  th,td { mso-data-placement:same-cell; }
  .head-bar { border-${ar ? 'right' : 'left'}:5px solid ${BRAND}; padding:2px 12px; margin-bottom:6px; }
  .head-bar h1 { margin:0; font-size:20px; color:${BRAND_DARK}; }
  .head-bar p { margin:2px 0 0; color:#475569; font-size:12px; }
  .meta { color:#475569; font-size:12px; margin:8px 0 14px; }
  .meta span { margin-${ar ? 'left' : 'right'}:18px; }
  ${printCss}
</style>
</head>
<body dir="${dir}">
  <div class="head-bar">
    <h1>${esc(title)}</h1>
    ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
  </div>
  <div class="meta">${metaBits.map(b => `<span>${b}</span>`).join('')}</div>
  ${forExcel ? '' : `<div class="hint noprint">${L('Use your browser print dialog → "Save as PDF".', 'استخدم نافذة الطباعة ← "حفظ كـ PDF".')}</div>`}
  <table dir="${dir}">
    <colgroup>${colgroup}</colgroup>
    <thead><tr>${headCells}</tr></thead>
    <tbody>${body || `<tr><td style="padding:18px;text-align:center;color:#94a3b8" colspan="${cols.length}">${L('No data.', 'لا توجد بيانات.')}</td></tr>`}</tbody>
  </table>
</body>
</html>`;
  }

  // ── helpers ────────────────────────────────────────────────────────
  private download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  /** yyyy-MM-dd for filenames (local time). */
  private stamp(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Human timestamp for the report header. */
  private nowLabel(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
}

/** Escape HTML so report values can't break the markup. */
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
