import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, of } from 'rxjs';
import { AuditApi } from '../../core/api/audit.api';
import { SalesReportApi } from '../../core/api/sales-report.api';
import {
  AuditPageContext,
  DailyDigestResult,
  toAuditFilterRequest,
} from '../../core/models/audit.models';
import { LanguageService } from '../../core/i18n/language.service';
import { FilterService } from '../../core/filters/filter.service';
import { AuditReportPageComponent } from '../../shared/audit-report-page/audit-report-page.component';

type Row = Record<string, unknown>;

/**
 * The daily summary as a way IN, not as a wall of numbers.
 *
 * <p>
 * It used to end at the day: a sentence, a net figure and a row of counters, with no way to ask
 * "which orders were those?". Every answer meant leaving for another report and rebuilding the
 * filters by hand.
 * </p>
 *
 * <p>
 * Now each day opens into its own orders, and each order opens into its full journey — days →
 * orders → one order, in one place. The counters stay because they are what tells you which day is
 * worth opening; the analytics the design also carried (a net trend chart, a per-day leak figure,
 * a biggest-movements panel) are deliberately not here — they were not asked for, and each would
 * have needed its own endpoint.
 * </p>
 */
@Component({
  selector: 'app-audit-digest',
  standalone: true,
  imports: [CommonModule, AuditReportPageComponent],
  template: `
    <app-audit-report-page
      titleEn="Daily Digest" titleAr="الموجز اليومي"
      subtitleEn="Each day, its orders, and where each order's money went"
      subtitleAr="كل يوم، وأوردراته، وفلوس كل أوردر راحت فين"
      [fetchFn]="fetch"
      [showGroupBy]="false"
      [showPageSize]="false"
      [showFilterBar]="false">
      <ng-template #body let-data>

        <section *ngFor="let d of data.days" class="card-padded">

          <!-- The day. Clicking it is the whole point of the page, so the row says so. -->
          <button type="button" (click)="toggleDay(d.date)"
            class="w-full text-start flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 class="text-sm font-bold text-slate-900 dark:text-slate-50">
                {{ d.date | date:'fullDate' }}
              </h3>
              <p class="text-sm text-slate-700 dark:text-slate-300 mt-1">
                {{ ar() ? d.story.descriptionAr : d.story.descriptionEn }}
              </p>
            </div>
            <span class="shrink-0 text-xs rounded-full px-2.5 py-1 border border-slate-200 dark:border-slate-700 text-slate-500">
              {{ isOpen(d.date) ? (ar() ? 'إخفاء الأوردرات' : 'Hide orders')
                                : (ar() ? 'اعرض أوردرات اليوم' : 'Show the day’s orders') }}
            </span>
          </button>

          <div class="flex flex-wrap gap-2 text-xs mt-3">
            <span class="pill-info">{{ ar() ? 'أوردرات' : 'Orders' }}: {{ d.uniqueOrders }}</span>
            <span class="pill-info">{{ ar() ? 'مستخدمون' : 'Users' }}: {{ d.uniqueUsers }}</span>
            <span class="pill-info">{{ ar() ? 'مدفوع' : 'Pays' }}: {{ d.pays }}</span>
            <span class="pill-warning" *ngIf="d.discounts">{{ ar() ? 'خصومات' : 'Discounts' }}: {{ d.discounts }}</span>
            <span class="pill-critical" *ngIf="d.voids">{{ ar() ? 'إلغاء أصناف' : 'Voids' }}: {{ d.voids }}</span>
            <span class="pill-critical" *ngIf="d.cancels">{{ ar() ? 'إلغاء أوردرات' : 'Cancels' }}: {{ d.cancels }}</span>
            <span class="pill-warning" *ngIf="d.editPays">{{ ar() ? 'تعديل دفع' : 'EditPays' }}: {{ d.editPays }}</span>
          </div>

          <!-- The day's orders, fetched only when the day is actually opened. -->
          <div *ngIf="isOpen(d.date)" class="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">

            <p *ngIf="isLoading(d.date)" class="text-sm text-slate-400 py-3">
              {{ ar() ? 'بنجيب أوردرات اليوم…' : 'Loading the day’s orders…' }}
            </p>

            <p *ngIf="error() && !isLoading(d.date)" class="text-sm text-red-600 dark:text-red-400 py-2">{{ error() }}</p>

            <div *ngIf="!isLoading(d.date) && ordersFor(d.date) as rows">
              <p *ngIf="!rows.length" class="text-sm text-slate-400 py-3">
                {{ ar() ? 'مفيش أوردرات في اليوم ده.' : 'No orders on this day.' }}
              </p>

              <button *ngFor="let o of rows" type="button" (click)="openOrder(o)"
                class="w-full text-start flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 mb-2 last:mb-0
                       hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <span class="flex items-baseline gap-2 flex-wrap min-w-0">
                  <span class="font-medium text-slate-900 dark:text-slate-100">
                    {{ ar() ? 'أوردر' : 'Order' }} <bdi>#{{ o['orderId'] }}</bdi>
                  </span>
                  <bdi class="text-xs text-slate-400">{{ o['orderTime'] }}</bdi>
                  <span class="text-xs text-slate-500">{{ o['transaction'] }}</span>
                  <span class="text-xs text-slate-500" *ngIf="o['tableName']">· {{ o['tableName'] }}</span>
                  <span class="text-xs text-slate-500" *ngIf="o['paymentStatus']">· {{ o['paymentStatus'] }}</span>
                </span>
                <bdi class="shrink-0 tabular-nums text-sm text-slate-700 dark:text-slate-200">
                  {{ money(o['total']) }}
                </bdi>
              </button>
            </div>
          </div>
        </section>

        <div *ngIf="!data.days?.length" class="card-padded text-center py-8 text-sm text-slate-500 dark:text-slate-400">
          {{ ar() ? 'مفيش أيام بنشاط في الفترة دي.' : 'No active days in this window.' }}
        </div>
      </ng-template>
    </app-audit-report-page>
  `,
})
export class AuditDigestComponent {
  private readonly api = inject(AuditApi);
  private readonly sales = inject(SalesReportApi);
  private readonly filter = inject(FilterService);
  private readonly router = inject(Router);
  readonly lang = inject(LanguageService);

