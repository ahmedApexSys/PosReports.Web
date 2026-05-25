import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { LucideAngularModule, AlertTriangle, ExternalLink, ChevronDown } from 'lucide-angular';
import { AuditApi } from '../../core/api/audit.api';
import {
  AuditPageContext,
  SuspiciousActivityResult,
  UserRiskScore,
  toAuditFilterRequest,
} from '../../core/models/audit.models';
import { LanguageService } from '../../core/i18n/language.service';
import { AuditReportPageComponent } from '../../shared/audit-report-page/audit-report-page.component';
import { AuditEventCardComponent } from '../../shared/audit-event-card/audit-event-card.component';

/**
 * `POST /api/AuditNarrativeReport/SuspiciousActivity` — heuristic
 * anti-theft scoring per user. Higher score = more loss-touching
 * actions (Discount / Void / Cancel / EditPay). Not proof of theft;
 * a starting point for an owner to investigate.
 *
 * UX:
 *  • Risk-level badge + score + monetary impact strip per user
 *  • Flag list (the rules that fired) with rule weights
 *  • Expandable "Top events" panel — the actual rows that pushed the
 *    score up, each one clickable to jump straight into Order Journey
 *  • "Investigate session" button → opens the user's UserSession view
 *    pre-loaded for the same date window
 */
