import { Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BiApi } from '../../core/api/bi.api';
import { BiPanel, BiReportRequest } from '../../core/models/bi.models';
import { BiPanelPageComponent } from '../../shared/bi-panel-page/bi-panel-page.component';

/**
 * `POST /api/BusinessIntelligence/KpiSummary` — lightweight headline KPIs
 * (revenue, orders, AOV, paid %, top branch, busiest tx type). Useful as
 * a status-bar widget or phone-sized landing view.
 */
@Component({
  selector: 'app-kpi-summary',
  standalone: true,
  imports: [BiPanelPageComponent],
  template: `
    <app-bi-panel-page
      titleEn="KPI Summary" titleAr="ملخص المؤشرات"
      subtitleEn="Headline KPIs — revenue, orders, AOV, collected-orders share"
      subtitleAr="المؤشرات الأساسية — الإيراد، الأوردرات، متوسط القيمة، نسبة الطلبات المحصّلة"
      [fetchFn]="fetch"></app-bi-panel-page>
  `,
})
export class KpiSummaryComponent {
  private readonly api = inject(BiApi);
  readonly fetch = (req: BiReportRequest): Observable<BiPanel> => this.api.kpiSummary(req);
}
