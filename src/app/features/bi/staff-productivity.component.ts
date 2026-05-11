import { Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BiApi } from '../../core/api/bi.api';
import { BiPanel, BiReportRequest } from '../../core/models/bi.models';
import { BiPanelPageComponent } from '../../shared/bi-panel-page/bi-panel-page.component';

/**
 * `POST /api/BusinessIntelligence/StaffProductivity` — per-user order
 * + revenue counts with insights for top / bottom performers.
 */
@Component({
  selector: 'app-staff-productivity',
  standalone: true,
  imports: [BiPanelPageComponent],
  template: `
    <app-bi-panel-page
      titleEn="Staff Productivity" titleAr="إنتاجية الفريق"
      subtitleEn="Per-staff order + revenue scoreboard"
      subtitleAr="لوحة أوردرات وإيراد لكل موظف"
      [fetchFn]="fetch"></app-bi-panel-page>
  `,
})
export class StaffProductivityComponent {
  private readonly api = inject(BiApi);
  readonly fetch = (req: BiReportRequest): Observable<BiPanel> => this.api.staffProductivity(req);
}
