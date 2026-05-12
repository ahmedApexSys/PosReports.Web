import {
  Component,
  Input,
  ContentChild,
  ViewChild,
  TemplateRef,
  inject,
  signal,
  effect,
  ChangeDetectionStrategy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Loader, RefreshCw, Building2 } from 'lucide-angular';
import { Observable, catchError, finalize, of } from 'rxjs';
import { LanguageService } from '../../core/i18n/language.service';
import { FilterService } from '../../core/filters/filter.service';
import { AuditPageContext } from '../../core/models/audit.models';
import { AuditFilterBarComponent } from '../audit-filter-bar/audit-filter-bar.component';
import { PagerComponent } from '../pager/pager.component';

/**
 * Page shell for the audit-narrative endpoints. Owns:
 *  - Page header (title + Refresh)
 *  - GroupBy + PageSize selectors
 *  - <app-audit-filter-bar> with every page-local filter dimension
 *    (transaction types, payment status, surfaces, user, action types,
 *     search text)
 *  - Loading / empty / error states
 *  - Bilingual conclusion banner above the projected body
 *  - <app-pager> below the body (visible when the response is paginated)
 *
 * Generic on `<T>`: each route's body template is supplied via content
 * projection (`<ng-template #body let-data>...</ng-template>`) so the
 * route-specific result shape renders inside.
 *
 * Filter ownership:
 *  - Global filters (branch, date range, language) come from FilterService
 *  - Page-local filters (groupBy, pageSize, page) live here as signals
 *  - Filter-bar filters (user, trx-types, etc.) live on AuditFilterBarComponent
 *    and are read on each fetch via @ViewChild
 *
 * Pagination — when the operator changes filters, page resets to 1 so
 * they don't sit on "page 25" of stale results.
 */