@Component({
  selector: 'app-audit-suspicious',
  standalone: true,
  imports: [CommonModule, AuditReportPageComponent, AuditEventCardComponent, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
          <!-- Header: name + risk badge + score -->
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div class="flex items-center gap-3">
              <div class="shrink-0 inline-flex items-center justify-center
                          h-10 w-10 rounded-card-sm ring-1"
                   [class]="riskIconClass(u.riskLevel)">
                <lucide-icon [img]="AlertIcon" class="h-5 w-5"></lucide-icon>
              </div>
              <div>
                <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  {{ u.userName }}
                  <span *ngIf="u.userRole" class="text-xs text-slate-400">· {{ u.userRole }}</span>
                </h3>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  {{ u.userId }}
                  <span *ngIf="u.topBranchName"> · {{ lang.language() === 'ar' ? 'الفرع' : 'Branch' }}: {{ u.topBranchName }}</span>
                </p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="pill-warning text-xs" *ngIf="u.riskLevel === 'Medium'">{{ riskLabel(u.riskLevel) }}</span>
              <span class="pill-critical text-xs" *ngIf="u.riskLevel === 'High'">{{ riskLabel(u.riskLevel) }}</span>
              <span class="pill-info text-xs" *ngIf="u.riskLevel === 'Low'">{{ riskLabel(u.riskLevel) }}</span>
              <span class="tabular text-2xl font-bold text-slate-900 dark:text-slate-50">{{ u.totalScore }}</span>
            </div>
          </div>

          <!-- Money-impact strip -->
          <div *ngIf="u.monetary" class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
            <div class="p-2 rounded-card-sm bg-critical-soft ring-1 ring-critical/30" *ngIf="(u.monetary?.totalVoidedValue || 0) > 0">
              <div class="text-critical text-[10px] font-medium uppercase tracking-wider">
                {{ lang.language() === 'ar' ? 'إجمالي Void' : 'Voided' }}
              </div>
              <div class="tabular text-critical font-bold mt-0.5">{{ u.monetary?.totalVoidedValue | number:'1.0-2' }}</div>
            </div>
            <div class="p-2 rounded-card-sm bg-warning-soft ring-1 ring-warning/30" *ngIf="(u.monetary?.totalDiscountedValue || 0) > 0">
              <div class="text-warning text-[10px] font-medium uppercase tracking-wider">
                {{ lang.language() === 'ar' ? 'خصومات' : 'Discounted' }}
              </div>
              <div class="tabular text-warning font-bold mt-0.5">{{ u.monetary?.totalDiscountedValue | number:'1.0-2' }}</div>
            </div>
            <div class="p-2 rounded-card-sm bg-critical-soft ring-1 ring-critical/30" *ngIf="(u.monetary?.totalCancelledValue || 0) > 0">
              <div class="text-critical text-[10px] font-medium uppercase tracking-wider">
                {{ lang.language() === 'ar' ? 'مبلغ ملغي' : 'Cancelled' }}
              </div>
              <div class="tabular text-critical font-bold mt-0.5">{{ u.monetary?.totalCancelledValue | number:'1.0-2' }}</div>
            </div>
            <div class="p-2 rounded-card-sm bg-slate-100 dark:bg-surface-dark-muted ring-1 ring-slate-200 dark:ring-slate-700" *ngIf="(u.monetary?.ordersTouched || 0) > 0">
              <div class="text-slate-500 text-[10px] font-medium uppercase tracking-wider">
                {{ lang.language() === 'ar' ? 'أوردرات' : 'Orders' }}
              </div>
              <div class="tabular text-slate-700 dark:text-slate-200 font-bold mt-0.5">{{ u.monetary?.ordersTouched }}</div>
            </div>
          </div>

          <!-- Flag list -->
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

          <!-- Action buttons + expand top events -->
          <div class="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button type="button" (click)="investigate(u)"
                    class="btn-primary text-xs">
              <lucide-icon [img]="ExternalIcon" class="h-3 w-3"></lucide-icon>
              {{ lang.language() === 'ar' ? 'افتح جلسة المستخدم' : 'Open user session' }}
            </button>
            <button type="button" (click)="toggleEvents(u.userId)" *ngIf="(u.topEvents?.length || 0) > 0"
                    class="btn-ghost text-xs">
              <lucide-icon [img]="ChevronIcon" class="h-3 w-3"
                           [class.rotate-180]="isExpanded(u.userId)"
                           style="transition: transform 180ms ease-out;"></lucide-icon>
              {{ lang.language() === 'ar' ? 'أهم الأحداث' : 'Top events' }} ({{ u.topEvents?.length }})
            </button>
          </div>

          <!-- Top events panel -->
          <div *ngIf="isExpanded(u.userId) && (u.topEvents?.length || 0) > 0"
               class="mt-3 space-y-2">
            <div class="text-[10px] text-slate-400 uppercase tracking-wider">
              {{ lang.language() === 'ar'
                  ? 'أعلى الأحداث تأثيراً ماليّاً — اضغط على أي حدث لفتح رحلة الأوردر'
                  : 'Highest-impact flagged events — click any to open Order Journey' }}
            </div>
            <div *ngFor="let r of u.topEvents" class="relative group">
              <app-audit-event-card [row]="r"></app-audit-event-card>
              <button type="button" (click)="openJourney(r.orderId)" *ngIf="r.orderId"
                      class="absolute top-2 end-2 opacity-0 group-hover:opacity-100
                             text-[10px] text-brand-600 dark:text-brand-400 hover:underline
                             transition-opacity duration-180"
                      [title]="lang.language() === 'ar' ? 'افتح رحلة الأوردر' : 'Open Order Journey'">
                {{ lang.language() === 'ar' ? 'رحلة الأوردر ↗' : 'Order Journey ↗' }}
              </button>
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
  private readonly router = inject(Router);
  readonly lang = inject(LanguageService);

  readonly AlertIcon = AlertTriangle;
  readonly ExternalIcon = ExternalLink;
  readonly ChevronIcon = ChevronDown;

  /** Local UI state — which users have their Top Events panel expanded. */
  private readonly expanded = new Set<string>();

  readonly fetch = (ctx: AuditPageContext): Observable<SuspiciousActivityResult> =>
    this.api.suspiciousActivity(toAuditFilterRequest(ctx));

  toggleEvents(userId: string): void {
    if (this.expanded.has(userId)) this.expanded.delete(userId);
    else this.expanded.add(userId);
  }

  isExpanded(userId: string): boolean { return this.expanded.has(userId); }

  riskLabel(level: 'Low' | 'Medium' | 'High'): string {
    const ar = { Low: 'منخفض', Medium: 'متوسط', High: 'مرتفع' } as const;
    return this.lang.language() === 'ar' ? ar[level] : level;
  }

  riskIconClass(level: 'Low' | 'Medium' | 'High'): string {
    switch (level) {
      case 'High':   return 'bg-critical-soft text-critical ring-critical/30';
      case 'Medium': return 'bg-warning-soft text-warning ring-warning/30';
      default:       return 'bg-info-soft text-info ring-info/30';
    }
  }

  /** Open the user's full session timeline for the same date window. */
  investigate(u: UserRiskScore): void {
    this.router.navigate(['/audit/user-session'], { queryParams: { userId: u.userId } });
  }

  /** Open Order Journey for the order behind a top-event card. */
  openJourney(orderId: number): void {
    if (orderId > 0) {
      this.router.navigate(['/audit/order-journey'], { queryParams: { orderId } });
    }
  }
}
