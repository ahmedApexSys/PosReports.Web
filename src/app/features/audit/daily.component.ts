import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { AuditApi } from '../../core/api/audit.api';
import {
  AuditNarrativeRow,
  AuditPageContext,
  AuditReportPagedResult,
  toAuditFilterRequest,
} from '../../core/models/audit.models';
import { LanguageService } from '../../core/i18n/language.service';
import { AuditReportPageComponent } from '../../shared/audit-report-page/audit-report-page.component';
import { AuditEventCardComponent } from '../../shared/audit-event-card/audit-event-card.component';

/**
 * `POST /api/AuditNarrativeReport/Daily` — per-action narrative timeline
 * filtered by every dimension, paginated, with optional Daily/Weekly/
 * Monthly bucket totals. Rows render as <app-audit-event-card> so the
 * same icon + narrative + expandable-details layout shows up across
 * every audit / trx report.
 *
 * Calculate rows are filtered out of the default feed server-side
 * (see AuditReportQueryBuilder.DefaultNoiseActionTypes). To opt back in,
 * pick "Calculate" from the action-type chips in the filter bar.
 */
@Component({
  selector: 'app-audit-daily',
  standalone: true,
  imports: [CommonModule, AuditReportPageComponent, AuditEventCardComponent],
  template: `
    <app-audit-report-page
      titleEn="Daily Audit Narrative" titleAr="السرد اليومي للتدقيق"
      subtitleEn="Click any row to expand totals, item count progression, promo / discount source"
      subtitleAr="اضغط على أي حدث لعرض الإجماليات وحركة الأصناف ومصدر الخصم"
      [fetchFn]="fetch">
      <ng-template #body let-data>
        <div class="space-y-2">
          <app-audit-event-card *ngFor="let r of data.data"
                                [row]="r"></app-audit-event-card>

          <div *ngIf="!data.data?.length" class="card-padded text-center py-8 text-sm text-slate-500 dark:text-slate-400">
            {{ lang.language() === 'ar' ? 'مفيش أحداث في الفترة دي.' : 'No events in this window.' }}
          </div>
        </div>
      </ng-template>
    </app-audit-report-page>
  `,
})
export class AuditDailyComponent {
  private readonly api = inject(AuditApi);
  readonly lang = inject(LanguageService);
  readonly fetch = (ctx: AuditPageContext): Observable<AuditReportPagedResult<AuditNarrativeRow>> =>
    this.api.daily(toAuditFilterRequest(ctx));
}
