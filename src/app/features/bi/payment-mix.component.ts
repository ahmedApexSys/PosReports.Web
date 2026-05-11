import { Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BiApi } from '../../core/api/bi.api';
import { BiPanel, BiReportRequest } from '../../core/models/bi.models';
import { BiPanelPageComponent } from '../../shared/bi-panel-page/bi-panel-page.component';

/**
 * `POST /api/BusinessIntelligence/PaymentMix` — cash / visa / other
 * distribution. Insight surfaces when the cash share spikes (theft
 * signal) or visa drops below historical share.
 */
@Component({
  selector: 'app-payment-mix',
  standalone: true,
  imports: [BiPanelPageComponent],
  template: `
    <app-bi-panel-page
      titleEn="Payment Mix" titleAr="توزيع وسائل الدفع"
      subtitleEn="Cash / Visa / Other distribution and trend"
      subtitleAr="توزيع الكاش / فيزا / غيرها وتطورها"
      [fetchFn]="fetch"></app-bi-panel-page>
  `,
})
export class PaymentMixComponent {
  private readonly api = inject(BiApi);
  readonly fetch = (req: BiReportRequest): Observable<BiPanel> => this.api.paymentMix(req);
}
