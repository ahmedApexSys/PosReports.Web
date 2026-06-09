import {
  Component,
  Input,
  inject,
  signal,
  computed,
  effect,
  ChangeDetectionStrategy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Loader, RefreshCw, Building2 } from 'lucide-angular';
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
} from 'ng-apexcharts';
import { Observable } from 'rxjs';
import { catchError, finalize, of } from 'rxjs';
import { LanguageService } from '../../core/i18n/language.service';
import { FilterService } from '../../core/filters/filter.service';
import { KpiCardComponent } from '../kpi-card/kpi-card.component';
import { InsightCardComponent } from '../insight-card/insight-card.component';
import { ChartCardComponent } from '../chart-card/chart-card.component';
import { ConclusionBannerComponent } from '../conclusion-banner/conclusion-banner.component';
import { BiPanel, BiReportRequest, BiText, CategorySlice } from '../../core/models/bi.models';
import { dataValueLabel } from '../../core/i18n/monitoring-labels';

/**
 * Generic page shell for ANY BiPanel-returning endpoint. The 13 BI/Insights
 * report routes are each one thin wrapper that supplies:
 *  - a bilingual title + optional subtitle
 *  - a `fetchFn` lambda that wraps the appropriate `BiApi` method
 *
 * The shell owns: filter-driven auto-reload, loading/skeleton/error states,
 * and the full panel rendering (KPIs, time-series with ApexCharts,
 * categories, pareto bars, insights, conclusion). Layout matches
 * DashboardComponent exactly — both routes consume the same shell so the
 * look and feel stay aligned without duplicating 200 lines per page.
 */
interface TimeSeriesChartOptions {
  title: BiText;
  series: ApexAxisChartSeries;
  chartConfig: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  stroke: ApexStroke;
  dataLabels: ApexDataLabels;
  grid: ApexGrid;
  fill: ApexFill;
  tooltip: ApexTooltip;
  colors: string[];
}

