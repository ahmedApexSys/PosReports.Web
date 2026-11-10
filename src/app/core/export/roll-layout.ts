/**
 * Column layout for the thermal roll (Flash / POS 72 / POS 80).
 *
 * The roll used `table-layout:fixed` with equal columns, so a long header ("TOTAL RESERVATION
 * AMOUNT") either broke mid-word or — on a figure column, which never wraps — ran across its
 * neighbours, and a date wrapped as "2026-11- / 01" (owner, 2026-11-10). Here every column gets
 * at least the width of its longest header WORD and of its longest unbreakable cell (figures,
 * dates); what is left goes to the columns that want more. When even the minimums do not fit,
 * the type steps down until they do.
 */

/** Printable width of the roll in CSS px: paper minus the 3mm @page margins and 6px body padding. */
export function rollWidthPx(paper: 'pos72' | 'pos80' | 'flash'): number {
  const mm = paper === 'pos72' ? 72 : 80;
  return Math.floor((mm - 6) * 3.7795 - 12);
}

export interface RollColumnInput {
  header: string;
  /** Cell texts as printed. */
  cells: string[];
  /** Figures and dates: never wrap. Text columns may wrap between words. */
  nowrap: boolean;
}

export interface RollLayout {
  /** Column widths in % of the table. */
  widths: number[];
  headPx: number;
  cellPx: number;
}

const HEAD_PX = 9.5;
const CELL_PX = 10;
const MIN_PX = 7;
const SOFT_MIN_PX = 8;
/** Horizontal padding of a cell (2px each side) plus a little air between neighbours. */
const PAD = 6;
/** Our measure runs in the app's document; the print frame may fall back to another face. */
const SAFETY = 1.06;
/* The roll asks for Tajawal, but the print frame only has it when the system does; otherwise it
   falls back to Segoe UI / Arial. Measure in both and keep the wider. */
const FONTS = ["'Tajawal',sans-serif", "'Segoe UI',Arial,sans-serif"];

let ctx: CanvasRenderingContext2D | null | undefined;
function measure(text: string, px: number, weight: number, upper: boolean): number {
  const t = upper ? text.toUpperCase() : text;
  if (ctx === undefined) {
    try { ctx = document.createElement('canvas').getContext('2d'); } catch { ctx = null; }
  }
  if (ctx) {
    const c = ctx;
    const w = Math.max(...FONTS.map((f) => { c.font = `${weight} ${px}px ${f}`; return c.measureText(t).width; }));
    // + letter-spacing of the upper-case header.
    return (w + (upper ? t.length * 0.2 : 0)) * SAFETY;
  }
  // No canvas: a generous per-character estimate.
  return t.length * px * (upper ? 0.74 : 0.62) * SAFETY;
}

const words = (s: string) => s.split(/\s+/).filter(Boolean);

export function rollLayout(cols: RollColumnInput[], widthPx: number, upperHead: boolean): RollLayout {
  let headPx = HEAD_PX;
  let cellPx = CELL_PX;
  let mins: number[] = [];
  let wants: number[] = [];
  // Fit order: the headers step down first (they may also wrap), then the figures, never below 7px.
  for (let pass = 0; pass < 24; pass++) {
    mins = []; wants = [];
    for (const c of cols) {
      const headWord = Math.max(0, ...words(c.header).map((w) => measure(w, headPx, 800, upperHead)));
      const headFull = measure(c.header, headPx, 800, upperHead);
      const cellMax = Math.max(0, ...c.cells.map((v) => measure(v, cellPx, 700, false)));
      const cellWord = Math.max(0, ...c.cells.flatMap((v) => words(v)).map((w) => measure(w, cellPx, 700, false)));
      // A text cell may wrap between words, but a single word wider than ~70px may break inside.
      const content = c.nowrap ? cellMax : Math.min(cellWord, 70);
      const min = Math.max(headWord, content) + PAD;
      // Wanted: the whole header on at most two lines, a text column on one line where it can.
      const want = Math.max(min, headFull / 2 + PAD, (c.nowrap ? cellMax : Math.min(cellMax, 130)) + PAD);
      mins.push(min); wants.push(want);
    }
    const sum = mins.reduce((a, b) => a + b, 0);
    if (sum <= widthPx) break;
    if (headPx > SOFT_MIN_PX) headPx -= 0.5;
    else if (cellPx > SOFT_MIN_PX) cellPx -= 0.5;
    else if (headPx > MIN_PX || cellPx > MIN_PX) { headPx = MIN_PX; cellPx = MIN_PX; }
    else break;
  }
  const sumMin = mins.reduce((a, b) => a + b, 0);
  const px = mins.slice();
  let extra = Math.max(0, widthPx - sumMin);
  const need = wants.map((w, i) => Math.max(0, w - mins[i]));
  const needSum = need.reduce((a, b) => a + b, 0);
  if (needSum > 0) {
    const give = Math.min(extra, needSum);
    need.forEach((n, i) => (px[i] += give * (n / needSum)));
    extra -= give;
  }
  if (extra > 0) px.forEach((p, i) => (px[i] += extra * (mins[i] / sumMin)));
  const total = px.reduce((a, b) => a + b, 0) || 1;
  return { widths: px.map((p) => (p / total) * 100), headPx, cellPx };
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY = /^(\d{2})[/-](\d{2})[/-](\d{4})$/;

/** True for a printed calendar date ("2026-11-01" or "01/11/2026"). */
export function isDateText(v: string): boolean {
  return ISO.test(v) || DMY.test(v);
}

/**
 * Compact date for the roll: "01/11" — the period (with its year) is printed in the header.
 * When the period spans two years the year stays, as "01/11/26".
 */
export function compactDate(v: string, withYear: boolean): string {
  const m = ISO.exec(v);
  const [d, mo, y] = m ? [m[3], m[2], m[1]] : (() => { const x = DMY.exec(v)!; return [x[1], x[2], x[3]]; })();
  return withYear ? `${d}/${mo}/${y.slice(2)}` : `${d}/${mo}`;
}
