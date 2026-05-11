import { Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuditApi } from '../../core/api/audit.api';
import {
  AuditPageContext,
  TransactionReportResult,
  toTakeAwayRequest,
} from '../../core/models/audit.models';
import { TrxPageComponent } from './trx-page.component';

/**
 * `POST /api/AuditNarrativeReport/TakeAway` — TakeAway-only narrative.
 * Server forces `TransactionTypes = [3]`.
 */
@Component({
  selector: 'app-trx-takeaway',
  standalone: true,
  imports: [TrxPageComponent],
  template: `
    <app-trx-page
      titleEn="Take-Away" titleAr="تيك أواي"
      subtitleEn="TakeAway-only narrative — flat or grouped by Cashier / Order"
      subtitleAr="السرد الخاص بالتيك أواي — مسطح أو مجمع بالكاشير / الأوردر"
      [fetchFn]="fetch"></app-trx-page>
  `,
})
export class TrxTakeAwayComponent {
  private readonly api = inject(AuditApi);
  readonly fetch = (ctx: AuditPageContext): Observable<TransactionReportResult> =>
    this.api.takeAway(toTakeAwayRequest(ctx));
}
