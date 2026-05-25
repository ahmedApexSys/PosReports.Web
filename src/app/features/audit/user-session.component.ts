import { Component, ViewChild, inject, signal, effect, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { LucideAngularModule, UserSearch } from 'lucide-angular';
import { Observable, of } from 'rxjs';
import { AuditApi } from '../../core/api/audit.api';
import { FilterPickerApi } from '../../core/api/filter-picker.api';
import {
  AuditPageContext,
  UserSessionResult,
  UserSession,
} from '../../core/models/audit.models';
import { PickerItem } from '../../core/models/picker.models';
import { FilterService } from '../../core/filters/filter.service';
import { LanguageService } from '../../core/i18n/language.service';
import { AuditReportPageComponent } from '../../shared/audit-report-page/audit-report-page.component';
import { AuditEventCardComponent } from '../../shared/audit-event-card/audit-event-card.component';
import { PickerComponent } from '../../shared/picker/picker.component';

/**
 * `POST /api/AuditNarrativeReport/UserSession` — one user's activity
 * grouped into login → logout sessions. Requires a `userId`. The user
 * picker is loaded from `/api/FilterPickers/Users` scoped to the
 * currently-selected branch; changing the user triggers a refresh on
 * the shared <app-audit-report-page> shell.
 */
@Component({
  selector: 'app-audit-user-session',
  standalone: true,
  imports: [CommonModule, AuditReportPageComponent, AuditEventCardComponent, PickerComponent, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Local picker row -->
    <div class="flex items-center gap-2 flex-wrap mb-4">
      <span class="text-xs text-slate-500 dark:text-slate-400">
        {{ lang.language() === 'ar' ? 'المستخدم' : 'User' }}:
      </span>
      <app-picker
        titleEn="Select user" titleAr="اختر مستخدم"
        [items]="users()"
        [selectedId]="userId()"
        [loading]="usersLoading()"
        [required]="true"
        (selectedIdChange)="onUserChange($event)"></app-picker>
    </div>

    <app-audit-report-page #page
      titleEn="User Session" titleAr="جلسات المستخدم"
      subtitleEn="One user's login → logout sessions with chronological action lists"
      subtitleAr="جلسات دخول وخروج لمستخدم محدد مع قوائم الإجراءات"
      [fetchFn]="fetch"
      [showGroupBy]="false"
      [showPageSize]="false"
      [showFilterBar]="false">
      <ng-template #body let-data>
        <!-- Empty placeholder — no user picked yet (or sentinel result returned
             from fetch). Replaces the red "UserId is required" error banner. -->
        <section *ngIf="!data || !data.userId" class="card-padded text-center py-12 md:py-16 space-y-4">
          <div class="inline-flex h-14 w-14 items-center justify-center rounded-2xl
                      bg-info-soft text-info ring-1 ring-info/30">
            <lucide-icon [img]="UserSearchIcon" class="h-7 w-7"></lucide-icon>
          </div>
          <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-50">
            {{ lang.language() === 'ar' ? 'اختر مستخدم لعرض الجلسات' : 'Pick a user to see their sessions' }}
          </h2>
          <p class="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {{ lang.language() === 'ar'
                ? 'استخدم القائمة فوق لاختيار مستخدم. هتظهر كل جلسات الدخول والخروج بتاعته مع تفاصيل كل إجراء قام بيه.'
                : 'Pick a user from the dropdown above. You will see every login / logout session for that user, plus every action they took inside it.' }}
          </p>
        </section>

        <section *ngIf="data && data.userId" class="card-padded">
          <h2 class="text-lg font-bold text-slate-900 dark:text-slate-50">
            {{ data.userName || (lang.language() === 'ar' ? 'مستخدم غير محدد' : 'No user') }}
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {{ data.userRole }}<span *ngIf="data.userId"> · {{ data.userId }}</span>
          </p>
        </section>

        <section *ngFor="let s of data.userId ? (data.sessions || []) : []" class="card-padded">
          <!-- Session header -->
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
              <span class="pill-info" *ngIf="s.monetary?.ordersTouched">
                {{ lang.language() === 'ar' ? 'تم لمسه' : 'Touched' }}: {{ s.monetary?.ordersTouched }}
              </span>
              <span class="pill-info">{{ lang.language() === 'ar' ? 'نظام' : 'System' }}: {{ s.systemActionCount }}</span>
            </div>
          </div>

          <!-- Action-type breakdown chips -->
          <div *ngIf="hasBreakdown(s)" class="flex items-center gap-1.5 flex-wrap mb-3">
            <span class="text-[10px] text-slate-400">{{ lang.language() === 'ar' ? 'الإجراءات' : 'Actions' }}:</span>
            <span *ngFor="let kv of breakdownEntries(s)"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-card-sm text-[11px] ring-1 tabular"
                  [class]="chipClassFor(kv.key)">
              <span class="font-medium">{{ kv.key }}</span>
              <span class="opacity-75">·</span>
              <span class="font-semibold">{{ kv.value }}</span>
            </span>
          </div>

          <!-- Money snapshot strip -->
          <div *ngIf="s.monetary" class="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3 text-xs">
            <div class="p-2 rounded-card-sm bg-success-soft ring-1 ring-success/30" *ngIf="(s.monetary?.totalPaidValue || 0) > 0">
              <div class="text-success text-[10px] font-medium uppercase tracking-wider">
                {{ lang.language() === 'ar' ? 'مدفوع' : 'Paid' }}
              </div>
              <div class="tabular text-success font-bold mt-0.5">{{ s.monetary?.totalPaidValue | number:'1.0-2' }}</div>
            </div>
            <div class="p-2 rounded-card-sm bg-critical-soft ring-1 ring-critical/30" *ngIf="(s.monetary?.totalVoidedValue || 0) > 0">
              <div class="text-critical text-[10px] font-medium uppercase tracking-wider">
                {{ lang.language() === 'ar' ? 'Void' : 'Voided' }}
              </div>
              <div class="tabular text-critical font-bold mt-0.5">{{ s.monetary?.totalVoidedValue | number:'1.0-2' }}</div>
            </div>
            <div class="p-2 rounded-card-sm bg-warning-soft ring-1 ring-warning/30" *ngIf="(s.monetary?.totalDiscountedValue || 0) > 0">
              <div class="text-warning text-[10px] font-medium uppercase tracking-wider">
                {{ lang.language() === 'ar' ? 'خصومات' : 'Discounted' }}
              </div>
              <div class="tabular text-warning font-bold mt-0.5">{{ s.monetary?.totalDiscountedValue | number:'1.0-2' }}</div>
            </div>
            <div class="p-2 rounded-card-sm bg-critical-soft ring-1 ring-critical/30" *ngIf="(s.monetary?.totalCancelledValue || 0) > 0">
              <div class="text-critical text-[10px] font-medium uppercase tracking-wider">
                {{ lang.language() === 'ar' ? 'ملغي' : 'Cancelled' }}
              </div>
              <div class="tabular text-critical font-bold mt-0.5">{{ s.monetary?.totalCancelledValue | number:'1.0-2' }}</div>
            </div>
            <div class="p-2 rounded-card-sm bg-slate-100 dark:bg-surface-dark-muted ring-1 ring-slate-200 dark:ring-slate-700" *ngIf="(s.monetary?.totalNetTouched || 0) > 0">
              <div class="text-slate-500 text-[10px] font-medium uppercase tracking-wider">
                {{ lang.language() === 'ar' ? 'صافي ملموس' : 'Net handled' }}
              </div>
              <div class="tabular text-slate-700 dark:text-slate-200 font-bold mt-0.5">{{ s.monetary?.totalNetTouched | number:'1.0-2' }}</div>
            </div>
          </div>

          <p class="text-sm text-slate-700 dark:text-slate-300 mb-2">
            {{ lang.language() === 'ar' ? s.summary.descriptionAr : s.summary.descriptionEn }}
          </p>

          <!-- Action-type filter (collapsible inside session) -->
          <details>
            <summary class="text-xs text-brand-600 dark:text-brand-400 cursor-pointer">
              {{ lang.language() === 'ar' ? 'عرض كل الإجراءات' : 'View all actions' }} ({{ s.actions?.length || 0 }})
            </summary>
            <div class="flex items-center gap-1.5 flex-wrap mt-2 mb-3"
                 *ngIf="hasBreakdown(s)">
              <span class="text-[10px] text-slate-400">{{ lang.language() === 'ar' ? 'فلترة:' : 'Filter:' }}</span>
              <button type="button" (click)="setSessionFilter(s, null)"
                      class="px-2 py-0.5 rounded-card-sm text-[10px] ring-1 transition-colors duration-180"
                      [class.bg-brand-600]="(sessionFilters().get(sessionKey(s)) ?? null) === null"
                      [class.text-white]="(sessionFilters().get(sessionKey(s)) ?? null) === null"
                      [class.ring-brand-600]="(sessionFilters().get(sessionKey(s)) ?? null) === null"
                      [class.bg-white]="(sessionFilters().get(sessionKey(s)) ?? null) !== null"
                      [class.dark:bg-surface-dark-subtle]="(sessionFilters().get(sessionKey(s)) ?? null) !== null"
                      [class.ring-slate-300]="(sessionFilters().get(sessionKey(s)) ?? null) !== null"
                      [class.dark:ring-slate-700]="(sessionFilters().get(sessionKey(s)) ?? null) !== null">
                {{ lang.language() === 'ar' ? 'الكل' : 'All' }}
              </button>
              <button *ngFor="let kv of breakdownEntries(s)" type="button"
                      (click)="setSessionFilter(s, kv.key)"
                      class="px-2 py-0.5 rounded-card-sm text-[10px] ring-1 transition-colors duration-180"
                      [class.bg-brand-600]="sessionFilters().get(sessionKey(s)) === kv.key"
                      [class.text-white]="sessionFilters().get(sessionKey(s)) === kv.key"
                      [class.ring-brand-600]="sessionFilters().get(sessionKey(s)) === kv.key"
                      [class.bg-white]="sessionFilters().get(sessionKey(s)) !== kv.key"
                      [class.dark:bg-surface-dark-subtle]="sessionFilters().get(sessionKey(s)) !== kv.key"
                      [class.ring-slate-300]="sessionFilters().get(sessionKey(s)) !== kv.key"
                      [class.dark:ring-slate-700]="sessionFilters().get(sessionKey(s)) !== kv.key">
                {{ kv.key }} ({{ kv.value }})
              </button>
            </div>
            <div class="space-y-2 mt-3">
              <ng-container *ngFor="let r of s.actions">
                <div *ngIf="passesFilter(r, sessionFilters().get(sessionKey(s)))"
                     class="relative group">
                  <app-audit-event-card [row]="r"></app-audit-event-card>
                  <button type="button" (click)="openJourney(r.orderId)" *ngIf="r.orderId"
                          class="absolute top-2 end-2 opacity-0 group-hover:opacity-100
                                 text-[10px] text-brand-600 dark:text-brand-400 hover:underline
                                 transition-opacity duration-180"
                          [title]="lang.language() === 'ar' ? 'افتح رحلة الأوردر' : 'Open Order Journey'">
                    {{ lang.language() === 'ar' ? 'رحلة الأوردر ↗' : 'Order Journey ↗' }}
                  </button>
                </div>
              </ng-container>
            </div>
          </details>
        </section>

        <div *ngIf="data && data.userId && !data.sessions?.length"
             class="card-padded text-center py-8 text-sm text-slate-500 dark:text-slate-400">
          {{ lang.language() === 'ar' ? 'لا توجد جلسات للمستخدم في الفترة دي.' : 'No sessions for this user in the window.' }}
        </div>
      </ng-template>
    </app-audit-report-page>
  `,
})
export class AuditUserSessionComponent implements OnInit {
  private readonly api = inject(AuditApi);
  private readonly picker = inject(FilterPickerApi);
  private readonly filter = inject(FilterService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly lang = inject(LanguageService);

  readonly users = signal<PickerItem[]>([]);
  readonly usersLoading = signal(false);
  readonly userId = signal<string | null>(null);

  /** Per-session action-type filter: session-key → action-type (null = all). */
  readonly sessionFilters = signal<Map<string, string | null>>(new Map());

  /** Deep-link target. When `?userId=…` is present we set this and the
   *  picker-loader effect auto-selects it once the user list arrives. */
  private pendingUserId: string | null = null;

  @ViewChild('page') pageRef?: AuditReportPageComponent<UserSessionResult>;

  constructor() {
    effect(() => {
      const branchId = this.filter.branchId();
      this.users.set([]);
      // Preserve a pending deep-link target across branch changes — the
      // picker reloads when branch changes, then we re-apply it once the
      // user list arrives.
      if (this.pendingUserId === null) this.userId.set(null);
      if (branchId != null && branchId > 0) {
        this.usersLoading.set(true);
        this.picker.users(branchId).subscribe((list) => {
          this.users.set(list);
          this.usersLoading.set(false);
          if (this.pendingUserId !== null) {
            // Confirm the user exists in this branch's picker before
            // selecting — otherwise we'd fetch a 404 and confuse the operator.
            const matched = list.find(u => u.id === this.pendingUserId);
            if (matched) {
              this.userId.set(this.pendingUserId);
              this.pageRef?.reload();
            }
            this.pendingUserId = null;
          }
        });
      }
    });
  }

  ngOnInit(): void {
    const uid = this.route.snapshot.queryParamMap.get('userId');
    if (uid) this.pendingUserId = uid;
  }

  onUserChange(id: string | null): void {
    this.userId.set(id);
    this.pageRef?.reload();
  }

  // ── Breakdown / filter helpers ───────────────────────────────────
  hasBreakdown(s: UserSession): boolean {
    return !!s.actionBreakdown && Object.keys(s.actionBreakdown).length > 0;
  }

  breakdownEntries(s: UserSession): { key: string; value: number }[] {
    if (!s.actionBreakdown) return [];
    return Object.entries(s.actionBreakdown)
      .map(([key, value]) => ({ key, value: value as number }))
      .sort((a, b) => b.value - a.value);
  }

  /** Stable per-session key — loginAt is unique enough within a user view. */
  sessionKey(s: UserSession): string { return s.loginAt; }

  setSessionFilter(s: UserSession, actionType: string | null): void {
    const next = new Map(this.sessionFilters());
    if (actionType === null) next.delete(this.sessionKey(s));
    else next.set(this.sessionKey(s), actionType);
    this.sessionFilters.set(next);
  }

  passesFilter(row: { actionType: string }, filter: string | null | undefined): boolean {
    return !filter || row.actionType === filter;
  }

  /** Chip background colouring — mirrors the icon-bg families on the card. */
  chipClassFor(actionType: string): string {
    switch (actionType) {
      case 'Pay': case 'Checkout': case 'CheckOut': case 'OrderCompleted':
      case 'OrderDelivered': case 'OrderPickedup': case 'CollectMoney':
        return 'bg-success-soft text-success ring-success/30';
      case 'VoidItem': case 'StopItem': case 'Cancel': case 'ApproveCancelOrder':
        return 'bg-critical-soft text-critical ring-critical/30';
      case 'Discount': case 'PromoCode': case 'Voucher': case 'EditPay':
        return 'bg-warning-soft text-warning ring-warning/30';
      case 'Login': case 'Logout': case 'OpenShift': case 'CloseShift':
      case 'OpenDay': case 'CloseDay':
        return 'bg-info-soft text-info ring-info/30';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 ring-slate-200 dark:ring-slate-700';
    }
  }

  /** Cross-report navigation: jump to Order Journey for the given order. */
  openJourney(orderId: number): void {
    if (orderId > 0) {
      this.router.navigate(['/audit/order-journey'], { queryParams: { orderId } });
    }
  }

  readonly UserSearchIcon = UserSearch;

  readonly fetch = (ctx: AuditPageContext): Observable<UserSessionResult> => {
    // No user picked → return a synthetic empty result so the body
    // template can render the placeholder. Prevents the shell from
    // displaying the raw "UserId is required" API error.
    const uid = this.userId();
    if (!uid) {
      return of(this.emptyUserSession());
    }
    return this.api.userSession({
      userId: uid,
      fromDate: ctx.fromDate,
      toDate: ctx.toDate,
      branchId: ctx.branchId ?? undefined,
      language: ctx.language,
    });
  };

  private emptyUserSession(): UserSessionResult {
    return {
      userId: '',
      userName: '',
      userRole: '',
      sessions: [],
      conclusion: { description: '', descriptionEn: '', descriptionAr: '' },
    } as UserSessionResult;
  }
}
