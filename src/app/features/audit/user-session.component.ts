import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { AuditApi } from '../../core/api/audit.api';
import {
  AuditPageContext,
  UserSessionResult,
} from '../../core/models/audit.models';
import { LanguageService } from '../../core/i18n/language.service';
import { AuditReportPageComponent } from '../../shared/audit-report-page/audit-report-page.component';

/**
 * `POST /api/AuditNarrativeReport/UserSession` — one user's activity
 * grouped into login → logout sessions. Requires a `userId`. Empty
 * until a user-picker UI is wired.
 */
@Component({
  selector: 'app-audit-user-session',
  standalone: true,
  imports: [CommonModule, AuditReportPageComponent],
  template: `
    <app-audit-report-page
      titleEn="User Session" titleAr="جلسات المستخدم"
      subtitleEn="One user's login → logout sessions with chronological action lists"
      subtitleAr="جلسات دخول وخروج لمستخدم محدد مع قوائم الإجراءات"
      [fetchFn]="fetch"
      [showGroupBy]="false"
      [showPageSize]="false">
      <ng-template #body let-data>
        <section class="card-padded">
          <h2 class="text-lg font-bold text-slate-900 dark:text-slate-50">
            {{ data.userName || (lang.language() === 'ar' ? 'مستخدم غير محدد' : 'No user') }}
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {{ data.userRole }}<span *ngIf="data.userId"> · {{ data.userId }}</span>
          </p>
        </section>

        <section *ngFor="let s of data.sessions" class="card-padded">
          <div class="flex items-center justify-between flex-wrap gap-3 mb-3">
            <div>
              <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {{ s.loginAt | date:'medium' }}
                <span class="text-slate-400"> → </span>
                {{ s.logoutAt ? (s.logoutAt | date:'medium') : (lang.language() === 'ar' ? 'مفتوح' : 'open') }}
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ s.loginMachine }}<span *ngIf="s.loginIp"> · {{ s.loginIp }}</span>
                <span class="ms-2">· {{ s.duration }}</span>
              </p>
            </div>
            <div class="flex items-center gap-3 text-xs">
              <span class="pill-info">{{ lang.language() === 'ar' ? 'أوردرات' : 'Orders' }}: {{ s.orderActionCount }}</span>
              <span class="pill-info">{{ lang.language() === 'ar' ? 'نظام' : 'System' }}: {{ s.systemActionCount }}</span>
              <span class="pill-info">{{ lang.language() === 'ar' ? 'قائمة' : 'Menu' }}: {{ s.menuActionCount }}</span>
            </div>
          </div>
          <p class="text-sm text-slate-700 dark:text-slate-300 mb-2">
            {{ lang.language() === 'ar' ? s.summary.descriptionAr : s.summary.descriptionEn }}
          </p>
          <details>
            <summary class="text-xs text-brand-600 dark:text-brand-400 cursor-pointer">
              {{ lang.language() === 'ar' ? 'عرض كل الإجراءات' : 'View all actions' }} ({{ s.actions?.length || 0 }})
            </summary>
            <div class="space-y-1 mt-2">
              <div *ngFor="let r of s.actions" class="flex items-start gap-3 text-sm py-1 ps-3 border-l border-slate-200 dark:border-slate-700">
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

        <div *ngIf="!data.sessions?.length" class="card-padded text-center py-8 text-sm text-slate-500 dark:text-slate-400">
          {{ lang.language() === 'ar' ? 'لا توجد جلسات. مرر رقم مستخدم صحيح.' : 'No sessions. Pass a valid User ID.' }}
        </div>
      </ng-template>
    </app-audit-report-page>
  `,
})
export class AuditUserSessionComponent {
  private readonly api = inject(AuditApi);
  readonly lang = inject(LanguageService);
  readonly fetch = (ctx: AuditPageContext): Observable<UserSessionResult> =>
    this.api.userSession({
      userId: '',                            // needs picker UI
      fromDate: ctx.fromDate,
      toDate: ctx.toDate,
      branchId: ctx.branchId ?? undefined,
      language: ctx.language,
    });
}