@Component({
  selector: 'app-audit-report-page',
  standalone: true,
  imports: [
    CommonModule, FormsModule, LucideAngularModule,
    AuditFilterBarComponent, PagerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Page header -->
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">
            {{ lang.language() === 'ar' ? titleAr : titleEn }}
          </h1>
          <p *ngIf="subtitleEn || subtitleAr"
             class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {{ lang.language() === 'ar' ? (subtitleAr || subtitleEn) : (subtitleEn || subtitleAr) }}
          </p>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <label *ngIf="showGroupBy" class="flex items-center gap-1.5 text-xs">
            <span class="text-slate-500 dark:text-slate-400">{{ lang.language() === 'ar' ? 'تجميع' : 'Group' }}:</span>
            <select [ngModel]="groupBy()" (ngModelChange)="groupBy.set($event); onPageLocalChange()"
                    class="bg-white dark:bg-surface-dark-subtle border border-slate-300 dark:border-slate-700
                           rounded-card-sm px-2 py-1 text-xs text-slate-700 dark:text-slate-200
                           focus:ring-2 focus:ring-brand-500/30 focus:outline-none">
              <option value="None">{{ lang.language() === 'ar' ? 'بدون' : 'None' }}</option>
              <option value="Daily">{{ lang.language() === 'ar' ? 'يومي' : 'Daily' }}</option>
              <option value="Weekly">{{ lang.language() === 'ar' ? 'أسبوعي' : 'Weekly' }}</option>
              <option value="Monthly">{{ lang.language() === 'ar' ? 'شهري' : 'Monthly' }}</option>
            </select>
          </label>

          <label *ngIf="showPageSize" class="flex items-center gap-1.5 text-xs">
            <span class="text-slate-500 dark:text-slate-400">{{ lang.language() === 'ar' ? 'لكل صفحة' : 'Per page' }}:</span>
            <select [ngModel]="pageSize()" (ngModelChange)="pageSize.set(+$event); onPageLocalChange()"
                    class="bg-white dark:bg-surface-dark-subtle border border-slate-300 dark:border-slate-700
                           rounded-card-sm px-2 py-1 text-xs text-slate-700 dark:text-slate-200
                           focus:ring-2 focus:ring-brand-500/30 focus:outline-none">
              <option [ngValue]="25">25</option>
              <option [ngValue]="50">50</option>
              <option [ngValue]="100">100</option>
              <option [ngValue]="200">200</option>
            </select>
          </label>

          <button (click)="reload()" class="btn-ghost text-sm"
                  [disabled]="loading() || !filter.canFetch()">
            <lucide-icon [img]="loading() ? Loader : RefreshIcon"
                         class="h-4 w-4"
                         [class.animate-spin]="loading()"></lucide-icon>
            {{ lang.language() === 'ar' ? 'تحديث' : 'Refresh' }}
          </button>
        </div>
      </div>

      <!-- Filter bar — hide when caller passes [showFilterBar]="false" (e.g. OrderJourney / UserSession) -->
      <app-audit-filter-bar #filterBar *ngIf="showFilterBar"
        (filtersChange)="onFilterBarChange()"></app-audit-filter-bar>

      <!-- Empty state: branch not selected or dates invalid -->
      <div *ngIf="!filter.canFetch()" class="card-padded text-center py-12 md:py-16 space-y-4">
        <div class="inline-flex h-14 w-14 items-center justify-center rounded-2xl
                    bg-warning-soft text-warning ring-1 ring-warning/30">
          <lucide-icon [img]="BuildingIcon" class="h-7 w-7"></lucide-icon>
        </div>
        <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-50">
          {{ filter.validateBilingual(lang.language() === 'ar' ? 'ar' : 'en') }}
        </h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          {{ lang.language() === 'ar'
              ? 'مفيش بيانات هتظهر قبل ما تختار فرع وفترة زمنية صالحة من الـ Header.'
              : 'No data will load until a branch and a valid date range are selected in the header.' }}
        </p>
      </div>

      <!-- Skeleton state -->
      <div *ngIf="filter.canFetch() && loading() && !data()" class="space-y-4 md:space-y-6">
        <div class="card-padded animate-pulse h-24">
          <div class="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div class="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded mt-3"></div>
          <div class="h-4 w-2/3 bg-slate-200 dark:bg-slate-700 rounded mt-2"></div>
        </div>
        <div class="card-padded animate-pulse h-64">
          <div class="h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div class="h-48 w-full bg-slate-200 dark:bg-slate-700 rounded mt-4"></div>
        </div>
      </div>

      <!-- Loaded state -->
      <ng-container *ngIf="filter.canFetch() && !loading()">
        <div *ngIf="error()" class="card-padded ring-1 ring-critical/30 bg-critical-soft text-critical">
          <strong>{{ lang.language() === 'ar' ? 'خطأ:' : 'Error:' }}</strong> {{ error() }}
        </div>

        <ng-container *ngIf="data() as d">
          <div *ngIf="conclusionText(d) as ct"
               class="card-padded bg-brand-50 dark:bg-brand-900/20 ring-1 ring-brand-200 dark:ring-brand-800/50">
            <h3 class="text-sm font-semibold text-brand-700 dark:text-brand-300 mb-1">
              {{ lang.language() === 'ar' ? 'الخلاصة' : 'Conclusion' }}
            </h3>
            <p class="text-sm text-slate-700 dark:text-slate-200">{{ ct }}</p>
          </div>

          <ng-container *ngIf="bodyTpl">
            <ng-container *ngTemplateOutlet="bodyTpl; context: { $implicit: d }"></ng-container>
          </ng-container>

          <div *ngIf="!bodyTpl" class="card-padded">
            <h3 class="text-sm font-semibold mb-2">{{ lang.language() === 'ar' ? 'البيانات' : 'Data' }}</h3>
            <pre class="text-xs overflow-auto max-h-96 text-slate-600 dark:text-slate-300">{{ d | json }}</pre>
          </div>

          <!-- Pagination — auto-hides when totalCount <= pageSize -->
          <app-pager *ngIf="totalCountOf(d) > 0"
            [page]="page()"
            [pageSize]="pageSize()"
            [totalCount]="totalCountOf(d)"
            (pageChange)="onPageChange($event)"></app-pager>
        </ng-container>
      </ng-container>
    </div>
  `,
})
export class AuditReportPageComponent<T> implements OnInit {
  @Input({ required: true }) titleEn!: string;
  @Input({ required: true }) titleAr!: string;
  @Input() subtitleEn?: string;
  @Input() subtitleAr?: string;
  @Input({ required: true }) fetchFn!: (ctx: AuditPageContext) => Observable<T>;
  @Input() showGroupBy = true;
  @Input() showPageSize = true;
  @Input() showFilterBar = true;
  @Input() defaultGroupBy: 'None' | 'Daily' | 'Weekly' | 'Monthly' = 'Daily';
  @Input() defaultPageSize = 50;

  @ContentChild('body', { read: TemplateRef })
  bodyTpl?: TemplateRef<{ $implicit: T }>;

  @ViewChild('filterBar') filterBar?: AuditFilterBarComponent;

  readonly lang = inject(LanguageService);
  readonly filter = inject(FilterService);

  readonly data = signal<T | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly groupBy = signal<'None' | 'Daily' | 'Weekly' | 'Monthly'>('Daily');
  readonly pageSize = signal<number>(50);
  readonly page = signal<number>(1);

  readonly Loader = Loader;
  readonly RefreshIcon = RefreshCw;
  readonly BuildingIcon = Building2;

  constructor() {
    effect(() => {
      const ok = this.filter.canFetch();
      this.groupBy();
      this.pageSize();
      this.page();
      if (ok) this.reload();
      else this.data.set(null);
    });
  }

  ngOnInit(): void {
    this.groupBy.set(this.defaultGroupBy);
    this.pageSize.set(this.defaultPageSize);
    if (this.filter.canFetch()) this.reload();
  }

  /** GroupBy / PageSize change → reset to page 1 + reload. */
  onPageLocalChange(): void {
    this.page.set(1);
    // setting `page` already triggers the effect, which fires reload()
  }

  /** Filter-bar emits whenever ANY of its dimensions changes. */
  onFilterBarChange(): void {
    this.page.set(1);
    this.reload();
  }

  /** Pager emits when the user navigates. */
  onPageChange(p: number): void {
    this.page.set(p);
    // setting `page` triggers the effect → reload
  }

  reload(): void {
    if (!this.filter.canFetch()) {
      this.error.set(this.filter.validateBilingual(this.lang.language() === 'ar' ? 'ar' : 'en'));
      return;
    }
    const ctx: AuditPageContext = {
      fromDate: this.filter.fromDate(),
      toDate: this.filter.toDate(),
      branchId: this.filter.branchId(),
      language: this.lang.language(),
      groupBy: this.groupBy(),
      page: this.page(),
      pageSize: this.pageSize(),
      // ── Filter-bar dimensions (when bar is mounted) ───────────────
      transactionTypes: this.filterBar?.transactionTypes(),
      paymentStatus:    this.filterBar?.paymentStatus(),
      surfaces:         this.filterBar?.surfaces(),
      userIds:          this.filterBar?.userId() ? [this.filterBar!.userId()!] : undefined,
      actionTypes:      this.filterBar?.actionTypes(),
      searchText:       this.filterBar?.searchText() || undefined,
    };
    this.loading.set(true);
    this.error.set('');
    this.fetchFn(ctx).pipe(
      catchError((err) => {
        const msg = err?.error?.message
                 || err?.error?.title
                 || err?.error?.errors?.[0]
                 || err?.message
                 || 'Failed to load report.';
        this.error.set(msg);
        return of(null as T | null);
      }),
      finalize(() => this.loading.set(false)),
    ).subscribe((d) => {
      if (d) this.data.set(d);
    });
  }

  /** Pull a bilingual conclusion off the result if present. */
  conclusionText(d: unknown): string | null {
    const c = (d as { conclusion?: { description?: string } })?.conclusion;
    return c?.description?.trim() ? c.description : null;
  }

  /** Pull totalCount from a paged-result-shaped response (Daily / Trx). */
  totalCountOf(d: unknown): number {
    return (d as { totalCount?: number })?.totalCount ?? 0;
  }
}
