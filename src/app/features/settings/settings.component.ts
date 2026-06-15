import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Sun, Moon, MonitorCog, Languages, SlidersHorizontal, RotateCcw, CalendarRange, Building2 } from 'lucide-angular';
import { ThemeService, ThemeMode } from '../../core/theme/theme.service';
import { LanguageService, Language } from '../../core/i18n/language.service';
import { FilterService, Grouping } from '../../core/filters/filter.service';
import { BranchPickerComponent } from '../../shared/branch-picker/branch-picker.component';
import { DateRangePickerComponent } from '../../shared/date-range-picker/date-range-picker.component';

/**
 * Settings — client-side preferences only (no server state). Appearance
 * (theme + language) maps to ThemeService / LanguageService; the default
 * report filters embed the same persisted pickers used in the header, so
 * whatever you pick here becomes the default for every report.
 */
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, BranchPickerComponent, DateRangePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-3xl mx-auto space-y-8">
      <header>
        <h1 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">
          {{ ar() ? 'الإعدادات' : 'Settings' }}
        </h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {{ ar() ? 'تفضيلاتك محفوظة على هذا المتصفح فقط.' : 'Your preferences are saved on this browser only.' }}
        </p>
      </header>

      <!-- Appearance -->
      <section class="space-y-3">
        <h2 class="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {{ ar() ? 'المظهر' : 'Appearance' }}
        </h2>
        <div class="card-padded space-y-5">
          <!-- Theme -->
          <div class="flex flex-col sm:flex-row sm:items-center gap-3">
            <div class="sm:w-44 shrink-0">
              <div class="text-sm font-medium text-slate-900 dark:text-slate-100">{{ ar() ? 'السمة' : 'Theme' }}</div>
              <div class="text-xs text-slate-500 dark:text-slate-400">{{ ar() ? 'فاتح / داكن / تلقائي' : 'Light / Dark / System' }}</div>
            </div>
            <div class="seg flex-1">
              <button *ngFor="let t of themeOpts"
                      (click)="theme.setMode(t.mode)"
                      [class.seg-on]="theme.mode() === t.mode"
                      class="seg-btn">
                <lucide-icon [img]="t.icon" class="h-4 w-4"></lucide-icon>
                <span>{{ ar() ? t.ar : t.en }}</span>
              </button>
            </div>
          </div>

          <div class="h-px bg-slate-100 dark:bg-slate-800"></div>

          <!-- Language -->
          <div class="flex flex-col sm:flex-row sm:items-center gap-3">
            <div class="sm:w-44 shrink-0">
              <div class="text-sm font-medium text-slate-900 dark:text-slate-100">{{ ar() ? 'اللغة' : 'Language' }}</div>
              <div class="text-xs text-slate-500 dark:text-slate-400">{{ ar() ? 'لغة الواجهة' : 'Interface language' }}</div>
            </div>
            <div class="seg flex-1">
              <button *ngFor="let l of langOpts"
                      (click)="lang.setLanguage(l.code)"
                      [class.seg-on]="lang.language() === l.code"
                      class="seg-btn">
                <lucide-icon [img]="Languages" class="h-4 w-4"></lucide-icon>
                <span>{{ l.label }}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Default report filters -->
      <section class="space-y-3">
        <h2 class="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {{ ar() ? 'الفلاتر الافتراضية للتقارير' : 'Default report filters' }}
        </h2>
        <div class="card-padded space-y-5">
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {{ ar()
                ? 'ما تختاره هنا يصبح الفرع والفترة الافتراضية لكل التقارير (نفس عناصر التحكم الموجودة بالأعلى).'
                : 'What you choose here becomes the default branch and date range for every report (the same controls shown in the header).' }}
          </p>

          <div class="flex items-center gap-2.5">
            <lucide-icon [img]="Building2" class="h-4 w-4 text-slate-400"></lucide-icon>
            <span class="text-sm font-medium text-slate-900 dark:text-slate-100 w-28">{{ ar() ? 'الفرع' : 'Branch' }}</span>
            <app-branch-picker></app-branch-picker>
          </div>

          <div class="flex items-center gap-2.5">
            <lucide-icon [img]="CalendarRange" class="h-4 w-4 text-slate-400"></lucide-icon>
            <span class="text-sm font-medium text-slate-900 dark:text-slate-100 w-28">{{ ar() ? 'الفترة' : 'Date range' }}</span>
            <app-date-range-picker></app-date-range-picker>
          </div>

          <div class="h-px bg-slate-100 dark:bg-slate-800"></div>

          <!-- Grouping -->
          <div class="flex flex-col sm:flex-row sm:items-center gap-3">
            <div class="sm:w-28 shrink-0 text-sm font-medium text-slate-900 dark:text-slate-100">
              {{ ar() ? 'التجميع' : 'Grouping' }}
            </div>
            <div class="seg flex-1">
              <button *ngFor="let g of groupingOpts"
                      (click)="filter.setGrouping(g.key)"
                      [class.seg-on]="filter.grouping() === g.key"
                      class="seg-btn">{{ ar() ? g.ar : g.en }}</button>
            </div>
          </div>

          <!-- Compare window -->
          <div class="flex flex-col sm:flex-row sm:items-center gap-3">
            <div class="sm:w-28 shrink-0 text-sm font-medium text-slate-900 dark:text-slate-100">
              {{ ar() ? 'فترة المقارنة' : 'Compare window' }}
            </div>
            <div class="seg flex-1">
              <button *ngFor="let d of compareOpts"
                      (click)="filter.setCompareDays(d)"
                      [class.seg-on]="filter.compareDays() === d"
                      class="seg-btn">{{ d }} {{ ar() ? 'يوم' : 'd' }}</button>
            </div>
          </div>
        </div>
      </section>

      <!-- Reset -->
      <section class="space-y-3">
        <h2 class="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {{ ar() ? 'إعادة الضبط' : 'Reset' }}
        </h2>
        <div class="card-padded flex flex-col sm:flex-row sm:items-center gap-3">
          <div class="flex items-start gap-3 flex-1">
            <lucide-icon [img]="SlidersHorizontal" class="h-5 w-5 shrink-0 text-slate-400 mt-0.5"></lucide-icon>
            <p class="text-sm text-slate-600 dark:text-slate-300">
              {{ ar()
                  ? 'مسح كل التفضيلات المحفوظة (السمة، اللغة، الفلاتر، الإشعارات) والعودة للوضع الافتراضي.'
                  : 'Clear all saved preferences (theme, language, filters, notifications) and return to defaults.' }}
            </p>
          </div>
          <button (click)="resetAll()" class="btn-ghost text-critical ring-1 ring-critical/30 shrink-0">
            <lucide-icon [img]="RotateCcw" class="h-4 w-4"></lucide-icon>
            {{ ar() ? 'إعادة ضبط' : 'Reset' }}
          </button>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .seg {
      display: inline-flex; gap: 0.25rem; padding: 0.25rem;
      border-radius: 0.75rem;
      background: var(--seg-bg, rgb(241 245 249));
    }
    :host-context(.dark) .seg { background: rgb(30 41 59); }
    .seg-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem;
      flex: 1 1 0; min-width: 0;
      padding: 0.45rem 0.75rem; border-radius: 0.55rem;
      font-size: 0.8125rem; font-weight: 500; white-space: nowrap;
      color: rgb(71 85 105); transition: all .18s ease;
    }
    :host-context(.dark) .seg-btn { color: rgb(203 213 225); }
    .seg-btn:hover { color: rgb(15 23 42); }
    :host-context(.dark) .seg-btn:hover { color: rgb(248 250 252); }
    .seg-on, .seg-on:hover {
      background: white; color: rgb(15 23 42);
      box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
    }
    :host-context(.dark) .seg-on, :host-context(.dark) .seg-on:hover {
      background: rgb(51 65 85); color: rgb(248 250 252);
    }
  `],
})
export class SettingsComponent {
  readonly theme = inject(ThemeService);
  readonly lang = inject(LanguageService);
  readonly filter = inject(FilterService);

  readonly Languages = Languages;
  readonly SlidersHorizontal = SlidersHorizontal;
  readonly RotateCcw = RotateCcw;
  readonly CalendarRange = CalendarRange;
  readonly Building2 = Building2;

  readonly ar = computed(() => this.lang.language() === 'ar');

  readonly themeOpts: { mode: ThemeMode; en: string; ar: string; icon: typeof Sun }[] = [
    { mode: 'light',  en: 'Light',  ar: 'فاتح',   icon: Sun },
    { mode: 'dark',   en: 'Dark',   ar: 'داكن',   icon: Moon },
    { mode: 'system', en: 'System', ar: 'تلقائي', icon: MonitorCog },
  ];

  readonly langOpts: { code: Language; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'ar', label: 'عربي' },
  ];

  readonly groupingOpts: { key: Grouping; en: string; ar: string }[] = [
    { key: 'day',   en: 'Day',   ar: 'يوم' },
    { key: 'week',  en: 'Week',  ar: 'أسبوع' },
    { key: 'month', en: 'Month', ar: 'شهر' },
    { key: 'year',  en: 'Year',  ar: 'سنة' },
  ];

  readonly compareOpts = [7, 14, 30, 90];

  resetAll(): void {
    const msg = this.ar()
      ? 'هل تريد مسح كل التفضيلات المحفوظة؟'
      : 'Clear all saved preferences?';
    if (!window.confirm(msg)) return;
    for (const k of [
      'pos-reports.theme',
      'pos-reports.language',
      'pos-reports.filters',
      'pos-reports.notifications',
      'pos-reports.notifications.seeded',
    ]) {
      try { localStorage.removeItem(k); } catch { /* noop */ }
    }
    window.location.reload();
  }
}
