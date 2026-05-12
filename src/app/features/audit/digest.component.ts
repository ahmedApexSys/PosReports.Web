import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { AuditApi } from '../../core/api/audit.api';
import {
  AuditPageContext,
  DailyDigestResult,
  toAuditFilterRequest,
} from '../../core/models/audit.models';
import { LanguageService } from '../../core/i18n/language.service';
import { AuditReportPageComponent } from '../../shared/audit-report-page/audit-report-page.component';

/**
 * `POST /api/AuditNarrativeReport/DailyDigest` — per-day text-only
 * digest. One row per calendar day, each with a bilingual conclusion
 * sentence and a few headline numbers.
 */
@Component({
  selector: 'app-audit-digest',
  standalone: true,
  imports: [CommonModule, AuditReportPageComponent],
  template: `
    <app-audit-report-page
      titleEn="Daily Digest" titleAr="الموجز اليومي"
      subtitleEn="What happened each day — story sentence + headline numbers"
      subtitleAr="إيه اللي حصل كل يوم — قصة قصيرة + الأرقام الأساسية"
      [fetchFn]="fetch"
      [showGroupBy]="false"
      [showPageSize]="false"
      [showFilterBar]="false">
      <ng-template #body let-data>
        <section *ngFor="let d of data.days" class="card-padded">
          <div class="flex items-center justify-between flex-wrap gap-3 mb-2">
            <h3 class="text-sm font-bold text-slate-900 dark:text-slate-50">
              {{ d.date | date:'fullDate' }}
            </h3>
            <span class="tabular text-base font-semibold text-slate-700 dark:text-slate-200">
              {{ d.netCollected | number:'1.0-2' }}
            </span>
          </div>
          <p class="text-sm text-slate-700 dark:text-slate-300 mb-3">
            {{ lang.language() === 'ar' ? d.story.descriptionAr : d.story.descriptionEn }}
          </p>
          <div class="flex flex-wrap gap-2 text-xs">
            <span class="pill-info">{{ lang.language() === 'ar' ? 'أوردرات' : 'Orders' }}: {{ d.uniqueOrders }}</span>
            <span class="pill-info">{{ lang.language() === 'ar' ? 'مستخدمون' : 'Users' }}: {{ d.uniqueUsers }}</span>
            <span class="pill-info">{{ lang.language() === 'ar' ? 'مدفوع' : 'Pays' }}: {{ d.pays }}</span>
            <span class="pill-warning" *ngIf="d.discounts">{{ lang.language() === 'ar' ? 'خصومات' : 'Discounts' }}: {{ d.discounts }}</span>
            <span class="pill-critical" *ngIf="d.voids">{{ lang.language() === 'ar' ? 'إلغاء أصناف' : 'Voids' }}: {{ d.voids }}</span>
            <span class="pill-critical" *ngIf="d.cancels">{{ lang.language() === 'ar' ? 'إلغاء أوردرات' : 'Cancels' }}: {{ d.cancels }}</span>
            <span class="pill-warning" *ngIf="d.editPays">{{ lang.language() === 'ar' ? 'تعديل دفع' : 'EditPays' }}: {{ d.editPays }}</span>
          </div>
        </section>

        <div *ngIf="!data.days?.length" class="card-padded text-center py-8 text-sm text-slate-500 dark:text-slate-400">
          {{ lang.language() === 'ar' ? 'مفيش أيام بنشاط في الفترة دي.' : 'No active days in this window.' }}
        </div>
      </ng-template>
    </app-audit-report-page>
  `,
})
export class AuditDigestComponent {
  private readonly api = inject(AuditApi);
  readonly lang = inject(LanguageService);
  readonly fetch = (ctx: AuditPageContext): Observable<DailyDigestResult> =>
    this.api.dailyDigest(toAuditFilterRequest(ctx));
}
