import { Component, Input, inject, computed, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService } from '../../core/i18n/language.service';
import { PaymentSummaryConfig } from '../../core/models/sales-report.models';

interface BarRow {
  payway: string;
  total: number;
  reservations: number;
  customerPayment: number;
  expenses: number;
  tip: number;
  net: number;
}

/**
 * Bottom PayWay summary bar — recreated from the legacy Cashier-Orders footer:
 * one row per payment method (Cash / Visa / Ledge / Other) × Total ·
 * Reservations · Customer Payment · Expenses · Tip · Net. Total + Net come from
 * the report's `totals` object; the other columns are 0 unless the API exposes
 * them (it currently doesn't — matching the legacy report, where they read 0).
 * Rows whose Total is 0 are dropped so the bar only shows methods that were used.
 */
@Component({
  selector: 'app-payment-summary-bar',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div *ngIf="rows().length" class="card overflow-hidden mt-3 animate-fade-in">
      <div class="px-3 py-2 border-b border-slate-200 dark:border-slate-800
                  bg-slate-50 dark:bg-surface-dark-muted/50">
        <span class="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {{ ar() ? 'ملخص طرق الدفع' : 'Payment Summary' }}
        </span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm whitespace-nowrap">
          <thead class="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400
                        bg-slate-50/60 dark:bg-surface-dark-muted/30
                        border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th class="px-3 py-2.5 text-start font-semibold">{{ ar() ? 'طريقة الدفع' : 'PayWay' }}</th>
              <th class="px-3 py-2.5 text-end font-semibold">{{ ar() ? 'الإجمالي' : 'Total' }}</th>
              <th class="px-3 py-2.5 text-end font-semibold">{{ ar() ? 'الحجوزات' : 'Reservations' }}</th>
              <th class="px-3 py-2.5 text-end font-semibold">{{ ar() ? 'دفعات العملاء' : 'Customer Payment' }}</th>
              <th class="px-3 py-2.5 text-end font-semibold">{{ ar() ? 'المصروفات' : 'Expenses' }}</th>
              <th class="px-3 py-2.5 text-end font-semibold">{{ ar() ? 'البقشيش' : 'Tip' }}</th>
              <th class="px-3 py-2.5 text-end font-semibold">{{ ar() ? 'الصافي' : 'Net' }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr *ngFor="let r of rows()" class="hover:bg-slate-50 dark:hover:bg-surface-dark-muted/50">
              <td class="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">{{ r.payway }}</td>
              <td class="px-3 py-2 text-end tabular">{{ money(r.total) }}</td>
              <td class="px-3 py-2 text-end tabular">{{ money(r.reservations) }}</td>
              <td class="px-3 py-2 text-end tabular">{{ money(r.customerPayment) }}</td>
              <td class="px-3 py-2 text-end tabular">{{ money(r.expenses) }}</td>
              <td class="px-3 py-2 text-end tabular">{{ money(r.tip) }}</td>
              <td class="px-3 py-2 text-end tabular font-semibold">{{ money(r.net) }}</td>
            </tr>
          </tbody>
          <tfoot *ngIf="rows().length > 1"
                 class="border-t-2 border-slate-200 dark:border-slate-700 font-semibold
                        bg-surface-muted/40 dark:bg-surface-dark-muted/30">
            <tr>
              <td class="px-3 py-2 text-slate-500">{{ ar() ? 'الإجمالي' : 'Total' }}</td>
              <td class="px-3 py-2 text-end tabular">{{ money(grand().total) }}</td>
              <td class="px-3 py-2 text-end tabular">{{ money(grand().reservations) }}</td>
              <td class="px-3 py-2 text-end tabular">{{ money(grand().customerPayment) }}</td>
              <td class="px-3 py-2 text-end tabular">{{ money(grand().expenses) }}</td>
              <td class="px-3 py-2 text-end tabular">{{ money(grand().tip) }}</td>
              <td class="px-3 py-2 text-end tabular">{{ money(grand().net) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `,
})
export class PaymentSummaryBarComponent {
  @Input({ required: true }) set config(v: PaymentSummaryConfig | undefined) { this._config.set(v ?? null); }
  @Input({ required: true }) set totals(v: Record<string, unknown> | null | undefined) { this._totals.set(v ?? {}); }

  private readonly lang = inject(LanguageService);
  private readonly _config = signal<PaymentSummaryConfig | null>(null);
  private readonly _totals = signal<Record<string, unknown>>({});

  readonly ar = computed(() => this.lang.language() === 'ar');

  private num(v: unknown): number { const n = Number(v); return Number.isFinite(n) ? n : 0; }

  readonly rows = computed<BarRow[]>(() => {
    const cfg = this._config();
    const t = this._totals();
    if (!cfg || !t) return [];
    return cfg.rows
      .map((r) => {
        const total = this.num(t[r.totalKey]);
        return { payway: this.ar() ? r.labelAr : r.labelEn, total, reservations: 0, customerPayment: 0, expenses: 0, tip: 0, net: total, _always: !!r.always };
      })
      .filter((r) => r.total !== 0 || r._always)
      .map(({ _always, ...r }) => r);
  });

  readonly grand = computed<BarRow>(() =>
    this.rows().reduce(
      (a, r) => ({
        payway: '', total: a.total + r.total, reservations: a.reservations + r.reservations,
        customerPayment: a.customerPayment + r.customerPayment, expenses: a.expenses + r.expenses,
        tip: a.tip + r.tip, net: a.net + r.net,
      }),
      { payway: '', total: 0, reservations: 0, customerPayment: 0, expenses: 0, tip: 0, net: 0 } as BarRow,
    ));

  money(n: number): string { return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
}
