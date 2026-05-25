import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import {
  AuditPageContext,
  TransactionReportResult,
} from '../../core/models/audit.models';
import { LanguageService } from '../../core/i18n/language.service';
import { AuditReportPageComponent } from '../../shared/audit-report-page/audit-report-page.component';
import { AuditEventCardComponent } from '../../shared/audit-event-card/audit-event-card.component';

/**
 * Shared body shell for the three per-transaction-type audit routes
 * (`trx/dinein`, `trx/takeaway`, `trx/delivery`). All three render the
 * same `TransactionReportResult` shape — flat narrative rows OR grouped
 * narrative — so a single body template lives here and each route is a
 * 10-line wrapper that supplies the title, subtitle, and the
 * type-specific filter (forced `transactionTypes` via the api method).
 *
 * Rows render through `<app-audit-event-card>` so DineIn / TakeAway /
 * Delivery share the same row layout as `/audit/daily`: icon, narrative,
 * money-delta badge, expandable detail panel.
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
  imports: [CommonModule, AuditReportPageComponent, AuditEventCardComponent],
  template: `
    <app-audit-report-page
      [titleEn]="titleEn" [titleAr]="titleAr"
      [subtitleEn]="subtitleEn" [subtitleAr]="subtitleAr"
      [fetchFn]="fetchFn"
      [showGroupBy]="false"
      [defaultPageSize]="100">
      <ng-template #body let-data>
        <!-- Flat narrative -->
        <section *ngIf="(data.rows?.length || 0) > 0" class="space-y-2">
          <div class="flex items-center justify-between px-1">
            <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {{ lang.language() === 'ar' ? 'الأحداث' : 'Events' }}
              <span class="text-xs text-slate-400">({{ data.totalCount | number }})</span>
            </h3>
          </div>
          <app-audit-event-card *ngFor="let r of data.rows"
                                [row]="r"></app-audit-event-card>
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
          <p *ngIf="g.summary" class="text-sm text-slate-700 dark:text-slate-300 mb-3">
            {{ lang.language() === 'ar' ? g.summary.descriptionAr : g.summary.descriptionEn }}
          </p>
          <details>
            <summary class="text-xs text-brand-600 dark:text-brand-400 cursor-pointer">
              {{ lang.language() === 'ar' ? 'عرض كل الأحداث' : 'View all events' }} ({{ g.rows?.length || 0 }})
            </summary>
            <div class="space-y-2 mt-3">
              <app-audit-event-card *ngFor="let r of g.rows"
                                    [row]="r"></app-audit-event-card>
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
