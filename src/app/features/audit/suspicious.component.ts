import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { AuditApi } from '../../core/api/audit.api';
import {
  AuditPageContext,
  SuspiciousActivityResult,
  toAuditFilterRequest,
} from '../../core/models/audit.models';
import { LanguageService } from '../../core/i18n/language.service';
import { AuditReportPageComponent } from '../../shared/audit-report-page/audit-report-page.component';

/**
 * `POST /api/AuditNarrativeReport/SuspiciousActivity` — heuristic
 * anti-theft scoring per user. Higher score = more loss-touching
 * actions (Discount / Void / Cancel / EditPay). Not proof of theft;
 * a starting point for an owner to investigate.
 */
@Component({
  selector: 'app-audit-suspicious',
  standalone: true,
  imports: [CommonModule, AuditReportPageComponent],
  template: `
    <app-audit-report-page
      titleEn="Suspicious Activity" titleAr="نشاط مشبوه"
      subtitleEn="Heuristic anti-theft scoring per user — where to look first"
      subtitleAr="تقييم المخاطر لكل مستخدم — من اللي محتاج تتبص عليه الأول"
      [fetchFn]="fetch"
      [showGroupBy]="false"
      [showPageSize]="false">
      <ng-template #body let-data>
        <section *ngFor="let u of data.users" class="card-padded">
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-50">
                {{ u.userName }} <span class="text-xs text-slate-400">· {{ u.userRole }}</span>
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ u.userId }}</p>
            </div>
            <div class="flex items-center gap-3">
              <span class="pill-warning text-xs" *ngIf="u.riskLevel === 'Medium'">{{ u.riskLevel }}</span>
              <span class="pill-critical text-xs" *ngIf="u.riskLevel === 'High'">{{ u.riskLevel }}</span>
              <span class="pill-info text-xs" *ngIf="u.riskLevel === 'Low'">{{ u.riskLevel }}</span>
              <span class="tabular text-xl font-bold text-slate-900 dark:text-slate-50">{{ u.totalScore }}</span>
            </div>
          </div>
          <div class="mt-3 space-y-1.5">
            <div *ngFor="let f of u.flags"
                 class="flex items-center justify-between gap-3 text-sm border-b border-slate-100 dark:border-slate-800 last:border-0 pb-1">
              <span class="flex-1 text-slate-700 dark:text-slate-300">
                {{ lang.language() === 'ar' ? f.description.descriptionAr : f.description.descriptionEn }}
              </span>
              <span class="tabular text-xs text-slate-500 dark:text-slate-400">
                {{ f.count }} × {{ f.weight }} = <strong class="text-slate-700 dark:text-slate-200">{{ f.score }}</strong>
              </span>
            </div>
          </div>
        </section>

        <div *ngIf="!data.users?.length" class="card-padded text-center py-8 text-sm text-slate-500 dark:text-slate-400">
          {{ lang.language() === 'ar' ? 'مفيش نشاط مشبوه في الفترة دي.' : 'No flagged activity in this window.' }}
        </div>
      </ng-template>
    </app-audit-report-page>
  `,
})
export class AuditSuspiciousComponent {
  private readonly api = inject(AuditApi);
  readonly lang = inject(LanguageService);
  readonly fetch = (ctx: AuditPageContext): Observable<SuspiciousActivityResult> =>
    this.api.suspiciousActivity(toAuditFilterRequest(ctx));
}
