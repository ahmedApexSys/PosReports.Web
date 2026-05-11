import { Injectable, signal, computed } from '@angular/core';
import { environment } from '../../../environments/environment';

const STORAGE_KEY = 'pos-reports.filters';

export interface FilterState {
  fromDate: string;    // ISO
  toDate: string;      // ISO
  branchId: number | null;
  compareWindowDays: number;
}

export type DatePresetKey =
  | 'today' | 'yesterday'
  | 'last7' | 'last30' | 'last90'
  | 'thisWeek' | 'lastWeek'
  | 'thisMonth' | 'lastMonth'
  | 'thisQuarter' | 'lastQuarter'
  | 'thisYear' | 'lastYear'
  | 'custom';

@Injectable({ providedIn: 'root' })
export class FilterService {
  private readonly _state = signal<FilterState>(this.initial());
  readonly state = this._state.asReadonly();

  readonly fromDate    = computed(() => this._state().fromDate);
  readonly toDate      = computed(() => this._state().toDate);
  readonly branchId    = computed(() => this._state().branchId);
  readonly compareDays = computed(() => this._state().compareWindowDays);

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

    // Default: last 7 days, default branch, default compare window
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return {
      fromDate: start.toISOString(),
      toDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString(),
      branchId: environment.defaultBranchId,
      compareWindowDays: environment.defaultCompareWindowDays,
    };
  }

  private persist(): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this._state())); } catch { /* noop */ }
  }
}
