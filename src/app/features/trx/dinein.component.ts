import { Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuditApi } from '../../core/api/audit.api';
import {
  AuditPageContext,
  TransactionReportResult,
  toDineInRequest,
} from '../../core/models/audit.models';
import { TrxPageComponent } from './trx-page.component';

/**
 * `POST /api/AuditNarrativeReport/DineIn` — DineIn-only audit narrative.
 * The server forces `TransactionTypes = [1]` internally, so the request
 * DTO doesn't carry that field. GroupBy defaults to `None` (flat) until
 * a per-trx groupBy picker is wired (`ByTable` / `ByWaiter` / etc.).
 */
@Component({
  selector: 'app-trx-dinein',
  standalone: true,
  imports: [TrxPageComponent],
  template: `
    <app-trx-page
      titleEn="Dine-In" titleAr="داخل المطعم"
      subtitleEn="DineIn-only narrative — flat or grouped by Table / Waiter / Cashier"
      subtitleAr="السرد الخاص بالأكل داخل المطعم — مسطح أو مجمع بالترابيزة / الويتر / الكاشير"
      [fetchFn]="fetch"></app-trx-page>
  `,
})
export class TrxDineInComponent {
  private readonly api = inject(AuditApi);
  readonly fetch = (ctx: AuditPageContext): Observable<TransactionReportResult> =>
    this.api.dineIn(toDineInRequest(ctx));
}
