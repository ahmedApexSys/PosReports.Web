import { Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BiApi } from '../../core/api/bi.api';
import { BiPanel, BiReportRequest } from '../../core/models/bi.models';
import { BiPanelPageComponent } from '../../shared/bi-panel-page/bi-panel-page.component';

/**
 * `POST /api/ItemRanking/Insights` — Pareto + insights view of item
 * performance. Surfaces top sellers, head-heaviness, and long-tail
 * candidates for menu simplification.
 */
@Component({
  selector: 'app-perf-items',
  standalone: true,
  imports: [BiPanelPageComponent],
  template: `
    <app-bi-panel-page
      titleEn="Item Insights" titleAr="رؤى الأصناف"
      subtitleEn="Top sellers, concentration risk, long-tail candidates"
      subtitleAr="الأفضل مبيعًا، مخاطر التركيز، مرشحات تبسيط القائمة"
      [fetchFn]="fetch"></app-bi-panel-page>
  `,
})
export class PerfItemsComponent {
  private readonly api = inject(BiApi);
  readonly fetch = (req: BiReportRequest): Observable<BiPanel> =>
    this.api.itemInsights({ fromDate: req.fromDate, toDate: req.toDate, branchId: req.branchId });
}
