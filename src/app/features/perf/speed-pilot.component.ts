import { Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BiApi } from '../../core/api/bi.api';
import { BiPanel, BiReportRequest } from '../../core/models/bi.models';
import { BiPanelPageComponent } from '../../shared/bi-panel-page/bi-panel-page.component';

/**
 * `POST /api/SerrviceSpeedByPilot/Insights` — single-pilot drill-down
 * with daily averages and SLA-bucket distribution. Requires a PilotId
 * in the request body (not currently set from the filter; defaults to
 * empty until a pilot picker is added).
 */
@Component({
  selector: 'app-perf-speed-pilot',
  standalone: true,
  imports: [BiPanelPageComponent],
  template: `
    <app-bi-panel-page
      titleEn="Speed by Pilot" titleAr="سرعة كل طيار"
      subtitleEn="Single-pilot drill-down — daily averages and SLA buckets"
      subtitleAr="تحليل طيار واحد — متوسطات يومية وفترات SLA"
      [fetchFn]="fetch"></app-bi-panel-page>
  `,
})
export class PerfSpeedPilotComponent {
  private readonly api = inject(BiApi);
  readonly fetch = (req: BiReportRequest): Observable<BiPanel> =>
    this.api.serviceSpeedByPilotInsights({
      fromDate: req.fromDate,
      toDate: req.toDate,
      branchId: req.branchId,
      pilotId: '',
    });
}
