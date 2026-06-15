import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { AuditApi } from '../../core/api/audit.api';
import {
  AuditPageContext,
  OrderTotalsByDayResult,
  toAuditFilterRequest,
} from '../../core/models/audit.models';
import { LanguageService } from '../../core/i18n/language.service';
import { AuditReportPageComponent } from '../../shared/audit-report-page/audit-report-page.component';

/**
 * Totals — order totals SUMMED per day (GroupBy date). The owner wants a
 * per-day rollup of order value, not per-action buckets and no repeated
 * orders. Built on the same per-order aggregation as Daily (AuditApi.totalsByDay)
 * so an order is counted once even when it had many actions.
 */
@Component({
  selector: 'app-audit-totals',
  standalone: true,
  imports: [CommonModule, AuditReportPageComponent],
  template: `
    <app-audit-report-page
      titleEn="Totals — by Day" titleAr="الإجماليات — حسب اليوم"
      subtitleEn="Each day's orders summed once — net, discounts, voids and cancellations"
      subtitleAr="إجمالي أوردرات كل يوم مرة واحدة — الصافي والخصومات والفويد والإلغاء"
      [fetchFn]="fetch"
      [showGroupBy]="false"
      [showPageSize]="false">
      <ng-template #body let-data>
        <!-- Window summary tiles -->
        <section class="grid gap-3 md:gap-4 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
          <div class="card-padded animate-slide-up">
            <div class="text-xs text-slate-500 dark:text-slate-400">{{ ar() ? 'أوردرات' : 'Orders' }}</div>
            <div class="text-2xl font-bold mt-1 tabular text-slate-900 dark:text-slate-50">{{ data.summary.uniqueOrders | number }}</div>
          </div>
          <div class="card-padded animate-slide-up" style="animation-delay:40ms">
            <div class="text-xs text-slate-500 dark:text-slate-400">{{ ar() ? 'مدفوعة' : 'Paid' }}</div>
            <div class="text-2xl font-bold mt-1 tabular text-good">{{ data.summary.paidOrders | number }}</div>
          </div>
          <div class="card-padded animate-slide-up" style="animation-delay:80ms">
            <div class="text-xs text-slate-500 dark:text-slate-400">{{ ar() ? 'صافي' : 'Total Net' }}</div>
            <div class="text-2xl font-bold mt-1 tabular text-brand-700 dark:text-brand-400">{{ data.summary.totalNet | number:'1.0-2' }}</div>
          </div>
          <div class="card-padded animate-slide-up" style="animation-delay:120ms">
            <div class="text-xs text-slate-500 dark:text-slate-400">{{ ar() ? 'الخصومات' : 'Discounts' }}</div>
            <div class="text-2xl font-bold mt-1 tabular text-warning">{{ data.summary.totalDiscount | number:'1.0-2' }}</div>
          </div>
          <div class="card-padded animate-slide-up" style="animation-delay:160ms">
            <div class="text-xs text-slate-500 dark:text-slate-400">{{ ar() ? 'فويد' : 'Voided' }}</div>
            <div class="text-2xl font-bold mt-1 tabular text-critical">{{ data.summary.voidedOrders | number }}</div>
          </div>
          <div class="card-padded animate-slide-up" style="animation-delay:200ms">
            <div class="text-xs text-slate-500 dark:text-slate-400">{{ ar() ? 'ملغاة' : 'Cancelled' }}</div>
            <div class="text-2xl font-bold mt-1 tabular text-critical">{{ data.summary.cancelledOrders | number }}</div>
          </div>
        </section>

        <!-- Per-day table -->
        <div *ngIf="data.days?.length" class="card-padded mt-4">
          <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
            {{ ar() ? 'إجماليات الأوردرات حسب اليوم' : 'Order totals by day' }}
          </h3>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th class="text-start py-2">{{ ar() ? 'اليوم' : 'Day' }}</th>
                  <th class="text-end py-2">{{ ar() ? 'أوردرات' : 'Orders' }}</th>
                  <th class="text-end py-2">{{ ar() ? 'مدفوعة' : 'Paid' }}</th>
                  <th class="text-end py-2">{{ ar() ? 'صافي' : 'Net' }}</th>
                  <th class="text-end py-2">{{ ar() ? 'خصم' : 'Discount' }}</th>
                  <th class="text-end py-2">{{ ar() ? 'فويد' : 'Void' }}</th>
                  <th class="text-end py-2">{{ ar() ? 'ملغاة' : 'Cancel' }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr *ngFor="let d of data.days" class="hover:bg-slate-50 dark:hover:bg-surface-dark-muted/50">
                  <td class="py-2 tabular font-medium text-slate-700 dark:text-slate-200">{{ d.date | date:'EEE, MMM d' }}</td>
                  <td class="py-2 text-end tabular">{{ d.orders | number }}</td>
                  <td class="py-2 text-end tabular text-good">{{ d.paidOrders | number }}</td>
                  <td class="py-2 text-end tabular font-semibold text-slate-900 dark:text-slate-50">{{ d.totalNet | number:'1.0-2' }}</td>
                  <td class="py-2 text-end tabular text-warning">{{ d.totalDiscount | number:'1.0-2' }}</td>
                  <td class="py-2 text-end tabular" [class.text-critical]="d.voidedOrders > 0">{{ d.voidedOrders | number }}</td>
                  <td class="py-2 text-end tabular" [class.text-critical]="d.cancelledOrders > 0">{{ d.cancelledOrders | number }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p *ngIf="data.truncated" class="text-[11px] text-warning mt-2">
            {{ ar() ? 'الفترة كبيرة — التُتل قد يكون جزئيًا. ضيّق الفترة لدقة كاملة.'
                    : 'Busy window — totals may be partial. Narrow the date range for full accuracy.' }}
          </p>
        </div>

        <div *ngIf="!data.days?.length" class="card-padded text-center py-10 text-sm text-slate-500 dark:text-slate-400">
          {{ ar() ? 'مفيش أوردرات في الفترة دي.' : 'No orders in this window.' }}
        </div>
      </ng-template>
    </app-audit-report-page>
  `,
})
export class AuditTotalsComponent {
  private readonly api = inject(AuditApi);
  readonly lang = inject(LanguageService);
  ar(): boolean { return this.lang.language() === 'ar'; }
  readonly fetch = (ctx: AuditPageContext): Observable<OrderTotalsByDayResult> =>
    this.api.totalsByDay(toAuditFilterRequest(ctx));
}
