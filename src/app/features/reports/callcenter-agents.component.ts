import { Component, DestroyRef, inject, signal, computed, effect, untracked, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, RefreshCw, Loader, Printer, ChevronDown, FileSpreadsheet } from 'lucide-angular';
import { catchError, finalize, of } from 'rxjs';
import { LanguageService } from '../../core/i18n/language.service';
import { FilterService } from '../../core/filters/filter.service';
import { BranchService } from '../../core/branches/branch.service';
import { SalesReportApi } from '../../core/api/sales-report.api';
import { ExportService, ExportColumn, ExportMeta, ExportSection } from '../../core/export/export.service';
import { LoadingSkeletonComponent } from '../../shared/loading-skeleton/loading-skeleton.component';
import {
  CcReportData, CcSection, CcColumn, CC_ENDPOINT, CC_ORDER_TYPES, CC_RECEIPT_COLUMNS,
  ccSections, ccOrderExcelColumns, ccReceiptTotals, money,
} from '../../core/reports/callcenter-agents.model';

/** Rows of the order list shown before "Show all". */
const ORDER_PAGE = 100;

/**
 * "Call centre sales by agent" — which call-centre agent took each order, per agent,
 * per agent × branch, per day, and the order list. Dates AND branch come from the header
 * (one branch filter for the whole app, 2026-11-10: a second in-page branch select made the
 * header's look broken). The call centre routes to every branch, so this page offers
 * "All branches" in the header picker; agent and order type are this page's own filters.
 */
