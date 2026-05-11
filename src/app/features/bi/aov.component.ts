import { Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BiApi } from '../../core/api/bi.api';
import { BiPanel, BiReportRequest } from '../../core/models/bi.models';
import { BiPanelPageComponent } from '../../shared/bi-panel-page/bi-panel-page.component';

/**
 * `POST /api/BusinessIntelligence/AverageOrderValue` — AOV trend over
 * the window plus per-transaction-type slice (DineIn / TakeAway /
 * Delivery / etc.). Useful for spotting cheque inflation / shrinkage.
 */
@Component({
  selector: 'app-aov',
  standalone: true,
  imports: [BiPanelPageComponent],
  template: `
    <app-bi-panel-page
      titleEn="Average Order Value" titleAr="متوسط قيمة الأوردر"
      subtitleEn="AOV trend + per-transaction-type slice"
      subtitleAr="اتجاه متوسط قيمة الأوردر + توزيع نوع المعاملة"
      [fetchFn]="fetch"></app-bi-panel-page>
  `,
})
export class AovComponent {
  private readonly api = inject(BiApi);
  readonly fetch = (req: BiReportRequest): Observable<BiPanel> => this.api.averageOrderValue(req);
}
