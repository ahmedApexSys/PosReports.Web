import { Injectable } from '@angular/core';
import { TotalBlock } from '../reports/total-report.model';

/**
 * Zero-dependency, bilingual, *styled* export for tabular report data.
 *
 * Four outputs, one column spec:
 *  - Excel  → a styled HTML table served as `.xls` (Excel opens it with the
 *             Apex brand colours, borders, widths and RTL intact). No library,
 *             so no new npm vulnerabilities and no bundler/polyfill risk.
 *  - PDF/A4 → the same styled report printed via a hidden iframe (the browser
 *             engine renders Arabic + RTL perfectly → "Save as PDF").
 *  - POS 72 / POS 80 → a narrow thermal-receipt layout (72mm / 80mm roll) for
 *             one-click printing of the (column-trimmed) report on the POS
 *             printer. Pair with the column customizer to keep it to the few
 *             columns that matter.
 *  - CSV    → clean UTF-8 (+BOM so Excel shows Arabic) with bilingual headers.
 *
 * Brand: Apex red (logo). Header degrades to dark-ink-on-tint for print so it
 * survives "Save as PDF" dropping backgrounds and mono printers.
 */

export type ExportLang = 'en' | 'ar';
export type ExportPaper = 'a4' | 'pos72' | 'pos80' | 'flash';

/** One column in the export. `value` formats a row into its display string. */
export interface ExportColumn<T> {
  headerEn: string;
  headerAr: string;
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
  /** File name base (no extension), e.g. "sales-period". */
  fileBase: string;
  /** Paper size for the print/PDF path. Default 'a4'. */
  paper?: ExportPaper;
  /** Optional bold footer row, one cell per column (e.g. totals). */
  footer?: (string | number | null | undefined)[];
  /** Filter selections that produced this report — printed in the header. */
  appliedFilters?: { label: string; value: string }[];
  /** Payment totals (Cash/Visa/Ledge/Other/Net …) for the receipt totals block. */
  paymentTotals?: { label: string; value: string; emphasize?: boolean }[];
}

/** Header meta for the multi-section TotalsReport ("Daily Transactions") receipt. */
export interface TotalReceiptMeta {
  titleEn: string;
  titleAr: string;
  companyName?: string | null;
  branchName?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  lang: ExportLang;
  fileBase: string;
}

// ── Apex brand palette ────────────────────────────────────────────────────
const BRAND = '#A81813';        // deep Apex red (white text passes AA)
const BRAND_LIGHT = '#E2231A';  // Apex red
const HEAD_TEXT = '#ffffff';
const HEAD_TINT = '#FCE0DE';    // light red tint (print-safe header)
const FOOT_TINT = '#FEF2F1';
const ZEBRA = '#FAF7F7';
const BORDER = '#e6d9d8';
const INK = '#1f2937';
const MUTE = '#6b7280';
const GOOD_BG = '#dcfce7';
const GOOD_TX = '#166534';
const BAD_BG = '#fee2e2';
const BAD_TX = '#991b1b';

/**
 * Smart short-codes for the narrow thermal receipt: recognise common
 * transaction / payment names and abbreviate them so they sit on one line
 * (TakeAway → T.Away, Dine In → DineIn, Delivery → Deliv., Reservation → Resv.).
 * Keys are normalised (lower-cased, spaces/dots/dashes stripped). Anything not
 * in the map passes through untouched — numbers, item names, dates are never
 * mangled.
 */
const RECEIPT_SHORT: Record<string, string> = {
  takeaway: 'T.Away', takeaways: 'T.Away', takaway: 'T.Away', takeout: 'T.Out',
  dinein: 'DineIn',
  delivery: 'Deliv.', delivered: 'Deliv.', deliveries: 'Deliv.',
  reservation: 'Resv.', reservations: 'Resv.', reserve: 'Resv.',
  pickup: 'Pickup',
  hosbitality: 'Hosp.', hospitality: 'Hosp.',
};

@Injectable({ providedIn: 'root' })
export class ExportService {

  // ── public API ─────────────────────────────────────────────────────
  excel<T>(rows: T[], cols: ExportColumn<T>[], meta: ExportMeta): void {
    const html = this.buildHtml(rows, cols, meta, 'excel');
    const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    this.download(blob, this.fileName(meta, 'xls'));
  }

