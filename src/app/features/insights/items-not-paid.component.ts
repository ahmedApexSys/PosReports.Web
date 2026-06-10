import { Component, inject, signal, effect, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { ItemsNotPaidResult, ItemsNotPaidRow } from '../../core/models/owner-insights.models';
import { FilterService } from '../../core/filters/filter.service';
import { LanguageService } from '../../core/i18n/language.service';
import { ExportMenuComponent } from '../../shared/export-menu/export-menu.component';
import { ExportColumn } from '../../core/export/export.service';

/**
 * `POST /api/OwnerInsights/ItemsNotPaid`
 *
 * "Which items do people NOT pay for?" — ranks every item by the
 * combined money lost to voids + cancelled-order details in the
 * window. The horizontal bar chart shows the top 10 problem items at
 * a glance; the table below has the long tail with quantities and
 * source breakdown so the operator can decide whether to retrain
 * staff or remove the item.
 */
@Component({
  selector: 'app-items-not-paid',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, ExportMenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Page header -->
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">
            {{ lang.language() === 'ar' ? 'أصناف غير مدفوعة' : 'Items not paid' }}
          </h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {{ lang.language() === 'ar'
                ? 'أصناف اتعملها void أو إلغاء — قرار: تدريب الموظفين أو شطب الصنف'
                : 'Items voided or cancelled — decision: retrain staff or pull the item' }}
          </p>
        </div>
        <app-export-menu *ngIf="data()?.items?.length"
          [rows]="data()!.items" [columns]="exportCols"
          titleEn="Items not paid" titleAr="أصناف غير مدفوعة"
          subtitleEn="Items voided or cancelled" subtitleAr="أصناف اتعملها void أو إلغاء"
          [branch]="null"
          [fromDate]="filter.fromDate()" [toDate]="filter.toDate()"
          fileBase="items-not-paid"></app-export-menu>
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
        <div class="card-padded"
             [class]="d.totalEvents === 0
                       ? 'ring-1 ring-success/30 bg-success-soft'
                       : 'ring-1 ring-warning/30 bg-warning-soft'">
          <h3 class="text-sm font-semibold mb-1"
              [class.text-success]="d.totalEvents === 0"
              [class.text-warning]="d.totalEvents > 0">
            {{ d.totalEvents === 0
                ? (lang.language() === 'ar' ? 'أداء قائمة نظيف' : 'Clean menu performance')
                : (lang.language() === 'ar' ? 'تحتاج مراجعة' : 'Needs review') }}
          </h3>
          <p class="text-sm text-slate-700 dark:text-slate-200">
            {{ lang.language() === 'ar' ? d.conclusion.descriptionAr : d.conclusion.descriptionEn }}
          </p>
        </div>

        <!-- KPI cards -->
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div class="card-padded">
            <div class="text-xs text-slate-500 uppercase tracking-wider">
              {{ lang.language() === 'ar' ? 'إجمالي أحداث' : 'Total events' }}
            </div>
            <div class="tabular text-2xl font-bold mt-1"
                 [class.text-success]="d.totalEvents === 0"
                 [class.text-warning]="d.totalEvents > 0">
              {{ d.totalEvents | number }}
            </div>
          </div>
          <div class="card-padded">
            <div class="text-xs text-slate-500 uppercase tracking-wider">
              {{ lang.language() === 'ar' ? 'مبيعات مفقودة' : 'Lost sales value' }}
            </div>
            <div class="tabular text-2xl font-bold text-critical mt-1">
              {{ d.totalImpact | number:'1.0-2' }}
            </div>
          </div>
          <div class="card-padded">
            <div class="text-xs text-slate-500 uppercase tracking-wider">
              {{ lang.language() === 'ar' ? 'أصناف متأثرة' : 'Items affected' }}
            </div>
            <div class="tabular text-2xl font-bold text-slate-900 dark:text-slate-50 mt-1">
              {{ d.items.length || 0 }}
            </div>
          </div>
        </div>

        <!-- Top-10 chart -->
        <div *ngIf="topTenSeries().length > 0 && topTenSeries()[0].data.length > 0"
             class="card-padded">
          <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
            {{ lang.language() === 'ar' ? 'أعلى 10 أصناف خسارة' : 'Top 10 lost-value items' }}
          </h3>
          <apx-chart
            [series]="topTenSeries()"
            [chart]="chartConfig"
            [plotOptions]="chartPlotOptions"
            [xaxis]="topTenXAxis()"
            [yaxis]="chartYAxis"
            [dataLabels]="chartDataLabels"
            [grid]="chartGrid"
            [tooltip]="chartTooltip"
            [colors]="chartColors">
          </apx-chart>
        </div>

        <!-- Full table -->
        <div *ngIf="d.items.length" class="card-padded overflow-x-auto">
          <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
            {{ lang.language() === 'ar' ? 'كل الأصناف' : 'All items' }}
            <span class="text-xs text-slate-400 ms-1">({{ d.items.length }})</span>
          </h3>
          <table class="w-full text-xs tabular">
            <thead>
              <tr class="text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th class="text-start py-2 font-normal w-8">#</th>
                <th class="text-start py-2 font-normal">{{ lang.language() === 'ar' ? 'الصنف' : 'Item' }}</th>
                <th class="text-start py-2 font-normal">{{ lang.language() === 'ar' ? 'المصدر' : 'Source' }}</th>
                <th class="text-end py-2 font-normal">{{ lang.language() === 'ar' ? 'عدد' : 'Events' }}</th>
                <th class="text-end py-2 font-normal">{{ lang.language() === 'ar' ? 'كمية' : 'Qty' }}</th>
                <th class="text-end py-2 font-normal">{{ lang.language() === 'ar' ? 'قيمة الخسارة' : 'Lost value' }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let r of d.items; let i = index"
                  class="border-b border-slate-100 dark:border-slate-800/40
                         hover:bg-slate-50 dark:hover:bg-surface-dark-muted/30 transition-colors duration-180">
                <td class="py-2 text-slate-400">{{ i + 1 }}</td>
                <td class="py-2 text-slate-700 dark:text-slate-200 font-medium">
                  {{ r.itemName || '—' }}
                  <span class="text-[10px] text-slate-400 ms-1">#{{ r.itemId }}</span>
                </td>
                <td class="py-2">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-card-sm text-[10px] ring-1"
                        [class.bg-warning-soft]="r.source.indexOf('Void') >= 0"
                        [class.text-warning]="r.source.indexOf('Void') >= 0"
                        [class.ring-warning]="r.source.indexOf('Void') >= 0"
                        [class.bg-critical-soft]="r.source === 'Cancel'"
                        [class.text-critical]="r.source === 'Cancel'"
                        [class.ring-critical]="r.source === 'Cancel'">
                    {{ r.source }}
                  </span>
                </td>
                <td class="py-2 text-end text-slate-700 dark:text-slate-200">{{ r.voidedCount | number }}</td>
                <td class="py-2 text-end text-slate-500">{{ r.voidedQty | number:'1.0-2' }}</td>
                <td class="py-2 text-end font-semibold text-critical">{{ r.voidedValue | number:'1.0-2' }}</td>
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
export class ItemsNotPaidComponent {
  private readonly api = inject(OwnerInsightsApi);
  readonly filter = inject(FilterService);
  readonly lang = inject(LanguageService);

  readonly data = signal<ItemsNotPaidResult | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly exportCols: ExportColumn<ItemsNotPaidRow>[] = [
    { headerEn: 'Item', headerAr: 'الصنف', width: 28, value: r => r.itemName || '' },
    { headerEn: 'Item ID', headerAr: 'كود الصنف', width: 10, numeric: true, value: r => r.itemId },
    { headerEn: 'Source', headerAr: 'المصدر', width: 12, value: r => r.source },
    { headerEn: 'Events', headerAr: 'عدد', width: 10, numeric: true, value: r => r.voidedCount },
    { headerEn: 'Qty', headerAr: 'كمية', width: 10, numeric: true, value: r => r.voidedQty },
    { headerEn: 'Lost value', headerAr: 'القيمة', width: 14, numeric: true, value: r => r.voidedValue },
  ];

  // ── Chart config ─────────────────────────────────────────────────────
  readonly chartConfig: ApexChart = {
    type: 'bar',
    height: 360,
    toolbar: { show: false },
    foreColor: 'rgb(100 116 139)',
  };
  readonly chartPlotOptions: ApexPlotOptions = {
    bar: { horizontal: true, borderRadius: 6, dataLabels: { position: 'top' } },
  };
  readonly chartDataLabels: ApexDataLabels = {
    enabled: true,
    formatter: (v) => (typeof v === 'number' ? v.toFixed(2) : `${v}`),
    style: { fontSize: '11px', colors: ['#475569'] },
    offsetX: 30,
  };
  readonly chartGrid: ApexGrid = { borderColor: 'rgba(148, 163, 184, 0.2)', strokeDashArray: 4 };
  readonly chartTooltip: ApexTooltip = { theme: 'dark' };
  readonly chartYAxis: ApexYAxis = { labels: { style: { fontSize: '11px' } } };
  readonly chartColors: string[] = ['#dc2626'];  // critical-600

  readonly topTenSeries = computed<ApexAxisChartSeries>(() => {
    const items = this.data()?.items ?? [];
    const top = items.slice(0, 10);
    return [{
      name: this.lang.language() === 'ar' ? 'قيمة الخسارة' : 'Lost value',
      data: top.map((r) => Math.round(r.voidedValue * 100) / 100),
    }];
  });

  readonly topTenXAxis = computed<ApexXAxis>(() => {
    const items = this.data()?.items ?? [];
    const top = items.slice(0, 10);
    return {
      categories: top.map((r) => r.itemName || `#${r.itemId}`),
      labels: { formatter: (v) => (typeof v === 'number' ? v.toLocaleString() : `${v}`) },
    };
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
    this.api.itemsNotPaid({
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
