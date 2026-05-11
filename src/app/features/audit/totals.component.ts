import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { AuditApi } from '../../core/api/audit.api';
import {
  AuditPageContext,
  AuditTotalsResult,
  toAuditFilterRequest,
} from '../../core/models/audit.models';
import { LanguageService } from '../../core/i18n/language.service';
import { AuditReportPageComponent } from '../../shared/audit-report-page/audit-report-page.component';

/**
 * `POST /api/AuditNarrativeReport/Totals` — sum-only, bucketed,
 * anti-theft markers. Drives KPI / dashboard panels without the per-row
 * narrative cost.
 */
@Component({
  selector: 'app-audit-totals',
  standalone: true,
  imports: [CommonModule, AuditReportPageComponent],
  template: `
    <app-audit-report-page
      titleEn="Audit Totals" titleAr="إجماليات التدقيق"
      subtitleEn="Aggregated buckets + summary + anti-theft markers"
      subtitleAr="إجماليات مجمّعة + ملخص + مؤشرات مكافحة السرقة"
      [fetchFn]="fetch"
      [showPageSize]="false">
      <ng-template #body let-data>
        <!-- Summary KPI tiles -->
        <section class="grid gap-4 md:gap-6 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
          <div class="card-padded">
            <div class="text-xs text-slate-500 dark:text-slate-400">{{ lang.language() === 'ar' ? 'إجمالي الأحداث' : 'Total Entries' }}</div>
            <div class="text-2xl font-bold mt-1 tabular text-slate-900 dark:text-slate-50">{{ data.summary.totalEntries | number }}</div>
          </div>
          <div class="card-padded">
            <div class="text-xs text-slate-500 dark:text-slate-400">{{ lang.language() === 'ar' ? 'مستخدمون' : 'Unique Users' }}</div>
            <div class="text-2xl font-bold mt-1 tabular text-slate-900 dark:text-slate-50">{{ data.summary.uniqueUsers | number }}</div>
          </div>
          <div class="card-padded">
            <div class="text-xs text-slate-500 dark:text-slate-400">{{ lang.language() === 'ar' ? 'أوردرات' : 'Unique Orders' }}</div>
            <div class="text-2xl font-bold mt-1 tabular text-slate-900 dark:text-slate-50">{{ data.summary.uniqueOrders | number }}</div>
          </div>
          <div class="card-padded">
            <div class="text-xs text-slate-500 dark:text-slate-400">{{ lang.language() === 'ar' ? 'صافي' : 'Total Net' }}</div>
            <div class="text-2xl font-bold mt-1 tabular text-slate-900 dark:text-slate-50">{{ data.summary.totalNet | number:'1.0-2' }}</div>
          </div>
          <div class="card-padded">
            <div class="text-xs text-slate-500 dark:text-slate-400">{{ lang.language() === 'ar' ? 'الخصومات' : 'Discounts' }}</div>
            <div class="text-2xl font-bold mt-1 tabular text-warning">{{ data.summary.discountActions | number }}</div>
          </div>
          <div class="card-padded">
            <div class="text-xs text-slate-500 dark:text-slate-400">{{ lang.language() === 'ar' ? 'إلغاء أصناف' : 'Voids' }}</div>
            <div class="text-2xl font-bold mt-1 tabular text-critical">{{ data.summary.voidActions | number }}</div>
          </div>
        </section>

        <!-- Bucket table -->
        <div *ngIf="data.buckets?.length" class="card-padded mt-4">
          <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
            {{ lang.language() === 'ar' ? 'إجماليات بحسب الفترة' : 'Bucketed Totals' }}
          </h3>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th class="text-start py-2">{{ lang.language() === 'ar' ? 'بداية' : 'Bucket' }}</th>
                  <th class="text-end py-2">{{ lang.language() === 'ar' ? 'أحداث' : 'Entries' }}</th>
                  <th class="text-end py-2">{{ lang.language() === 'ar' ? 'مستخدمون' : 'Users' }}</th>
                  <th class="text-end py-2">{{ lang.language() === 'ar' ? 'أوردرات' : 'Orders' }}</th>
                  <th class="text-end py-2">{{ lang.language() === 'ar' ? 'صافي' : 'Net' }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr *ngFor="let b of data.buckets">
                  <td class="py-2 tabular">{{ b.bucketStart | date:'mediumDate' }}</td>
                  <td class="py-2 text-end tabular">{{ b.entryCount | number }}</td>
                  <td class="py-2 text-end tabular">{{ b.uniqueUsers | number }}</td>
                  <td class="py-2 text-end tabular">{{ b.uniqueOrders | number }}</td>
                  <td class="py-2 text-end tabular">{{ b.totalNet | number:'1.0-2' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </ng-template>
    </app-audit-report-page>
  `,
})
export class AuditTotalsComponent {
  private readonly api = inject(AuditApi);
  readonly lang = inject(LanguageService);
  readonly fetch = (ctx: AuditPageContext): Observable<AuditTotalsResult> =>
    this.api.totals(toAuditFilterRequest(ctx));
}
