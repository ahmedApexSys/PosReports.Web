import { Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BiApi } from '../../core/api/bi.api';
import { BiPanel, BiReportRequest } from '../../core/models/bi.models';
import { BiPanelPageComponent } from '../../shared/bi-panel-page/bi-panel-page.component';

/**
 * `POST /api/BusinessIntelligence/Dashboard` — the aggregate dashboard.
 * Returns one BiPanel containing every section (KPIs, daily revenue
 * time-series, transaction-type + payment-method pies, top-items pareto,
 * insights, conclusion). Renders through the shared shell so this file
 * only declares the page's identity + the API call.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [BiPanelPageComponent],
  template: `
    <app-bi-panel-page
      titleEn="Business Dashboard" titleAr="لوحة الأعمال"
      subtitleEn="Live KPIs + actionable insights"
      subtitleAr="مؤشرات حية + رؤى قابلة للتنفيذ"
      [fetchFn]="fetch"></app-bi-panel-page>
  `,
})
export class DashboardComponent {
  private readonly api = inject(BiApi);
  readonly fetch = (req: BiReportRequest): Observable<BiPanel> => this.api.dashboard(req);
}