@Component({
  selector: 'app-callcenter-agents',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, LoadingSkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4" (click)="menu.set(false)">
      <!-- Header -->
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div class="min-w-0">
          <h1 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">{{ ar() ? 'مبيعات الكول سنتر حسب الموظف' : 'Call centre sales by agent' }}</h1>
          <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{{ ar() ? 'مين أخد كل طلب، وبكام، ولأي فرع' : 'Who took each order, for how much, and for which branch' }}</p>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <div class="relative" (click)="$event.stopPropagation()">
            <button (click)="menu.set(!menu())" [disabled]="!hasRows()" data-test="export"
                    class="btn-ghost text-sm ring-1 ring-slate-200 dark:ring-slate-700 disabled:opacity-40">
              <lucide-icon [img]="PrinterIcon" class="h-4 w-4"></lucide-icon>
              {{ ar() ? 'تصدير / طباعة' : 'Export / Print' }}
              <lucide-icon [img]="ChevronIcon" class="h-3.5 w-3.5 opacity-60"></lucide-icon>
            </button>
            <div *ngIf="menu()" class="menu">
              <button class="menu-item" (click)="exportExcel()"><lucide-icon [img]="SheetIcon" class="h-4 w-4 text-slate-400"></lucide-icon><span class="flex-1 text-start">{{ ar() ? 'إكسل (كل الأعمدة)' : 'Excel (all columns)' }}</span></button>
              <button class="menu-item" (click)="exportA4()"><lucide-icon [img]="PrinterIcon" class="h-4 w-4 text-slate-400"></lucide-icon><span class="flex-1 text-start">A4</span></button>
              <button class="menu-item" (click)="printRoll('pos80')"><lucide-icon [img]="PrinterIcon" class="h-4 w-4 text-slate-400"></lucide-icon><span class="flex-1 text-start">POS 80mm {{ ar() ? '(الملخص)' : '(summary)' }}</span></button>
              <button class="menu-item" (click)="printRoll('pos72')"><lucide-icon [img]="PrinterIcon" class="h-4 w-4 text-slate-400"></lucide-icon><span class="flex-1 text-start">POS 72mm {{ ar() ? '(الملخص)' : '(summary)' }}</span></button>
            </div>
          </div>
          <button (click)="reload()" [disabled]="loading() || !filter.hasValidDates()" class="btn-ghost text-sm">
            <lucide-icon [img]="loading() ? Loader : Refresh" class="h-4 w-4" [class.animate-spin]="loading()"></lucide-icon>
            {{ ar() ? 'تحديث' : 'Refresh' }}
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="card-padded grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label class="block text-xs font-medium text-slate-500 dark:text-slate-400">
          {{ ar() ? 'الموظف' : 'Agent' }}
          <select [ngModel]="agentId()" (ngModelChange)="setAgent($event)" data-test="agent"
                  class="mt-1 w-full bg-white dark:bg-surface-dark-subtle border border-slate-300 dark:border-slate-700 rounded-card-sm px-2 py-1.5 text-sm text-slate-700 dark:text-slate-200">
            <option [ngValue]="''">{{ ar() ? 'كل الموظفين' : 'All agents' }}</option>
            <option *ngFor="let a of data()?.agentOptions ?? []" [ngValue]="a.id">{{ ar() ? (a.nameAr || a.nameEn) : (a.nameEn || a.nameAr) }}</option>
          </select>
        </label>
        <label class="block text-xs font-medium text-slate-500 dark:text-slate-400">
          {{ ar() ? 'نوع الطلب' : 'Order type' }}
          <select [ngModel]="transactionId()" (ngModelChange)="setType(+$event)" data-test="type"
                  class="mt-1 w-full bg-white dark:bg-surface-dark-subtle border border-slate-300 dark:border-slate-700 rounded-card-sm px-2 py-1.5 text-sm text-slate-700 dark:text-slate-200">
            <option [ngValue]="0">{{ ar() ? 'كل الأنواع' : 'All types' }}</option>
            <option *ngFor="let t of types" [ngValue]="t.id">{{ ar() ? t.ar : t.en }}</option>
          </select>
        </label>
      </div>

      <!-- Gate -->
      <div *ngIf="!filter.hasValidDates()" class="card-padded text-center py-10 text-sm text-slate-600 dark:text-slate-300">
        {{ filter.validateBilingual(ar() ? 'ar' : 'en') || (ar() ? 'برجاء تحديد فترة التقرير.' : 'Please pick a date range.') }}
      </div>

      <app-loading-skeleton *ngIf="filter.hasValidDates() && loading()"></app-loading-skeleton>
      <div *ngIf="error()" class="card-padded text-center py-10 text-rose-600 dark:text-rose-400">{{ error() }}</div>

      <div *ngIf="filter.hasValidDates() && !loading() && !error() && data() && !hasRows()"
           class="card-padded text-center py-10 text-sm text-slate-500 dark:text-slate-400" data-test="empty">
        {{ ar() ? 'لا توجد طلبات كول سنتر في هذه الفترة.' : 'No call-centre orders in this period.' }}
      </div>

      <ng-container *ngIf="filter.hasValidDates() && !loading() && !error() && hasRows()">
        <!-- KPI strip -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3" data-test="kpis">
          <div *ngFor="let k of kpis()" class="card-padded">
            <div class="text-xs text-slate-500 dark:text-slate-400">{{ k.label }}</div>
            <div class="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50">{{ k.value }}</div>
          </div>
        </div>

        <!-- Sections -->
        <div *ngFor="let s of sections()" class="card overflow-hidden" [attr.data-test]="'section-' + s.key">
          <div class="px-4 py-2 flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800">
            <span class="text-xs font-bold text-slate-600 dark:text-slate-300" [class.uppercase]="!ar()">{{ ar() ? s.titleAr : s.titleEn }}</span>
            <span class="text-xs text-slate-400 tabular-nums">{{ s.rows.length }}</span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm whitespace-nowrap">
              <thead class="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-surface-dark-muted/50">
                <tr>
                  <th *ngFor="let c of s.columns" scope="col" class="px-3 py-2 font-semibold"
                      [class.text-end]="c.numeric" [class.text-start]="!c.numeric">{{ ar() ? c.ar : c.en }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr *ngFor="let r of visibleRows(s)" class="hover:bg-slate-50 dark:hover:bg-surface-dark-muted/50"
                    [ngClass]="r?.isCancelled ? 'text-rose-600 dark:text-rose-400' : ''">
                  <td *ngFor="let c of s.columns" class="px-3 py-1.5"
                      [class.text-end]="c.numeric" [class.tabular-nums]="c.numeric">{{ c.value(r, ar()) }}</td>
                </tr>
              </tbody>
              <tfoot *ngIf="s.footer">
                <tr class="font-bold border-t-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-50">
                  <td *ngFor="let v of s.footer; let i = index" class="px-3 py-2"
                      [class.text-end]="s.columns[i].numeric" [class.tabular-nums]="s.columns[i].numeric">{{ v }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div *ngIf="s.key === 'orders' && s.rows.length > pageSize" class="px-4 py-2 text-center border-t border-slate-100 dark:border-slate-800">
            <button class="btn-ghost text-sm" (click)="showAllOrders.set(!showAllOrders())">
              {{ showAllOrders() ? (ar() ? 'عرض أقل' : 'Show less') : (ar() ? 'عرض الكل (' + s.rows.length + ')' : 'Show all (' + s.rows.length + ')') }}
            </button>
          </div>
        </div>
      </ng-container>
    </div>
  `,
})
export class CallCenterAgentsComponent {
  private readonly lang = inject(LanguageService);
  readonly filter = inject(FilterService);
  private readonly api = inject(SalesReportApi);
  private readonly exp = inject(ExportService);
  private readonly branches = inject(BranchService);

  readonly ar = computed(() => this.lang.language() === 'ar');
  readonly Refresh = RefreshCw; readonly Loader = Loader; readonly PrinterIcon = Printer;
  readonly ChevronIcon = ChevronDown; readonly SheetIcon = FileSpreadsheet;
  readonly types = CC_ORDER_TYPES;
  readonly pageSize = ORDER_PAGE;

  readonly menu = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly data = signal<CcReportData | null>(null);
  readonly agentId = signal('');
  readonly transactionId = signal(0);
  readonly showAllOrders = signal(false);

  readonly sections = computed<CcSection[]>(() => {
    const d = this.data();
    return d ? ccSections(d, this.ar()) : [];
  });
  readonly hasRows = computed(() => (this.data()?.orders?.length ?? 0) > 0);

  readonly kpis = computed(() => {
    const t = this.data()?.totals;
    const ar = this.ar();
    if (!t) return [];
    return [
      { label: ar ? 'صافي المبيعات' : 'Net sales', value: money(t.netSales) },
      { label: ar ? 'عدد الطلبات' : 'Orders', value: String(t.orders) },
      { label: ar ? 'متوسط الطلب' : 'Average order', value: money(t.averageOrder) },
      { label: ar ? 'الملغي (عدد · قيمة)' : 'Cancelled (count · value)', value: `${t.cancelledOrders} · ${money(t.cancelledValue)}` },
    ];
  });

  constructor() {
    // The header offers "All branches" only while this page is open.
    inject(DestroyRef).onDestroy(this.filter.offerAllBranches());
    effect(() => {
      const ok = this.filter.hasValidDates();
      this.filter.fromDate(); this.filter.toDate(); this.filter.scopedBranchId();
      untracked(() => (ok ? this.reload() : this.data.set(null)));
    });
  }

  setAgent(id: string): void { this.agentId.set(id ?? ''); this.reload(); }
  setType(id: number): void { this.transactionId.set(id || 0); this.reload(); }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  visibleRows(s: CcSection): any[] {
    return s.key === 'orders' && !this.showAllOrders() ? s.rows.slice(0, ORDER_PAGE) : s.rows;
  }

  reload(): void {
    if (!this.filter.hasValidDates()) return;
    const body = {
      // Date-only: the API's day is the branch business day (OrderDate), whole days.
      fromDate: (this.filter.fromDate() || '').slice(0, 10),
      toDate: (this.filter.toDate() || '').slice(0, 10),
      branchId: this.filter.scopedBranchId() || null,
      agentId: this.agentId() || null,
      transactionId: this.transactionId() || null,
    };
    this.loading.set(true);
    this.error.set('');
    this.api.raw<CcReportData>(CC_ENDPOINT, body).pipe(
      catchError((err) => {
        this.error.set(err?.error?.message || err?.message || (this.ar() ? 'تعذر تحميل التقرير.' : 'Failed to load report.'));
        return of(null);
      }),
      finalize(() => this.loading.set(false)),
    ).subscribe((d) => this.data.set(d ?? null));
  }

  // ── exports ────────────────────────────────────────────────────────────────

  private meta(): ExportMeta {
    const ar = this.ar();
    const d = this.data();
    const branchId = this.filter.scopedBranchId();
    const listed = branchId ? this.branches.findById(branchId) : undefined;
    const opt = branchId ? d?.branchOptions?.find((b) => +b.id === branchId) : undefined;
    const branch = listed ? { nameEn: listed.name_En, nameAr: listed.name_Ar }
      : opt ? { nameEn: opt.nameEn, nameAr: opt.nameAr }
      : branchId ? { nameEn: `Branch #${branchId}`, nameAr: `فرع #${branchId}` } : undefined;
    const agent = d?.agentOptions?.find((a) => a.id === this.agentId());
    const type = CC_ORDER_TYPES.find((t) => t.id === this.transactionId());
    const all = ar ? 'الكل' : 'All';
    return {
      titleEn: 'Call centre sales by agent', titleAr: 'مبيعات الكول سنتر حسب الموظف',
      fromDate: this.filter.fromDate(), toDate: this.filter.toDate(),
      lang: ar ? 'ar' : 'en', fileBase: 'callcentre-agents',
      appliedFilters: [
        { label: ar ? 'الفرع' : 'Branch', value: branch ? (ar ? branch.nameAr || branch.nameEn : branch.nameEn || branch.nameAr) : all },
        { label: ar ? 'الموظف' : 'Agent', value: agent ? (ar ? agent.nameAr || agent.nameEn : agent.nameEn || agent.nameAr) : all },
        { label: ar ? 'نوع الطلب' : 'Order type', value: type ? (ar ? type.ar : type.en) : all },
      ],
    };
  }

  private toExport<T>(cols: CcColumn<T>[]): ExportColumn<T>[] {
    const ar = this.ar();
    return cols.map((c) => ({ headerEn: c.en, headerAr: c.ar, numeric: c.numeric, value: (r: T) => c.value(r, ar) }));
  }

  private exportSections(allOrderColumns: boolean): ExportSection[] {
    return this.sections().map((s) => ({
      titleEn: s.titleEn, titleAr: s.titleAr, rows: s.rows, footer: s.footer,
      cols: this.toExport(s.key === 'orders' && allOrderColumns ? ccOrderExcelColumns(this.ar()) : s.columns),
    }));
  }

  exportExcel(): void {
    this.menu.set(false);
    if (this.hasRows()) this.exp.sections(this.exportSections(true), this.meta(), 'excel');
  }

  exportA4(): void {
    this.menu.set(false);
    if (this.hasRows()) this.exp.sections(this.exportSections(false), this.meta(), 'a4');
  }

  /** The roll carries the per-agent summary only — the order list does not fit 72/80 mm. */
  printRoll(paper: 'pos72' | 'pos80'): void {
    this.menu.set(false);
    const d = this.data();
    if (!d?.agents?.length) return;
    const ar = this.ar();
    this.exp.pdf(d.agents, this.toExport(CC_RECEIPT_COLUMNS), {
      ...this.meta(), paper, paymentTotals: ccReceiptTotals(d.totals, ar),
    });
  }
}
