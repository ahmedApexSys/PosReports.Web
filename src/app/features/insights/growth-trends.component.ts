import { Component, inject, signal, effect, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  NgApexchartsModule,
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexFill,
  ApexGrid,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
  ApexLegend,
} from 'ng-apexcharts';
import { OwnerInsightsApi } from '../../core/api/owner-insights.api';
import { GrowthTrendsResult, GrowthTrendPoint } from '../../core/models/owner-insights.models';
import { FilterService } from '../../core/filters/filter.service';
import { LanguageService } from '../../core/i18n/language.service';

/**
 * `POST /api/OwnerInsights/GrowthTrends`
 *
 * "How is my business growing?" — compares the current [from, to] window
 * vs the same-length window immediately before. The chart renders both
 * series so the owner sees current vs previous side by side; the
 * conclusion banner names the trend direction by percentage so the
 * decision is immediate.
 */
@Component({
  selector: 'app-growth-trends',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Page header -->
      <div>
        <h1 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">
          {{ lang.language() === 'ar' ? 'اتجاهات النمو' : 'Growth trends' }}
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {{ lang.language() === 'ar'
              ? 'الفترة الحالية مقارنة بالفترة السابقة بنفس الطول'
              : 'Current period vs same-length previous period' }}
        </p>
      </div>

      <div *ngIf="loading()" class="card-padded animate-pulse">
        <div class="h-3 w-40 bg-slate-200 dark:bg-slate-700 rounded"></div>
        <div class="h-64 w-full bg-slate-200 dark:bg-slate-700 rounded mt-3"></div>
      </div>

      <div *ngIf="error()" class="card-padded ring-1 ring-critical/30 bg-critical-soft text-critical">
        <strong>{{ lang.language() === 'ar' ? 'خطأ:' : 'Error:' }}</strong> {{ error() }}
      </div>

      <ng-container *ngIf="data() as d; else needsContext">
        <!-- Conclusion banner -->
        <div class="card-padded"
             [class]="d.netDeltaPercent > 5
                       ? 'ring-1 ring-success/30 bg-success-soft'
                       : d.netDeltaPercent < -5
                         ? 'ring-1 ring-critical/30 bg-critical-soft'
                         : 'ring-1 ring-brand-200 dark:ring-brand-800/50 bg-brand-50 dark:bg-brand-900/20'">
          <h3 class="text-sm font-semibold mb-1"
              [class.text-success]="d.netDeltaPercent > 5"
              [class.text-critical]="d.netDeltaPercent < -5"
              [class.text-brand-700]="d.netDeltaPercent >= -5 && d.netDeltaPercent <= 5">
            {{ d.netDeltaPercent > 5
                ? (lang.language() === 'ar' ? 'في نمو' : 'Growing')
                : d.netDeltaPercent < -5
                  ? (lang.language() === 'ar' ? 'في تراجع' : 'Shrinking')
                  : (lang.language() === 'ar' ? 'ثابت' : 'Flat') }}
          </h3>
          <p class="text-sm text-slate-700 dark:text-slate-200">
            {{ lang.language() === 'ar' ? d.conclusion.descriptionAr : d.conclusion.descriptionEn }}
          </p>
        </div>

        <!-- KPI cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="card-padded">
            <div class="text-xs text-slate-500 uppercase tracking-wider">
              {{ lang.language() === 'ar' ? 'إيراد الفترة الحالية' : 'Current revenue' }}
            </div>
            <div class="tabular text-2xl font-bold text-slate-900 dark:text-slate-50 mt-1">
              {{ d.currentNet | number:'1.0-2' }}
            </div>
          </div>
          <div class="card-padded">
            <div class="text-xs text-slate-500 uppercase tracking-wider">
              {{ lang.language() === 'ar' ? 'إيراد الفترة السابقة' : 'Previous revenue' }}
            </div>
            <div class="tabular text-2xl font-bold text-slate-500 mt-1">
              {{ d.previousNet | number:'1.0-2' }}
            </div>
          </div>
          <div class="card-padded"
               [class.bg-success-soft]="d.netDeltaPercent > 5"
               [class.bg-critical-soft]="d.netDeltaPercent < -5">
            <div class="text-xs text-slate-500 uppercase tracking-wider">
              {{ lang.language() === 'ar' ? 'تغيّر الإيراد' : 'Revenue change' }}
            </div>
            <div class="tabular text-2xl font-bold mt-1"
                 [class.text-success]="d.netDeltaPercent > 0"
                 [class.text-critical]="d.netDeltaPercent < 0"
                 [class.text-slate-500]="d.netDeltaPercent === 0">
              {{ d.netDeltaPercent > 0 ? '+' : '' }}{{ d.netDeltaPercent }}%
            </div>
          </div>
          <div class="card-padded"
               [class.bg-success-soft]="d.ordersDeltaPercent > 5"
               [class.bg-critical-soft]="d.ordersDeltaPercent < -5">
            <div class="text-xs text-slate-500 uppercase tracking-wider">
              {{ lang.language() === 'ar' ? 'تغيّر الأوردرات' : 'Orders change' }}
            </div>
            <div class="tabular text-2xl font-bold mt-1"
                 [class.text-success]="d.ordersDeltaPercent > 0"
                 [class.text-critical]="d.ordersDeltaPercent < 0"
                 [class.text-slate-500]="d.ordersDeltaPercent === 0">
              {{ d.ordersDeltaPercent > 0 ? '+' : '' }}{{ d.ordersDeltaPercent }}%
            </div>
          </div>
        </div>

        <!-- Chart -->
        <div class="card-padded">
          <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
            {{ lang.language() === 'ar' ? 'إيراد يومي — حالي مقابل سابق' : 'Daily revenue — current vs previous' }}
          </h3>
          <apx-chart
            [series]="chartSeries()"
            [chart]="chartConfig"
            [xaxis]="chartXAxis()"
            [yaxis]="chartYAxis"
            [stroke]="chartStroke"
            [dataLabels]="chartDataLabels"
            [grid]="chartGrid"
            [fill]="chartFill"
            [tooltip]="chartTooltip"
            [legend]="chartLegend"
            [colors]="chartColors">
          </apx-chart>
        </div>

        <!-- Series table (fallback when chart can't show full data) -->
        <div *ngIf="d.series.length" class="card-padded overflow-x-auto">
          <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
            {{ lang.language() === 'ar' ? 'تفاصيل يومية' : 'Daily breakdown' }}
            <span class="text-xs text-slate-400 ms-1">({{ d.series.length }})</span>
          </h3>
          <table class="w-full text-xs tabular">
            <thead>
              <tr class="text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th class="text-start py-2 font-normal">{{ lang.language() === 'ar' ? 'تاريخ' : 'Date' }}</th>
                <th class="text-start py-2 font-normal">{{ lang.language() === 'ar' ? 'فترة' : 'Bucket' }}</th>
                <th class="text-end py-2 font-normal">{{ lang.language() === 'ar' ? 'صافي' : 'Net' }}</th>
                <th class="text-end py-2 font-normal">{{ lang.language() === 'ar' ? 'أوردرات' : 'Orders' }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let p of d.series"
                  class="border-b border-slate-100 dark:border-slate-800/40
                         hover:bg-slate-50 dark:hover:bg-surface-dark-muted/30 transition-colors duration-180">
                <td class="py-2 text-slate-700 dark:text-slate-200">{{ p.date | date:'shortDate' }}</td>
                <td class="py-2">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-card-sm text-[10px] ring-1"
                        [class.bg-brand-50]="p.bucket === 'current'"
                        [class.text-brand-700]="p.bucket === 'current'"
                        [class.ring-brand-200]="p.bucket === 'current'"
                        [class.bg-slate-100]="p.bucket !== 'current'"
                        [class.text-slate-600]="p.bucket !== 'current'"
                        [class.ring-slate-200]="p.bucket !== 'current'">
                    {{ p.bucket === 'current'
                        ? (lang.language() === 'ar' ? 'حالي' : 'current')
                        : (lang.language() === 'ar' ? 'سابق' : 'previous') }}
                  </span>
                </td>
                <td class="py-2 text-end text-slate-700 dark:text-slate-200">{{ p.net | number:'1.0-2' }}</td>
                <td class="py-2 text-end text-slate-500">{{ p.orders | number }}</td>
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
export class GrowthTrendsComponent {
  private readonly api = inject(OwnerInsightsApi);
  private readonly filter = inject(FilterService);
  readonly lang = inject(LanguageService);

  readonly data = signal<GrowthTrendsResult | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  // ── ApexCharts config — current vs previous overlay ─────────────────
  readonly chartConfig: ApexChart = {
    type: 'area',
    height: 320,
    toolbar: { show: false },
    zoom: { enabled: false },
    foreColor: 'rgb(100 116 139)',  // slate-500 — looks fine in both themes
  };
  readonly chartStroke: ApexStroke = { curve: 'smooth', width: 2 };
  readonly chartDataLabels: ApexDataLabels = { enabled: false };
  readonly chartGrid: ApexGrid = { borderColor: 'rgba(148, 163, 184, 0.2)', strokeDashArray: 4 };
  readonly chartFill: ApexFill = { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05 } };
  readonly chartTooltip: ApexTooltip = { theme: 'dark', shared: true, intersect: false };
  readonly chartYAxis: ApexYAxis = { labels: { formatter: (v) => (v ?? 0).toLocaleString() } };
  readonly chartLegend: ApexLegend = { position: 'top', horizontalAlign: 'right' };
  readonly chartColors: string[] = ['#2563eb', '#94a3b8'];  // brand-600, slate-400

  readonly chartSeries = computed<ApexAxisChartSeries>(() => {
    const d = this.data();
    if (!d?.series?.length) return [];
    const current = d.series.filter((p) => p.bucket === 'current');
    const previous = d.series.filter((p) => p.bucket !== 'current');
    return [
      {
        name: this.lang.language() === 'ar' ? 'الفترة الحالية' : 'Current',
        data: current.map((p) => Math.round(p.net * 100) / 100),
      },
      {
        name: this.lang.language() === 'ar' ? 'الفترة السابقة' : 'Previous',
        data: previous.map((p) => Math.round(p.net * 100) / 100),
      },
    ];
  });

  readonly chartXAxis = computed<ApexXAxis>(() => {
    const d = this.data();
    if (!d?.series?.length) return { categories: [] };
    const current = d.series.filter((p) => p.bucket === 'current');
    // Use the current-window day numbers so both series align day-by-day.
    return {
      categories: current.map((p, i) => (i + 1).toString()),
      title: {
        text: this.lang.language() === 'ar' ? 'يوم في الفترة' : 'Day in window',
      },
    };
  });

  constructor() {
    effect(() => {
      // Re-read grouping inside the effect so grouping changes auto-refetch.
      const _g = this.filter.grouping();
      const ok = this.filter.canFetch();
      if (ok) this.reload();
      else this.data.set(null);
    });
  }

  reload(): void {
    if (!this.filter.canFetch()) return;
    this.loading.set(true);
    this.error.set('');
    this.api.growthTrends({
      fromDate: this.filter.fromDate(),
      toDate:   this.filter.toDate(),
      branchId: this.filter.branchId() ?? undefined,
      language: this.lang.language(),
      grouping: this.filter.grouping(),
    }).subscribe({
      next: (res) => { this.data.set(res); this.loading.set(false); },
      error: (e)  => { this.error.set(e?.message || 'Failed to load'); this.loading.set(false); },
    });
  }
}
