import { Component, ViewChild, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { AuditApi } from '../../core/api/audit.api';
import {
  AuditPageContext,
  OrderJourneyResult,
} from '../../core/models/audit.models';
import { LanguageService } from '../../core/i18n/language.service';
import { AuditReportPageComponent } from '../../shared/audit-report-page/audit-report-page.component';

/**
 * `POST /api/AuditNarrativeReport/OrderJourney` — single-order timeline.
 * Operator enters an Order ID (or Receipt Number); the page hits the
 * endpoint when they click Load or hit Enter. Until an id is entered,
 * the request is suppressed so the API doesn't keep returning "OrderId
 * required" every time the date filter ticks.
 */
@Component({
  selector: 'app-audit-order-journey',
  standalone: true,
  imports: [CommonModule, FormsModule, AuditReportPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Local lookup row -->
    <div class="flex items-center gap-2 flex-wrap mb-4">
      <span class="text-xs text-slate-500 dark:text-slate-400">
        {{ lang.language() === 'ar' ? 'البحث بـ' : 'Lookup by' }}:
      </span>
      <select [(ngModel)]="searchBy"
              class="bg-white dark:bg-surface-dark-subtle border border-slate-300 dark:border-slate-700
                     rounded-card-sm px-2 py-1 text-xs text-slate-700 dark:text-slate-200">
        <option value="orderId">{{ lang.language() === 'ar' ? 'رقم الأوردر' : 'Order ID' }}</option>
        <option value="receipt">{{ lang.language() === 'ar' ? 'رقم الإيصال' : 'Receipt #' }}</option>
      </select>
      <input type="number" inputmode="numeric" min="1" [(ngModel)]="lookupValue"
             (keyup.enter)="onLoad()"
             [placeholder]="lang.language() === 'ar' ? 'مثال: 5432' : 'e.g. 5432'"
             class="w-32 bg-white dark:bg-surface-dark-subtle
                    border border-slate-300 dark:border-slate-700
                    rounded-card-sm px-2.5 py-1 text-xs tabular
                    focus:ring-2 focus:ring-brand-500/30 focus:outline-none"/>
      <button type="button" (click)="onLoad()"
              [disabled]="!lookupValue"
              class="btn-primary text-xs">
        {{ lang.language() === 'ar' ? 'حمّل الرحلة' : 'Load journey' }}
      </button>
      <span *ngIf="!loaded()" class="text-xs text-warning">
        {{ lang.language() === 'ar'
            ? 'أدخل رقم وضغط Enter لتحميل رحلة الأوردر'
            : 'Enter an ID and press Enter to load the order timeline' }}
      </span>
    </div>

    <app-audit-report-page #page
      titleEn="Order Journey" titleAr="رحلة الأوردر"
      subtitleEn="One order's full lifecycle as a chronological narrative"
      subtitleAr="رحلة أوردر واحد كاملة بترتيب زمني"
      [fetchFn]="fetch"
      [showGroupBy]="false"
      [showPageSize]="false"
      [showFilterBar]="false">
      <ng-template #body let-data>
        <section class="card-padded">
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 class="text-lg font-bold text-slate-900 dark:text-slate-50">
                {{ lang.language() === 'ar' ? 'أوردر رقم' : 'Order #' }}{{ data.orderId }}
                <span *ngIf="data.receiptNumber" class="text-sm text-slate-500 ms-2">({{ data.receiptNumber }})</span>
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ data.transactionTypeName }}
                <span *ngIf="data.tableName"> · {{ data.tableName }}</span>
                <span *ngIf="data.branchName"> · {{ data.branchName }}</span>
              </p>
            </div>
            <div class="flex items-center gap-2">
              <span *ngIf="data.isPaid" class="pill-success text-xs">{{ lang.language() === 'ar' ? 'مدفوع' : 'Paid' }}</span>
              <span *ngIf="data.isCancelled" class="pill-critical text-xs">{{ lang.language() === 'ar' ? 'ملغي' : 'Cancelled' }}</span>
              <span class="tabular text-lg font-semibold text-slate-900 dark:text-slate-50">{{ data.finalNet | number:'1.0-2' }}</span>
            </div>
          </div>
        </section>

        <section class="card-padded">
          <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
            {{ lang.language() === 'ar' ? 'الجدول الزمني' : 'Timeline' }}
            <span class="text-xs text-slate-400">({{ data.timeline?.length || 0 }})</span>
          </h3>
          <div class="space-y-2">
            <div *ngFor="let r of data.timeline" class="flex items-start gap-3 text-sm border-l-2 border-brand-500/40 ps-3 py-1">
              <span class="shrink-0 w-32 tabular text-xs text-slate-500 dark:text-slate-400">
                {{ r.actionDate | date:'short' }}
              </span>
              <span class="shrink-0 w-24 truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                {{ r.userName || '—' }}
              </span>
              <span class="flex-1 text-slate-700 dark:text-slate-300">
                {{ lang.language() === 'ar' ? r.narrative.descriptionAr : r.narrative.descriptionEn }}
              </span>
            </div>
            <div *ngIf="!data.timeline?.length" class="text-center py-8 text-sm text-slate-500 dark:text-slate-400">
              {{ lang.language() === 'ar' ? 'لا توجد رحلة محملة بعد.' : 'No journey loaded.' }}
            </div>
          </div>
        </section>
      </ng-template>
    </app-audit-report-page>
  `,
})
export class AuditOrderJourneyComponent {
  private readonly api = inject(AuditApi);
  readonly lang = inject(LanguageService);

  searchBy: 'orderId' | 'receipt' = 'orderId';
  lookupValue: number | null = null;
  readonly loaded = signal(false);

  @ViewChild('page') pageRef?: AuditReportPageComponent<OrderJourneyResult>;

  onLoad(): void {
    if (!this.lookupValue || this.lookupValue <= 0) return;
    this.loaded.set(true);
    this.pageRef?.reload();
  }

  readonly fetch = (ctx: AuditPageContext): Observable<OrderJourneyResult> => {
    const v = this.lookupValue ?? 0;
    return this.api.orderJourney({
      orderId:       this.searchBy === 'orderId' ? (v > 0 ? v : undefined) : undefined,
      receiptNumber: this.searchBy === 'receipt' ? (v > 0 ? v : undefined) : undefined,
      branchId:      ctx.branchId ?? undefined,
      language:      ctx.language,
    });
  };
}
