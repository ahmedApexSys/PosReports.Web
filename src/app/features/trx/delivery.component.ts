import { Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuditApi } from '../../core/api/audit.api';
import {
  AuditPageContext,
  TransactionReportResult,
  toDeliveryRequest,
} from '../../core/models/audit.models';
import { TrxPageComponent } from './trx-page.component';

/**
 * `POST /api/AuditNarrativeReport/Delivery` — Delivery-only narrative.
 * Server forces `TransactionTypes = [2]` and defaults the action set
 * to the delivery lifecycle (Pay / Assign / Return / CollectMoney /
 * OrderDelivered etc.) when the caller leaves it empty. Default
 * grouping is `ByOrder` so each delivery shows as its own row.
 */
@Component({
  selector: 'app-trx-delivery',
  standalone: true,
  imports: [TrxPageComponent],
  template: `
    <app-trx-page
      titleEn="Delivery" titleAr="ديليفري"
      subtitleEn="Delivery-only narrative — flat or grouped by Pilot / Order"
      subtitleAr="السرد الخاص بالديليفري — مسطح أو مجمع بالطيار / الأوردر"
      [fetchFn]="fetch"></app-trx-page>
  `,
})
export class TrxDeliveryComponent {
  private readonly api = inject(AuditApi);
  readonly fetch = (ctx: AuditPageContext): Observable<TransactionReportResult> =>
    this.api.delivery(toDeliveryRequest(ctx));
}
