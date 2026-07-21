import { Component, Input, OnInit, inject, signal, computed, effect, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Router } from '@angular/router';
import {
  LucideAngularModule, RefreshCw, Loader, Building2, Download, Printer, ChevronDown, ChevronRight, Zap,
  FileSpreadsheet, FileText,
} from 'lucide-angular';
import { catchError, finalize, of } from 'rxjs';
import { LanguageService } from '../../core/i18n/language.service';
import { dataValueLabel } from '../../core/i18n/monitoring-labels';
import { FilterService } from '../../core/filters/filter.service';
import { BranchService } from '../../core/branches/branch.service';
import { AuthService } from '../../core/auth/auth.service';
import { SalesReportApi } from '../../core/api/sales-report.api';
import { ReportLookupsService } from '../../core/filters/report-lookups.service';
import { ExportService, ExportColumn, ExportMeta, ExportPaper } from '../../core/export/export.service';
import {
  ReportDef, ReportColumn, SalesReportFilter, SalesReportResult, SavedColumnLayout,
} from '../../core/models/sales-report.models';
import { LoadingSkeletonComponent } from '../loading-skeleton/loading-skeleton.component';
import { ReportFilterBarComponent } from '../report-filter-bar/report-filter-bar.component';
import { ColumnCustomizerComponent } from '../column-customizer/column-customizer.component';
import { PagerComponent } from '../pager/pager.component';
import { PaymentSummaryBarComponent } from '../payment-summary-bar/payment-summary-bar.component';

type Row = Record<string, unknown>;

/** Text-column keys whose server values are category-like (English in AR mode)
 *  and should be run through dataValueLabel() for Arabic display. */
const I18N_TEXT_KEYS = new Set(['transaction', 'transactionName', 'paymentStatus', 'payWay', 'payway']);

/** One applied filter chip — label + resolved display value, for the export header. */
interface AppliedFilter { label: string; value: string; }

/**
 * Generic config-driven table report. Drives every migrated "Sales report":
 * branch + date come from the header; a full filter bar (payment / shift /
 * transaction / discount / promo / voucher / online-app / user / waiter /
 * pilot) feeds the request; columns are drag-reorderable + hideable and saved
 * per-user; and the toolbar prints (A4 / POS 72 / POS 80), exports (Excel /
 * PDF / CSV) and offers a one-click Flash report. Each report is just a
 * ReportDef — no bespoke component needed.
 */