@Component({
  selector: 'app-bi-panel-page',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    NgApexchartsModule,
    KpiCardComponent,
    InsightCardComponent,
    ChartCardComponent,
    ConclusionBannerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Page header -->
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">
            {{ lang.language() === 'ar' ? titleAr : titleEn }}
          </h1>
          <p *ngIf="subtitleEn || subtitleAr"
             class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {{ lang.language() === 'ar' ? (subtitleAr || subtitleEn) : (subtitleEn || subtitleAr) }}
          </p>
        </div>
        <button (click)="reload()" class="btn-ghost text-sm"
                [disabled]="loading() || !filter.canFetch()">
          <lucide-icon [img]="loading() ? Loader : RefreshIcon"
                       class="h-4 w-4"
                       [class.animate-spin]="loading()"></lucide-icon>
          {{ lang.language() === 'ar' ? 'تحديث' : 'Refresh' }}
        </button>
      </div>

      <!-- Empty state: branch not selected or dates invalid -->
      <div *ngIf="!filter.canFetch()" class="card-padded text-center py-12 md:py-16 space-y-4">
        <div class="inline-flex h-14 w-14 items-center justify-center rounded-2xl
                    bg-warning-soft text-warning ring-1 ring-warning/30">
          <lucide-icon [img]="BuildingIcon" class="h-7 w-7"></lucide-icon>
        </div>
        <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-50">
          {{ filter.validateBilingual(lang.language() === 'ar' ? 'ar' : 'en') }}
        </h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          {{ lang.language() === 'ar'
              ? 'مفيش بيانات هتظهر قبل ما تختار فرع وفترة زمنية صالحة من الـ Header.'
              : 'No data will load until a branch and a valid date range are selected in the header.' }}
        </p>
      </div>

      <!-- Skeleton state -->
      <ng-container *ngIf="filter.canFetch() && loading() && !panel(); else loadedOrIdle">
        <div class="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          <div *ngFor="let i of [1,2,3,4]" class="card-padded animate-pulse h-32">
            <div class="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded"></div>
            <div class="h-8 w-32 bg-slate-200 dark:bg-slate-700 rounded mt-3"></div>
            <div class="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded mt-3"></div>
          </div>
        </div>
        <div class="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-3 mt-6">
          <div *ngFor="let i of [1,2,3]" class="card-padded animate-pulse h-64">
            <div class="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded"></div>
            <div class="h-48 w-full bg-slate-200 dark:bg-slate-700 rounded mt-4"></div>
          </div>
        </div>
      </ng-container>

      <!-- Loaded state -->
      <ng-template #loadedOrIdle>
       <ng-container *ngIf="filter.canFetch()">
        <!-- Error banner -->
        <div *ngIf="error()" class="card-padded ring-1 ring-critical/30 bg-critical-soft text-critical">
          <strong>{{ lang.language() === 'ar' ? 'خطأ:' : 'Error:' }}</strong> {{ error() }}
        </div>

        <ng-container *ngIf="panel() as p">
          <!-- KPI grid -->
          <section *ngIf="p.kpis.length" class="grid gap-4 md:gap-6
                          grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
            <app-kpi-card *ngFor="let k of p.kpis" [data]="k"></app-kpi-card>
          </section>

          <!-- Charts row 1: time-series (full width) — real ApexCharts -->
          <section *ngIf="timeSeriesCharts().length" class="grid grid-cols-1 gap-4 md:gap-6 mt-2">
            <app-chart-card *ngFor="let chart of timeSeriesCharts()" [title]="chart.title">
              <apx-chart
                [series]="chart.series"
                [chart]="chart.chartConfig"
                [xaxis]="chart.xaxis"
                [yaxis]="chart.yaxis"
                [stroke]="chart.stroke"
                [dataLabels]="chart.dataLabels"
                [grid]="chart.grid"
                [fill]="chart.fill"
                [tooltip]="chart.tooltip"
                [colors]="chart.colors"
              ></apx-chart>
            </app-chart-card>
          </section>

          <!-- Charts row 2: categories -->
          <section *ngIf="p.categories.length" class="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
            <app-chart-card *ngFor="let c of p.categories" [title]="c.title">
              <div class="space-y-2">
                <div *ngFor="let s of c.slices.slice(0, 6); let i = index"
                     class="flex items-center gap-3 text-sm">
                  <div class="h-2.5 w-2.5 rounded-full shrink-0"
                       [style.background]="paletteFor(i)"></div>
                  <span class="flex-1 truncate text-slate-700 dark:text-slate-300">
                    {{ sliceLabel(s) }}
                  </span>
                  <span class="tabular text-slate-900 dark:text-slate-100 font-medium">
                    {{ s.value | number:'1.0-2' }}
                  </span>
                  <span *ngIf="s.percent != null" class="text-xs text-slate-500 dark:text-slate-400 w-12 text-end tabular">
                    {{ (s.percent * 100) | number:'1.0-1' }}%
                  </span>
                </div>
              </div>
            </app-chart-card>
          </section>

          <!-- Pareto -->
          <section *ngIf="p.paretos.length" class="space-y-4 md:space-y-6">
            <app-chart-card *ngFor="let pa of p.paretos" [title]="pa.title">
              <div class="space-y-1.5">
                <div *ngFor="let r of pa.rows.slice(0, 10); let i = index"
                     class="flex items-center gap-3 text-sm">
                  <span class="w-6 tabular text-slate-400 text-xs">{{ i + 1 }}</span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2 mb-1">
                      <span class="truncate text-slate-700 dark:text-slate-300">{{ lang.pick(r.label) }}</span>
                      <span class="tabular text-slate-900 dark:text-slate-100 font-medium">
                        {{ r.value | number:'1.0-2' }}
                      </span>
                    </div>
                    <div class="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div class="h-full transition-all duration-500"
                           [class]="r.inTopBand ? 'bg-brand-600' : 'bg-slate-400'"
                           [style.width.%]="barWidth(r.value, pa.rows[0].value)"></div>
                    </div>
                  </div>
                  <span class="tabular text-xs text-slate-500 w-12 text-end">
                    {{ (r.cumulativePercent * 100) | number:'1.0-1' }}%
                  </span>
                </div>
              </div>
            </app-chart-card>
          </section>

          <!-- Insights -->
          <section *ngIf="p.insights.length" class="space-y-3">
            <h2 class="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {{ lang.language() === 'ar' ? 'رؤى وتنبيهات' : 'Insights' }}
              <span class="text-xs text-slate-400">({{ p.insights.length }})</span>
            </h2>
            <app-insight-card *ngFor="let ins of p.insights"
                              [data]="ins"
                              (dismiss)="onDismissInsight($event)"></app-insight-card>
          </section>

          <!-- Conclusion -->
          <app-conclusion-banner *ngIf="p.conclusion" [text]="p.conclusion"></app-conclusion-banner>

          <!-- Empty body fallback — endpoint returned a panel but nothing to render -->
          <div *ngIf="!p.kpis.length && !p.categories.length && !p.timeSeries.length
                       && !p.paretos.length && !p.insights.length"
               class="card-padded text-center py-10">
            <p class="text-sm text-slate-500 dark:text-slate-400">
              {{ lang.language() === 'ar'
                  ? 'مفيش بيانات في الفترة دي.'
                  : 'No data in the selected window.' }}
            </p>
          </div>
        </ng-container>
       </ng-container>
      </ng-template>
    </div>
  `,
})
export class BiPanelPageComponent implements OnInit {
  /** Bilingual title shown in the page header. Required. */
  @Input({ required: true }) titleEn!: string;
  @Input({ required: true }) titleAr!: string;
  /** Optional bilingual subtitle. */
  @Input() subtitleEn?: string;
  @Input() subtitleAr?: string;
  /**
   * The endpoint lambda. Provided by the page-level component which
   * captures the right `BiApi` method, e.g.
   *   fetchFn = (req) => this.api.kpiSummary(req)
   */
  @Input({ required: true }) fetchFn!: (req: BiReportRequest) => Observable<BiPanel>;

  readonly lang = inject(LanguageService);
  readonly filter = inject(FilterService);

  readonly panel = signal<BiPanel | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly Loader = Loader;
  readonly RefreshIcon = RefreshCw;
  readonly BuildingIcon = Building2;

  private static readonly CHART_PALETTE = [
    '#0F766E', '#3B82F6', '#F59E0B', '#EF4444',
    '#10B981', '#A855F7', '#F97316', '#0EA5E9',
  ];

  /**
   * Maps `panel().timeSeries` → ApexCharts option blocks per chart.
   * Recomputes whenever the panel signal changes; the apx-chart picks
   * up the new inputs and re-renders in place.
   */
  readonly timeSeriesCharts = computed<TimeSeriesChartOptions[]>(() => {
    const p = this.panel();
    if (!p?.timeSeries?.length) return [];
    return p.timeSeries.map((ts) => ({
      title: ts.title,
      series: ts.series.map((line) => ({
        name: this.lang.pick(line.label),
        data: line.points.map((pt) => ({
          x: new Date(pt.x).getTime(),
          y: pt.y,
        })),
      })) as ApexAxisChartSeries,
      chartConfig: {
        type: 'area',
        height: 280,
        toolbar: { show: false },
        zoom: { enabled: false },
        background: 'transparent',
        fontFamily: 'inherit',
        animations: { speed: 350 },
      } as ApexChart,
      xaxis: {
        type: 'datetime',
        labels: { style: { colors: '#94a3b8', fontSize: '11px' }, datetimeUTC: false },
        axisBorder: { show: false },
        axisTicks: { show: false },
      } as ApexXAxis,
      yaxis: {
        labels: {
          style: { colors: '#94a3b8', fontSize: '11px' },
          formatter: (v: number) =>
            v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0),
        },
      } as ApexYAxis,
      stroke: { curve: 'smooth', width: 2.5 } as ApexStroke,
      dataLabels: { enabled: false } as ApexDataLabels,
      grid: {
        borderColor: '#1e293b',
        strokeDashArray: 3,
        xaxis: { lines: { show: false } },
        padding: { left: 10, right: 10 },
      } as ApexGrid,
      fill: {
        type: 'gradient',
        gradient: { shadeIntensity: 1, opacityFrom: 0.45, opacityTo: 0.05, stops: [0, 100] },
      } as ApexFill,
      tooltip: {
        theme: 'dark',
        x: { format: 'dd MMM yyyy' },
        y: { formatter: (v: number) => v.toLocaleString() },
      } as ApexTooltip,
      colors: BiPanelPageComponent.CHART_PALETTE,
    }));
  });

  constructor() {
    // Auto-reload whenever filter (branch / dates / compare-window) becomes valid.
    effect(() => {
      const ok = this.filter.canFetch();
      if (ok) this.reload();
      else this.panel.set(null);
    });
  }

  ngOnInit(): void {
    if (this.filter.canFetch()) this.reload();
  }

  reload(): void {
    if (!this.filter.canFetch()) {
      this.error.set(this.filter.validateBilingual(this.lang.language() === 'ar' ? 'ar' : 'en'));
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.fetchFn({
      fromDate: this.filter.fromDate(),
      toDate: this.filter.toDate(),
      branchId: this.filter.branchId(),
      language: this.lang.language(),
      compareWindowDays: this.filter.compareDays(),
    }).pipe(
      catchError((err) => {
        const msg = err?.error?.message || err?.message || 'Failed to load report.';
        this.error.set(msg);
        return of(null as BiPanel | null);
      }),
      finalize(() => this.loading.set(false)),
    ).subscribe((p) => {
      if (p) this.panel.set(p);
    });
  }

  onDismissInsight(code: string): void {
    const p = this.panel();
    if (!p) return;
    this.panel.set({ ...p, insights: p.insights.filter((i) => i.code !== code) });
  }

  /**
   * Category-slice label with a data-value Arabic fallback for the few
   * payment-method / transaction-type names the server leaves untranslated
   * (e.g. "TakeAWay", "Dine In", "LEDGE"). Server-translated values pass through.
   */
  sliceLabel(s: CategorySlice): string {
    return dataValueLabel(this.lang.pick(s.label), s.key, this.lang.language());
  }

  barWidth(v: number, max: number): number {
    if (!max) return 0;
    return Math.max(2, Math.min(100, (v / max) * 100));
  }

  paletteFor(i: number): string {
    return BiPanelPageComponent['CHART_PALETTE'][i % BiPanelPageComponent['CHART_PALETTE'].length];
  }
}
