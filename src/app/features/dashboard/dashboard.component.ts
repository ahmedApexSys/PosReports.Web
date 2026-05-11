import { Component, inject, signal, computed, OnInit, effect, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Loader, RefreshCw, Building2 } from 'lucide-angular';
import { BiApi } from '../../core/api/bi.api';
import { LanguageService } from '../../core/i18n/language.service';
import { FilterService } from '../../core/filters/filter.service';
import { KpiCardComponent } from '../../shared/kpi-card/kpi-card.component';
import { InsightCardComponent } from '../../shared/insight-card/insight-card.component';
import { ChartCardComponent } from '../../shared/chart-card/chart-card.component';
import { ConclusionBannerComponent } from '../../shared/conclusion-banner/conclusion-banner.component';
import { BiPanel } from '../../core/models/bi.models';
import { catchError, of, finalize } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
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
            {{ lang.language() === 'ar' ? 'لوحة الأعمال' : 'Business Dashboard' }}
          </h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {{ lang.language() === 'ar' ? 'مؤشرات حية + رؤى قابلة للتنفيذ' : 'Live KPIs + actionable insights' }}
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

      <!-- Empty state: branch not selected -->
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

      <!-- Skeleton state (only when filters valid) -->
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
          <!-- KPI grid — fluid across breakpoints -->
          <section class="grid gap-4 md:gap-6
                          grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
            <app-kpi-card *ngFor="let k of p.kpis" [data]="k"></app-kpi-card>
          </section>

          <!-- Charts row 1: time-series (full width) -->
          <section *ngIf="p.timeSeries?.length" class="grid grid-cols-1 gap-4 md:gap-6 mt-2">
            <app-chart-card *ngFor="let ts of p.timeSeries" [title]="ts.title">
              <!-- Placeholder for ApexCharts time-series; wired in next iteration -->
              <div class="flex h-64 items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
                {{ ts.series[0]?.points?.length ?? 0 }} data points · chart renders here
              </div>
            </app-chart-card>
          </section>

          <!-- Charts row 2: categories (pies + breakdowns) -->
          <section *ngIf="p.categories?.length" class="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
            <app-chart-card *ngFor="let c of p.categories" [title]="c.title">
              <div class="space-y-2">
                <div *ngFor="let s of c.slices.slice(0, 6); let i = index"
                     class="flex items-center gap-3 text-sm">
                  <div class="h-2.5 w-2.5 rounded-full shrink-0"
                       [style.background]="paletteFor(i)"></div>
                  <span class="flex-1 truncate text-slate-700 dark:text-slate-300">
                    {{ lang.pick(s.label) }}
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
          <section *ngIf="p.paretos?.length" class="space-y-4 md:space-y-6">
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
          <section *ngIf="p.insights?.length" class="space-y-3">
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
        </ng-container>
       </ng-container>
      </ng-template>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(BiApi);
  readonly lang = inject(LanguageService);
  readonly filter = inject(FilterService);

  readonly panel = signal<BiPanel | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly Loader = Loader;
  readonly RefreshIcon = RefreshCw;
  readonly BuildingIcon = Building2;

  constructor() {
    // Auto-reload whenever branch / dates change and become valid.
    effect(() => {
      const ok = this.filter.canFetch();
      if (ok) this.reload();
      else this.panel.set(null); // drop stale data when filters become invalid
    });
  }

  ngOnInit(): void {
    if (this.filter.canFetch()) this.reload();
  }

  reload(): void {
    // Hard gate — never fire an API call without a branch + valid dates.
    if (!this.filter.canFetch()) {
      this.error.set(this.filter.validateBilingual(this.lang.language() === 'ar' ? 'ar' : 'en'));
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.api.dashboard({
      fromDate: this.filter.fromDate(),
      toDate: this.filter.toDate(),
      branchId: this.filter.branchId(),
      language: this.lang.language(),
      compareWindowDays: this.filter.compareDays(),
    }).pipe(
      catchError((err) => {
        const msg = err?.error?.message || err?.message || 'Failed to load dashboard.';
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

  barWidth(v: number, max: number): number {
    if (!max) return 0;
    return Math.max(2, Math.min(100, (v / max) * 100));
  }

  paletteFor(i: number): string {
    const palette = ['#0F766E', '#3B82F6', '#F59E0B', '#EF4444', '#10B981', '#A855F7', '#F97316', '#0EA5E9'];
    return palette[i % palette.length];
  }
}
