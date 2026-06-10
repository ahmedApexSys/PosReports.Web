import { Component, inject, signal, effect, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OwnerInsightsApi } from '../../core/api/owner-insights.api';
import { TopPayingCustomersResult, TopCustomerRow } from '../../core/models/owner-insights.models';
import { FilterService } from '../../core/filters/filter.service';
import { LanguageService } from '../../core/i18n/language.service';
import { ExportMenuComponent } from '../../shared/export-menu/export-menu.component';
import { ExportColumn } from '../../core/export/export.service';

/**
 * `POST /api/OwnerInsights/TopPayingCustomers`
 *
 * Marketing / owner decision view — who pays you most. The conclusion
 * banner names the percentage of revenue concentrated in the top 10
 * customers, so the owner can decide whether to invest in loyalty
 * (high concentration) or in acquisition (low concentration).
 */
@Component({
  selector: 'app-top-customers',
  standalone: true,
  imports: [CommonModule, ExportMenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Page header -->
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">
            {{ lang.language() === 'ar' ? 'أفضل العملاء دفعاً' : 'Top paying customers' }}
          </h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {{ lang.language() === 'ar'
                ? 'مين العملاء اللي بيدفعوا أكتر — ركّز عليهم لبرامج الولاء'
                : 'Who pays you the most — direct loyalty effort here' }}
          </p>
        </div>
        <app-export-menu *ngIf="data()?.customers?.length"
          [rows]="data()!.customers" [columns]="exportCols"
          titleEn="Top paying customers" titleAr="أفضل العملاء دفعاً"
          subtitleEn="Who pays you the most" subtitleAr="مين العملاء اللي بيدفعوا أكتر"
          [branch]="null"
          [fromDate]="filter.fromDate()" [toDate]="filter.toDate()"
          fileBase="top-customers"></app-export-menu>
      </div>

      <!-- Loading -->
      <div *ngIf="loading()" class="card-padded animate-pulse">
        <div class="h-3 w-40 bg-slate-200 dark:bg-slate-700 rounded"></div>
        <div class="h-32 w-full bg-slate-200 dark:bg-slate-700 rounded mt-3"></div>
      </div>

      <!-- Error -->
      <div *ngIf="error()" class="card-padded ring-1 ring-critical/30 bg-critical-soft text-critical">
        <strong>{{ lang.language() === 'ar' ? 'خطأ:' : 'Error:' }}</strong> {{ error() }}
      </div>

      <ng-container *ngIf="data() as d; else needsContext">
        <!-- Conclusion banner -->
        <div class="card-padded bg-brand-50 dark:bg-brand-900/20 ring-1 ring-brand-200 dark:ring-brand-800/50">
          <h3 class="text-sm font-semibold text-brand-700 dark:text-brand-300 mb-1">
            {{ lang.language() === 'ar' ? 'الخلاصة' : 'Conclusion' }}
          </h3>
          <p class="text-sm text-slate-700 dark:text-slate-200">
            {{ lang.language() === 'ar' ? d.conclusion.descriptionAr : d.conclusion.descriptionEn }}
          </p>
        </div>

        <!-- KPI cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="card-padded">
            <div class="text-xs text-slate-500 uppercase tracking-wider">
              {{ lang.language() === 'ar' ? 'إيراد إجمالي' : 'Total revenue' }}
            </div>
            <div class="tabular text-2xl font-bold text-slate-900 dark:text-slate-50 mt-1">
              {{ d.totalNet | number:'1.0-2' }}
            </div>
          </div>
          <div class="card-padded">
            <div class="text-xs text-slate-500 uppercase tracking-wider">
              {{ lang.language() === 'ar' ? 'أوردرات' : 'Orders' }}
            </div>
            <div class="tabular text-2xl font-bold text-slate-900 dark:text-slate-50 mt-1">
              {{ d.totalOrders | number }}
            </div>
          </div>
          <div class="card-padded">
            <div class="text-xs text-slate-500 uppercase tracking-wider">
              {{ lang.language() === 'ar' ? 'عملاء معروفين' : 'Identified' }}
            </div>
            <div class="tabular text-2xl font-bold text-slate-900 dark:text-slate-50 mt-1">
              {{ d.identifiedCount | number }}
            </div>
          </div>
          <div class="card-padded"
               [class.bg-success-soft]="d.top10Percentage >= 50"
               [class.bg-warning-soft]="d.top10Percentage > 0 && d.top10Percentage < 50">
            <div class="text-xs text-slate-500 uppercase tracking-wider">
              {{ lang.language() === 'ar' ? 'تركيز أعلى 10' : 'Top-10 share' }}
            </div>
            <div class="tabular text-2xl font-bold text-slate-900 dark:text-slate-50 mt-1">
              {{ d.top10Percentage }}%
            </div>
          </div>
        </div>

        <!-- Customer ranking table -->
        <div class="card-padded overflow-x-auto" *ngIf="d.customers.length; else noCustomers">
          <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
            {{ lang.language() === 'ar' ? 'تصنيف العملاء' : 'Customer ranking' }}
            <span class="text-xs text-slate-400 ms-1">({{ d.customers.length }})</span>
          </h3>
          <table class="w-full text-xs tabular">
            <thead>
              <tr class="text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th class="text-start py-2 font-normal w-8">#</th>
                <th class="text-start py-2 font-normal">{{ lang.language() === 'ar' ? 'العميل' : 'Customer' }}</th>
                <th class="text-start py-2 font-normal">{{ lang.language() === 'ar' ? 'موبايل' : 'Mobile' }}</th>
                <th class="text-end py-2 font-normal">{{ lang.language() === 'ar' ? 'أوردرات' : 'Orders' }}</th>
                <th class="text-end py-2 font-normal">{{ lang.language() === 'ar' ? 'إجمالي صافي' : 'Total net' }}</th>
                <th class="text-end py-2 font-normal">{{ lang.language() === 'ar' ? 'متوسط الفاتورة' : 'Avg ticket' }}</th>
                <th class="text-start py-2 font-normal">{{ lang.language() === 'ar' ? 'أول طلب' : 'First' }}</th>
                <th class="text-start py-2 font-normal">{{ lang.language() === 'ar' ? 'آخر طلب' : 'Last' }}</th>
                <th class="text-start py-2 font-normal">{{ lang.language() === 'ar' ? 'أكتر معاملة' : 'Top type' }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let c of d.customers; let i = index"
                  class="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-50 dark:hover:bg-surface-dark-muted/30 transition-colors duration-180">
                <td class="py-2 text-slate-400">{{ i + 1 }}</td>
                <td class="py-2 text-slate-700 dark:text-slate-200 font-medium">
                  {{ c.customerName || (lang.language() === 'ar' ? '(غير معروف)' : '(unknown)') }}
                </td>
                <td class="py-2 text-slate-500">{{ c.mobilePhone || '—' }}</td>
                <td class="py-2 text-end">{{ c.ordersCount }}</td>
                <td class="py-2 text-end font-semibold text-slate-900 dark:text-slate-50">{{ c.totalNet | number:'1.0-2' }}</td>
                <td class="py-2 text-end text-slate-500">{{ c.avgTicket | number:'1.0-2' }}</td>
                <td class="py-2 text-slate-500">{{ c.firstOrderAt | date:'shortDate' }}</td>
                <td class="py-2 text-slate-500">{{ c.lastOrderAt | date:'shortDate' }}</td>
                <td class="py-2 text-slate-500">{{ c.topTransaction || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <ng-template #noCustomers>
          <div class="card-padded text-center py-12 text-sm text-slate-500 dark:text-slate-400">
            {{ lang.language() === 'ar' ? 'مفيش أوردرات مدفوعة في الفترة دي.' : 'No paid orders in this window.' }}
          </div>
        </ng-template>
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
export class TopCustomersComponent {
  private readonly api = inject(OwnerInsightsApi);
  readonly filter = inject(FilterService);
  readonly lang = inject(LanguageService);

  readonly data = signal<TopPayingCustomersResult | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly exportCols: ExportColumn<TopCustomerRow>[] = [
    { headerEn: 'Customer', headerAr: 'العميل', width: 22, value: (r, l) => r.customerName || (l === 'ar' ? '(غير معروف)' : '(unknown)') },
    { headerEn: 'Mobile', headerAr: 'موبايل', width: 16, value: r => r.mobilePhone || '' },
    { headerEn: 'Orders', headerAr: 'عدد الأوردرات', width: 11, numeric: true, value: r => r.ordersCount },
    { headerEn: 'Total net', headerAr: 'الإجمالي', width: 14, numeric: true, value: r => r.totalNet },
    { headerEn: 'Avg ticket', headerAr: 'متوسط الفاتورة', width: 14, numeric: true, value: r => r.avgTicket },
    { headerEn: 'First order', headerAr: 'أول طلب', width: 12, value: r => (r.firstOrderAt || '').slice(0, 10) },
    { headerEn: 'Last order', headerAr: 'آخر طلب', width: 12, value: r => (r.lastOrderAt || '').slice(0, 10) },
    { headerEn: 'Branches', headerAr: 'الفروع', width: 10, numeric: true, value: r => r.branchesSeen },
    { headerEn: 'Top type', headerAr: 'أكتر معاملة', width: 14, value: r => r.topTransaction || '' },
  ];

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
    this.api.topPayingCustomers({
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
