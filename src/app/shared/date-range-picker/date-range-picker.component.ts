import {
  Component, inject, signal, computed, ElementRef, HostListener, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, CalendarRange, ChevronDown } from 'lucide-angular';
import { LanguageService } from '../../core/i18n/language.service';
import { FilterService, DatePresetKey } from '../../core/filters/filter.service';
import { DATE_PRESETS } from '../../core/models/audit.models';

/**
 * Global date-range picker for the app header. Replaces the old static
 * "Last 7 days" label so EVERY report page (not just the audit pages) can
 * change the window via quick presets or a custom range. Reads/writes the
 * shared FilterService, which already persists the selection to localStorage
 * — so the chosen range (and branch) is remembered across reloads.
 */
@Component({
  selector: 'app-date-range-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative">
      <button type="button" (click)="toggle($event)"
              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-card-sm text-xs font-medium
                     bg-white dark:bg-surface-dark-subtle ring-1 ring-slate-200 dark:ring-slate-700
                     text-slate-700 dark:text-slate-200 hover:ring-brand-300 transition-colors">
        <lucide-icon [img]="CalIcon" class="h-4 w-4 text-brand-600"></lucide-icon>
        <span class="tabular">{{ activeLabel() }}</span>
        <lucide-icon [img]="ChevronIcon" class="h-3.5 w-3.5 opacity-60"></lucide-icon>
      </button>

      <div *ngIf="open()"
           class="absolute z-40 mt-1 end-0 w-[300px] rounded-card ring-1 ring-slate-200 dark:ring-slate-700
                  bg-white dark:bg-surface-dark-subtle shadow-xl p-3 space-y-3">
        <!-- Quick presets -->
        <div class="grid grid-cols-2 gap-1.5">
          <button *ngFor="let p of presets" type="button" (click)="pick(p.key)"
                  [disabled]="isPresetTooWide(p.key)"
                  [attr.title]="isPresetTooWide(p.key) ? tooWideTooltip() : null"
                  [attr.aria-disabled]="isPresetTooWide(p.key)"
                  class="px-2.5 py-1.5 rounded-card-sm text-[11px] font-medium ring-1 text-start transition-all"
                  [class.opacity-40]="isPresetTooWide(p.key)"
                  [class.cursor-not-allowed]="isPresetTooWide(p.key)"
                  [class.bg-brand-600]="activePreset() === p.key && !isPresetTooWide(p.key)"
                  [class.text-white]="activePreset() === p.key && !isPresetTooWide(p.key)"
                  [class.ring-brand-600]="activePreset() === p.key && !isPresetTooWide(p.key)"
                  [class.bg-white]="activePreset() !== p.key || isPresetTooWide(p.key)"
                  [class.dark:bg-surface-dark-muted]="activePreset() !== p.key || isPresetTooWide(p.key)"
                  [class.text-slate-700]="activePreset() !== p.key || isPresetTooWide(p.key)"
                  [class.dark:text-slate-200]="activePreset() !== p.key || isPresetTooWide(p.key)"
                  [class.ring-slate-200]="activePreset() !== p.key || isPresetTooWide(p.key)"
                  [class.dark:ring-slate-700]="activePreset() !== p.key || isPresetTooWide(p.key)">
            {{ ar() ? p.labelAr : p.labelEn }}
          </button>
        </div>

        <!-- Custom range -->
        <div class="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <div class="flex items-center gap-2">
            <span class="w-8 text-[11px] text-slate-500">{{ ar() ? 'من' : 'From' }}</span>
            <input type="date" [ngModel]="fromLocal()" (ngModelChange)="onFrom($event)"
                   class="flex-1 bg-slate-50 dark:bg-surface-dark-muted border-0 rounded-card-sm px-2 py-1.5 text-xs tabular
                          focus:ring-2 focus:ring-brand-500/30"/>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-8 text-[11px] text-slate-500">{{ ar() ? 'إلى' : 'To' }}</span>
            <input type="date" [ngModel]="toLocal()" (ngModelChange)="onTo($event)"
                   class="flex-1 bg-slate-50 dark:bg-surface-dark-muted border-0 rounded-card-sm px-2 py-1.5 text-xs tabular
                          focus:ring-2 focus:ring-brand-500/30"/>
          </div>
        </div>

        <p *ngIf="validationMsg()" class="text-[11px] text-warning">{{ validationMsg() }}</p>
      </div>
    </div>
  `,
})
export class DateRangePickerComponent {
  readonly lang = inject(LanguageService);
  readonly filter = inject(FilterService);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly open = signal(false);
  readonly presets = DATE_PRESETS;
  readonly CalIcon = CalendarRange;
  readonly ChevronIcon = ChevronDown;

  ar(): boolean { return this.lang.language() === 'ar'; }

  /** From-date as a `date` input value (YYYY-MM-DD). */
  readonly fromLocal = computed(() => (this.filter.fromDate() || '').slice(0, 10));
  readonly toLocal = computed(() => (this.filter.toDate() || '').slice(0, 10));

  /** Which preset (if any) matches the current range — drives chip highlight + the label. */
  readonly activePreset = computed<DatePresetKey>(() => {
    const f = this.filter.fromDate();
    const t = this.filter.toDate();
    for (const p of DATE_PRESETS) {
      if (p.key === 'custom') continue;
      const range = this.filter.computePreset(p.key as DatePresetKey);
      if (range && range.from === f && range.to === t) return p.key as DatePresetKey;
    }
    return 'custom';
  });

  /** Button label — the matched preset name, or the custom range as short dates. */
  readonly activeLabel = computed<string>(() => {
    const key = this.activePreset();
    if (key !== 'custom') {
      const p = DATE_PRESETS.find((x) => x.key === key)!;
      return this.ar() ? p.labelAr : p.labelEn;
    }
    return `${this.shortDate(this.filter.fromDate())} ← ${this.shortDate(this.filter.toDate())}`;
  });

  readonly validationMsg = computed(() => this.filter.validateBilingual(this.lang.language()));

  /** Bilingual tooltip for presets whose window exceeds the 92-day fetch gate. */
  readonly tooWideTooltip = computed(() =>
    this.ar() ? 'النطاق محدود بـ 92 يومًا' : 'Window limited to 92 days');

  /**
   * True when a preset's computed range exceeds the 92-day window that
   * `FilterService.hasValidDates()` enforces — picking it would silently flip
   * reports to the empty "pick a date range" gate, so we disable it instead.
   * Quarter/year presets are the ones that blow past 92 days.
   */
  isPresetTooWide(key: string): boolean {
    if (key === 'custom') return false;
    const range = this.filter.computePreset(key as DatePresetKey);
    if (!range) return false;
    const f = new Date(range.from).getTime();
    const t = new Date(range.to).getTime();
    if (isNaN(f) || isNaN(t)) return false;
    const days = (t - f) / (1000 * 60 * 60 * 24);
    return days > 92;
  }

  toggle(ev: Event): void { ev.stopPropagation(); this.open.update((v) => !v); }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(ev.target as Node)) this.open.set(false);
  }

  pick(key: string): void {
    if (key === 'custom') return;
    // Guard: never apply a preset wider than the 92-day fetch gate.
    if (this.isPresetTooWide(key)) return;
    this.filter.applyPreset(key as DatePresetKey);
    this.open.set(false);
  }

  onFrom(value: string): void {
    if (!value) return;
    // Keep the picked calendar day as-is (local-naive) — no UTC shift.
    this.filter.setDateRange(`${value}T00:00:00`, this.filter.toDate());
  }

  onTo(value: string): void {
    if (!value) return;
    this.filter.setDateRange(this.filter.fromDate(), `${value}T23:59:59`);
  }

  private shortDate(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat(this.ar() ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' }).format(d);
  }
}
