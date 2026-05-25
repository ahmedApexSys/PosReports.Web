import { Component, inject, signal, effect, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { OwnerInsightsApi } from '../../core/api/owner-insights.api';
import {
  PostCheckoutModificationsResult,
  PostCheckoutEvent,
  PostCheckoutUserRollup,
} from '../../core/models/owner-insights.models';
import { FilterService } from '../../core/filters/filter.service';
import { LanguageService } from '../../core/i18n/language.service';

/**
 * `POST /api/OwnerInsights/PostCheckoutModifications`
 *
 * Owner / accounting decision view — every action that mutated an
 * order AFTER the customer's most-recent Pay / Checkout in the window.
 * Each event is a fraud signal: discount applied after pay, item
 * transferred after checkout, void on a printed receipt, payment
 * method swapped retroactively.
 *
 * The conclusion banner names the top offender by money impact so
 * the owner knows whom to investigate first.
 */
@Component({
  selector: 'app-post-checkout',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Page header -->
      <div>
        <h1 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">
          {{ lang.language() === 'ar' ? 'تعديلات بعد الدفع' : 'Post-checkout modifications' }}
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {{ lang.language() === 'ar'
              ? 'كل تعديل اتعمل على أوردر بعد ما اتدفع — إشارات تنبيه للسرقة أو الفوضى'
              : 'Every mutation that happened AFTER the customer paid — fraud / chaos signals' }}
        </p>
      </div>

      <div *ngIf="loading()" class="card-padded animate-pulse">
        <div class="h-3 w-40 bg-slate-200 dark:bg-slate-700 rounded"></div>
        <div class="h-32 w-full bg-slate-200 dark:bg-slate-700 rounded mt-3"></div>
      </div>

      <div *ngIf="error()" class="card-padded ring-1 ring-critical/30 bg-critical-soft text-critical">
        <strong>{{ lang.language() === 'ar' ? 'خطأ:' : 'Error:' }}</strong> {{ error() }}
      </div>

      <ng-container *ngIf="data() as d; else needsContext">
        <!-- Conclusion banner -->
        <div class="card-padded"
             [class.bg-success-soft]="d.totalEvents === 0"
             [class.ring-success]="d.totalEvents === 0"
             [class.bg-critical-soft]="d.totalEvents > 0"
             [class.ring-critical]="d.totalEvents > 0"
             [class]="d.totalEvents > 0 ? 'ring-1 ring-critical/30' : 'ring-1 ring-success/30'">
          <h3 class="text-sm font-semibold mb-1"
              [class.text-success]="d.totalEvents === 0"
              [class.text-critical]="d.totalEvents > 0">
            {{ d.totalEvents === 0
                ? (lang.language() === 'ar' ? 'كل حاجة سليمة' : 'Clean operations')
                : (lang.language() === 'ar' ? 'تنبيه' : 'Investigation needed') }}
          </h3>
          <p class="text-sm text-slate-700 dark:text-slate-200">
            {{ lang.language() === 'ar' ? d.conclusion.descriptionAr : d.conclusion.descriptionEn }}
          </p>
        </div>

        <!-- KPI cards -->
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div class="card-padded">
            <div class="text-xs text-slate-500 uppercase tracking-wider">
              {{ lang.language() === 'ar' ? 'إجمالي التعديلات' : 'Total events' }}
            </div>
            <div class="tabular text-2xl font-bold mt-1"
                 [class.text-success]="d.totalEvents === 0"
                 [class.text-critical]="d.totalEvents > 0">
              {{ d.totalEvents | number }}
            </div>
          </div>
          <div class="card-padded">
            <div class="text-xs text-slate-500 uppercase tracking-wider">
              {{ lang.language() === 'ar' ? 'تأثير مالي إجمالي' : 'Total money impact' }}
            </div>
            <div class="tabular text-2xl font-bold text-critical mt-1">
              {{ d.totalMoneyImpact | number:'1.0-2' }}
            </div>
          </div>
          <div class="card-padded">
            <div class="text-xs text-slate-500 uppercase tracking-wider">
              {{ lang.language() === 'ar' ? 'مستخدمين متورطين' : 'Users involved' }}
            </div>
            <div class="tabular text-2xl font-bold text-slate-900 dark:text-slate-50 mt-1">
              {{ d.byUser.length || 0 }}
            </div>
          </div>
        </div>

        <!-- Per-user rollup -->
        <div *ngIf="d.byUser.length" class="card-padded">
          <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
            {{ lang.language() === 'ar' ? 'حسب المستخدم' : 'By user' }}
          </h3>
          <div class="space-y-2">
            <div *ngFor="let u of d.byUser"
                 class="flex items-center justify-between gap-3 p-3 rounded-card-sm bg-slate-50 dark:bg-surface-dark-muted/30
                        hover:bg-slate-100 dark:hover:bg-surface-dark-muted/60 transition-colors duration-180">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-sm font-semibold text-slate-900 dark:text-slate-50">{{ u.userName }}</span>
                  <span *ngFor="let kv of breakdownEntries(u)"
                        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-card-sm text-[10px] ring-1
                               bg-warning-soft text-warning ring-warning/30">
                    {{ kv.key }} · {{ kv.value }}
                  </span>
                </div>
                <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {{ u.eventCount }} {{ lang.language() === 'ar' ? 'حدث' : 'event(s)' }}
                </div>
              </div>
              <div class="text-end shrink-0">
                <div class="tabular text-lg font-bold text-critical">{{ u.totalImpact | number:'1.0-2' }}</div>
                <div class="text-[10px] text-slate-400">
                  {{ lang.language() === 'ar' ? 'تأثير' : 'impact' }}
                </div>
              </div>
              <button type="button" (click)="openUserSession(u.userId)"
                      class="btn-ghost text-xs shrink-0">
                {{ lang.language() === 'ar' ? 'جلسات المستخدم ↗' : 'Sessions ↗' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Top events table -->
        <div *ngIf="d.events.length" class="card-padded overflow-x-auto">
          <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
            {{ lang.language() === 'ar' ? 'الأحداث (أعلى تأثيراً)' : 'Events (highest impact first)' }}
            <span class="text-xs text-slate-400 ms-1">({{ d.events.length }})</span>
          </h3>
          <table class="w-full text-xs tabular">
            <thead>
              <tr class="text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th class="text-start py-2 font-normal">{{ lang.language() === 'ar' ? 'الإجراء' : 'Action' }}</th>
                <th class="text-start py-2 font-normal">{{ lang.language() === 'ar' ? 'أوردر' : 'Order' }}</th>
                <th class="text-start py-2 font-normal">{{ lang.language() === 'ar' ? 'بواسطة' : 'By' }}</th>
                <th class="text-end py-2 font-normal">{{ lang.language() === 'ar' ? 'بعد الدفع' : 'After pay' }}</th>
                <th class="text-end py-2 font-normal">{{ lang.language() === 'ar' ? 'الصافي قبل' : 'Net before' }}</th>
                <th class="text-end py-2 font-normal">{{ lang.language() === 'ar' ? 'الصافي بعد' : 'Net after' }}</th>
                <th class="text-end py-2 font-normal">{{ lang.language() === 'ar' ? 'تأثير' : 'Impact' }}</th>
                <th class="text-start py-2 font-normal">{{ lang.language() === 'ar' ? 'الوقت' : 'Time' }}</th>
                <th class="w-8"></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let e of d.events"
                  class="border-b border-slate-100 dark:border-slate-800/40
                         hover:bg-slate-50 dark:hover:bg-surface-dark-muted/30 transition-colors duration-180">
                <td class="py-2">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-card-sm text-[10px] ring-1
                               bg-warning-soft text-warning ring-warning/30">
                    {{ e.actionType }}
                  </span>
                </td>
                <td class="py-2 text-slate-700 dark:text-slate-200">
                  #{{ e.orderId }}
                  <span *ngIf="e.tableName" class="text-slate-400 ms-1">· {{ e.tableName }}</span>
                </td>
                <td class="py-2 text-slate-700 dark:text-slate-200">{{ e.userName || '—' }}</td>
                <td class="py-2 text-end text-slate-500">+{{ e.minutesAfterPay }}m</td>
                <td class="py-2 text-end text-slate-500">{{ e.netBefore | number:'1.0-2' }}</td>
                <td class="py-2 text-end text-slate-700 dark:text-slate-200">{{ e.netAfter | number:'1.0-2' }}</td>
                <td class="py-2 text-end font-semibold text-critical">{{ e.moneyImpact | number:'1.0-2' }}</td>
                <td class="py-2 text-slate-500">{{ e.actionDate | date:'short' }}</td>
                <td class="py-2 text-end">
                  <button type="button" (click)="openJourney(e.orderId)"
                          class="text-[10px] text-brand-600 dark:text-brand-400 hover:underline">
                    ↗
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ng-container>

      <ng-template #needsContext>
        <div *ngIf="!loading() && !error()" class="card-padded text-center py-12">
          <p class="text-sm text-slate-500 dark:text-slate-400">
            {{ lang.language() === 'ar' ? 'اختر فرع ومدة في الـ Header.' : 'Pick a branch and date range in the header.' }}
          </p>
        </div>
      </ng-template>
    </div>
  `,
})
export class PostCheckoutComponent {
  private readonly api = inject(OwnerInsightsApi);
  private readonly filter = inject(FilterService);
  private readonly router = inject(Router);
  readonly lang = inject(LanguageService);

  readonly data = signal<PostCheckoutModificationsResult | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  constructor() {
    effect(() => {
      const ok = this.filter.canFetch();
      if (ok) this.reload();
      else this.data.set(null);
    });
  }

  reload(): void {
    if (!this.filter.canFetch()) return;
    this.loading.set(true);
    this.error.set('');
    this.api.postCheckoutModifications({
      fromDate: this.filter.fromDate(),
      toDate:   this.filter.toDate(),
      branchId: this.filter.branchId() ?? undefined,
      language: this.lang.language(),
    }).subscribe({
      next: (res) => { this.data.set(res); this.loading.set(false); },
      error: (e)  => { this.error.set(e?.message || 'Failed to load'); this.loading.set(false); },
    });
  }

  breakdownEntries(u: PostCheckoutUserRollup): { key: string; value: number }[] {
    if (!u.byActionType) return [];
    return Object.entries(u.byActionType)
      .map(([key, value]) => ({ key, value: value as number }))
      .sort((a, b) => b.value - a.value);
  }

  openUserSession(userId: string): void {
    this.router.navigate(['/audit/user-session'], { queryParams: { userId } });
  }

  openJourney(orderId: number): void {
    if (orderId > 0) {
      this.router.navigate(['/audit/order-journey'], { queryParams: { orderId } });
    }
  }
}