@Component({
  selector: 'app-tabular-report-page',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DragDropModule, LucideAngularModule, LoadingSkeletonComponent,
    ReportFilterBarComponent, ColumnCustomizerComponent, PagerComponent, PaymentSummaryBarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4" (click)="menu.set(null)">
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

          <!-- Expand / collapse all (daily tree reports only) -->
          <button *ngIf="isTree() && rows().length" (click)="allExpanded() ? collapseAll() : expandAll()"
                  class="btn-ghost text-sm ring-1 ring-slate-200 dark:ring-slate-700">
            <lucide-icon [img]="allExpanded() ? ChevronIcon : ChevronRightIcon" class="h-4 w-4"></lucide-icon>
            {{ allExpanded() ? (ar() ? 'اقفل الكل' : 'Collapse all') : (ar() ? 'افتح الكل' : 'Expand all') }}
          </button>

          <!-- Column customizer -->
          <app-column-customizer
            [columns]="orderedColumns()" [hidden]="hidden()"
            (layoutChange)="onLayout($event)" (resetToDefault)="resetLayout()"></app-column-customizer>

          <!-- Print -->
          <div class="relative" (click)="$event.stopPropagation()">
            <button (click)="menu.set(menu() === 'print' ? null : 'print')" [disabled]="!rows().length"
                    class="btn-ghost text-sm ring-1 ring-slate-200 dark:ring-slate-700 disabled:opacity-40">
              <lucide-icon [img]="PrinterIcon" class="h-4 w-4"></lucide-icon>
              {{ ar() ? 'طباعة' : 'Print' }}
              <lucide-icon [img]="ChevronIcon" class="h-3.5 w-3.5 opacity-60"></lucide-icon>
            </button>
            <div *ngIf="menu() === 'print'" class="menu">
              <button class="menu-item" (click)="print('a4')"><lucide-icon [img]="PrinterIcon" class="h-4 w-4 text-slate-400"></lucide-icon><span class="flex-1 text-start">A4</span></button>
              <button class="menu-item" (click)="print('pos72')"><lucide-icon [img]="PrinterIcon" class="h-4 w-4 text-slate-400"></lucide-icon><span class="flex-1 text-start">POS 72mm</span></button>
              <button class="menu-item" (click)="print('pos80')"><lucide-icon [img]="PrinterIcon" class="h-4 w-4 text-slate-400"></lucide-icon><span class="flex-1 text-start">POS 80mm</span></button>
            </div>
          </div>

          <!-- Download — one-click Excel or a real direct PDF file (no dialog). -->
          <div class="relative" (click)="$event.stopPropagation()">
            <button (click)="menu.set(menu() === 'dl' ? null : 'dl')" [disabled]="!rows().length || pdfBusy()"
                    class="btn-ghost text-sm ring-1 ring-slate-200 dark:ring-slate-700 disabled:opacity-40">
              <lucide-icon [img]="pdfBusy() ? Loader : DownloadIcon" class="h-4 w-4" [class.animate-spin]="pdfBusy()"></lucide-icon>
              {{ ar() ? 'تحميل' : 'Download' }}
              <lucide-icon [img]="ChevronIcon" class="h-3.5 w-3.5 opacity-60"></lucide-icon>
            </button>
            <div *ngIf="menu() === 'dl'" class="menu">
              <button class="menu-item" (click)="exportExcel()"><lucide-icon [img]="ExcelIcon" class="h-4 w-4 text-emerald-500"></lucide-icon><span class="flex-1 text-start">Excel</span></button>
              <button class="menu-item" (click)="exportPdf()"><lucide-icon [img]="PdfIcon" class="h-4 w-4 text-rose-500"></lucide-icon><span class="flex-1 text-start">PDF</span></button>
            </div>
          </div>

          <!-- Flash report -->
          <button (click)="flash()" [disabled]="!rows().length"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card-sm text-sm font-semibold
                         bg-brand-600 hover:bg-brand-700 text-white shadow-sm disabled:opacity-40
                         transition-colors duration-180">
            <lucide-icon [img]="ZapIcon" class="h-4 w-4"></lucide-icon>
            {{ ar() ? 'تقرير سريع' : 'Flash report' }}
          </button>

          <!-- Refresh -->
          <button (click)="reload()" [disabled]="loading() || !filter.canFetch()" class="btn-ghost text-sm">
            <lucide-icon [img]="loading() ? Loader : Refresh" class="h-4 w-4" [class.animate-spin]="loading()"></lucide-icon>
            {{ ar() ? 'تحديث' : 'Refresh' }}
          </button>
        </div>
      </div>

      <!-- Filter bar -->
      <app-report-filter-bar *ngIf="showFilters()" [filters]="def.filters"
        (filtersChange)="onFilters($event)"></app-report-filter-bar>

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
            <!-- full-width table: fills the container so there's no empty gap on the side;
                 overflows to horizontal scroll only when the columns are genuinely too wide -->
            <table class="w-full text-sm whitespace-nowrap">
              <thead class="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400
                            bg-slate-50 dark:bg-surface-dark-muted/50
                            border-b border-slate-200 dark:border-slate-800">
                <tr cdkDropList cdkDropListOrientation="horizontal" (cdkDropListDropped)="dropHeader($event)">
                  <th *ngIf="isTree()" class="px-2 py-2.5 w-9"></th>
                  <th *ngFor="let c of visibleColumns()" cdkDrag
                      class="px-3 py-2.5 font-semibold text-center cursor-move select-none
                             hover:bg-slate-100 dark:hover:bg-surface-dark-muted/70 transition-colors"
                      [title]="ar() ? 'اسحب لإعادة ترتيب الأعمدة' : 'Drag to reorder columns'">
                    {{ ar() ? c.labelAr : c.labelEn }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr *ngFor="let r of pagedRows(); let ri = index"
                    (click)="onRowClick(r)"
                    [attr.title]="canDrill(r) ? drillTitle() : null"
                    [class.cursor-pointer]="canDrill(r)"
                    class="hover:bg-slate-50 dark:hover:bg-surface-dark-muted/50"
                    [class.row-group]="hasMerge() && isMergeStart(ri)"
                    [class.tree-parent]="isTree() && lvl(r) === 0"
                    [class.tree-child]="isTree() && lvl(r) === 1">
                  <td *ngIf="isTree()" class="px-2 py-2 text-center align-middle">
                    <lucide-icon *ngIf="lvl(r) === 0" [img]="isExpanded(r) ? ChevronIcon : ChevronRightIcon"
                                 class="h-4 w-4 inline-block text-slate-400"></lucide-icon>
                  </td>
                  <ng-container *ngFor="let c of visibleColumns()">
                    <td *ngIf="c.key !== mergeColKey() || isMergeStart(ri)" class="px-3 py-2 text-center"
                        [attr.rowspan]="c.key === mergeColKey() ? mergeSpan(ri) : null"
                        [class.tabular]="isNumeric(c)"
                        [class.font-medium]="c.key === firstCol()"
                        [class.merge-cell]="c.key === mergeColKey()">
                      {{ fmt(r[c.key], c) }}
                    </td>
                  </ng-container>
                </tr>
              </tbody>
              <tfoot *ngIf="hasTotals()" class="border-t-2 border-slate-200 dark:border-slate-700 font-semibold bg-surface-muted/40 dark:bg-surface-dark-muted/30">
                <tr>
                  <td *ngIf="isTree()" class="px-2 py-2"></td>
                  <td *ngFor="let c of visibleColumns(); let i = index" class="px-3 py-2 text-center"
                      [class.tabular]="isNumeric(c)">
                    <span *ngIf="i === 0 && !c.totalKey" class="text-slate-500">{{ ar() ? 'الإجمالي' : 'Total' }}</span>
                    <span *ngIf="c.totalKey">{{ fmt(totals()[c.totalKey!], c) }}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <!-- Footer: row count + page-size selector + pager -->
          <div class="flex items-center justify-between flex-wrap gap-3 px-3 py-2
                      border-t border-slate-100 dark:border-slate-800">
            <span class="text-[11px] text-slate-400">
              {{ displayRows().length }} {{ ar() ? (def.rowUnitAr || 'صف') : (def.rowUnitEn || 'rows') }}
            </span>
            <div class="flex items-center gap-3">
              <label class="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                {{ ar() ? 'لكل صفحة' : 'Per page' }}
                <select [ngModel]="pageSize()" (ngModelChange)="setPageSize(+$event)"
                        class="rounded-card-sm border border-slate-300 dark:border-slate-700
                               bg-white dark:bg-surface-dark-subtle text-slate-700 dark:text-slate-200
                               text-xs px-2 py-1 focus:ring-2 focus:ring-brand-500/30 focus:outline-none">
                  <option *ngFor="let s of pageSizeOpts" [ngValue]="s">{{ s === 0 ? (ar() ? 'الكل' : 'All') : s }}</option>
                </select>
              </label>
            </div>
          </div>
          <app-pager class="block px-3 pb-3"
                     [page]="page()" [pageSize]="effectivePageSize()" [totalCount]="displayRows().length"
                     (pageChange)="page.set($event)"></app-pager>
        </div>

        <!-- Bottom Summary bar — financial figures strip (derived from THIS report's
             own total columns) + payment split (when the report has a paymentSummary
             config). Shown on EVERY report that has totals, not just the sales family. -->
        <app-payment-summary-bar *ngIf="!error() && rows().length && hasTotals()"
          [config]="def.paymentSummary" [totals]="totals()" [columns]="def.columns"></app-payment-summary-bar>
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
    .menu { position:absolute; inset-inline-end:0; margin-top:.5rem; z-index:50; min-width:11rem;
            border-radius:.7rem; overflow:hidden; background:white; box-shadow:0 8px 24px rgb(0 0 0 /.12);
            border:1px solid rgb(226 232 240); }
    :host-context(.dark) .menu { background: rgb(30 41 59); border-color: rgb(51 65 85); }
    .menu-item { display:flex; align-items:center; gap:.6rem; width:100%; padding:.55rem .8rem; font-size:.82rem;
                 text-align:start; color: rgb(51 65 85); }
    :host-context(.dark) .menu-item { color: rgb(203 213 225); }
    .menu-item:hover { background: rgba(168,24,19,.07); }
    .merge-cell { @apply align-middle font-semibold text-center bg-slate-50/60 dark:bg-surface-dark-muted/40; }
    .row-group > td { @apply border-t-2 border-slate-200 dark:border-slate-700; }
    /* Expandable per-day tree: bold tinted day rows (clickable), muted detail rows. */
    .tree-parent { cursor: pointer; }
    .tree-parent > td { @apply bg-slate-50 dark:bg-surface-dark-muted/40 font-semibold border-t border-slate-200 dark:border-slate-700; }
    .tree-child > td { @apply text-slate-500 dark:text-slate-400 bg-white dark:bg-transparent; }
  `],
})
export class TabularReportPageComponent implements OnInit {
  @Input({ required: true }) def!: ReportDef;

  readonly lang = inject(LanguageService);
  readonly filter = inject(FilterService);
  private readonly router = inject(Router);
  private readonly api = inject(SalesReportApi);
  private readonly branches = inject(BranchService);
  private readonly auth = inject(AuthService);
  private readonly lookups = inject(ReportLookupsService);
  private readonly exp = inject(ExportService);

  readonly Refresh = RefreshCw;
  readonly Loader = Loader;
  readonly Branch = Building2;
  readonly DownloadIcon = Download;
  readonly PrinterIcon = Printer;
  readonly ChevronIcon = ChevronDown;
  readonly ChevronRightIcon = ChevronRight;
  readonly ZapIcon = Zap;
  readonly ExcelIcon = FileSpreadsheet;
  readonly PdfIcon = FileText;

  readonly ordersOpts = [
    { v: 'Paid' as const,   en: 'Paid',   ar: 'مدفوع' },
    { v: 'UnPaid' as const, en: 'Unpaid', ar: 'غير مدفوع' },
    { v: 'All' as const,    en: 'All',    ar: 'الكل' },
  ];

  readonly ordersFilter = signal<'Paid' | 'UnPaid' | 'All'>('Paid');
  readonly menu = signal<'print' | 'dl' | null>(null);
  /** True while a direct PDF file is being rasterised + saved. */
  readonly pdfBusy = signal(false);

  // Column layout (per-user persisted)
  readonly order = signal<string[]>([]);
  readonly hidden = signal<Set<string>>(new Set());

  // Page-local filter selections from the filter bar
  private readonly extraFilters = signal<Partial<SalesReportFilter>>({});

  readonly loading = signal(false);
  readonly error = signal('');
  private readonly result = signal<SalesReportResult>({ rows: [], totals: {} });

  readonly rows = computed(() => this.result().rows);
  readonly totals = computed(() => this.result().totals);
  readonly ar = computed(() => this.lang.language() === 'ar');

  // ── Expandable per-day tree (Daily Discounts / Vouchers / Promo). The transform
  //    emits day-summary rows (__level 0) + detail rows (__level 1, __parent=dayKey).
  //    Days start collapsed; clicking a day row (or "Expand all") reveals its details. ──
  readonly expanded = signal<Set<string>>(new Set());
  readonly isTree = computed(() => !!this.def.expandable && this.rows().some((r) => (r as Row)['__level'] != null));
  /** Rows actually shown: all day rows + the detail rows of expanded days. */
  readonly displayRows = computed<Row[]>(() => {
    const all = this.rows() as Row[];
    if (!this.isTree()) return all;
    const exp = this.expanded();
    return all.filter((r) => Number(r['__level']) === 0 || exp.has(String(r['__parent'])));
  });
  readonly allExpanded = computed(() => {
    const parents = (this.rows() as Row[]).filter((r) => Number(r['__level']) === 0);
    return parents.length > 0 && parents.every((r) => this.expanded().has(String(r['__key'])));
  });

  // ── Client-side pagination (zero backend impact — the report already
  //    returns the full row set; we just page the display). 0 = "All". ──
  readonly pageSizeOpts = [25, 50, 100, 200, 0];
  readonly pageSize = signal(50);
  readonly page = signal(1);
  /** Page size actually used for slicing/pager — "All" collapses to the row count. */
  readonly effectivePageSize = computed(() => {
    const ps = this.pageSize();
    return ps <= 0 ? Math.max(this.displayRows().length, 1) : ps;
  });
  readonly pagedRows = computed<Row[]>(() => {
    const ps = this.pageSize();
    const all = this.displayRows();
    if (ps <= 0) return all;
    const start = (this.page() - 1) * ps;
    return all.slice(start, start + ps);
  });

  /** Applied filter selections (resolved to display names) for the export header. */
  readonly appliedFilters = computed<AppliedFilter[]>(() => {
    const ar = this.ar();
    const f = this.extraFilters();
    const out: AppliedFilter[] = [];
    const nm = (items: { id: string; nameEn: string; nameAr: string }[], id: unknown): string => {
      const it = items.find((x) => String(x.id) === String(id));
      return it ? (ar ? (it.nameAr || it.nameEn) : (it.nameEn || it.nameAr)) : String(id ?? '');
    };
    const of = this.ordersFilter();
    out.push({
      label: ar ? 'الحالة' : 'Orders',
      value: of === 'Paid' ? (ar ? 'مدفوع' : 'Paid') : of === 'UnPaid' ? (ar ? 'غير مدفوع' : 'Unpaid') : (ar ? 'الكل' : 'All'),
    });
    if (f.payway)                 out.push({ label: ar ? 'طريقة الدفع' : 'Payment',     value: nm(this.lookups.paymentMethods(), f.payway) });
    if (f.transactionId != null)  out.push({ label: ar ? 'المعاملة' : 'Transaction',    value: nm(this.lookups.transactions(), f.transactionId) });
    if (f.shiftId != null)        out.push({ label: ar ? 'الوردية' : 'Shift',           value: nm(this.lookups.shifts(), f.shiftId) });
    if (f.discountId != null)     out.push({ label: ar ? 'الخصم' : 'Discount',          value: nm(this.lookups.discounts(), f.discountId) });
    if (f.promoCodeDiscountId != null) out.push({ label: ar ? 'البرومو' : 'Promo',      value: nm(this.lookups.promoDiscounts(), f.promoCodeDiscountId) });
    if (f.voucherName)            out.push({ label: ar ? 'القسيمة' : 'Voucher',         value: nm(this.lookups.vouchers(), f.voucherName) });
    if (f.onlineApp != null)      out.push({ label: ar ? 'تطبيق أونلاين' : 'Online app', value: nm(this.lookups.onlineApps(), f.onlineApp) });
    if (f.userId)                 out.push({ label: ar ? 'المستخدم' : 'User',           value: nm(this.lookups.cashiers(), f.userId) });
    if (f.waiterId)               out.push({ label: ar ? 'الويتر' : 'Waiter',           value: nm(this.lookups.waiters(), f.waiterId) });
    if (f.poiltId)                out.push({ label: ar ? 'الطيار' : 'Pilot',            value: nm(this.lookups.pilots(), f.poiltId) });
    return out;
  });

  private readonly colByKey = computed(() => {
    const m = new Map<string, ReportColumn>();
    for (const c of this.def.columns) m.set(c.key, c);
    return m;
  });
  /** Full column list in the user's chosen order (incl. hidden) — for the customizer. */
  readonly orderedColumns = computed<ReportColumn[]>(() =>
    this.order().map((k) => this.colByKey().get(k)).filter((c): c is ReportColumn => !!c));
  /** Visible columns in order — for the table + exports. */
  readonly visibleColumns = computed<ReportColumn[]>(() => {
    const vis = this.orderedColumns().filter((c) => !this.hidden().has(c.key));
    // Net is ALWAYS the last column (table + A4/Excel/PDF follow this order).
    const isNet = (c: ReportColumn) => c.key === 'net' || c.key === 'netAmount';
    const net = vis.filter(isNet);
    return net.length ? [...vis.filter((c) => !isNet(c)), ...net] : vis;
  });

  readonly showFilters = computed(() => this.def.filters == null || this.def.filters.length > 0);

  constructor() {
    // Ensure the branch list is loading (cached/idempotent) — reload() waits on
    // it to apply the branch-name filter on the first fetch.
    this.branches.load().subscribe({ error: () => undefined });

    // Drive lookup loading from branch + orders filter.
    effect(() => {
      const branchId = this.filter.branchId();
      const of = this.ordersFilter();
      this.lookups.ensureStatic();
      this.lookups.loadBranch(branchId);
      this.lookups.loadPaymentMethods(of);
    });

    // (Re)load whenever branch / dates / orders-filter / filters change.
    effect(() => {
      const ok = this.filter.canFetch();
      this.filter.fromDate(); this.filter.toDate(); this.filter.branchId();
      this.ordersFilter(); this.extraFilters();
      if (ok) this.reload();
      else this.result.set({ rows: [], totals: {} });
    });

    // A fresh result set always returns to page 1.
    effect(() => { this.rows(); this.page.set(1); });
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
  }

  ngOnInit(): void { this.applyLayout(); }

  // ── filters ────────────────────────────────────────────────────────
  onFilters(f: Partial<SalesReportFilter>): void { this.extraFilters.set(f); }

  // ── column layout persistence ────────────────────────────────────────
  private storageKey(): string {
    const uid = this.auth.profile()?.userId || 'anon';
    return `pos-reports.cols.v1.${uid}.${this.def.id}`;
  }
  private applyLayout(): void {
    if (this.def.defaultOrdersFilter) this.ordersFilter.set(this.def.defaultOrdersFilter);
    const allKeys = this.def.columns.map((c) => c.key);
    let saved: SavedColumnLayout | null = null;
    try {
      const raw = localStorage.getItem(this.storageKey());
      if (raw) saved = JSON.parse(raw) as SavedColumnLayout;
    } catch { /* noop */ }
    if (saved && Array.isArray(saved.order)) {
      const ordered = saved.order.filter((k) => allKeys.includes(k));
      for (const k of allKeys) if (!ordered.includes(k)) ordered.push(k);
      this.order.set(ordered);
      this.hidden.set(new Set((saved.hidden ?? []).filter((k) => allKeys.includes(k))));
    } else {
      this.order.set(allKeys);
      this.hidden.set(new Set(this.def.columns.filter((c) => c.defaultHidden).map((c) => c.key)));
    }
  }
  onLayout(ev: { order: string[]; hidden: string[] }): void {
    this.order.set(ev.order);
    this.hidden.set(new Set(ev.hidden));
    try { localStorage.setItem(this.storageKey(), JSON.stringify(ev)); } catch { /* noop */ }
  }
  /** Direct drag-reorder on the table headers (mirrors the legacy app). Reorders
   *  the visible columns, keeps hidden ones, and persists like the customizer. */
  dropHeader(ev: CdkDragDrop<unknown>): void {
    if (ev.previousIndex === ev.currentIndex) return;
    const vis = this.visibleColumns().map((c) => c.key);
    moveItemInArray(vis, ev.previousIndex, ev.currentIndex);
    const hiddenKeys = this.order().filter((k) => this.hidden().has(k));
    this.onLayout({ order: [...vis, ...hiddenKeys], hidden: [...this.hidden()] });
  }
  resetLayout(): void {
    try { localStorage.removeItem(this.storageKey()); } catch { /* noop */ }
    this.order.set(this.def.columns.map((c) => c.key));
    this.hidden.set(new Set(this.def.columns.filter((c) => c.defaultHidden).map((c) => c.key)));
  }

  // ── table helpers ────────────────────────────────────────────────────
  firstCol(): string { return this.visibleColumns()[0]?.key ?? ''; }

  // ── expandable tree helpers ──────────────────────────────────────────
  lvl(r: Row): number { return Number(r['__level']) || 0; }
  isExpanded(r: Row): boolean { return this.expanded().has(String(r['__key'])); }
  toggleRow(r: Row): void {
    if (!this.isTree() || this.lvl(r) !== 0) return;
    const key = String(r['__key']);
    const next = new Set(this.expanded());
    if (next.has(key)) next.delete(key); else next.add(key);
    this.expanded.set(next);
  }
  expandAll(): void {
    this.expanded.set(new Set((this.rows() as Row[])
      .filter((r) => Number(r['__level']) === 0).map((r) => String(r['__key']))));
  }
  collapseAll(): void { this.expanded.set(new Set()); }

  // ── row drill-down — per-order reports open that order's detail page ──
  /** A row is drillable only when the report declares it and the id is real. */
  canDrill(r: Row): boolean {
    const d = this.def.drilldown;
    if (!d) return false;
    return Number(r[d.rowKey]) > 0;
  }
  drillTitle(): string {
    const d = this.def.drilldown;
    if (!d) return '';
    return (this.ar() ? d.titleAr : d.titleEn) ?? (this.ar() ? 'عرض تفاصيل الأوردر' : 'Open order details');
  }
  /**
   * One handler for both behaviours: a day/parent row in a tree expands,
   * anything else drills through when the report opted in.
   */
  onRowClick(r: Row): void {
    if (this.isTree() && this.lvl(r) === 0) { this.toggleRow(r); return; }
    const d = this.def.drilldown;
    if (!d || !this.canDrill(r)) return;
    void this.router.navigate([d.route], { queryParams: { [d.param]: r[d.rowKey] } });
  }

  // ── Merged (rowspan) column — e.g. the date on date×category totals so it
  //    isn't repeated. Only active when the merge column is visible. ──
  mergeColKey(): string {
    const mc = this.def.mergeColumn;
    return mc && !this.hidden().has(mc) ? mc : '';
  }
  hasMerge(): boolean { return !!this.mergeColKey(); }
  isMergeStart(i: number): boolean {
    const mc = this.mergeColKey();
    if (!mc || i <= 0) return true;
    const rows = this.pagedRows();
    return String(rows[i]?.[mc] ?? '') !== String(rows[i - 1]?.[mc] ?? '');
  }
  mergeSpan(i: number): number {
    const mc = this.mergeColKey();
    if (!mc) return 1;
    const rows = this.pagedRows();
    const v = String(rows[i]?.[mc] ?? '');
    let n = 1;
    while (i + n < rows.length && String(rows[i + n]?.[mc] ?? '') === v) n++;
    return n;
  }
  hasTotals(): boolean { return this.def.columns.some((c) => !!c.totalKey) && Object.keys(this.totals()).length > 0; }
  isNumeric(c: ReportColumn): boolean { return c.type === 'money' || c.type === 'number' || c.type === 'int' || !!c.alignEnd; }

  reload(): void {
    if (!this.filter.canFetch()) return;
    const body: SalesReportFilter = {
      fromDate: this.filter.fromDate(),
      toDate: this.filter.toDate(),
      branchId: this.filter.branchId(),
      ordersFilter: this.ordersFilter(),
      ...this.extraFilters(),
      ...(this.def.requestExtra ?? {}),
    };
    // Selected branch names (en + ar) — used to drop "Call Center" rows the
    // API leaks into every branch's results. Reading the branches signal makes
    // this load effect re-run once the list arrives; wait for it (null = still
    // loading) so the filter applies on the FIRST fetch (no unfiltered flash).
    // On load error the service sets [], which unblocks (filter simply no-ops).
    const branchList = this.branches.branches();
    if (branchList == null) return;
    const b = branchList.find((x) => x.id === this.filter.branchId());
    const branchNames = b ? [b.name_En, b.name_Ar].filter((n): n is string => !!n) : [];

    this.loading.set(true);
    this.error.set('');
    this.api.run(this.def.endpoint, body, {
      rowsKey: this.def.rowsKey, totalsKey: this.def.totalsKey, transform: this.def.transform,
      branchNames, branchId: this.filter.branchId(), mergeByDate: this.def.mergeByDate,
    }).pipe(
      catchError((err) => {
        this.error.set(err?.error?.message || err?.message || 'Failed to load report.');
        return of<SalesReportResult>({ rows: [], totals: {} });
      }),
      finalize(() => this.loading.set(false)),
    ).subscribe((res) => this.result.set(res));
  }

  fmt(v: unknown, c: ReportColumn): string {
    if (v === null || v === undefined || v === '') return c.type === 'money' || c.type === 'number' || c.type === 'int' ? '0' : '—';
    if (c.dashIfZero && String(v).trim() === '0') return '—';
    // Date columns: drop any time component (e.g. 2026-06-10T00:00:00 → 2026-06-10).
    if (c.type === 'date') return String(v).trim().split('T')[0].split(' ')[0];
    if (c.type === 'money' || c.type === 'number') {
      const n = Number(v); return Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(v);
    }
    if (c.type === 'int') { const n = Number(v); return Number.isFinite(n) ? n.toLocaleString() : String(v); }
    // Category-like text columns hold server values that stay English in Arabic
    // mode (e.g. transaction / payment-status / pay-way) → localise them.
    if (c.type === 'text' && I18N_TEXT_KEYS.has(c.key)) {
      const s = String(v);
      return dataValueLabel(s, s, this.lang.language());
    }
    return String(v);
  }

  // ── export / print ───────────────────────────────────────────────────
  /** Narrow thermal-receipt paper (vs A4 / Excel)? */
  private isReceipt(paper: ExportPaper): boolean {
    return paper === 'pos72' || paper === 'pos80' || paper === 'flash';
  }
  /**
   * Columns for a given paper. A4 / Excel → every visible column. The thermal
   * receipt → the report's curated `receiptColumns` (the short legacy layout)
   * when defined, else the visible columns auto-capped to what fits the roll
   * (leading identity columns + the Net/Total column).
   */
  private colsForPaper(paper: ExportPaper): ReportColumn[] {
    if (!this.isReceipt(paper)) return this.visibleColumns();
    const rc = this.def.receiptColumns;
    if (rc && rc.length) {
      return rc
        .map((r) => {
          const base = this.colByKey().get(r.key);
          if (!base) return null;
          const ml = r.maxLen ?? base.maxLen;
          return { ...base, labelEn: r.en ?? base.labelEn, labelAr: r.ar ?? base.labelAr, ...(ml != null ? { maxLen: ml } : {}) };
        })
        .filter((c): c is ReportColumn => !!c);
    }
    const vis = this.visibleColumns();
    const max = paper === 'pos72' ? 5 : 6;
    if (vis.length <= max) return vis;
    const isKey = (c: ReportColumn) => /\bnet\b|الصاف|\btotal\b|الإجمال|الاجمال/i.test(`${c.labelEn}|${c.labelAr}`);
    const keyCol = [...vis].reverse().find((c) => this.isNumeric(c) && isKey(c));
    const base = vis.slice(0, keyCol ? max - 1 : max);
    return keyCol && !base.includes(keyCol) ? [...base, keyCol] : base;
  }
  private exportColsFrom(cols: ReportColumn[]): ExportColumn<Row>[] {
    return cols.map((c) => ({
      headerEn: c.labelEn,
      headerAr: c.labelAr,
      numeric: this.isNumeric(c),
      width: c.width ?? (this.isNumeric(c) ? 12 : 16),
      key: c.key,
      value: (r: Row) => this.clampLen(this.fmt(r[c.key], c), c.maxLen),
    }));
  }
  /** Truncate long text to `n` chars + "…" (used on the narrow receipt columns). */
  private clampLen(v: string | number | null | undefined, n?: number): string | number | null | undefined {
    if (!n || typeof v !== 'string') return v;
    const s = v.trim();
    return s.length > n ? `${s.slice(0, n)}…` : s;
  }
  private exportFooterFrom(cols: ReportColumn[]): (string | number | null)[] | undefined {
    if (!this.hasTotals()) return undefined;
    return cols.map((c, i) =>
      c.totalKey ? this.fmt(this.totals()[c.totalKey], c) : (i === 0 ? (this.ar() ? 'الإجمالي' : 'Total') : ''));
  }
  /** Cash/Visa/Ledge/Other + Net summary from the report's paymentSummary config. */
  private receiptPaymentTotals(): { label: string; value: string; emphasize?: boolean }[] {
    const ps = this.def.paymentSummary;
    if (!ps) return [];
    const t = this.totals();
    const ar = this.ar();
    const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
    const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const out: { label: string; value: string; emphasize?: boolean }[] =
      ps.rows.map((r) => ({ label: ar ? r.labelAr : r.labelEn, value: money(num(t[r.totalKey])) }));
    const net = t['net'] != null ? num(t['net']) : ps.rows.reduce((a, r) => a + num(t[r.totalKey]), 0);
    out.push({ label: ar ? 'الصافي' : 'Net', value: money(net), emphasize: true });
    return out;
  }
  /**
   * Receipt totals block. Curated `receiptTotals` win (e.g. Cash/Visa/Ledge/Net
   * on the cashier daily report); else, when the report has curated
   * `receiptColumns`, return [] so the receipt sums its own numeric columns
   * (SubTotal/Service/Tax/Discount/Net…); else the payment summary.
   */
  private receiptTotalsFor(paper: ExportPaper): { label: string; value: string; emphasize?: boolean }[] {
    if (!this.isReceipt(paper)) return this.receiptPaymentTotals();
    const rt = this.def.receiptTotals;
    if (rt && rt.length) {
      const t = this.totals();
      const ar = this.ar();
      const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
      const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return rt.map((r) => ({ label: ar ? r.ar : r.en, value: money(num(t[r.key])), emphasize: r.emphasize }));
    }
    if (this.def.receiptColumns?.length) return [];
    return this.receiptPaymentTotals();
  }
  private exportMeta(paper: ExportPaper, cols: ReportColumn[]): ExportMeta {
    const b = this.branches.findById(this.filter.branchId());
    return {
      titleEn: this.def.titleEn, titleAr: this.def.titleAr,
      subtitleEn: this.def.subtitleEn, subtitleAr: this.def.subtitleAr,
      branch: b ? (this.ar() ? (b.name_Ar || b.name_En) : (b.name_En || b.name_Ar)) : null,
      fromDate: this.filter.fromDate(), toDate: this.filter.toDate(),
      lang: this.ar() ? 'ar' : 'en',
      fileBase: this.def.id,
      paper,
      footer: this.exportFooterFrom(cols),
      appliedFilters: this.appliedFilters(),
      paymentTotals: this.receiptTotalsFor(paper),
      summary: this.buildSummary(),
    };
  }

  /** The bottom Summary (financial figures strip + payment split) for exports —
   *  same content as the on-screen payment-summary-bar. Built for EVERY report
   *  that has total columns: the figures strip is derived from the report's own
   *  money totals; the payment split is added only when the report defines a
   *  paymentSummary config (the per-payway rows). */
  private buildSummary(): ExportMeta['summary'] {
    if (!this.hasTotals()) return undefined;
    const t = this.totals();
    const ar = this.ar();
    const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
    const m = (v: unknown) => num(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const tenders = new Set(['cash', 'visa', 'otherPayment', 'paymentAmount']);
    const figs = this.def.columns
      .filter((c) => !!c.totalKey && (c.type ?? 'text') === 'money' && !tenders.has(c.totalKey!))
      .map((c) => ({ key: c.key, label: ar ? c.labelAr : c.labelEn, value: num(t[c.totalKey!]), emphasize: c.key === 'net' || c.key === 'total' }));
    const ordered = [...figs.filter((f) => f.key !== 'net'), ...figs.filter((f) => f.key === 'net')];
    const figures = ordered.map((f) => ({ label: f.label, value: m(f.value), emphasize: f.emphasize }));
    const cfg = this.def.paymentSummary;
    const payways = cfg
      ? cfg.rows
          .map((r) => ({ payway: ar ? r.labelAr : r.labelEn, total: num(t[r.totalKey]), always: !!r.always }))
          .filter((r) => r.total !== 0 || r.always)
          .map((r) => ({ payway: r.payway, total: m(r.total), net: m(r.total) }))
      : [];
    if (!figures.length && !payways.length) return undefined;
    return { figures, payways };
  }

  exportExcel(): void {
    this.menu.set(null);
    if (!this.rows().length) return;
    const cols = this.colsForPaper('a4');
    this.exp.excel(this.rows() as Row[], this.exportColsFrom(cols), this.exportMeta('a4', cols));
  }
  /** Direct one-click PDF *file* download (no print dialog). */
  async exportPdf(): Promise<void> {
    this.menu.set(null);
    if (!this.rows().length || this.pdfBusy()) return;
    this.pdfBusy.set(true);
    const cols = this.colsForPaper('a4');
    try { await this.exp.pdfDownload(this.rows() as Row[], this.exportColsFrom(cols), this.exportMeta('a4', cols)); }
    finally { this.pdfBusy.set(false); }
  }
  print(paper: ExportPaper): void {
    this.menu.set(null);
    if (!this.rows().length) return;
    const cols = this.colsForPaper(paper);
    this.exp.pdf(this.rows() as Row[], this.exportColsFrom(cols), this.exportMeta(paper, cols));
  }
  flash(): void { this.print('flash'); }
}
