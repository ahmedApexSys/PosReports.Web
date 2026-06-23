import { Component, inject, signal, computed, effect, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideAngularModule, RefreshCw, Loader, Building2, Printer, ChevronDown, Zap,
} from 'lucide-angular';
import { catchError, finalize, of } from 'rxjs';
import { LanguageService } from '../../core/i18n/language.service';
import { FilterService } from '../../core/filters/filter.service';
import { BranchService } from '../../core/branches/branch.service';
import { SalesReportApi } from '../../core/api/sales-report.api';
import { ExportService, ExportPaper } from '../../core/export/export.service';
import { LoadingSkeletonComponent } from '../../shared/loading-skeleton/loading-skeleton.component';
import { TotalReportData, TotalBlock, buildTotalBlocks } from '../../core/reports/total-report.model';

/**
 * "Daily Transactions" — the legacy multi-section daily summary
 * (`TotalsReport/TotalReport`). Branch + date come from the header; the report
 * renders fixed named sections and prints a thermal-receipt version (Flash /
 * POS 72 / POS 80) matching the legacy printout.
 */
@Component({
  selector: 'app-total-report',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, LoadingSkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4" (click)="menu.set(false)">
      <!-- Header -->
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">{{ ar() ? 'حركة المبيعات اليومية' : 'Daily Transactions' }}</h1>
          <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{{ ar() ? 'الملخص اليومي الكامل' : 'Full daily summary' }}</p>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <!-- Branch scope toggle: All Branches (default) vs This branch -->
          <div class="inline-flex rounded-card-sm ring-1 ring-slate-200 dark:ring-slate-700 overflow-hidden text-sm">
            <button (click)="setScope('all')"
                    class="px-3 py-1.5 font-medium transition-colors duration-180"
                    [class.bg-brand-600]="scope() === 'all'" [class.text-white]="scope() === 'all'"
                    [class.text-slate-600]="scope() !== 'all'" [class.dark:text-slate-300]="scope() !== 'all'">
              {{ ar() ? 'كل الفروع' : 'All Branches' }}
            </button>
            <button (click)="setScope('branch')" [disabled]="!filter.hasBranch()"
                    class="px-3 py-1.5 font-medium transition-colors duration-180 disabled:opacity-40"
                    [class.bg-brand-600]="scope() === 'branch'" [class.text-white]="scope() === 'branch'"
                    [class.text-slate-600]="scope() !== 'branch'" [class.dark:text-slate-300]="scope() !== 'branch'">
              {{ ar() ? 'هذا الفرع' : 'This branch' }}
            </button>
          </div>
          <div class="relative" (click)="$event.stopPropagation()">
            <button (click)="menu.set(!menu())" [disabled]="!data()"
                    class="btn-ghost text-sm ring-1 ring-slate-200 dark:ring-slate-700 disabled:opacity-40">
              <lucide-icon [img]="PrinterIcon" class="h-4 w-4"></lucide-icon>
              {{ ar() ? 'طباعة' : 'Print' }}
              <lucide-icon [img]="ChevronIcon" class="h-3.5 w-3.5 opacity-60"></lucide-icon>
            </button>
            <div *ngIf="menu()" class="menu">
              <button class="menu-item" (click)="print('pos80')"><lucide-icon [img]="PrinterIcon" class="h-4 w-4 text-slate-400"></lucide-icon><span class="flex-1 text-start">POS 80mm</span></button>
              <button class="menu-item" (click)="print('pos72')"><lucide-icon [img]="PrinterIcon" class="h-4 w-4 text-slate-400"></lucide-icon><span class="flex-1 text-start">POS 72mm</span></button>
            </div>
          </div>
          <button (click)="print('flash')" [disabled]="!data()"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card-sm text-sm font-semibold
                         bg-brand-600 hover:bg-brand-700 text-white shadow-sm disabled:opacity-40 transition-colors duration-180">
            <lucide-icon [img]="ZapIcon" class="h-4 w-4"></lucide-icon>
            {{ ar() ? 'تقرير سريع' : 'Flash report' }}
          </button>
          <button (click)="reload()" [disabled]="loading() || !filter.canFetch()" class="btn-ghost text-sm">
            <lucide-icon [img]="loading() ? Loader : Refresh" class="h-4 w-4" [class.animate-spin]="loading()"></lucide-icon>
            {{ ar() ? 'تحديث' : 'Refresh' }}
          </button>
        </div>
      </div>

      <!-- Gate -->
      <div *ngIf="!filter.canFetch()" class="card-padded text-center py-12 md:py-16 space-y-3">
        <div class="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-warning-soft text-warning ring-1 ring-warning/30">
          <lucide-icon [img]="Branch" class="h-7 w-7"></lucide-icon>
        </div>
        <h2 class="text-base font-semibold text-slate-700 dark:text-slate-200">{{ filter.validateBilingual(ar() ? 'ar' : 'en') }}</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
          {{ ar() ? 'اختر فرعاً وفترة زمنية من الأعلى لعرض التقرير.' : 'Pick a branch and date range in the header to load the report.' }}
        </p>
      </div>

      <app-loading-skeleton *ngIf="filter.canFetch() && loading()"></app-loading-skeleton>

      <div *ngIf="error()" class="card-padded text-center py-10 text-rose-600 dark:text-rose-400">{{ error() }}</div>

      <!-- Sections -->
      <div *ngIf="filter.canFetch() && !loading() && !error() && data()" class="space-y-4">
        <!-- summary strip -->
        <div class="card-padded flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="text-lg font-bold text-slate-900 dark:text-slate-50">{{ data()?.companyName }}</div>
            <div class="text-sm text-slate-500 dark:text-slate-400">{{ scopeLabel() }}</div>
          </div>
          <div class="text-sm text-slate-600 dark:text-slate-300 font-medium">
            {{ (filter.fromDate() || '').slice(0,10) }} → {{ (filter.toDate() || '').slice(0,10) }}
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <ng-container *ngFor="let b of blocks()">
            <!-- Section heading (e.g. Category Sales) -->
            <div *ngIf="b.heading" class="sm:col-span-2 xl:col-span-3 text-xs font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300 border-b border-brand-200 dark:border-brand-800 pb-1">
              {{ b.title }}
            </div>

            <!-- Category box (boxed = true) -->
            <div *ngIf="!b.heading && b.boxed" class="card overflow-hidden ring-1 ring-brand-200 dark:ring-brand-800">
              <div class="px-4 py-2 bg-brand-50 dark:bg-brand-900/30 text-sm font-bold text-brand-800 dark:text-brand-200 text-center uppercase">{{ b.title }}</div>
              <div class="px-4 py-2 space-y-1 border-b border-slate-100 dark:border-slate-800">
                <div *ngFor="let r of b.rows" class="flex items-center justify-between text-sm" [class.font-bold]="r.strong">
                  <span class="text-slate-500 dark:text-slate-400">{{ r.label }}</span>
                  <span class="tabular-nums text-slate-900 dark:text-slate-100">{{ r.value }}</span>
                </div>
              </div>
              <table *ngIf="b.table" class="w-full text-sm">
                <thead><tr class="text-xs text-slate-500 dark:text-slate-400">
                  <th *ngFor="let h of b.table.head; let i = index" class="px-4 py-1.5" [class.text-start]="i===0" [class.text-end]="i>0">{{ h }}</th>
                </tr></thead>
                <tbody>
                  <tr *ngFor="let row of b.table.rows" class="border-t border-slate-100 dark:border-slate-800">
                    <td *ngFor="let c of row; let i = index" class="px-4 py-1.5" [class.text-start]="i===0" [class.text-end]="i>0" [class.tabular-nums]="i>0">{{ c }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Key-value section -->
            <div *ngIf="!b.heading && !b.boxed && b.rows" class="card-padded">
              <div class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-1.5 mb-2">{{ b.title }}</div>
              <div class="space-y-1.5">
                <div *ngFor="let r of b.rows" class="flex items-center justify-between text-sm" [class.font-bold]="r.strong" [class.text-brand-700]="r.strong">
                  <span class="text-slate-500 dark:text-slate-400">{{ r.label }}</span>
                  <span class="tabular-nums text-slate-900 dark:text-slate-100" [class.text-brand-700]="r.strong">{{ r.value }}</span>
                </div>
              </div>
            </div>

            <!-- Table section -->
            <div *ngIf="!b.heading && !b.boxed && b.table" class="card overflow-hidden">
              <div class="px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">{{ b.title }}</div>
              <table class="w-full text-sm">
                <thead><tr class="text-xs text-slate-500 dark:text-slate-400">
                  <th *ngFor="let h of b.table.head; let i = index" class="px-4 py-1.5" [class.text-start]="i===0" [class.text-end]="i>0">{{ h }}</th>
                </tr></thead>
                <tbody>
                  <tr *ngIf="!b.table.rows.length"><td [attr.colspan]="b.table.head.length" class="px-4 py-3 text-center text-slate-400">—</td></tr>
                  <tr *ngFor="let row of b.table.rows" class="border-t border-slate-100 dark:border-slate-800">
                    <td *ngFor="let c of row; let i = index" class="px-4 py-1.5" [class.text-start]="i===0" [class.text-end]="i>0" [class.tabular-nums]="i>0">{{ c }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </ng-container>
        </div>
      </div>
    </div>
  `,
})
export class TotalReportComponent {
  private readonly lang = inject(LanguageService);
  readonly filter = inject(FilterService);
  private readonly branches = inject(BranchService);
  private readonly api = inject(SalesReportApi);
  private readonly exp = inject(ExportService);

  readonly ar = computed(() => this.lang.language() === 'ar');

  readonly Refresh = RefreshCw; readonly Loader = Loader; readonly Branch = Building2;
  readonly PrinterIcon = Printer; readonly ChevronIcon = ChevronDown; readonly ZapIcon = Zap;

  readonly menu = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly data = signal<TotalReportData | null>(null);
  /** Branch scope: 'all' (company-wide, default) or 'branch' (selected branch only). */
  readonly scope = signal<'all' | 'branch'>('all');

  /** Scope label for the summary strip — never show the API branchName when
   *  aggregating all branches, so the scope is never misrepresented. */
  readonly scopeLabel = computed(() => {
    if (this.scope() === 'all') return this.ar() ? 'كل الفروع' : 'All Branches';
    const b = this.branches.findById(this.filter.branchId());
    return (this.ar() ? b?.name_Ar : b?.name_En) ?? this.data()?.branchName ?? '';
  });
  readonly blocks = computed<TotalBlock[]>(() => {
    const d = this.data();
    return d ? buildTotalBlocks(d, this.ar()) : [];
  });

  constructor() {
    this.branches.load().subscribe({ error: () => undefined });
    effect(() => {
      const ok = this.filter.canFetch();
      this.filter.fromDate(); this.filter.toDate(); this.filter.branchId();
      if (ok) this.reload(); else this.data.set(null);
    });
  }

  /** Switch branch scope and refetch. 'branch' needs a selected branch. */
  setScope(scope: 'all' | 'branch'): void {
    if (scope === 'branch' && !this.filter.hasBranch()) return;
    if (this.scope() === scope) return;
    this.scope.set(scope);
    this.reload();
  }

  reload(): void {
    if (!this.filter.canFetch()) return;
    const branchId = this.filter.branchId();
    // "Daily Transactions" defaults to a COMPANY-WIDE summary (header reads
    // "Branch Name: All Branches") → ForAllBranches:true aggregates every branch.
    // The "This branch" toggle scopes it to the selected branch instead.
    // TotalsReport also expects DATE-ONLY ("yyyy-MM-dd"); the app's
    // "…T23:59:59" local-naive datetime makes the API return an all-zero report.
    const allBranches = this.scope() === 'all';
    const body = {
      fromDate: (this.filter.fromDate() || '').slice(0, 10),
      toDate: (this.filter.toDate() || '').slice(0, 10),
      BranchId: allBranches ? 0 : (branchId ?? 0),
      ForAllBranches: allBranches,
      ForAllShift: true,
      shiftId: 0,
    };
    this.loading.set(true);
    this.error.set('');
    this.api.raw<TotalReportData>('TotalsReport/TotalReport', body).pipe(
      catchError((err) => {
        this.error.set(err?.error?.message || err?.message || 'Failed to load report.');
        return of(null as unknown as TotalReportData);
      }),
      finalize(() => this.loading.set(false)),
    ).subscribe((d) => this.data.set(d ?? null));
  }

  print(paper: ExportPaper): void {
    this.menu.set(false);
    const d = this.data();
    if (!d) return;
    this.exp.totalReport(this.blocks(), {
      titleEn: 'Daily Transactions', titleAr: 'حركة المبيعات اليومية',
      companyName: d.companyName, branchName: this.scopeLabel(),
      fromDate: this.filter.fromDate(), toDate: this.filter.toDate(),
      lang: this.ar() ? 'ar' : 'en', fileBase: 'daily-transactions',
    }, paper);
  }
}
