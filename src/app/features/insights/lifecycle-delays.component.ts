import { Component, inject, signal, effect, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  NgApexchartsModule,
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexGrid,
  ApexPlotOptions,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
} from 'ng-apexcharts';
import { OwnerInsightsApi } from '../../core/api/owner-insights.api';
import { OrderLifecycleDelaysDto } from '../../core/models/owner-insights.models';
import { FilterService } from '../../core/filters/filter.service';
import { LanguageService } from '../../core/i18n/language.service';

/**
 * `POST /api/BusinessIntelligence/OrderLifecycleDelays`
 *
 * "Why are operations slow / where do orders get stuck?" — breaks the
 * order journey into stages and surfaces the bottleneck stage with
 * p95 / max minutes per stage, plus the slowest individual orders so
 * the manager can drill into specific incidents.
 */
@Component({
  selector: 'app-lifecycle-delays',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Page header -->
      <div>
        <h1 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">
          {{ lang.language() === 'ar' ? 'فجوات وقت العمليات' : 'Operational time gaps' }}
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {{ lang.language() === 'ar'
              ? 'فين الأوردرات بتقف — اعرف عنق الزجاجة عشان تحله'
              : 'Where orders get stuck — identify the bottleneck to fix it' }}
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
        <!-- Conclusion banner -->
        <div class="card-padded ring-1 ring-brand-200 dark:ring-brand-800/50 bg-brand-50 dark:bg-brand-900/20">
          <h3 class="text-sm font-semibold text-brand-700 dark:text-brand-300 mb-1">
            {{ lang.language() === 'ar' ? 'الخلاصة' : 'Conclusion' }}
          </h3>
          <p class="text-sm text-slate-700 dark:text-slate-200">
            {{ lang.language() === 'ar' ? d.insightAr : d.insight }}
          </p>
          <p *ngIf="d.bottleneckStage" class="text-xs text-slate-500 mt-2">
            <span class="font-semibold">{{ lang.language() === 'ar' ? 'عنق الزجاجة:' : 'Bottleneck:' }}</span>
            {{ lang.language() === 'ar' ? d.bottleneckStageAr || d.bottleneckStage : d.bottleneckStage }}
          </p>
        </div>

        <!-- KPI cards -->
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div class="card-padded">
            <div class="text-xs text-slate-500 uppercase tracking-wider">
              {{ lang.language() === 'ar' ? 'أوردرات اتحللت' : 'Orders analyzed' }}
            </div>
            <div class="tabular text-2xl font-bold text-slate-900 dark:text-slate-50 mt-1">
              {{ d.totalOrdersAnalyzed | number }}
            </div>
          </div>
          <div class="card-padded">
            <div class="text-xs text-slate-500 uppercase tracking-wider">
              {{ lang.language() === 'ar' ? 'متوسط زمن إجمالي' : 'Avg total time' }}
            </div>
            <div class="tabular text-2xl font-bold text-slate-900 dark:text-slate-50 mt-1">
              {{ d.avgTotalLifecycleMinutes | number:'1.0-1' }}m
            </div>
          </div>
          <div class="card-padded ring-1 ring-warning/30">
            <div class="text-xs text-slate-500 uppercase tracking-wider">
              {{ lang.language() === 'ar' ? 'عنق الزجاجة' : 'Bottleneck stage' }}
            </div>
            <div class="text-sm font-semibold text-warning mt-1 truncate">
              {{ lang.language() === 'ar' ? d.bottleneckStageAr || d.bottleneckStage || '—' : d.bottleneckStage || '—' }}
            </div>
          </div>
        </div>

        <!-- Stage chart -->
        <div *ngIf="stageSeries().length > 0 && stageSeries()[0].data.length > 0"
             class="card-padded">
          <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
            {{ lang.language() === 'ar' ? 'الزمن لكل مرحلة (دقيقة)' : 'Time per stage (minutes)' }}
          </h3>
          <apx-chart
            [series]="stageSeries()"
            [chart]="stageChartConfig"
            [plotOptions]="stagePlotOptions"
            [xaxis]="stageXAxis()"
            [yaxis]="chartYAxis"
            [dataLabels]="stageDataLabels"
            [grid]="chartGrid"
            [tooltip]="chartTooltip"
            [colors]="stageColors">
          </apx-chart>
        </div>

        <!-- Stage metrics table -->
        <div *ngIf="d.stageMetrics.length" class="card-padded overflow-x-auto">
          <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
            {{ lang.language() === 'ar' ? 'تفاصيل المراحل' : 'Stage breakdown' }}
          </h3>
          <table class="w-full text-xs tabular">
            <thead>
              <tr class="text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th class="text-start py-2 font-normal">{{ lang.language() === 'ar' ? 'مرحلة' : 'Stage' }}</th>
                <th class="text-end py-2 font-normal">{{ lang.language() === 'ar' ? 'متوسط' : 'Avg' }}</th>
                <th class="text-end py-2 font-normal">{{ lang.language() === 'ar' ? 'وسيط' : 'Median' }}</th>
                <th class="text-end py-2 font-normal">P95</th>
                <th class="text-end py-2 font-normal">{{ lang.language() === 'ar' ? 'أقصى' : 'Max' }}</th>
                <th class="text-end py-2 font-normal">{{ lang.language() === 'ar' ? 'متأخر' : 'Delayed' }}</th>
                <th class="text-start py-2 font-normal">{{ lang.language() === 'ar' ? 'الخطورة' : 'Severity' }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let s of d.stageMetrics"
                  class="border-b border-slate-100 dark:border-slate-800/40
                         hover:bg-slate-50 dark:hover:bg-surface-dark-muted/30 transition-colors duration-180">
                <td class="py-2 text-slate-900 dark:text-slate-50 font-medium">
                  {{ lang.language() === 'ar' ? s.stageAr || s.stage : s.stage }}
                </td>
                <td class="py-2 text-end">{{ s.avgMinutes | number:'1.0-1' }}m</td>
                <td class="py-2 text-end text-slate-500">{{ s.medianMinutes | number:'1.0-1' }}m</td>
                <td class="py-2 text-end text-warning">{{ s.p95Minutes | number:'1.0-1' }}m</td>
                <td class="py-2 text-end text-critical">{{ s.maxMinutes | number:'1.0-1' }}m</td>
                <td class="py-2 text-end">{{ s.delayedCount | number }}</td>
                <td class="py-2">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-card-sm text-[10px] ring-1"
                        [class.bg-success-soft]="severityLow(s.severity)"
                        [class.text-success]="severityLow(s.severity)"
                        [class.ring-success]="severityLow(s.severity)"
                        [class.bg-warning-soft]="severityMid(s.severity)"
                        [class.text-warning]="severityMid(s.severity)"
                        [class.ring-warning]="severityMid(s.severity)"
                        [class.bg-critical-soft]="severityHigh(s.severity)"
                        [class.text-critical]="severityHigh(s.severity)"
                        [class.ring-critical]="severityHigh(s.severity)">
                    {{ s.severity }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Top 10 slowest orders -->
        <div *ngIf="d.delayedOrders.length" class="card-padded overflow-x-auto">
          <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
            {{ lang.language() === 'ar' ? 'أبطأ الأوردرات' : 'Slowest orders' }}
            <span class="text-xs text-slate-400 ms-1">({{ d.delayedOrders.length }})</span>
          </h3>
          <table class="w-full text-xs tabular">
            <thead>
              <tr class="text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th class="text-start py-2 font-normal">{{ lang.language() === 'ar' ? 'أوردر' : 'Order' }}</th>
                <th class="text-start py-2 font-normal">{{ lang.language() === 'ar' ? 'فرع' : 'Branch' }}</th>
                <th class="text-end py-2 font-normal">{{ lang.language() === 'ar' ? 'إجمالي زمن' : 'Total time' }}</th>
                <th class="text-start py-2 font-normal">{{ lang.language() === 'ar' ? 'مرحلة عالقة' : 'Stuck in' }}</th>
                <th class="text-end py-2 font-normal">{{ lang.language() === 'ar' ? 'زمن المرحلة' : 'Stage time' }}</th>
                <th class="w-8"></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let o of d.delayedOrders"
                  class="border-b border-slate-100 dark:border-slate-800/40
                         hover:bg-slate-50 dark:hover:bg-surface-dark-muted/30 transition-colors duration-180">
                <td class="py-2 text-slate-700 dark:text-slate-200">
                  #{{ o.orderId }}
                  <span *ngIf="o.receiptNumber" class="text-slate-400 ms-1">· {{ o.receiptNumber }}</span>
                </td>
                <td class="py-2 text-slate-500">{{ o.branchName || '—' }}</td>
                <td class="py-2 text-end text-critical font-semibold">{{ o.totalMinutes | number:'1.0-1' }}m</td>
                <td class="py-2 text-warning">{{ o.bottleneckStage || '—' }}</td>
                <td class="py-2 text-end text-warning">{{ o.bottleneckMinutes | number:'1.0-1' }}m</td>
                <td class="py-2 text-end">
                  <button type="button" (click)="openJourney(o.orderId)"
                          class="text-[10px] text-brand-600 dark:text-brand-400 hover:underline">↗</button>
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
export class LifecycleDelaysComponent {
  private readonly api = inject(OwnerInsightsApi);
  private readonly filter = inject(FilterService);
  private readonly router = inject(Router);
  readonly lang = inject(LanguageService);

  readonly data = signal<OrderLifecycleDelaysDto | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  // ── Stage bar chart (avg + p95) ──────────────────────────────────────
  readonly stageChartConfig: ApexChart = {
    type: 'bar',
    height: 360,
    toolbar: { show: false },
    foreColor: 'rgb(100 116 139)',
    stacked: false,
  };
  readonly stagePlotOptions: ApexPlotOptions = {
    bar: { horizontal: false, borderRadius: 6, columnWidth: '60%' },
  };
  readonly stageDataLabels: ApexDataLabels = { enabled: false };
  readonly chartGrid: ApexGrid = { borderColor: 'rgba(148, 163, 184, 0.2)', strokeDashArray: 4 };
  readonly chartTooltip: ApexTooltip = { theme: 'dark', shared: true };
  readonly chartYAxis: ApexYAxis = { labels: { formatter: (v) => `${(v ?? 0).toFixed(1)}m` } };
  readonly stageColors: string[] = ['#2563eb', '#dc2626'];  // brand for avg, critical for p95

  readonly stageSeries = computed<ApexAxisChartSeries>(() => {
    const stages = this.data()?.stageMetrics ?? [];
    return [
      {
        name: this.lang.language() === 'ar' ? 'متوسط' : 'Avg',
        data: stages.map((s) => Math.round(s.avgMinutes * 10) / 10),
      },
      {
        name: 'P95',
        data: stages.map((s) => Math.round(s.p95Minutes * 10) / 10),
      },
    ];
  });

  readonly stageXAxis = computed<ApexXAxis>(() => {
    const stages = this.data()?.stageMetrics ?? [];
    return {
      categories: stages.map((s) => (this.lang.language() === 'ar' ? s.stageAr || s.stage : s.stage)),
      labels: { style: { fontSize: '11px' } },
    };
  });

  severityLow(s: string): boolean  { return /low|info|good/i.test(s ?? ''); }
  severityMid(s: string): boolean  { return /warn|mid|medium/i.test(s ?? ''); }
  severityHigh(s: string): boolean { return /high|critical|severe/i.test(s ?? ''); }

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
    this.api.orderLifecycleDelays({
      fromDate: this.filter.fromDate(),
      toDate:   this.filter.toDate(),
      branchId: this.filter.branchId() ?? undefined,
      language: this.lang.language(),
    }).subscribe({
      next: (res) => { this.data.set(res); this.loading.set(false); },
      error: (e)  => { this.error.set(e?.message || 'Failed to load'); this.loading.set(false); },
    });
  }

  openJourney(orderId: number): void {
    if (orderId > 0) this.router.navigate(['/audit/order-journey'], { queryParams: { orderId } });
  }
}
