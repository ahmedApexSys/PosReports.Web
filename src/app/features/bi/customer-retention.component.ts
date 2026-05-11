import { Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BiApi } from '../../core/api/bi.api';
import { BiPanel, BiReportRequest } from '../../core/models/bi.models';
import { BiPanelPageComponent } from '../../shared/bi-panel-page/bi-panel-page.component';

/**
 * `POST /api/BusinessIntelligence/CustomerRetention` — new vs returning
 * customer breakdown + insights for retention dips.
 */
@Component({
  selector: 'app-customer-retention',
  standalone: true,
  imports: [BiPanelPageComponent],
  template: `
    <app-bi-panel-page
      titleEn="Customer Retention" titleAr="استبقاء العملاء"
      subtitleEn="New vs returning + retention trend"
      subtitleAr="عملاء جدد مقابل عائدين + اتجاه الاستبقاء"
      [fetchFn]="fetch"></app-bi-panel-page>
  `,
})
export class CustomerRetentionComponent {
  private readonly api = inject(BiApi);
  readonly fetch = (req: BiReportRequest): Observable<BiPanel> => this.api.customerRetention(req);
}
