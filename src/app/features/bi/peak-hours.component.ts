import { Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BiApi } from '../../core/api/bi.api';
import { BiPanel, BiReportRequest } from '../../core/models/bi.models';
import { BiPanelPageComponent } from '../../shared/bi-panel-page/bi-panel-page.component';

/**
 * `POST /api/BusinessIntelligence/PeakHours` — day-of-week × hour-of-day
 * heatmap of orders / revenue. Surfaces peak hours so staff and kitchen
 * capacity can be right-sized.
 */
@Component({
  selector: 'app-peak-hours',
  standalone: true,
  imports: [BiPanelPageComponent],
  template: `
    <app-bi-panel-page
      titleEn="Peak Hours" titleAr="ساعات الذروة"
      subtitleEn="Day × hour heatmap — orders and revenue"
      subtitleAr="خريطة حرارية يوم × ساعة — الأوردرات والإيراد"
      [fetchFn]="fetch"></app-bi-panel-page>
  `,
})
export class PeakHoursComponent {
  private readonly api = inject(BiApi);
  readonly fetch = (req: BiReportRequest): Observable<BiPanel> => this.api.peakHours(req);
}
