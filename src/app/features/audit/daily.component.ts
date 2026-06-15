import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { LucideAngularModule, Receipt, Users, Clock, ArrowRight, Armchair } from 'lucide-angular';
import { AuditApi } from '../../core/api/audit.api';
import {
  AuditPageContext,
  AuditReportPagedResult,
  OrderSummaryRow,
  toAuditFilterRequest,
} from '../../core/models/audit.models';
import { LanguageService } from '../../core/i18n/language.service';
import { txTypeLabel } from '../../core/i18n/monitoring-labels';
import { AuditReportPageComponent } from '../../shared/audit-report-page/audit-report-page.component';

/**
 * Daily — ONE summary row per ORDER (the owner wants order totals, not a
 * per-action narrative, and no repeated orders). The feed is grouped on
 * orderId client-side (see AuditApi.dailyPerOrder). Click a card to open the
 * full order journey.
 */
@Component({
  selector: 'app-audit-daily',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, AuditReportPageComponent],
  template: `
    <app-audit-report-page
      titleEn="Daily — Orders Summary" titleAr="اليومي — ملخص الأوردرات"
      subtitleEn="One row per order with its final totals — click to open the full journey"
      subtitleAr="صف واحد لكل أوردر بإجمالياته النهائية — اضغط لفتح رحلة الأوردر"
      [fetchFn]="fetch"
      [showGroupBy]="false"
      [showPageSize]="false">
      <ng-template #body let-data>
        <div class="space-y-2">
          <button *ngFor="let o of data.data; let i = index"
                  type="button" (click)="openJourney(o.orderId)"
                  class="w-full text-start card-padded animate-slide-up
                         hover:ring-2 hover:ring-brand-300 dark:hover:ring-brand-700/60
                         transition-shadow"
                  [style.animation-delay.ms]="lessThan20(i) ? i * 35 : 0">
            <div class="flex items-start gap-3">
              <div class="min-w-0 flex-1">
                <!-- Title -->
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-sm font-bold text-slate-900 dark:text-slate-50">
                    {{ ar() ? 'أوردر #' : 'Order #' }}{{ o.orderId }}
                  </span>
                  <span *ngIf="o.receiptNumber" class="text-[11px] text-slate-400 tabular">{{ o.receiptNumber }}</span>
                  <span class="text-[11px] text-slate-500 dark:text-slate-400">{{ tx(o) }}</span>
                  <span *ngIf="o.tableName" class="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <lucide-icon [img]="Table" class="h-3 w-3"></lucide-icon>{{ o.tableName }}
                  </span>
                </div>
                <!-- Meta -->
                <div class="flex items-center gap-3 flex-wrap mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <span class="inline-flex items-center gap-1">
                    <lucide-icon [img]="ClockIcon" class="h-3 w-3"></lucide-icon>
                    {{ o.lastAt | date:'MMM d, HH:mm' }}
                  </span>
                  <span>{{ o.itemCount }} {{ ar() ? 'صنف' : 'items' }}</span>
                  <span>{{ o.actionCount }} {{ ar() ? 'حركة' : 'actions' }}</span>
                  <span *ngIf="o.users?.length" class="inline-flex items-center gap-1 truncate max-w-[14rem]">
                    <lucide-icon [img]="UsersIcon" class="h-3 w-3"></lucide-icon>{{ o.users.join(', ') }}
                  </span>
                </div>
                <!-- Status pills -->
                <div class="flex items-center gap-1.5 flex-wrap mt-1.5">
                  <span *ngIf="o.wasCancelled" class="pill-critical">{{ ar() ? 'ملغي' : 'Cancelled' }}</span>
                  <span *ngIf="!o.wasCancelled && o.wasPaid" class="pill-good">{{ ar() ? 'مدفوع' : 'Paid' }}</span>
                  <span *ngIf="!o.wasCancelled && !o.wasPaid" class="pill-warning">{{ ar() ? 'مفتوح' : 'Open' }}</span>
                  <span *ngIf="o.hadDiscount" class="pill-warning">{{ ar() ? 'خصم' : 'Discount' }}</span>
                  <span *ngIf="o.wasVoided" class="pill-critical">{{ ar() ? 'فويد' : 'Void' }}</span>
                </div>
              </div>
              <!-- Net + arrow -->
              <div class="shrink-0 text-end">
                <div class="text-lg font-bold tabular text-slate-900 dark:text-slate-50">{{ o.finalNet | number:'1.0-2' }}</div>
                <div *ngIf="o.discount > 0" class="text-[11px] text-warning tabular">−{{ o.discount | number:'1.0-2' }}</div>
                <lucide-icon [img]="Arrow" class="h-4 w-4 text-brand-500 mt-1 ms-auto rtl:rotate-180"></lucide-icon>
              </div>
            </div>
          </button>

          <div *ngIf="!data.data?.length" class="card-padded text-center py-10 text-sm text-slate-500 dark:text-slate-400">
            {{ ar() ? 'مفيش أوردرات في الفترة دي.' : 'No orders in this window.' }}
          </div>
        </div>
      </ng-template>
    </app-audit-report-page>
  `,
})
export class AuditDailyComponent {
  private readonly api = inject(AuditApi);
  private readonly router = inject(Router);
  readonly lang = inject(LanguageService);

  readonly Receipt = Receipt;
  readonly UsersIcon = Users;
  readonly ClockIcon = Clock;
  readonly Arrow = ArrowRight;
  readonly Table = Armchair;

  ar(): boolean { return this.lang.language() === 'ar'; }
  tx(o: OrderSummaryRow): string { return txTypeLabel(o.transactionTypeName, o.transactionType, this.lang.language()); }
  lessThan20(i: number): boolean { return i < 20; }

  openJourney(orderId: number): void {
    if (orderId > 0) this.router.navigate(['/audit/order-journey'], { queryParams: { orderId } });
  }

  readonly fetch = (ctx: AuditPageContext): Observable<AuditReportPagedResult<OrderSummaryRow>> =>
    this.api.dailyPerOrder(toAuditFilterRequest(ctx));
}