  csv<T>(rows: T[], cols: ExportColumn<T>[], meta: ExportMeta): void {
    const esc = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const head = cols.map(c => esc(`${meta.lang === 'ar' ? c.headerAr : c.headerEn}${c.headerEn && c.headerAr ? ` / ${meta.lang === 'ar' ? c.headerEn : c.headerAr}` : ''}`));
    const lines: string[] = [];
    // Title + applied filters as comment-ish leading rows so the CSV is self-describing.
    lines.push(esc(meta.lang === 'ar' ? meta.titleAr : meta.titleEn));
    for (const fl of this.metaLines(meta)) lines.push(esc(fl));
    lines.push('');
    lines.push(head.join(','));
    for (const r of rows) lines.push(cols.map(c => esc(c.value(r, meta.lang))).join(','));
    if (meta.footer && meta.footer.length === cols.length) {
      lines.push(meta.footer.map(v => esc(v)).join(','));
    }
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    this.download(blob, this.fileName(meta, 'csv'));
  }

  /** Print / Save-as-PDF at the requested paper size (default A4 landscape). */
  pdf<T>(rows: T[], cols: ExportColumn<T>[], meta: ExportMeta): void {
    const paper = meta.paper ?? 'a4';
    // Flash + thermal widths get the modern receipt; A4 keeps the full table.
    const html = (paper === 'pos72' || paper === 'pos80' || paper === 'flash')
      ? this.buildReceipt(rows, cols, meta, paper)
      : this.buildHtml(rows, cols, meta, paper);
    this.printHtml(html);
  }

  /** Print a ready HTML document via a hidden iframe (Save-as-PDF / receipt printer). */
  private printHtml(html: string): void {
    const frame = document.createElement('iframe');
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
    document.body.appendChild(frame);
    const doc = frame.contentWindow?.document;
    if (!doc) { frame.remove(); return; }
    doc.open(); doc.write(html); doc.close();
    const win = frame.contentWindow;
    const go = () => {
      try { win?.focus(); win?.print(); } catch { /* noop */ }
      setTimeout(() => frame.remove(), 60000);
    };
    if (doc.readyState === 'complete') setTimeout(go, 300);
    else frame.onload = () => setTimeout(go, 300);
  }

  /**
   * Print the multi-section "Daily Transactions" (TotalsReport) as a thermal
   * receipt — Sale Transactions, POS, Sales Group, Category Sales, PayWay,
   * Information… Pure-black, heavy, BIG type for legibility on the roll.
   */
  totalReport(blocks: TotalBlock[], meta: TotalReceiptMeta, paper: ExportPaper): void {
    this.printHtml(this.buildTotalReceipt(blocks, meta, paper));
  }

