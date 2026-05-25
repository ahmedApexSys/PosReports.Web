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

  /** Compute ISO from/to for a given preset key. Returns null for 'custom'. */
  computePreset(preset: DatePresetKey): { from: string; to: string } | null {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
    const endOfDay   = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
    const daysAgo    = (n: number) => { const d = new Date(todayStart); d.setDate(d.getDate() - n); return d; };

    switch (preset) {
      case 'today':       return { from: startOfDay(now).toISOString(), to: todayEnd.toISOString() };
      case 'yesterday': {
        const y = daysAgo(1);
        return { from: startOfDay(y).toISOString(), to: endOfDay(y).toISOString() };
      }
      case 'last7':       return { from: daysAgo(6).toISOString(),  to: todayEnd.toISOString() };
      case 'last30':      return { from: daysAgo(29).toISOString(), to: todayEnd.toISOString() };
      case 'last90':      return { from: daysAgo(89).toISOString(), to: todayEnd.toISOString() };
      case 'thisWeek': {
        const dow = now.getDay(); // 0 = Sun in JS
        return { from: daysAgo(dow).toISOString(), to: todayEnd.toISOString() };
      }
      case 'lastWeek': {
        const dow = now.getDay();
        const lastWeekEnd = daysAgo(dow + 1);
        const lastWeekStart = daysAgo(dow + 7);
        return { from: startOfDay(lastWeekStart).toISOString(), to: endOfDay(lastWeekEnd).toISOString() };
      }
      case 'thisMonth': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return { from: start.toISOString(), to: todayEnd.toISOString() };
      }
      case 'lastMonth': {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        return { from: start.toISOString(), to: end.toISOString() };
      }
      case 'thisQuarter': {
        const q = Math.floor(now.getMonth() / 3);
        const start = new Date(now.getFullYear(), q * 3, 1);
        return { from: start.toISOString(), to: todayEnd.toISOString() };
      }
      case 'lastQuarter': {
        const q = Math.floor(now.getMonth() / 3);
        const start = new Date(now.getFullYear(), (q - 1) * 3, 1);
        const end   = new Date(now.getFullYear(), q * 3, 0, 23, 59, 59);
        return { from: start.toISOString(), to: end.toISOString() };
      }
      case 'thisYear': {
        const start = new Date(now.getFullYear(), 0, 1);
        return { from: start.toISOString(), to: todayEnd.toISOString() };
      }
      case 'lastYear': {
        const start = new Date(now.getFullYear() - 1, 0, 1);
        const end   = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
        return { from: start.toISOString(), to: end.toISOString() };
      }
      case 'custom':
      default: return null;
    }
  }

  private initial(): FilterState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as FilterState;
    } catch { /* noop */ }

    // Default: last 7 days dates pre-filled (convenience), but
    // NO default branch — user MUST select one before any fetch.
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return {
      fromDate: start.toISOString(),
      toDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString(),
      branchId: null,                                              // ← forced selection
      compareWindowDays: environment.defaultCompareWindowDays,
      grouping: 'day',
    };
  }

  private persist(): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this._state())); } catch { /* noop */ }
  }
}
