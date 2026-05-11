import {
  Component,
  Input,
  ContentChild,
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

/**
 * Page shell for the audit-narrative endpoints. Generic on `<T>`: each
 * route's body template is supplied via content projection
 * (`<ng-template #body let-data>...</ng-template>`) and renders the
 * route-specific result shape.
 *
 * Filter ownership:
 *  - Global filters (branch, date range, language) come from
 *    FilterService — owned by the layout shell, shared across pages.
 *  - Page-local filters (groupBy, pageSize) are owned HERE and rendered
 *    inline in the page header. They re-trigger the fetch on change.
 *
 * The shell does not assume one wire shape — each route's `fetchFn`
 * receives an `AuditPageContext` and returns its own typed response.
 * That keeps the OrderJourney / UserSession single-entity endpoints
 * and the per-tx-type ones happy with their distinct request DTOs.
 */
@Component({
  selector: 'app-audit-report-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Page header + filter bar -->
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
          <!-- GroupBy selector — hidden for endpoints that don't use it -->
          <label *ngIf="showGroupBy" class="flex items-center gap-1.5 text-xs">
            <span class="text-slate-500 dark:text-slate-400">{{ lang.language() === 'ar' ? 'تجميع' : 'Group' }}:</span>
            <select [ngModel]="groupBy()" (ngModelChange)="groupBy.set($event)"
                    class="bg-white dark:bg-surface-dark-subtle border border-slate-300 dark:border-slate-700
                           rounded-card-sm px-2 py-1 text-xs text-slate-700 dark:text-slate-200
                           focus:ring-2 focus:ring-brand-500/30 focus:outline-none">
              <option value="None">{{ lang.language() === 'ar' ? 'بدون' : 'None' }}</option>
              <option value="Daily">{{ lang.language() === 'ar' ? 'يومي' : 'Daily' }}</option>
              <option value="Weekly">{{ lang.language() === 'ar' ? 'أسبوعي' : 'Weekly' }}</option>
              <option value="Monthly">{{ lang.language() === 'ar' ? 'شهري' : 'Monthly' }}</option>
            </select>
          </label>

          <!-- PageSize selector — hidden for endpoints that don't paginate -->
          <label *ngIf="showPageSize" class="flex items-center gap-1.5 text-xs">
            <span class="text-slate-500 dark:text-slate-400">{{ lang.language() === 'ar' ? 'لكل صفحة' : 'Per page' }}:</span>
            <select [ngModel]="pageSize()" (ngModelChange)="pageSize.set(+$event)"
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
        <!-- Error banner -->
        <div *ngIf="error()" class="card-padded ring-1 ring-critical/30 bg-critical-soft text-critical">
          <strong>{{ lang.language() === 'ar' ? 'خطأ:' : 'Error:' }}</strong> {{ error() }}
        </div>

        <ng-container *ngIf="data() as d">
          <!-- Bilingual conclusion banner — render when the response has one -->
          <div *ngIf="conclusionText(d) as ct"
               class="card-padded bg-brand-50 dark:bg-brand-900/20 ring-1 ring-brand-200 dark:ring-brand-800/50">
            <h3 class="text-sm font-semibold text-brand-700 dark:text-brand-300 mb-1">
              {{ lang.language() === 'ar' ? 'الخلاصة' : 'Conclusion' }}
            </h3>
            <p class="text-sm text-slate-700 dark:text-slate-200">{{ ct }}</p>
          </div>

          <!-- Caller-supplied body -->
          <ng-container *ngIf="bodyTpl">
            <ng-container *ngTemplateOutlet="bodyTpl; context: { $implicit: d }"></ng-container>
          </ng-container>

          <!-- Fallback when caller didn't supply a body template -->
          <div *ngIf="!bodyTpl" class="card-padded">
            <h3 class="text-sm font-semibold mb-2">{{ lang.language() === 'ar' ? 'البيانات' : 'Data' }}</h3>
            <pre class="text-xs overflow-auto max-h-96 text-slate-600 dark:text-slate-300">{{ d | json }}</pre>
          </div>
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
  /** Build the per-endpoint request from the context + call the right API. */
  @Input({ required: true }) fetchFn!: (ctx: AuditPageContext) => Observable<T>;
  /** Hide the GroupBy selector for single-entity endpoints (OrderJourney, UserSession). */
  @Input() showGroupBy = true;
  /** Hide the PageSize selector for endpoints that don't paginate. */
  @Input() showPageSize = true;
  /** Initial defaults — override per route via @Input. */
  @Input() defaultGroupBy: 'None' | 'Daily' | 'Weekly' | 'Monthly' = 'Daily';
  @Input() defaultPageSize = 50;

  @ContentChild('body', { read: TemplateRef })
  bodyTpl?: TemplateRef<{ $implicit: T }>;

  readonly lang = inject(LanguageService);
  readonly filter = inject(FilterService);

  readonly data = signal<T | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  // Page-local filter signals — wired to the header dropdowns.
  readonly groupBy = signal<'None' | 'Daily' | 'Weekly' | 'Monthly'>('Daily');
  readonly pageSize = signal<number>(50);
  readonly page = signal<number>(1);

  readonly Loader = Loader;
  readonly RefreshIcon = RefreshCw;
  readonly BuildingIcon = Building2;

  constructor() {
    // Auto-reload whenever any input the request depends on changes —
    // global filter validity + page-local group/page selectors.
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
    // Honour the route's chosen defaults before the first fetch.
    this.groupBy.set(this.defaultGroupBy);
    this.pageSize.set(this.defaultPageSize);
    if (this.filter.canFetch()) this.reload();
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

  /**
   * Pull a bilingual conclusion off the result if the shape has one.
   * Phase 6 results consistently use `conclusion.description` (the
   * server-picked language). Returns null otherwise.
   */
  conclusionText(d: unknown): string | null {
    const c = (d as { conclusion?: { description?: string } })?.conclusion;
    return c?.description?.trim() ? c.description : null;
  }
}
