import {
  Component, inject, signal, effect, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideAngularModule, RefreshCw, Loader, Building2, Search, ListFilter,
} from 'lucide-angular';
import { catchError, finalize, of } from 'rxjs';
import { LanguageService } from '../../core/i18n/language.service';
import { FilterService } from '../../core/filters/filter.service';
import { MonitoringApi } from '../../core/api/monitoring.api';
import { OrderActionLogRow } from '../../core/models/monitoring.models';
import { OrderActionRowComponent } from '../../shared/order-action-row/order-action-row.component';
import { PagerComponent } from '../../shared/pager/pager.component';

type Mode = 'browse' | 'order' | 'receipt';

/**
 * Order Actions — every change on orders. Browse a branch+date window with
 * filters (transaction type, table, success), or drill into a single order
 * by Order # / Receipt # to see its full change history with before→after.
 */
@Component({
  selector: 'app-order-actions',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, OrderActionRowComponent, PagerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5">
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">
            {{ lang.language() === 'ar' ? 'حركات الأوردرات' : 'Order Actions' }}
          </h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {{ lang.language() === 'ar'
                ? 'كل تعديل على الأوردر — مع الحالة قبل وبعد كل خطوة.'
                : 'Every order mutation — with the before/after state of each step.' }}
          </p>
        </div>
        <button (click)="run()" class="btn-ghost text-sm" [disabled]="loading() || !canRun()">
          <lucide-icon [img]="loading() ? LoaderIcon : RefreshIcon" class="h-4 w-4" [class.animate-spin]="loading()"></lucide-icon>
          {{ lang.language() === 'ar' ? 'تحديث' : 'Refresh' }}
        </button>
      </div>

      <!-- Mode + filters -->
      <div class="card-padded space-y-3">
        <div class="inline-flex rounded-card-sm ring-1 ring-slate-200 dark:ring-slate-700 overflow-hidden">
          <button *ngFor="let m of modes" type="button" (click)="setMode(m.key)"
                  class="px-3 py-1.5 text-xs font-medium transition-colors"
                  [class.bg-brand-600]="mode() === m.key" [class.text-white]="mode() === m.key"
                  [class.text-slate-600]="mode() !== m.key" [class.dark:text-slate-300]="mode() !== m.key">
            {{ lang.language() === 'ar' ? m.ar : m.en }}
          </button>
        </div>

        <!-- Browse filters -->
        <div *ngIf="mode() === 'browse'" class="flex flex-wrap items-center gap-2">
          <!-- Transaction-type tabs (consistent with the Live Feed) -->
          <div class="inline-flex rounded-card-sm ring-1 ring-slate-200 dark:ring-slate-700 overflow-hidden">
            <button *ngFor="let t of txTabs" type="button" (click)="setTrx(t.id)"
                    class="px-3 py-1.5 text-xs font-medium transition-colors"
                    [class.bg-brand-600]="trxType() === t.id" [class.text-white]="trxType() === t.id"
                    [class.text-slate-600]="trxType() !== t.id" [class.dark:text-slate-300]="trxType() !== t.id">
              {{ lang.language() === 'ar' ? t.ar : t.en }}
            </button>
          </div>
          <div class="relative min-w-[150px]">
            <lucide-icon [img]="FilterIcon" class="absolute start-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"></lucide-icon>
            <input type="text" [(ngModel)]="tableText" (keyup.enter)="applyTable()"
                   class="w-full ps-8 pe-2 py-1.5 text-sm rounded-card-sm bg-slate-50 dark:bg-surface-dark-muted border-0 focus:ring-2 focus:ring-brand-500/30"
                   [placeholder]="lang.language() === 'ar' ? 'اسم طاولة (Enter)' : 'Table name (Enter)'"/>
          </div>
          <select [ngModel]="successFilter()" (ngModelChange)="setSuccess($event)"
                  class="bg-white dark:bg-surface-dark-subtle border border-slate-300 dark:border-slate-700 rounded-card-sm px-2 py-1.5 text-xs">
            <option value="all">{{ lang.language() === 'ar' ? 'الكل' : 'All' }}</option>
            <option value="ok">{{ lang.language() === 'ar' ? 'ناجح' : 'Success' }}</option>
            <option value="fail">{{ lang.language() === 'ar' ? 'فشل' : 'Failed' }}</option>
          </select>
          <select [ngModel]="pageSize()" (ngModelChange)="setPageSize(+$event)"
                  class="bg-white dark:bg-surface-dark-subtle border border-slate-300 dark:border-slate-700 rounded-card-sm px-2 py-1.5 text-xs">
            <option [ngValue]="25">25</option><option [ngValue]="50">50</option>
            <option [ngValue]="100">100</option><option [ngValue]="200">200</option>
          </select>
        </div>

        <!-- Order # lookup -->
        <div *ngIf="mode() === 'order'" class="flex items-center gap-2">
          <input type="number" [(ngModel)]="orderIdText" (keyup.enter)="run()"
                 class="w-40 px-3 py-1.5 text-sm rounded-card-sm bg-slate-50 dark:bg-surface-dark-muted border-0 focus:ring-2 focus:ring-brand-500/30"
                 [placeholder]="lang.language() === 'ar' ? 'رقم الأوردر' : 'Order ID'"/>
          <button (click)="run()" class="btn-ghost text-sm" [disabled]="!filter.hasBranch()">
            <lucide-icon [img]="SearchIcon" class="h-4 w-4"></lucide-icon>{{ lang.language() === 'ar' ? 'بحث' : 'Go' }}
          </button>
        </div>

        <!-- Receipt # lookup -->
        <div *ngIf="mode() === 'receipt'" class="flex items-center gap-2">
          <input type="number" [(ngModel)]="receiptText" (keyup.enter)="run()"
                 class="w-48 px-3 py-1.5 text-sm rounded-card-sm bg-slate-50 dark:bg-surface-dark-muted border-0 focus:ring-2 focus:ring-brand-500/30"
                 [placeholder]="lang.language() === 'ar' ? 'رقم الإيصال' : 'Receipt number'"/>
          <button (click)="run()" class="btn-ghost text-sm" [disabled]="!filter.hasBranch()">
            <lucide-icon [img]="SearchIcon" class="h-4 w-4"></lucide-icon>{{ lang.language() === 'ar' ? 'بحث' : 'Go' }}
          </button>
        </div>
      </div>

      <!-- Gate -->
      <div *ngIf="mode() === 'browse' && !filter.canFetch()" class="card-padded text-center py-12 space-y-3">
        <div class="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-warning-soft text-warning">
          <lucide-icon [img]="BuildingIcon" class="h-6 w-6"></lucide-icon>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400">{{ filter.validateBilingual(lang.language()) }}</p>
      </div>
      <div *ngIf="mode() !== 'browse' && !filter.hasBranch()" class="card-padded text-center py-12 text-sm text-slate-500">
        {{ lang.language() === 'ar' ? 'اختر فرع أولاً.' : 'Select a branch first.' }}
      </div>

      <!-- Skeleton / error / list -->
      <div *ngIf="loading() && !rows().length" class="space-y-2">
        <div *ngFor="let i of [1,2,3,4]" class="card-padded animate-pulse h-16"></div>
      </div>
      <div *ngIf="error()" class="card-padded ring-1 ring-critical/30 bg-critical-soft text-critical">
        <strong>{{ lang.language() === 'ar' ? 'خطأ:' : 'Error:' }}</strong> {{ error() }}
      </div>

      <ng-container *ngIf="!error() && started()">
        <div *ngIf="!loading() && !rows().length" class="card-padded text-center py-12 text-sm text-slate-500">
          {{ lang.language() === 'ar' ? 'مفيش حركات مطابقة.' : 'No matching actions.' }}
        </div>
        <div class="space-y-1.5">
          <app-order-action-row *ngFor="let r of rows()" [row]="r"></app-order-action-row>
        </div>
        <app-pager *ngIf="mode() !== 'receipt'"
                   [page]="page()" [pageSize]="pageSize()" [totalCount]="totalCount()"
                   (pageChange)="setPage($event)"></app-pager>
      </ng-container>
    </div>
  `,
})
export class OrderActionsComponent {
  readonly lang = inject(LanguageService);
  readonly filter = inject(FilterService);
  private readonly api = inject(MonitoringApi);

  readonly rows = signal<OrderActionLogRow[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly started = signal(false);

  readonly mode = signal<Mode>('browse');
  readonly trxType = signal<number | null>(null);
  readonly tableName = signal('');
  readonly successFilter = signal<'all' | 'ok' | 'fail'>('all');
  readonly page = signal(1);
  readonly pageSize = signal(50);

  tableText = '';
  orderIdText: number | null = null;
  receiptText: number | null = null;

  readonly modes: { key: Mode; en: string; ar: string }[] = [
    { key: 'browse', en: 'Browse', ar: 'تصفّح' },
    { key: 'order', en: 'By Order #', ar: 'برقم الأوردر' },
    { key: 'receipt', en: 'By Receipt #', ar: 'برقم الإيصال' },
  ];

  /** Transaction-type tabs for browse mode (id maps to the server's TransactionType). */
  readonly txTabs: { id: number | null; en: string; ar: string }[] = [
    { id: null, en: 'All types', ar: 'كل الأنواع' },
    { id: 1, en: 'Dine-In', ar: 'صالة' },
    { id: 2, en: 'Delivery', ar: 'دليفري' },
    { id: 3, en: 'Take-away', ar: 'تيك أواي' },
  ];

  readonly RefreshIcon = RefreshCw;
  readonly LoaderIcon = Loader;
  readonly BuildingIcon = Building2;
  readonly SearchIcon = Search;
  readonly FilterIcon = ListFilter;

  constructor() {
    // Browse mode is reactive to global filters + page-local filters.
    effect(() => {
      const browse = this.mode() === 'browse';
      const ok = this.filter.canFetch();
      this.trxType(); this.tableName(); this.successFilter(); this.page(); this.pageSize();
      if (browse && ok) this.loadBrowse();
      else if (browse && !ok) { this.rows.set([]); this.started.set(false); }
    });
  }

  canRun(): boolean {
    return this.mode() === 'browse' ? this.filter.canFetch() : this.filter.hasBranch();
  }

  setMode(m: Mode): void {
    this.mode.set(m);
    this.rows.set([]); this.totalCount.set(0); this.error.set(''); this.started.set(false);
  }
  setTrx(v: number | null): void { this.page.set(1); this.trxType.set(v); }
  setSuccess(v: 'all' | 'ok' | 'fail'): void { this.page.set(1); this.successFilter.set(v); }
  setPageSize(n: number): void { this.page.set(1); this.pageSize.set(n); }
  setPage(p: number): void { this.page.set(p); }
  applyTable(): void { this.page.set(1); this.tableName.set(this.tableText.trim()); }

  /** Manual trigger — used by lookups + the Refresh button. */
  run(): void {
    if (this.mode() === 'browse') { this.loadBrowse(); return; }
    if (!this.filter.hasBranch()) return;
    if (this.mode() === 'order') this.loadOrder();
    else this.loadReceipt();
  }

  private successOnly(): boolean | null {
    return this.successFilter() === 'all' ? null : this.successFilter() === 'ok';
  }

  private loadBrowse(): void {
    if (!this.filter.canFetch()) return;
    this.begin();
    this.api.orderByBranch({
      branchId: this.filter.branchId() as number,
      fromDate: this.filter.fromDate(), toDate: this.filter.toDate(),
      transactionType: this.trxType(), tableName: this.tableName() || null,
      successOnly: this.successOnly(), page: this.page(), pageSize: this.pageSize(),
    }).pipe(
      catchError((e) => { this.error.set(e?.message || 'Failed to load.'); return of(null); }),
      finalize(() => this.loading.set(false)),
    ).subscribe((res) => { if (res) { this.rows.set(res.data ?? []); this.totalCount.set(res.totalCount ?? 0); } });
  }

  private loadOrder(): void {
    const id = Number(this.orderIdText);
    if (!id || id <= 0) { this.error.set(this.lang.language() === 'ar' ? 'أدخل رقم أوردر صحيح.' : 'Enter a valid order ID.'); return; }
    this.begin();
    this.api.orderByOrderId(this.filter.branchId() as number, id, this.page(), this.pageSize()).pipe(
      catchError((e) => { this.error.set(e?.message || 'Failed to load.'); return of(null); }),
      finalize(() => this.loading.set(false)),
    ).subscribe((res) => { if (res) { this.rows.set(res.data ?? []); this.totalCount.set(res.totalCount ?? 0); } });
  }

  private loadReceipt(): void {
    const rc = Number(this.receiptText);
    if (!rc || rc <= 0) { this.error.set(this.lang.language() === 'ar' ? 'أدخل رقم إيصال صحيح.' : 'Enter a valid receipt number.'); return; }
    this.begin();
    this.api.orderByReceipt(this.filter.branchId() as number, rc).pipe(
      catchError((e) => { this.error.set(e?.message || 'Failed to load.'); return of(null); }),
      finalize(() => this.loading.set(false)),
    ).subscribe((res) => { if (res) { this.rows.set(res ?? []); this.totalCount.set((res ?? []).length); } });
  }

  private begin(): void { this.loading.set(true); this.error.set(''); this.started.set(true); }
}
