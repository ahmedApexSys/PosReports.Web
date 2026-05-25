import { Component, inject, signal, effect, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OwnerInsightsApi } from '../../core/api/owner-insights.api';
import { StaffScorecardDto, StaffScoreDto } from '../../core/models/owner-insights.models';
import { FilterService } from '../../core/filters/filter.service';
import { LanguageService } from '../../core/i18n/language.service';

/**
 * `POST /api/BusinessIntelligence/StaffAccountabilityScorecard`
 *
 * "Who's lazy / who's stealing?" — per-staff scorecard with three
 * 0-100 scores: Efficiency (speed + volume), Integrity (low
 * void / discount / payment-edit rate), Productivity (orders × revenue).
 *
 * The page sorts by Overall ascending so the worst performers surface
 * at the top, where management decisions need to start.
 */
@Component({
  selector: 'app-staff-gaps',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Page header -->
      <div>
        <h1 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">
          {{ lang.language() === 'ar' ? 'فجوات أداء الموظفين' : 'Staff productivity gaps' }}
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {{ lang.language() === 'ar'
              ? 'كفاءة + نزاهة + إنتاجية لكل موظف — الأسوأ أولاً'
              : 'Efficiency + Integrity + Productivity per user — worst first' }}
        </p>
      </div>

      <div *ngIf="loading()" class="card-padded animate-pulse">
        <div class="h-3 w-40 bg-slate-200 dark:bg-slate-700 rounded"></div>
        <div class="h-48 w-full bg-slate-200 dark:bg-slate-700 rounded mt-3"></div>
      </div>

      <div *ngIf="error()" class="card-padded ring-1 ring-critical/30 bg-critical-soft text-critical">
        <strong>{{ lang.language() === 'ar' ? 'خطأ:' : 'Error:' }}</strong> {{ error() }}
      </div>

      <ng-container *ngIf="data() as d; else needsContext">
        <!-- Branch averages -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="card-padded">
            <div class="text-xs text-slate-500 uppercase tracking-wider">
              {{ lang.language() === 'ar' ? 'متوسط الفاتورة' : 'Avg order value' }}
            </div>
            <div class="tabular text-2xl font-bold text-slate-900 dark:text-slate-50 mt-1">
              {{ d.branchAverages.avgOrderValue | number:'1.0-2' }}
            </div>
          </div>
          <div class="card-padded">
            <div class="text-xs text-slate-500 uppercase tracking-wider">
              {{ lang.language() === 'ar' ? 'متوسط زمن الأوردر' : 'Avg order time' }}
            </div>
            <div class="tabular text-2xl font-bold text-slate-900 dark:text-slate-50 mt-1">
              {{ d.branchAverages.avgOrderTimeMinutes | number:'1.0-1' }}m
            </div>
          </div>
          <div class="card-padded">
            <div class="text-xs text-slate-500 uppercase tracking-wider">
              {{ lang.language() === 'ar' ? 'متوسط نسبة Void' : 'Avg void rate' }}
            </div>
            <div class="tabular text-2xl font-bold text-warning mt-1">
              {{ d.branchAverages.avgVoidRate | number:'1.0-1' }}%
            </div>
          </div>
          <div class="card-padded">
            <div class="text-xs text-slate-500 uppercase tracking-wider">
              {{ lang.language() === 'ar' ? 'متوسط نسبة الخصم' : 'Avg discount rate' }}
            </div>
            <div class="tabular text-2xl font-bold text-brand-600 mt-1">
              {{ d.branchAverages.avgDiscountRate | number:'1.0-1' }}%
            </div>
          </div>
        </div>

        <!-- Bottom 5 (needs attention) banner -->
        <div *ngIf="bottomFive().length > 0"
             class="card-padded ring-1 ring-critical/30 bg-critical-soft">
          <h3 class="text-sm font-semibold text-critical mb-2">
            {{ lang.language() === 'ar' ? 'محتاجين متابعة' : 'Needs attention' }}
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-5 gap-2">
            <div *ngFor="let s of bottomFive()"
                 class="p-2 rounded-card-sm bg-white/60 dark:bg-surface-dark-muted/40 ring-1 ring-critical/20">
              <div class="text-xs font-semibold text-slate-900 dark:text-slate-50 truncate">
                {{ s.userName }}
              </div>
              <div class="text-[10px] text-slate-500 mt-0.5">{{ s.userRole || '—' }}</div>
              <div class="flex items-baseline gap-1 mt-1">
                <span class="tabular text-lg font-bold text-critical">{{ s.overallScore | number:'1.0-0' }}</span>
                <span class="text-[10px] text-slate-400">/ 100</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Full scorecard table -->
        <div *ngIf="sortedStaff().length" class="card-padded overflow-x-auto">
          <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
            {{ lang.language() === 'ar' ? 'بطاقة درجات الموظفين' : 'Staff scorecard' }}
            <span class="text-xs text-slate-400 ms-1">({{ sortedStaff().length }})</span>
          </h3>
          <table class="w-full text-xs tabular">
            <thead>
              <tr class="text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th class="text-start py-2 font-normal">{{ lang.language() === 'ar' ? 'الموظف' : 'User' }}</th>
                <th class="text-start py-2 font-normal">{{ lang.language() === 'ar' ? 'الدور' : 'Role' }}</th>
                <th class="text-end py-2 font-normal">{{ lang.language() === 'ar' ? 'أوردرات' : 'Orders' }}</th>
                <th class="text-end py-2 font-normal">{{ lang.language() === 'ar' ? 'إيراد' : 'Revenue' }}</th>
                <th class="text-end py-2 font-normal">{{ lang.language() === 'ar' ? 'خصم' : 'Disc' }}</th>
                <th class="text-end py-2 font-normal">{{ lang.language() === 'ar' ? 'Void' : 'Void' }}</th>
                <th class="text-end py-2 font-normal">{{ lang.language() === 'ar' ? 'تعديل دفع' : 'PayEdit' }}</th>
                <th class="text-end py-2 font-normal">{{ lang.language() === 'ar' ? 'كفاءة' : 'Eff' }}</th>
                <th class="text-end py-2 font-normal">{{ lang.language() === 'ar' ? 'نزاهة' : 'Integ' }}</th>
                <th class="text-end py-2 font-normal">{{ lang.language() === 'ar' ? 'إنتاجية' : 'Prod' }}</th>
                <th class="text-end py-2 font-normal">{{ lang.language() === 'ar' ? 'إجمالي' : 'Overall' }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let s of sortedStaff()"
                  class="border-b border-slate-100 dark:border-slate-800/40
                         hover:bg-slate-50 dark:hover:bg-surface-dark-muted/30 transition-colors duration-180">
                <td class="py-2 text-slate-900 dark:text-slate-50 font-medium">{{ s.userName }}</td>
                <td class="py-2 text-slate-500">{{ s.userRole || '—' }}</td>
                <td class="py-2 text-end">{{ s.ordersProcessed | number }}</td>
                <td class="py-2 text-end text-slate-700 dark:text-slate-200">{{ s.totalRevenue | number:'1.0-2' }}</td>
                <td class="py-2 text-end text-slate-500">{{ s.discountsApplied | number }}</td>
                <td class="py-2 text-end text-warning">{{ s.voidsPerformed | number }}</td>
                <td class="py-2 text-end text-critical">{{ s.paymentEdits | number }}</td>
                <td class="py-2 text-end font-semibold"
                    [class.text-success]="s.efficiencyScore >= 75"
                    [class.text-warning]="s.efficiencyScore >= 50 && s.efficiencyScore < 75"
                    [class.text-critical]="s.efficiencyScore < 50">
                  {{ s.efficiencyScore | number:'1.0-0' }}
                </td>
                <td class="py-2 text-end font-semibold"
                    [class.text-success]="s.integrityScore >= 75"
                    [class.text-warning]="s.integrityScore >= 50 && s.integrityScore < 75"
                    [class.text-critical]="s.integrityScore < 50">
                  {{ s.integrityScore | number:'1.0-0' }}
                </td>
                <td class="py-2 text-end font-semibold"
                    [class.text-success]="s.productivityScore >= 75"
                    [class.text-warning]="s.productivityScore >= 50 && s.productivityScore < 75"
                    [class.text-critical]="s.productivityScore < 50">
                  {{ s.productivityScore | number:'1.0-0' }}
                </td>
                <td class="py-2 text-end">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-card-sm text-xs font-bold ring-1"
                        [class.bg-success-soft]="s.overallScore >= 75"
                        [class.text-success]="s.overallScore >= 75"
                        [class.ring-success]="s.overallScore >= 75"
                        [class.bg-warning-soft]="s.overallScore >= 50 && s.overallScore < 75"
                        [class.text-warning]="s.overallScore >= 50 && s.overallScore < 75"
                        [class.ring-warning]="s.overallScore >= 50 && s.overallScore < 75"
                        [class.bg-critical-soft]="s.overallScore < 50"
                        [class.text-critical]="s.overallScore < 50"
                        [class.ring-critical]="s.overallScore < 50">
                    {{ s.overallScore | number:'1.0-0' }}
                  </span>
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
export class StaffGapsComponent {
  private readonly api = inject(OwnerInsightsApi);
  private readonly filter = inject(FilterService);
  readonly lang = inject(LanguageService);

  readonly data = signal<StaffScorecardDto | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  /** Sort by Overall ASC so the worst performers land at the top. */
  readonly sortedStaff = computed<StaffScoreDto[]>(() => {
    const staff = this.data()?.staff ?? [];
    return [...staff].sort((a, b) => a.overallScore - b.overallScore);
  });

  readonly bottomFive = computed<StaffScoreDto[]>(() => this.sortedStaff().slice(0, 5));

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
    this.api.staffAccountabilityScorecard({
      fromDate: this.filter.fromDate(),
      toDate:   this.filter.toDate(),
      branchId: this.filter.branchId() ?? undefined,
      language: this.lang.language(),
    }).subscribe({
      next: (res) => { this.data.set(res); this.loading.set(false); },
      error: (e)  => { this.error.set(e?.message || 'Failed to load'); this.loading.set(false); },
    });
  }
}
