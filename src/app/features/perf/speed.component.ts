import { Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BiApi } from '../../core/api/bi.api';
import { BiPanel, BiReportRequest } from '../../core/models/bi.models';
import { BiPanelPageComponent } from '../../shared/bi-panel-page/bi-panel-page.component';

/**
 * `POST /api/ServiceSpeed/Insights` — delivery-time SLA buckets + pilot
 * ranking. Flags ≥60-minute deliveries (Critical) and outlier pilots.
 */
@Component({
  selector: 'app-perf-speed',
  standalone: true,
  imports: [BiPanelPageComponent],
  template: `
    <app-bi-panel-page
      titleEn="Service Speed" titleAr="سرعة الخدمة"
      subtitleEn="Delivery time SLA buckets + pilot ranking"
      subtitleAr="فترات SLA لوقت التوصيل + ترتيب الطيارين"
      [fetchFn]="fetch"></app-bi-panel-page>
  `,
})
export class PerfSpeedComponent {
  private readonly api = inject(BiApi);
  readonly fetch = (req: BiReportRequest): Observable<BiPanel> =>
    this.api.serviceSpeedInsights({ fromDate: req.fromDate, toDate: req.toDate, branchId: req.branchId });
}
