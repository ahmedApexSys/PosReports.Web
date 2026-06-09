import { Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BiApi } from '../../core/api/bi.api';
import { BiPanel, BiReportRequest } from '../../core/models/bi.models';
import { BiPanelPageComponent } from '../../shared/bi-panel-page/bi-panel-page.component';

/**
 * `POST /api/HighlySales/Insights` — chart-friendly top-sellers analysis
 * (Pareto + KPI + insights), corrects the legacy IsByQuantityOrPrice
 * sum-vs-firstordefault bug.
 */
@Component({
  selector: 'app-perf-highly',
  standalone: true,
  imports: [BiPanelPageComponent],
  template: `
    <app-bi-panel-page
      titleEn="Highly Sales" titleAr="الأعلى مبيعًا"
      subtitleEn="Top sellers — Pareto with concentration insights"
      subtitleAr="الأعلى مبيعًا — باريتو مع رؤى التركيز"
      [fetchFn]="fetch"></app-bi-panel-page>
  `,
})
export class PerfHighlyComponent {
  private readonly api = inject(BiApi);
  readonly fetch = (req: BiReportRequest): Observable<BiPanel> =>
    this.api.highlySalesInsights({ fromDate: req.fromDate, toDate: req.toDate, branchId: req.branchId, language: req.language });
}
