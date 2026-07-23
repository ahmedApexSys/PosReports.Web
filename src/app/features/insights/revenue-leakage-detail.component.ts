import { Component, inject, signal, effect, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  NgApexchartsModule,
  ApexAxisChartSeries,
  ApexNonAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexFill,
  ApexGrid,
  ApexPlotOptions,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
  ApexLegend,
} from 'ng-apexcharts';
import { OwnerInsightsApi } from '../../core/api/owner-insights.api';
import { RevenueLeakageSummaryDto } from '../../core/models/owner-insights.models';
import { FilterService } from '../../core/filters/filter.service';
import { LanguageService } from '../../core/i18n/language.service';

/**
 * `POST /api/BusinessIntelligence/RevenueLeakageSummary`
 *
 * "Where is money leaking? Discounts, voids, cancels, promo codes —
 *  as percentages." Surfaces every channel that reduces net revenue,
 *  trends over time, and the top users responsible. Drill-down on
 *  the user list jumps to /audit/user-session.
 */
@Component({
  selector: 'app-revenue-leakage-detail',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Page header -->
      <div>
        <h1 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">
          {{ lang.language() === 'ar' ? 'تسرّب الإيرادات — تفاصيل' : 'Revenue leakage — detail' }}
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {{ lang.language() === 'ar'
              ? 'كل قناة بتقلل من الصافي — خصومات، voids، إلغاء، promo codes'
              : 'Every channel that reduces net — discounts, voids, cancels, promo codes' }}
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
        <!-- The report could not be fully computed (window too wide, or the query threw). Its zeros
             are "not measured", not "no leakage" — a neutral note, never the green all-clear. -->
        <div *ngIf="d.partial" class="card-padded ring-1 ring-slate-200 dark:ring-slate-700 bg-slate-50 dark:bg-slate-800/40">
          <h3 class="text-sm font-semibold mb-1 text-slate-700 dark:text-slate-200">
            {{ lang.language() === 'ar' ? 'تعذّر حساب التقرير' : 'Report could not be computed' }}
          </h3>
          <p class="text-sm text-slate-600 dark:text-slate-300">
            {{ (lang.language() === 'ar' ? d.partialReasonAr : d.partialReason)
               || (lang.language() === 'ar' ? 'جرّب فترة أضيق.' : 'Try a narrower window.') }}
          </p>
        </div>

        <!-- Insight banner — hidden when partial so a failed report never shows a green 0%. -->
        <div *ngIf="!d.partial" class="card-padded"
             [class]="d.leakagePercent < 3
                       ? 'ring-1 ring-success/30 bg-success-soft'
                       : d.leakagePercent < 8
                         ? 'ring-1 ring-warning/30 bg-warning-soft'
                         : 'ring-1 ring-critical/30 bg-critical-soft'">
          <h3 class="text-sm font-semibold mb-1"
              [class.text-success]="d.leakagePercent < 3"
              [class.text-warning]="d.leakagePercent >= 3 && d.leakagePercent < 8"
              [class.text-critical]="d.leakagePercent >= 8">
            {{ d.leakagePercent < 3
                ? (lang.language() === 'ar' ? 'تسرّب منخفض' : 'Low leakage')
                : d.leakagePercent < 8
                  ? (lang.language() === 'ar' ? 'تحت المراقبة' : 'Watch list')
                  : (lang.language() === 'ar' ? 'تسرّب مرتفع' : 'High leakage') }}
          </h3>
          <p class="text-sm text-slate-700 dark:text-slate-200">
            {{ lang.language() === 'ar' ? d.leakageInsightAr : d.leakageInsight }}
          </p>
        </div>

        <!-- KPI row -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="card-padded">
            <div class="text-xs text-slate-500 uppercase tracking-wider">
              {{ lang.language() === 'ar' ? 'إجمالي قبل الخصومات' : 'Gross revenue' }}
            </div>
            <div class="tabular text-2xl font-bold text-slate-900 dark:text-slate-50 mt-1">
              {{ d.grossRevenue | number:'1.0-2' }}
            </div>
          </div>
          <div class="card-padded">
            <div class="text-xs text-slate-500 uppercase tracking-wider">
              {{ lang.language() === 'ar' ? 'الصافي' : 'Net revenue' }}
            </div>
            <div class="tabular text-2xl font-bold text-success mt-1">
              {{ d.netRevenue | number:'1.0-2' }}
            </div>
          </div>
          <div class="card-padded">
            <div class="text-xs text-slate-500 uppercase tracking-wider">
              {{ lang.language() === 'ar' ? 'إجمالي التسرّب' : 'Total leakage' }}
            </div>
            <div class="tabular text-2xl font-bold text-critical mt-1">
              {{ d.totalLeakage | number:'1.0-2' }}
            </div>
          </div>
          <div class="card-padded"
               [class.bg-success-soft]="d.leakagePercent < 3"
               [class.bg-warning-soft]="d.leakagePercent >= 3 && d.leakagePercent < 8"
               [class.bg-critical-soft]="d.leakagePercent >= 8">
            <div class="text-xs text-slate-500 uppercase tracking-wider">
              {{ lang.language() === 'ar' ? 'نسبة التسرّب' : 'Leakage %' }}
            </div>
            <div class="tabular text-2xl font-bold mt-1"
                 [class.text-success]="d.leakagePercent < 3"
                 [class.text-warning]="d.leakagePercent >= 3 && d.leakagePercent < 8"
                 [class.text-critical]="d.leakagePercent >= 8">
              {{ d.leakagePercent | number:'1.0-1' }}%
            </div>
          </div>
        </div>

        <!-- Channels donut + table side by side -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div *ngIf="channelSeries().length > 0" class="card-padded">
            <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
              {{ lang.language() === 'ar' ? 'حسب القناة' : 'By channel' }}
            </h3>
            <apx-chart
              [series]="channelSeries()"
              [chart]="donutChartConfig"
              [labels]="channelLabels()"
              [legend]="donutLegend"
              [dataLabels]="donutDataLabels"
              [tooltip]="chartTooltip"
              [colors]="donutColors">
            </apx-chart>
          </div>

          <div *ngIf="d.byChannel.length" class="card-padded overflow-x-auto">
            <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
              {{ lang.language() === 'ar' ? 'تفاصيل القنوات' : 'Channel breakdown' }}
            </h3>
            <table class="w-full text-xs tabular">
              <thead>
                <tr class="text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th class="text-start py-2 font-normal">{{ lang.language() === 'ar' ? 'قناة' : 'Channel' }}</th>
                  <th class="text-end py-2 font-normal">{{ lang.language() === 'ar' ? 'مبلغ' : 'Amount' }}</th>
                  <th class="text-end py-2 font-normal">%</th>
                  <th class="text-end py-2 font-normal">{{ lang.language() === 'ar' ? 'أحداث' : 'Events' }}</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let c of d.byChannel"
                    class="border-b border-slate-100 dark:border-slate-800/40
                           hover:bg-slate-50 dark:hover:bg-surface-dark-muted/30 transition-colors duration-180">
                  <td class="py-2 text-slate-900 dark:text-slate-50 font-medium">
                    {{ lang.language() === 'ar' ? c.channelAr || c.channel : c.channel }}
                  </td>
                  <td class="py-2 text-end text-critical font-semibold">{{ c.amount | number:'1.0-2' }}</td>
                  <td class="py-2 text-end text-slate-500">{{ c.percent | number:'1.0-1' }}%</td>
                  <td class="py-2 text-end text-slate-500">{{ c.eventCount | number }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Trend line -->
        <div *ngIf="trendSeries().length > 0 && trendSeries()[0].data.length > 0"
             class="card-padded">
          <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
            {{ lang.language() === 'ar' ? 'تطوّر التسرّب يومياً' : 'Daily leakage trend' }}
          </h3>
          <apx-chart
            [series]="trendSeries()"
            [chart]="lineChartConfig"
            [xaxis]="trendXAxis()"
            [yaxis]="lineYAxis"
            [stroke]="lineStroke"
            [dataLabels]="lineDataLabels"
            [grid]="chartGrid"
            [fill]="lineFill"
            [tooltip]="chartTooltip"
            [colors]="lineColors">
          </apx-chart>
        </div>

        <!-- Top leaking users -->
        <div *ngIf="d.topLeakingUsers.length" class="card-padded overflow-x-auto">
          <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
            {{ lang.language() === 'ar' ? 'أعلى مستخدمين تسرّباً' : 'Top leaking users' }}
            <span class="text-xs text-slate-400 ms-1">({{ d.topLeakingUsers.length }})</span>
          </h3>
          <table class="w-full text-xs tabular">
            <thead>
              <tr class="text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th class="text-start py-2 font-normal w-8">#</th>
                <th class="text-start py-2 font-normal">{{ lang.language() === 'ar' ? 'الموظف' : 'User' }}</th>
                <th class="text-end py-2 font-normal">{{ lang.language() === 'ar' ? 'إجمالي تسرّب' : 'Total leakage' }}</th>
                <th class="text-start py-2 font-normal">{{ lang.language() === 'ar' ? 'القناة الرئيسية' : 'Top channel' }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let u of d.topLeakingUsers; let i = index"
                  class="border-b border-slate-100 dark:border-slate-800/40
                         hover:bg-slate-50 dark:hover:bg-surface-dark-muted/30 transition-colors duration-180">
                <td class="py-2 text-slate-400">{{ i + 1 }}</td>
                <td class="py-2 text-slate-900 dark:text-slate-50 font-medium">{{ u.userName }}</td>
                <td class="py-2 text-end text-critical font-semibold">{{ u.totalLeakage | number:'1.0-2' }}</td>
                <td class="py-2 text-slate-500">
                  {{ lang.language() === 'ar' ? u.topChannelAr || u.topChannel : u.topChannel }}
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
export class RevenueLeakageDetailComponent {
  private readonly api = inject(OwnerInsightsApi);
  private readonly filter = inject(FilterService);
  readonly lang = inject(LanguageService);

  readonly data = signal<RevenueLeakageSummaryDto | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  // ── Donut (channels) ─────────────────────────────────────────────────
  readonly donutChartConfig: ApexChart = {
    type: 'donut',
    height: 320,
    foreColor: 'rgb(100 116 139)',
  };
  readonly donutLegend: ApexLegend = { position: 'bottom' };
  readonly donutDataLabels: ApexDataLabels = {
    enabled: true,
    formatter: (val) => (typeof val === 'number' ? `${val.toFixed(1)}%` : `${val}`),
  };
  readonly donutColors: string[] = ['#dc2626', '#f59e0b', '#2563eb', '#10b981', '#a855f7', '#0ea5e9'];

  readonly channelSeries = computed<ApexNonAxisChartSeries>(() => {
    const ch = this.data()?.byChannel ?? [];
    return ch.map((c) => Math.round(c.amount * 100) / 100);
  });

  readonly channelLabels = computed<string[]>(() => {
    const ch = this.data()?.byChannel ?? [];
    const ar = this.lang.language() === 'ar';
    return ch.map((c) => (ar ? c.channelAr || c.channel : c.channel));
  });

  // ── Line (daily trend) ───────────────────────────────────────────────
  readonly lineChartConfig: ApexChart = {
    type: 'area',
    height: 280,
    toolbar: { show: false },
    zoom: { enabled: false },
    foreColor: 'rgb(100 116 139)',
  };
  readonly lineStroke: ApexStroke = { curve: 'smooth', width: 2 };
  readonly lineDataLabels: ApexDataLabels = { enabled: false };
  readonly lineFill: ApexFill = { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05 } };
  readonly lineYAxis: ApexYAxis = { labels: { formatter: (v) => `${(v ?? 0).toFixed(1)}%` } };
  readonly lineColors: string[] = ['#dc2626'];
  readonly chartGrid: ApexGrid = { borderColor: 'rgba(148, 163, 184, 0.2)', strokeDashArray: 4 };
  readonly chartTooltip: ApexTooltip = { theme: 'dark', shared: true };

  readonly trendSeries = computed<ApexAxisChartSeries>(() => {
    const trend = this.data()?.trendByDay ?? [];
    return [{
      name: this.lang.language() === 'ar' ? 'نسبة التسرّب' : 'Leakage %',
      data: trend.map((t) => Math.round(t.leakagePercent * 10) / 10),
    }];
  });

  readonly trendXAxis = computed<ApexXAxis>(() => {
    const trend = this.data()?.trendByDay ?? [];
    return { categories: trend.map((t) => t.date) };
  });

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
    this.api.revenueLeakageSummary({
      fromDate: this.filter.fromDate(),
      toDate:   this.filter.toDate(),
      branchId: this.filter.branchId() ?? undefined,
      language: this.lang.language(),
    }).subscribe({
      next: (res) => { this.data.set(res); this.loading.set(false); },
      // Clear the data on failure. Otherwise a previous window's panel — often a green
      // "Low leakage 0%" — stayed on screen beside the error banner, reading as reassurance
      // when the real answer is "we could not measure it".
      error: (e)  => { this.error.set(e?.message || 'Failed to load'); this.data.set(null); this.loading.set(false); },
    });
  }
}