  private buildTotalReceipt(blocks: TotalBlock[], meta: TotalReceiptMeta, paper: ExportPaper): string {
    const ar = meta.lang === 'ar';
    const dir = ar ? 'rtl' : 'ltr';
    const L = (en: string, arr: string) => (ar ? arr : en);
    const width = paper === 'pos72' ? '72mm' : '80mm';
    const title = ar ? meta.titleAr : meta.titleEn;
    const period = `${esc((meta.fromDate || '').slice(0, 10))} → ${esc((meta.toDate || '').slice(0, 10))}`;

    const tbl = (t: { head: string[]; rows: string[][] }) => {
      const head = t.head.map((h, i) => `<th class="${i > 0 ? 'num' : ''}">${esc(h)}</th>`).join('');
      const rows = t.rows.length
        ? t.rows.map((r) => `<tr>${r.map((c, i) => `<td class="${i > 0 ? 'num' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')
        : `<tr><td colspan="${t.head.length}" class="empty">—</td></tr>`;
      return `<table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
    };
    const kv = (r: { label: string; value: string; strong?: boolean }) =>
      `<div class="kv ${r.strong ? 'st' : ''}"><span>${esc(r.label)}</span><span>${esc(r.value)}</span></div>`;

    const body = blocks.map((b) => {
      if (b.heading) return `<div class="sec-head">${esc(b.title)}</div>`;
      if (b.boxed) {
        const rows = (b.rows ?? []).map(kv).join('');
        return `<div class="cat"><div class="cat-t">${esc(b.title)}</div>${rows}</div>${b.table ? tbl(b.table) : ''}`;
      }
      let h = `<div class="sec">${esc(b.title)}</div>`;
      if (b.rows) h += b.rows.map(kv).join('');
      if (b.table) h += tbl(b.table);
      return h;
    }).join('');

    return `<!doctype html>
<html dir="${dir}" lang="${meta.lang}">
<head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: ${width} auto; margin: 3mm; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact } }
  * { box-sizing:border-box; }
  body { font-family:'Tajawal','Segoe UI',Arial,sans-serif; margin:0 auto; padding:6px; color:#000;
         width:${width}; font-size:12.5px; line-height:1.34; font-weight:600; }
  .r-head { text-align:center; border:2px solid #000; border-radius:8px; padding:9px 6px; margin-bottom:8px; }
  .r-head .logo { display:inline-flex; height:26px; width:26px; align-items:center; justify-content:center;
                  border-radius:6px; background:#000; color:#fff; font-weight:800; font-size:16px; margin-bottom:4px;
                  -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .r-head h1 { margin:2px 0 0; font-size:18px; font-weight:800; color:#000; }
  .r-head .sub { margin-top:2px; color:#000; font-size:11px; font-weight:700; }
  .m-row { display:flex; justify-content:space-between; gap:8px; padding:2px; font-size:12px; }
  .m-row span { color:#000; font-weight:700; } .m-row b { color:#000; font-weight:800; }
  .rule { border:0; border-top:2px solid #000; margin:7px 0; }
  .sec { margin:9px 0 2px; font-size:12.5px; font-weight:800; text-transform:uppercase; letter-spacing:.3px;
         color:#000; border-bottom:2px solid #000; padding-bottom:2px; }
  .sec-head { margin:11px 0 3px; font-size:13.5px; font-weight:800; text-transform:uppercase; text-align:center;
              color:#000; border-top:2px solid #000; border-bottom:2px solid #000; padding:3px 0; }
  .kv { display:flex; justify-content:space-between; gap:10px; padding:3px 2px; font-size:12.5px; font-weight:700; color:#000;
        border-bottom:1px dashed #000; }
  .kv span:last-child { font-variant-numeric:tabular-nums; font-weight:800; }
  .kv.st { font-size:15px; font-weight:800; border-bottom:0; border-top:2px solid #000; margin-top:3px; padding-top:5px; }
  .cat { border:2px solid #000; border-radius:6px; padding:5px 7px; margin:5px 0 3px; }
  .cat-t { text-align:center; font-size:13px; font-weight:800; text-transform:uppercase; margin-bottom:3px; }
  table { width:100%; border-collapse:collapse; table-layout:fixed; margin:1px 0 4px; }
  thead th { font-size:10px; text-transform:uppercase; color:#000; font-weight:800; padding:4px 2px;
             border-bottom:2px solid #000; text-align:${ar ? 'right' : 'left'}; white-space:normal; overflow-wrap:anywhere; }
  tbody td { padding:4px 2px; border-bottom:1px dashed #000; font-size:11.5px; font-weight:700; color:#000;
             text-align:${ar ? 'right' : 'left'}; white-space:normal; overflow-wrap:anywhere; }
  th.num, td.num { text-align:${ar ? 'left' : 'right'}; font-variant-numeric:tabular-nums; white-space:nowrap; overflow-wrap:normal; }
  td.empty { text-align:center; color:#000; font-weight:600; }
  .r-foot { text-align:center; color:#000; font-size:11px; font-weight:700; margin-top:12px; border-top:2px solid #000; padding-top:5px; }
</style></head>
<body dir="${dir}">
  <div class="r-head">
    <div class="logo">A</div>
    <h1>${esc(title)}</h1>
    ${meta.companyName ? `<div class="sub">${esc(meta.companyName)}${meta.branchName ? ' · ' + esc(meta.branchName) : ''}</div>` : ''}
  </div>
  <div class="r-meta">
    ${meta.companyName ? `<div class="m-row"><span>${L('Company', 'الشركة')}</span><b>${esc(meta.companyName)}</b></div>` : ''}
    ${meta.branchName ? `<div class="m-row"><span>${L('Branch', 'الفرع')}</span><b>${esc(meta.branchName)}</b></div>` : ''}
    <div class="m-row"><span>${L('Period', 'الفترة')}</span><b>${period}</b></div>
  </div>
  <hr class="rule">
  ${body}
  <div class="r-foot">Apex Point of Sale — ${L('Thank you', 'شكراً لك')}</div>
</body>
</html>`;
  }

  /**
   * Direct one-click PDF *file* download (no print dialog / no "Save as PDF").
   *
   * Uses jsPDF + jspdf-autotable to emit a **vector** A4-landscape table: an
   * Apex-red title bar, the meta + applied-filter lines, then the data table
   * with a red header (repeated on every page), zebra rows, a bold totals
   * footer, right-aligned numerics, auto column-fitting and a page-number
   * footer. Vector output ⇒ crisp text, correct page count, tiny file size
   * (the old html2canvas image approach produced faded, clipped, 40+-page,
   * multi-MB files for wide reports). Libraries are dynamically imported so
   * they stay out of the main bundle.
   *
   * Arabic UI: jsPDF's built-in fonts don't shape Arabic, so we defer to the
   * browser print path (`pdf()`), which renders Arabic/RTL perfectly.
   * On any failure we also fall back to print so the user still gets a PDF.
   */
  async pdfDownload<T>(rows: T[], cols: ExportColumn<T>[], meta: ExportMeta): Promise<void> {
    if (meta.lang === 'ar') { this.pdf(rows, cols, meta); return; }

    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const M = 28;

      // ── Title bar ──
      doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(168, 24, 19);
      doc.text(meta.titleEn || meta.fileBase || 'Report', M, 30);
      let y = 38;
      if (meta.subtitleEn) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120, 120, 120);
        doc.text(meta.subtitleEn, M, y); y += 8;
      }
      doc.setDrawColor(168, 24, 19); doc.setLineWidth(1.5); doc.line(M, y, pageW - M, y);
      y += 12;

      // ── Meta + applied filters ──
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(90, 90, 90);
      for (const line of this.metaLines(meta)) {
        doc.text(line, M, y, { maxWidth: pageW - M * 2 }); y += 11;
      }

      // ── Table ──
      const head = [cols.map((c) => c.headerEn || c.headerAr || '')];
      const body = rows.map((r) => cols.map((c) => String(c.value(r, 'en') ?? '')));
      const foot = (meta.footer && meta.footer.length === cols.length)
        ? [meta.footer.map((v) => String(v ?? ''))] : undefined;
      const columnStyles: Record<number, { halign: 'left' | 'right' }> = {};
      cols.forEach((c, i) => { columnStyles[i] = { halign: c.numeric ? 'right' : 'left' }; });

      autoTable(doc, {
        head, body, foot,
        startY: y + 2,
        margin: { left: M, right: M, bottom: 26 },
        tableWidth: 'auto',
        styles: {
          font: 'helvetica', fontSize: 7, cellPadding: 3, overflow: 'linebreak',
          lineColor: [230, 217, 216], lineWidth: 0.5, textColor: [31, 41, 55], valign: 'middle',
        },
        headStyles: {
          fillColor: [168, 24, 19], textColor: [255, 255, 255], fontStyle: 'bold',
          halign: 'center', fontSize: 7, lineColor: [168, 24, 19],
        },
        footStyles: { fillColor: [254, 242, 241], textColor: [168, 24, 19], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 247, 247] },
        columnStyles,
        didDrawPage: () => {
          const page = doc.getNumberOfPages();
          doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(150, 150, 150);
          doc.text(`${meta.titleEn || ''}  ·  ${this.nowLabel()}  ·  ${page}`, M, pageH - 12);
        },
      });

      doc.save(this.fileName(meta, 'pdf'));
    } catch (err) {
      // Graceful fallback: still give the user a PDF via the print path.
      console.error('[ExportService] vector PDF failed, falling back to print:', err);
      this.pdf(rows, cols, meta);
    }
  }

  // ── shared styled-HTML builder ─────────────────────────────────────
  private buildHtml<T>(rows: T[], cols: ExportColumn<T>[], meta: ExportMeta, mode: 'excel' | ExportPaper): string {
    const ar = meta.lang === 'ar';
    const dir = ar ? 'rtl' : 'ltr';
    const forExcel = mode === 'excel';
    const pos = mode === 'pos72' || mode === 'pos80';
    const title = ar ? meta.titleAr : meta.titleEn;
    const subtitle = ar ? (meta.subtitleAr || meta.subtitleEn) : (meta.subtitleEn || meta.subtitleAr);
    const L = (en: string, arr: string) => (ar ? arr : en);

    // Filled brand header for Excel; print-safe tinted header otherwise.
    const headBg = forExcel ? BRAND : HEAD_TINT;
    const headTx = forExcel ? HEAD_TEXT : BRAND;

    const metaBits: string[] = [];
    if (meta.branch) metaBits.push(`${L('Branch', 'الفرع')}: <b>${esc(meta.branch)}</b>`);
    if (meta.fromDate || meta.toDate)
      metaBits.push(`${L('Period', 'الفترة')}: <b>${esc((meta.fromDate || '').slice(0, 10))} → ${esc((meta.toDate || '').slice(0, 10))}</b>`);
    metaBits.push(`${L('Rows', 'عدد السجلات')}: <b>${rows.length}</b>`);
    metaBits.push(`${L('Generated', 'تاريخ التصدير')}: <b>${esc(this.nowLabel())}</b>`);

    // Applied filter selections — printed as a distinct, chip-styled row so the
    // reader knows exactly which slice of data this export represents.
    const filterChips = (meta.appliedFilters ?? [])
      .filter((f) => f && f.value && String(f.value).trim() !== '')
      .map((f) => `<span class="chip"><i>${esc(f.label)}</i>${esc(f.value)}</span>`)
      .join('');
    const filtersRow = filterChips
      ? `<div class="filters"><span class="filters-lead">${L('Filters', 'الفلاتر')}:</span>${filterChips}</div>`
      : '';

    const fontPx = pos ? 9 : 12;
    const pad = pos ? '3px 4px' : '6px 10px';
    const wrap = pos ? 'normal' : 'nowrap';

    // Excel honours a per-cell width hint and, crucially, an `mso-number-format`
    // text format that stops it re-parsing dates/codes (which showed as "####")
    // and lets long names render in full. Print/PDF ignore these harmlessly.
    const colPx = (c: ExportColumn<T>): number =>
      forExcel ? Math.max(c.width ?? 18, c.numeric ? 12 : 20) * 8 : (c.width ?? 18) * 7;
    const exTextFmt = (c: ExportColumn<T>): string =>
      forExcel && !c.numeric ? `mso-number-format:'\\@';` : '';

    const headCells = cols.map(c => {
      const h1 = ar ? c.headerAr : c.headerEn;
      const h2 = ar ? c.headerEn : c.headerAr;
      const sub = (!pos && h2 && h2 !== h1) ? `<div style="font-weight:400;font-size:10px;opacity:.75">${esc(h2)}</div>` : '';
      const w = forExcel ? `width:${colPx(c)}px;` : '';
      return `<th style="background:${headBg};color:${headTx};border:1px solid ${forExcel ? BRAND : BORDER};border-bottom:2px solid ${BRAND};padding:${pad};text-align:center;font-weight:700;white-space:${wrap};${w}">${esc(h1)}${sub}</th>`;
    }).join('');

    const body = rows.map((r, i) => {
      const zebra = i % 2 ? ` background:${ZEBRA};` : '';
      const tds = cols.map(c => {
        const raw = c.value(r, meta.lang);
        const t = c.tone?.(r);
        let cell = '';
        if (t === 'good') cell = `background:${GOOD_BG};color:${GOOD_TX};font-weight:600;`;
        else if (t === 'bad') cell = `background:${BAD_BG};color:${BAD_TX};font-weight:600;`;
        else if (t === 'muted') cell = `color:${MUTE};`;
        const align = c.numeric ? 'right' : (ar ? 'right' : 'left');
        return `<td style="border:1px solid ${BORDER};padding:${pad};text-align:${align};vertical-align:top;white-space:${wrap};${exTextFmt(c)}${zebra}${cell}">${esc(raw)}</td>`;
      }).join('');
      return `<tr>${tds}</tr>`;
    }).join('');

    const footer = (meta.footer && meta.footer.length === cols.length)
      ? `<tfoot><tr>${cols.map((c, i) => {
          const align = c.numeric ? 'right' : (ar ? 'right' : 'left');
          return `<td style="border:1px solid ${BORDER};border-top:2px solid ${BRAND};background:${FOOT_TINT};padding:${pad};text-align:${align};font-weight:700;color:${BRAND};white-space:${wrap};${exTextFmt(c)}">${esc(meta.footer![i])}</td>`;
        }).join('')}</tr></tfoot>`
      : '';

    const colgroup = cols.map(c => `<col style="width:${colPx(c)}px">`).join('');

    const pageSize = mode === 'pos72' ? '72mm auto' : mode === 'pos80' ? '80mm auto' : 'A4 landscape';
    const pageMargin = pos ? '3mm' : '12mm';
    const bodyPad = pos ? '6px' : '18px';

    const printCss = forExcel ? '' : `
      @page { size: ${pageSize}; margin: ${pageMargin}; }
      @media print { .noprint { display:none } body { -webkit-print-color-adjust:exact; print-color-adjust:exact } }
      .hint { margin: 8px 0 14px; color:${MUTE}; font-size:12px }
    `;

    return `<!doctype html>
<html dir="${dir}" lang="${meta.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(this.fileNameBase(meta))}</title>
<style>
  body { font-family:'Tajawal','Segoe UI',Arial,sans-serif; margin:0; padding:${bodyPad}; color:${INK}; }
  table { border-collapse:collapse; width:100%; font-size:${fontPx}px; }
  th,td { mso-data-placement:same-cell; }
  .head-bar { padding-bottom:8px; margin-bottom:10px; border-bottom:3px solid ${BRAND}; ${pos ? 'text-align:center;' : ''} }
  .head-bar .brand { display:inline-flex; align-items:center; gap:8px; }
  .head-bar .logo { display:inline-flex; height:${pos ? 18 : 26}px; width:${pos ? 18 : 26}px; align-items:center; justify-content:center;
                    border-radius:6px; background:${BRAND}; color:#fff; font-weight:800; font-size:${pos ? 11 : 15}px; }
  .head-bar h1 { margin:0; font-size:${pos ? 14 : 20}px; color:${BRAND}; }
  .head-bar p { margin:2px 0 0; color:${MUTE}; font-size:${pos ? 10 : 12}px; }
  .meta { color:${MUTE}; font-size:${pos ? 10 : 12}px; margin:8px 0 6px; ${pos ? 'text-align:center;' : ''} }
  .meta span { display:${pos ? 'block' : 'inline'}; margin-${ar ? 'left' : 'right'}:${pos ? '0' : '18px'}; }
  .filters { margin:4px 0 12px; font-size:${pos ? 9 : 11}px; ${pos ? 'text-align:center;' : ''} }
  .filters-lead { color:${MUTE}; font-weight:700; margin-${ar ? 'left' : 'right'}:6px; }
  .chip { display:inline-block; margin:2px 4px 2px 0; padding:2px 8px; border-radius:999px;
          background:${HEAD_TINT}; color:${BRAND}; border:1px solid ${BORDER}; white-space:nowrap; }
  .chip i { font-style:normal; color:${MUTE}; font-weight:600; margin-${ar ? 'left' : 'right'}:5px; }
  ${printCss}
</style>
</head>
<body dir="${dir}">
  <div class="head-bar">
    <span class="brand"><span class="logo">A</span><h1>${esc(title)}</h1></span>
    ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
  </div>
  <div class="meta">${metaBits.map(b => `<span>${b}</span>`).join('')}</div>
  ${filtersRow}
  ${forExcel ? '' : `<div class="hint noprint">${L('Use your browser print dialog → "Save as PDF".', 'استخدم نافذة الطباعة ← "حفظ كـ PDF".')}</div>`}
  <table dir="${dir}">
    <colgroup>${colgroup}</colgroup>
    <thead><tr>${headCells}</tr></thead>
    <tbody>${body || `<tr><td style="padding:18px;text-align:center;color:${MUTE}" colspan="${cols.length}">${L('No data.', 'لا توجد بيانات.')}</td></tr>`}</tbody>
    ${footer}
  </table>
</body>
</html>`;
  }

  /**
   * Modern thermal-receipt layout (Flash report + POS 72mm / 80mm). Clean
   * centred header with the Apex mark, a compact key→value meta block, a
   * borderless item table with hairline row rules + tabular figures, and a
   * totals block (payment breakdown when available, else the column footer)
   * with an emphasised Net line.
   */
  private buildReceipt<T>(rows: T[], cols: ExportColumn<T>[], meta: ExportMeta, paper: ExportPaper): string {
    const ar = meta.lang === 'ar';
    const dir = ar ? 'rtl' : 'ltr';
    const title = ar ? meta.titleAr : meta.titleEn;
    const subtitle = ar ? (meta.subtitleAr || meta.subtitleEn) : (meta.subtitleEn || meta.subtitleAr);
    const L = (en: string, arr: string) => (ar ? arr : en);
    const width = paper === 'pos72' ? '72mm' : '80mm';

    // The caller (the report page) already curates `cols` down to the columns
    // that fit the roll — the report's short-named `receiptColumns`, or the
    // visible columns auto-capped. Render exactly what we're given.
    const metaRows: string[] = [];
    if (meta.fromDate || meta.toDate)
      metaRows.push(`<div class="m-row"><span>${L('Period', 'الفترة')}</span><b>${esc((meta.fromDate || '').slice(0, 10))} → ${esc((meta.toDate || '').slice(0, 10))}</b></div>`);
    if (meta.branch) metaRows.push(`<div class="m-row"><span>${L('Branch', 'الفرع')}</span><b>${esc(meta.branch)}</b></div>`);
    for (const f of (meta.appliedFilters ?? [])) {
      if (f && f.value && String(f.value).trim() !== '') metaRows.push(`<div class="m-row"><span>${esc(f.label)}</span><b>${esc(f.value)}</b></div>`);
    }
    metaRows.push(`<div class="m-row"><span>${L('Records', 'عدد السجلات')}</span><b>${rows.length}</b></div>`);

    const head = cols.map((c) => `<th class="${c.numeric ? 'num' : ''}">${esc(ar ? c.headerAr : c.headerEn)}</th>`).join('');
    const body = rows.length
      ? rows.map((r) => `<tr>${cols.map((c) => `<td class="${c.numeric ? 'num' : ''}">${esc(this.receiptShort(c.value(r, meta.lang)))}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${cols.length}" style="text-align:center;color:#999;padding:14px 0">${L('No data.', 'لا توجد بيانات.')}</td></tr>`;

    // Totals block: the curated `paymentTotals` the caller built (e.g.
    // Cash/Visa/Ledge/Net on the cashier daily report). When none, sum this
    // receipt's own numeric columns from the footer (SubTotal/Service/Tax/
    // Discount/Net, SubTotal/Quantity/Net…), with Net emphasized.
    let totals = meta.paymentTotals ?? [];
    if (!totals.length && meta.footer && meta.footer.length === cols.length) {
      totals = cols.map((c, i) => ({ c, v: meta.footer![i] }))
        .filter((x) => x.c.numeric && x.v != null && String(x.v).trim() !== '')
        .map((x) => ({ label: ar ? x.c.headerAr : x.c.headerEn, value: String(x.v), emphasize: /net|الصافي/i.test(`${x.c.headerEn}${x.c.headerAr}`) }));
    }
    const totalsHtml = totals
      .map((t) => `<div class="t-row ${t.emphasize ? 'net' : ''}"><span>${esc(t.label)}</span><span>${esc(t.value)}</span></div>`)
      .join('');

    return `<!doctype html>
<html dir="${dir}" lang="${meta.lang}">
<head>
<meta charset="utf-8">
<title>${esc(this.fileNameBase(meta))}</title>
<style>
  /* Thermal-optimised: pure black, heavy weights, solid lines. Receipt printers
     are 1-bit — any grey or colour is dithered into sparse dots that barely burn
     (that's why the old grey headers / red logo printed almost invisible). */
  @page { size: ${width} auto; margin: 3mm; }
  @media print { .noprint { display:none } body { -webkit-print-color-adjust:exact; print-color-adjust:exact } }
  * { box-sizing:border-box; }
  body { font-family:'Tajawal','Segoe UI',Arial,sans-serif; margin:0 auto; padding:6px; color:#000;
         width:${width}; font-size:12px; line-height:1.34; font-weight:600; }
  .r-time { text-align:center; color:#000; font-size:10.5px; font-weight:700; letter-spacing:.3px; margin-bottom:5px; }
  .r-head { text-align:center; border:2px solid #000; border-radius:8px; padding:9px 6px; margin-bottom:8px; }
  .r-head .logo { display:inline-flex; height:26px; width:26px; align-items:center; justify-content:center;
                  border-radius:6px; background:#000; color:#fff; font-weight:800; font-size:16px; margin-bottom:4px;
                  -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .r-head h1 { margin:2px 0 0; font-size:18px; font-weight:800; letter-spacing:.2px; color:#000; }
  .r-head .sub { margin-top:2px; color:#000; font-size:11px; font-weight:700; }
  .r-meta { margin:0 0 6px; }
  .m-row { display:flex; justify-content:space-between; gap:8px; padding:2.5px; font-size:12px; }
  .m-row span { color:#000; font-weight:700; }
  .m-row b { color:#000; font-weight:800; text-align:${ar ? 'left' : 'right'}; }
  .rule { border:0; border-top:2px solid #000; margin:6px 0; }
  table { width:100%; border-collapse:collapse; table-layout:fixed; }
  thead th { font-size:9.5px; text-transform:uppercase; letter-spacing:.2px; color:#000; font-weight:800;
             padding:4px 2px; border-bottom:2px solid #000; text-align:center;
             white-space:normal; overflow-wrap:anywhere; }
  tbody td { padding:5px 2px; border-bottom:1px dashed #000; vertical-align:middle; font-size:10px; font-weight:700;
             color:#000; text-align:center; white-space:normal; overflow-wrap:anywhere; }
  .num { font-variant-numeric:tabular-nums; white-space:nowrap; overflow-wrap:normal; }
  .r-totals { margin-top:8px; border-top:2px solid #000; padding-top:6px; }
  .t-row { display:flex; justify-content:space-between; padding:3.5px 2px; font-size:13px; font-weight:700; color:#000; }
  .t-row span:last-child { font-variant-numeric:tabular-nums; color:#000; font-weight:800; }
  .t-row.net { margin-top:4px; padding-top:6px; border-top:2px solid #000; font-size:16px; font-weight:800; color:#000; }
  .t-row.net span:last-child { color:#000; }
  .r-foot { text-align:center; color:#000; font-size:10.5px; font-weight:700; margin-top:10px; }
  .hint { text-align:center; color:#000; font-size:10px; margin:6px 0 10px; }
</style>
</head>
<body dir="${dir}">
  <div class="r-time">${esc(this.nowLabel())}</div>
  <div class="r-head">
    <div class="logo">A</div>
    <h1>${esc(title)}</h1>
    ${subtitle ? `<div class="sub">${esc(subtitle)}</div>` : ''}
  </div>
  <div class="r-meta">${metaRows.join('')}</div>
  <hr class="rule">
  <div class="hint noprint">${L('Print → "Save as PDF" or send to the receipt printer.', 'اطبع ← "حفظ كـ PDF" أو أرسل لطابعة الإيصالات.')}</div>
  <table>
    <thead><tr>${head}</tr></thead>
    <tbody>${body}</tbody>
  </table>
  ${totalsHtml ? `<div class="r-totals">${totalsHtml}</div>` : ''}
  <div class="r-foot">Apex Point of Sale — ${L('Thank you', 'شكراً لك')}</div>
</body>
</html>`;
  }

  // ── helpers ────────────────────────────────────────────────────────
  /** Abbreviate a recognised transaction/payment name for the narrow receipt. */
  private receiptShort(v: string | number | null | undefined): string {
    const s = v == null ? '' : String(v);
    const key = s.trim().toLowerCase().replace(/[\s._-]/g, '');
    return RECEIPT_SHORT[key] ?? s;
  }
  private download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  /** Parts of the current Cairo-local time (handles Egypt DST automatically). */
  private egyptParts(): { date: string; time12: string; ampm: string } {
    const d = new Date();
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Cairo',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: true,
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const date = `${get('year')}-${get('month')}-${get('day')}`;
    const ampm = (get('dayPeriod') || '').toUpperCase();
    return { date, time12: `${get('hour')}:${get('minute')}`, ampm };
  }

  /** "2026-06-16  11:35 AM" (Cairo) — for the report header. */
  private nowLabel(): string {
    const e = this.egyptParts();
    return `${e.date}  ${e.time12} ${e.ampm}`;
  }

  /** Filename base: "<Report name> - 2026-06-16 11.35 AM" (Cairo, filename-safe). */
  private fileNameBase(meta: ExportMeta): string {
    const title = (meta.lang === 'ar' ? meta.titleAr : meta.titleEn) || meta.fileBase || 'report';
    const safe = title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
    const e = this.egyptParts();
    // Colons are illegal in filenames → use a dot in the time component.
    return `${safe} - ${e.date} ${e.time12.replace(':', '.')} ${e.ampm}`;
  }

  private fileName(meta: ExportMeta, ext: string): string {
    return `${this.fileNameBase(meta)}.${ext}`;
  }

  /** Human-readable meta + filter lines (branch / period / generated / filters) for the CSV preamble. */
  private metaLines(meta: ExportMeta): string[] {
    const ar = meta.lang === 'ar';
    const L = (en: string, arr: string) => (ar ? arr : en);
    const out: string[] = [];
    if (meta.branch) out.push(`${L('Branch', 'الفرع')}: ${meta.branch}`);
    if (meta.fromDate || meta.toDate)
      out.push(`${L('Period', 'الفترة')}: ${(meta.fromDate || '').slice(0, 10)} -> ${(meta.toDate || '').slice(0, 10)}`);
    out.push(`${L('Generated', 'تاريخ التصدير')}: ${this.nowLabel()}`);
    for (const f of (meta.appliedFilters ?? [])) {
      if (f && f.value && String(f.value).trim() !== '') out.push(`${f.label}: ${f.value}`);
    }
    return out;
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
