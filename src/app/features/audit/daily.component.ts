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

/**
 * `POST /api/AuditNarrativeReport/Daily` — per-action narrative timeline
 * filtered by every dimension, paginated, with optional Daily/Weekly/
 * Monthly bucket totals.
 */
@Component({
  selector: 'app-audit-daily',
  standalone: true,
  imports: [CommonModule, AuditReportPageComponent],
  template: `
    <app-audit-report-page
      titleEn="Daily Audit Narrative" titleAr="السرد اليومي للتدقيق"
      subtitleEn="Bilingual sentence per audit row — who did what, when, and the money delta"
      subtitleAr="جملة ثنائية اللغة لكل إجراء — مين عمل إيه، إمتى، والفرق المالي"
      [fetchFn]="fetch">
      <ng-template #body let-data>
        <div class="card-padded">
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
            <div *ngFor="let r of data.data"
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
            <div *ngIf="!data.data?.length" class="text-center py-8 text-sm text-slate-500 dark:text-slate-400">
              {{ lang.language() === 'ar' ? 'مفيش أحداث في الفترة دي.' : 'No events in this window.' }}
            </div>
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
