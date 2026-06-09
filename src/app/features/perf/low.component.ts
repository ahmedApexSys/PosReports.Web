import { Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BiApi } from '../../core/api/bi.api';
import { BiPanel, BiReportRequest } from '../../core/models/bi.models';
import { BiPanelPageComponent } from '../../shared/bi-panel-page/bi-panel-page.component';

/**
 * `POST /api/LowSales/Insights` — slow-mover analysis with dead-item
 * flags and long-tail simplification candidates.
 */
@Component({
  selector: 'app-perf-low',
  standalone: true,
  imports: [BiPanelPageComponent],
  template: `
    <app-bi-panel-page
      titleEn="Low Sales" titleAr="الأقل مبيعًا"
      subtitleEn="Slow movers — zero-sales flags and simplification ideas"
      subtitleAr="الأقل مبيعًا — أصناف بدون بيع ومرشحات الحذف"
      [fetchFn]="fetch"></app-bi-panel-page>
  `,
})
export class PerfLowComponent {
  private readonly api = inject(BiApi);
  readonly fetch = (req: BiReportRequest): Observable<BiPanel> =>
    this.api.lowSalesInsights({ fromDate: req.fromDate, toDate: req.toDate, branchId: req.branchId, language: req.language });
}