  /** Which day is expanded. One at a time — two open days is two scroll positions to hold. */
  private readonly openDay = signal<string | null>(null);
  /** Orders already fetched, keyed by day, so re-opening a day costs nothing. */
  private readonly cache = signal<Record<string, Row[]>>({});
  protected readonly loading = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  readonly fetch = (ctx: AuditPageContext): Observable<DailyDigestResult> =>
    this.api.dailyDigest(toAuditFilterRequest(ctx));

  protected ar(): boolean { return this.lang.language() === 'ar'; }
  protected isOpen(date: string): boolean { return this.openDay() === this.key(date); }
  /** The rows carry a full timestamp; the signals hold the day. Compare like with like. */
  protected isLoading(date: string): boolean { return this.loading() === this.key(date); }
  protected ordersFor(date: string): Row[] | null { return this.cache()[this.key(date)] ?? null; }

  /** The digest sends a full timestamp; the orders query wants the day. */
  private key(date: string): string { return (date || '').slice(0, 10); }

  protected toggleDay(date: string): void {
    const day = this.key(date);
    if (this.openDay() === day) { this.openDay.set(null); return; }

    this.openDay.set(day);
    this.error.set(null);
    if (this.cache()[day]) { return; }

    this.loading.set(day);
    this.sales.run('DailySalesController/getDailySalesReport', {
      fromDate: day,
      toDate: day,
      branchId: this.filter.branchId(),
      ordersFilter: 'All',
    }).pipe(
      catchError((e: Error) => { this.error.set(e?.message || 'Failed to load'); return of(null); }),
      finalize(() => this.loading.set(null)),
    ).subscribe(res => {
      if (!res) { return; }
      this.cache.set({ ...this.cache(), [day]: (res.rows ?? []) as Row[] });
    });
  }

  /**
   * Straight into that order's journey. A row whose id is missing stays inert rather than
   * navigating to a page that would have nothing to resolve.
   */
  protected openOrder(row: Row): void {
    const id = Number(row['orderId']);
    if (!(id > 0)) { return; }
    void this.router.navigate(['/journey'], { queryParams: { orderId: id } });
  }

  protected money(v: unknown): string {
    const n = Math.round((Number(v) || 0) * 100) / 100;
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
