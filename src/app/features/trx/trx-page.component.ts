import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import {
  AuditPageContext,
  TransactionReportResult,
} from '../../core/models/audit.models';
import { LanguageService } from '../../core/i18n/language.service';
import { AuditReportPageComponent } from '../../shared/audit-report-page/audit-report-page.component';

/**
 * Shared body shell for the three per-transaction-type audit routes
 * (`trx/dinein`, `trx/takeaway`, `trx/delivery`). All three render the
 * same `TransactionReportResult` shape — flat narrative rows OR grouped
 * narrative — so a single body template lives here and each route is a
 * 10-line wrapper that supplies the title, subtitle, and the
 * type-specific filter (forced `transactionTypes` via the api method).
 *
 * The GroupBy selector is hidden on this shell because the trx group-by
 * enum is different from the audit time-bucket enum
 * (None/ByTable/ByWaiter/ByCashier/ByOrder/ByPilot vs
 *  None/Daily/Weekly/Monthly). A trx-specific groupBy picker will land
 * in a follow-up; for now each trx component passes a sensible default
 * (`None` for DineIn/TakeAway, `ByOrder` for Delivery).
 */
@Component({
  selector: 'app-trx-page',
  standalone: true,
  imports: [CommonModule, AuditReportPageComponent],
  template: `
    <app-audit-report-page
      [titleEn]="titleEn" [titleAr]="titleAr"
      [subtitleEn]="subtitleEn" [subtitleAr]="subtitleAr"
      [fetchFn]="fetchFn"
      [showGroupBy]="false"
      [defaultPageSize]="100">
      <ng-template #body let-data>
        <!-- Flat narrative -->
        <section *ngIf="(data.rows?.length || 0) > 0" class="card-padded">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {{ lang.language() === 'ar' ? 'الأحداث' : 'Events' }}
              <span class="text-xs text-slate-400">({{ data.totalCount | number }})</span>
            </h3>
            <span class="text-xs text-slate-500 dark:text-slate-400">
              {{ lang.language() === 'ar' ? 'صفحة' : 'Page' }} {{ data.page }} / {{ data.totalPages || 1 }}
            </span>
          </div>
          <div class="space-y-2">
            <div *ngFor="let r of data.rows"
                 class="flex items-start gap-3 text-sm border-b border-slate-100 dark:border-slate-800 last:border-0 pb-2">
              <span class="shrink-0 w-32 tabular text-xs text-slate-500 dark:text-slate-400">
                {{ r.actionDate | date:'short' }}
              </span>
              <span class="shrink-0 w-28 truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                {{ r.userName || '—' }}
              </span>
              <span class="flex-1 text-slate-700 dark:text-slate-300">
                {{ lang.language() === 'ar' ? r.narrative.descriptionAr : r.narrative.descriptionEn }}
              </span>
              <span *ngIf="r.netDiff" class="tabular text-xs"
                    [class.text-critical]="r.netDiff < 0"
                    [class.text-success]="r.netDiff > 0">
                {{ r.netDiff > 0 ? '+' : '' }}{{ r.netDiff | number:'1.0-2' }}
              </span>
            </div>
          </div>
        </section>

        <!-- Grouped narrative -->
        <section *ngFor="let g of data.groups" class="card-padded">
          <div class="flex items-center justify-between flex-wrap gap-3 mb-3">
            <div>
              <h3 class="text-sm font-bold text-slate-900 dark:text-slate-50">{{ g.groupLabel || g.groupKey }}</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ g.rowCount }} {{ lang.language() === 'ar' ? 'حدث' : 'events' }}
                <span *ngIf="g.totalNet"> · {{ g.totalNet | number:'1.0-2' }}</span>
              </p>
            </div>
          </div>
          <p *ngIf="g.summary" class="text-sm text-slate-700 dark:text-slate-300 mb-2">
            {{ lang.language() === 'ar' ? g.summary.descriptionAr : g.summary.descriptionEn }}
          </p>
          <details>
            <summary class="text-xs text-brand-600 dark:text-brand-400 cursor-pointer">
              {{ lang.language() === 'ar' ? 'عرض كل الأحداث' : 'View all events' }} ({{ g.rows?.length || 0 }})
            </summary>
            <div class="space-y-1 mt-2">
              <div *ngFor="let r of g.rows" class="flex items-start gap-3 text-sm py-1 ps-3 border-l border-slate-200 dark:border-slate-700">
                <span class="shrink-0 w-32 tabular text-xs text-slate-500 dark:text-slate-400">
                  {{ r.actionDate | date:'short' }}
                </span>
                <span class="flex-1 text-slate-700 dark:text-slate-300">
                  {{ lang.language() === 'ar' ? r.narrative.descriptionAr : r.narrative.descriptionEn }}
                </span>
              </div>
            </div>
          </details>
        </section>

        <div *ngIf="!data.rows?.length && !data.groups?.length"
             class="card-padded text-center py-8 text-sm text-slate-500 dark:text-slate-400">
          {{ lang.language() === 'ar' ? 'مفيش أحداث في الفترة دي.' : 'No events in this window.' }}
        </div>
      </ng-template>
    </app-audit-report-page>
  `,
})
export class TrxPageComponent {
  @Input({ required: true }) titleEn!: string;
  @Input({ required: true }) titleAr!: string;
  @Input() subtitleEn?: string;
  @Input() subtitleAr?: string;
  @Input({ required: true }) fetchFn!: (ctx: AuditPageContext) => Observable<TransactionReportResult>;
  readonly lang = inject(LanguageService);
}
