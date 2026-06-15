import { Component, Input, inject, signal, computed, effect, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, RefreshCw, Loader, Building2, Download, SlidersHorizontal } from 'lucide-angular';
import { catchError, finalize, of } from 'rxjs';
import { LanguageService } from '../../core/i18n/language.service';
import { FilterService } from '../../core/filters/filter.service';
import { SalesReportApi } from '../../core/api/sales-report.api';
import { ReportDef, ReportColumn, SalesReportFilter, SalesReportResult } from '../../core/models/sales-report.models';
import { LoadingSkeletonComponent } from '../loading-skeleton/loading-skeleton.component';

/**
 * Generic config-driven table report. Drives every migrated "Sales report":
 * reads branch + date from the shared FilterService (header), adds an
 * OrdersFilter (Paid/Unpaid/All) toggle, fetches via SalesReportApi, and renders
 * a column-selectable table with a totals footer + CSV export. Each report is
 * just a ReportDef (title, endpoint, columns) — no bespoke component needed.
 */
@Component({
  selector: 'app-tabular-report-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, LoadingSkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5">
      <!-- Header -->
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">{{ ar() ? def.titleAr : def.titleEn }}</h1>
          <p *ngIf="def.subtitleEn || def.subtitleAr" class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {{ ar() ? (def.subtitleAr || def.subtitleEn) : (def.subtitleEn || def.subtitleAr) }}
          </p>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <!-- Orders filter -->
          <div class="seg">
            <button *ngFor="let o of ordersOpts" (click)="ordersFilter.set(o.v)" [class.seg-on]="ordersFilter() === o.v" class="seg-btn">
              {{ ar() ? o.ar : o.en }}
            </button>
          </div>
          <!-- Column picker -->
          <div class="relative">
            <button (click)="pickerOpen.set(!pickerOpen())" class="btn-ghost text-sm ring-1 ring-slate-200 dark:ring-slate-700">
              <lucide-icon [img]="Cols" class="h-4 w-4"></lucide-icon>
              {{ visibleColumns().length }}/{{ def.columns.length }}
            </button>
            <div *ngIf="pickerOpen()" class="absolute end-0 mt-2 z-40 w-60 max-h-80 overflow-auto rounded-card bg-white dark:bg-surface-dark-subtle shadow-card ring-1 ring-slate-200 dark:ring-slate-800 p-2 space-y-0.5">
              <label *ngFor="let c of def.columns" class="flex items-center gap-2 px-2 py-1 rounded-card-sm text-xs hover:bg-surface-muted dark:hover:bg-surface-dark-muted cursor-pointer">
                <input type="checkbox" [checked]="!hidden().has(c.key)" (change)="toggleCol(c.key)" class="rounded-sm"/>
                <span class="text-slate-700 dark:text-slate-200">{{ ar() ? c.labelAr : c.labelEn }}</span>
              </label>
            </div>
          </div>
          <button (click)="exportCsv()" [disabled]="!rows().length" class="btn-ghost text-sm ring-1 ring-slate-200 dark:ring-slate-700 disabled:opacity-40">
            <lucide-icon [img]="Dl" class="h-4 w-4"></lucide-icon> CSV
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

      <!-- Loading -->
      <app-loading-skeleton *ngIf="filter.canFetch() && loading() && !rows().length" [rows]="6"></app-loading-skeleton>

      <ng-container *ngIf="filter.canFetch() && !loading()">
        <div *ngIf="error()" class="card-padded ring-1 ring-critical/30 bg-critical-soft text-critical text-sm">
          <strong>{{ ar() ? 'خطأ:' : 'Error:' }}</strong> {{ error() }}
        </div>

        <div *ngIf="!error() && !rows().length" class="card-padded text-center py-10 text-sm text-slate-500 dark:text-slate-400">
          {{ ar() ? 'مفيش بيانات في الفترة دي.' : 'No data in this window.' }}
        </div>

        <!-- Table -->
        <div *ngIf="!error() && rows().length" class="card overflow-hidden animate-fade-in">
          <div class="overflow-x-auto">
            <table class="w-full text-sm whitespace-nowrap">
              <thead class="text-xs text-slate-500 dark:text-slate-400 bg-surface-muted/60 dark:bg-surface-dark-muted/40">
                <tr>
                  <th *ngFor="let c of visibleColumns()" class="px-3 py-2 font-semibold"
                      [class.text-end]="isNumeric(c)" [class.text-start]="!isNumeric(c)">
                    {{ ar() ? c.labelAr : c.labelEn }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr *ngFor="let r of rows()" class="hover:bg-slate-50 dark:hover:bg-surface-dark-muted/50">
                  <td *ngFor="let c of visibleColumns()" class="px-3 py-2"
                      [class.text-end]="isNumeric(c)" [class.tabular]="isNumeric(c)"
                      [class.font-medium]="c.key === firstCol()">
                    {{ fmt(r[c.key], c) }}
                  </td>
                </tr>
              </tbody>
              <tfoot *ngIf="hasTotals()" class="border-t-2 border-slate-200 dark:border-slate-700 font-semibold bg-surface-muted/40 dark:bg-surface-dark-muted/30">
                <tr>
                  <td *ngFor="let c of visibleColumns(); let i = index" class="px-3 py-2"
                      [class.text-end]="isNumeric(c)" [class.tabular]="isNumeric(c)">
                    <span *ngIf="i === 0 && !c.totalKey" class="text-slate-500">{{ ar() ? 'الإجمالي' : 'Total' }}</span>
                    <span *ngIf="c.totalKey">{{ fmt(totals()[c.totalKey!], c) }}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div class="px-3 py-2 text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800">
            {{ rows().length }} {{ ar() ? 'صف' : 'rows' }}
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .seg { display:inline-flex; gap:.2rem; padding:.2rem; border-radius:.7rem; background: rgb(241 245 249); }
    :host-context(.dark) .seg { background: rgb(30 41 59); }
    .seg-btn { padding:.35rem .7rem; border-radius:.5rem; font-size:.78rem; font-weight:500; color: rgb(71 85 105); white-space:nowrap; transition:all .18s; }
    :host-context(.dark) .seg-btn { color: rgb(203 213 225); }
    .seg-on { background:white; color: rgb(15 23 42); box-shadow:0 1px 2px rgb(0 0 0 /.08); }
    :host-context(.dark) .seg-on { background: rgb(51 65 85); color: rgb(248 250 252); }
  `],
})
export class TabularReportPageComponent {
  @Input({ required: true }) def!: ReportDef;

  readonly lang = inject(LanguageService);
  readonly filter = inject(FilterService);
  private readonly api = inject(SalesReportApi);

  readonly Refresh = RefreshCw;
  readonly Loader = Loader;
  readonly Branch = Building2;
  readonly Dl = Download;
  readonly Cols = SlidersHorizontal;

  readonly ordersOpts = [
    { v: 'Paid' as const,   en: 'Paid',   ar: 'مدفوع' },
    { v: 'UnPaid' as const, en: 'Unpaid', ar: 'غير مدفوع' },
    { v: 'All' as const,    en: 'All',    ar: 'الكل' },
  ];

  readonly ordersFilter = signal<'Paid' | 'UnPaid' | 'All'>('Paid');
  readonly pickerOpen = signal(false);
  readonly hidden = signal<Set<string>>(new Set());

  readonly loading = signal(false);
  readonly error = signal('');
  private readonly result = signal<SalesReportResult>({ rows: [], totals: {} });

  readonly rows = computed(() => this.result().rows);
  readonly totals = computed(() => this.result().totals);
  readonly ar = computed(() => this.lang.language() === 'ar');
  readonly visibleColumns = computed(() => this.def.columns.filter(c => !this.hidden().has(c.key)));

  private initialised = false;

  constructor() {
    // (Re)load whenever branch / dates / orders-filter change and we can fetch.
    effect(() => {
      const ok = this.filter.canFetch();
      this.filter.fromDate(); this.filter.toDate(); this.filter.branchId();
      this.ordersFilter();
      if (!this.initialised) { this.initialised = true; this.applyDefaults(); }
      if (ok) this.reload();
      else this.result.set({ rows: [], totals: {} });
    });
  }

  private applyDefaults(): void {
    if (this.def.defaultOrdersFilter) this.ordersFilter.set(this.def.defaultOrdersFilter);
    const h = new Set<string>();
    for (const c of this.def.columns) if (c.defaultHidden) h.add(c.key);
    this.hidden.set(h);
  }

  firstCol(): string { return this.visibleColumns()[0]?.key ?? ''; }
  hasTotals(): boolean { return this.def.columns.some(c => !!c.totalKey) && Object.keys(this.totals()).length > 0; }
  isNumeric(c: ReportColumn): boolean { return c.type === 'money' || c.type === 'number' || c.type === 'int' || !!c.alignEnd; }

  toggleCol(key: string): void {
    const h = new Set(this.hidden());
    if (h.has(key)) h.delete(key); else h.add(key);
    this.hidden.set(h);
  }

  reload(): void {
    if (!this.filter.canFetch()) return;
    const body: SalesReportFilter = {
      fromDate: this.filter.fromDate(),
      toDate: this.filter.toDate(),
      branchId: this.filter.branchId(),
      ordersFilter: this.ordersFilter(),
    };
    this.loading.set(true);
    this.error.set('');
    this.api.run(this.def.endpoint, body).pipe(
      catchError((err) => {
        this.error.set(err?.error?.message || err?.message || 'Failed to load report.');
        return of<SalesReportResult>({ rows: [], totals: {} });
      }),
      finalize(() => this.loading.set(false)),
    ).subscribe((res) => this.result.set(res));
  }

  fmt(v: unknown, c: ReportColumn): string {
    if (v === null || v === undefined || v === '') return c.type === 'money' || c.type === 'number' || c.type === 'int' ? '0' : '—';
    if (c.type === 'money' || c.type === 'number') {
      const n = Number(v); return Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(v);
    }
    if (c.type === 'int') { const n = Number(v); return Number.isFinite(n) ? n.toLocaleString() : String(v); }
    return String(v);
  }

  exportCsv(): void {
    const cols = this.visibleColumns();
    const head = cols.map(c => '"' + (this.ar() ? c.labelAr : c.labelEn).replace(/"/g, '""') + '"').join(',');
    const lines = this.rows().map(r => cols.map(c => '"' + this.fmt(r[c.key], c).replace(/"/g, '""') + '"').join(','));
    if (this.hasTotals()) {
      lines.push(cols.map((c, i) => '"' + (c.totalKey ? this.fmt(this.totals()[c.totalKey], c) : (i === 0 ? (this.ar() ? 'الإجمالي' : 'Total') : '')).replace(/"/g, '""') + '"').join(','));
    }
    const csv = '﻿' + [head, ...lines].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.def.titleEn.replace(/\s+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
