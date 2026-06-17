import { Injectable, signal, computed } from '@angular/core';
import { environment } from '../../../environments/environment';

const STORAGE_KEY = 'pos-reports.filters';

export interface FilterState {
  fromDate: string;    // ISO
  toDate: string;      // ISO
  branchId: number | null;
  compareWindowDays: number;
  grouping: Grouping;
}

/** Time-series aggregation granularity for the BI / Insights chart pages. */
export type Grouping = 'day' | 'week' | 'month' | 'year';

export type DatePresetKey =
  | 'today' | 'yesterday'
  | 'last7' | 'last30' | 'last90'
  | 'thisWeek' | 'lastWeek'
  | 'thisMonth' | 'lastMonth'
  | 'thisQuarter' | 'lastQuarter'
  | 'thisYear' | 'lastYear'
  | 'custom';

export interface ValidationResult {
  ok: boolean;
  reason?: 'no-branch' | 'no-dates' | 'bad-range' | 'future-from' | 'too-wide';
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class FilterService {
  private readonly _state = signal<FilterState>(this.initial());
  readonly state = this._state.asReadonly();

  readonly fromDate    = computed(() => this._state().fromDate);
  readonly toDate      = computed(() => this._state().toDate);
  readonly branchId    = computed(() => this._state().branchId);
  readonly compareDays = computed(() => this._state().compareWindowDays);
  readonly grouping    = computed<Grouping>(() => this._state().grouping ?? 'day');

  /** True when a branch is selected — required for ALL data fetches. */
  readonly hasBranch = computed(() => {
    const id = this._state().branchId;
    return id != null && id > 0;
  });

  /** True when the date range is valid (both set + from <= to + range <= 92 days). */
  readonly hasValidDates = computed(() => {
    const s = this._state();
    if (!s.fromDate || !s.toDate) return false;
    const f = new Date(s.fromDate).getTime();
    const t = new Date(s.toDate).getTime();
    if (isNaN(f) || isNaN(t)) return false;
    if (f > t) return false;
    const days = (t - f) / (1000 * 60 * 60 * 24);
    if (days > 92) return false;
    return true;
  });

  /** Aggregate readiness — used by every report page to gate fetches. */
  readonly canFetch = computed(() => this.hasBranch() && this.hasValidDates());

  /** Detailed validation for UI feedback. */
  validate(): ValidationResult {
    const s = this._state();
    if (s.branchId == null || s.branchId <= 0) {
      return { ok: false, reason: 'no-branch', message: 'Please select a branch first.' };
    }
    if (!s.fromDate || !s.toDate) {
      return { ok: false, reason: 'no-dates', message: 'Please pick a date range.' };
    }
    const f = new Date(s.fromDate).getTime();
    const t = new Date(s.toDate).getTime();
    if (isNaN(f) || isNaN(t)) {
      return { ok: false, reason: 'no-dates', message: 'Date format is invalid.' };
    }
    if (f > t) {
      return { ok: false, reason: 'bad-range', message: 'From-date is after To-date.' };
    }
    if (f > Date.now()) {
      return { ok: false, reason: 'future-from', message: 'From-date is in the future.' };
    }
    const days = (t - f) / (1000 * 60 * 60 * 24);
    if (days > 92) {
      return { ok: false, reason: 'too-wide', message: 'Window > 92 days — narrow the range.' };
    }
    return { ok: true };
  }

  /** Bilingual validation message. */
  validateBilingual(language: 'en' | 'ar'): string {
    const r = this.validate();
    if (r.ok) return '';
    if (language === 'ar') {
      return ({
        'no-branch':   'برجاء اختيار فرع أولاً.',
        'no-dates':    'برجاء تحديد فترة التقرير.',
        'bad-range':   'تاريخ البداية أحدث من تاريخ النهاية.',
        'future-from': 'تاريخ البداية في المستقبل.',
        'too-wide':    'الفترة أطول من 92 يوم — قللها.',
      } as Record<string, string>)[r.reason!] ?? r.message ?? '';
    }
    return r.message ?? '';
  }

  setDateRange(fromIso: string, toIso: string): void {
    this._state.update((s) => ({ ...s, fromDate: fromIso, toDate: toIso }));
    this.persist();
  }

  setBranch(id: number | null): void {
    this._state.update((s) => ({ ...s, branchId: id }));
    this.persist();
  }

  setCompareDays(days: number): void {
    this._state.update((s) => ({ ...s, compareWindowDays: days }));
    this.persist();
  }

  setGrouping(g: Grouping): void {
    this._state.update((s) => ({ ...s, grouping: g }));
    this.persist();
  }

  applyPreset(preset: DatePresetKey): void {
    const range = this.computePreset(preset);
    if (range) this.setDateRange(range.from, range.to);
  }

  /**
   * Compute from/to for a given preset key. Returns null for 'custom'.
   *
   * Emits **local-naive** datetime strings ("YYYY-MM-DDTHH:mm:ss", no `Z`) so a
   * preset means the LOCAL (Cairo) calendar day — e.g. "Today" = today 00:00 →
   * 23:59 of the same date. The old code called `.toISOString()`, which shifted
   * local midnight back into the previous UTC day in Egypt (UTC+2/+3), so
   * "Today" displayed as yesterday→today and queried 2-3h early.
   */
  computePreset(preset: DatePresetKey): { from: string; to: string } | null {
    const now = new Date();
    const L = (d: Date) => this.localIso(d);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
    const endOfDay   = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
    const daysAgo    = (n: number) => { const d = new Date(todayStart); d.setDate(d.getDate() - n); return d; };

    switch (preset) {
      case 'today':       return { from: L(todayStart), to: L(todayEnd) };
      case 'yesterday': {
        const y = daysAgo(1);
        return { from: L(startOfDay(y)), to: L(endOfDay(y)) };
      }
      case 'last7':       return { from: L(daysAgo(6)),  to: L(todayEnd) };
      case 'last30':      return { from: L(daysAgo(29)), to: L(todayEnd) };
      case 'last90':      return { from: L(daysAgo(89)), to: L(todayEnd) };
      case 'thisWeek': {
        const dow = now.getDay(); // 0 = Sun in JS
        return { from: L(daysAgo(dow)), to: L(todayEnd) };
      }
      case 'lastWeek': {
        const dow = now.getDay();
        const lastWeekEnd = daysAgo(dow + 1);
        const lastWeekStart = daysAgo(dow + 7);
        return { from: L(startOfDay(lastWeekStart)), to: L(endOfDay(lastWeekEnd)) };
      }
      case 'thisMonth': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return { from: L(start), to: L(todayEnd) };
      }
      case 'lastMonth': {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        return { from: L(start), to: L(end) };
      }
      case 'thisQuarter': {
        const q = Math.floor(now.getMonth() / 3);
        const start = new Date(now.getFullYear(), q * 3, 1);
        return { from: L(start), to: L(todayEnd) };
      }
      case 'lastQuarter': {
        const q = Math.floor(now.getMonth() / 3);
        const start = new Date(now.getFullYear(), (q - 1) * 3, 1);
        const end   = new Date(now.getFullYear(), q * 3, 0, 23, 59, 59);
        return { from: L(start), to: L(end) };
      }
      case 'thisYear': {
        const start = new Date(now.getFullYear(), 0, 1);
        return { from: L(start), to: L(todayEnd) };
      }
      case 'lastYear': {
        const start = new Date(now.getFullYear() - 1, 0, 1);
        const end   = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
        return { from: L(start), to: L(end) };
      }
      case 'custom':
      default: return null;
    }
  }

  /** Format a Date as a local-naive ISO-like string (no timezone conversion). */
  localIso(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  private initial(): FilterState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as FilterState;
    } catch { /* noop */ }

    // Default: TODAY (local calendar day, full 24h) pre-filled (convenience), but
    // NO default branch — user MUST select one before any fetch.
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    return {
      fromDate: this.localIso(todayStart),
      toDate: this.localIso(todayEnd),
      branchId: null,                                              // ← forced selection
      compareWindowDays: environment.defaultCompareWindowDays,
      grouping: 'day',
    };
  }

  private persist(): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this._state())); } catch { /* noop */ }
  }
}
