import { Component, Input, inject, computed, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService } from '../../core/i18n/language.service';
import { PaymentSummaryConfig, ReportColumn } from '../../core/models/sales-report.models';

interface PayRow { payway: string; total: number; net: number; }
interface Figure { key: string; label: string; value: number; emphasize: boolean; }

/**
 * Bottom summary under every tabular report. Two parts:
 *   1. A full order-level financial totals strip (Sub Total · Commercial Disc ·
 *      Services · Tax · Item Disc · Extra Disc · Voucher · Expenses · Total · Net),
 *      derived automatically from the report's own total columns — so every report
 *      gets a complete totals summary, not just a payment split.
 *   2. The payment-method split (Cash / Visa / Ledge / Other) with Total + Net,
 *      from the report's `paymentSummary` config (the per-payway rows the financial
 *      figures can't be split by).
 * Net is emphasized; rows/figures that are 0 (and not marked always) are dropped.
 */
@Component({
  selector: 'app-payment-summary-bar',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div *ngIf="figures().length || rows().length" class="card overflow-hidden mt-3 animate-fade-in">
      <div class="px-3 py-2 border-b border-slate-200 dark:border-slate-800
                  bg-slate-50 dark:bg-surface-dark-muted/50">
        <span class="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {{ ar() ? 'ملخص الإجماليات' : 'Summary' }}
        </span>
      </div>

      <!-- Financial totals strip (order-level figures) -->
      <div *ngIf="figures().length" class="overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        <table class="w-full text-sm whitespace-nowrap">
          <thead class="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400
                        bg-slate-50/60 dark:bg-surface-dark-muted/30">
            <tr>
              <th *ngFor="let f of figures()" class="px-3 py-2.5 text-center font-semibold">{{ f.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td *ngFor="let f of figures()" class="px-3 py-2.5 text-center tabular"
                  [class.font-bold]="f.emphasize" [class.text-brand-700]="f.emphasize"
                  [class.font-medium]="!f.emphasize">{{ money(f.value) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Payment-method split -->
      <div *ngIf="rows().length" class="overflow-x-auto">
        <table class="w-full text-sm whitespace-nowrap">
          <thead class="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400
                        bg-slate-50/60 dark:bg-surface-dark-muted/30
                        border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th class="px-3 py-2.5 text-center font-semibold">{{ ar() ? 'طريقة الدفع' : 'PayWay' }}</th>
              <th class="px-3 py-2.5 text-center font-semibold">{{ ar() ? 'الإجمالي' : 'Total' }}</th>
              <th class="px-3 py-2.5 text-center font-semibold">{{ ar() ? 'الصافي' : 'Net' }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr *ngFor="let r of rows()" class="hover:bg-slate-50 dark:hover:bg-surface-dark-muted/50">
              <td class="px-3 py-2 text-center font-medium text-slate-700 dark:text-slate-200">{{ r.payway }}</td>
              <td class="px-3 py-2 text-center tabular">{{ money(r.total) }}</td>
              <td class="px-3 py-2 text-center tabular font-semibold">{{ money(r.net) }}</td>
            </tr>
          </tbody>
          <tfoot *ngIf="rows().length > 1"
                 class="border-t-2 border-slate-200 dark:border-slate-700 font-semibold
                        bg-surface-muted/40 dark:bg-surface-dark-muted/30">
            <tr>
              <td class="px-3 py-2 text-center text-slate-500">{{ ar() ? 'الإجمالي' : 'Total' }}</td>
              <td class="px-3 py-2 text-center tabular">{{ money(grandTotal()) }}</td>
              <td class="px-3 py-2 text-center tabular">{{ money(grandTotal()) }}</td>
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
  @Input() set columns(v: ReportColumn[] | undefined) { this._columns.set(v ?? []); }

  private readonly lang = inject(LanguageService);
  private readonly _config = signal<PaymentSummaryConfig | null>(null);
  private readonly _totals = signal<Record<string, unknown>>({});
  private readonly _columns = signal<ReportColumn[]>([]);

  readonly ar = computed(() => this.lang.language() === 'ar');

  private num(v: unknown): number { const n = Number(v); return Number.isFinite(n) ? n : 0; }

  /** Order-level financial figures: every MONEY report column that has a footer
   *  total, EXCEPT the pure cash/card tenders shown in the payment split below
   *  (Ledge/آجل is kept here as a figure too). Net is forced to the last slot. */
  readonly figures = computed<Figure[]>(() => {
    const cols = this._columns();
    const t = this._totals();
    const tenders = new Set(['cash', 'visa', 'otherPayment', 'paymentAmount']);
    const list = cols
      .filter((c) => !!c.totalKey && (c.type ?? 'text') === 'money' && !tenders.has(c.totalKey!))
      .map((c) => ({
        key: c.key,
        label: this.ar() ? c.labelAr : c.labelEn,
        value: this.num(t[c.totalKey!]),
        emphasize: c.key === 'net' || c.key === 'total' || c.totalKey === 'net',
      }));
    const net = list.filter((f) => f.key === 'net');
    const rest = list.filter((f) => f.key !== 'net');
    return [...rest, ...net];
  });

  readonly rows = computed<PayRow[]>(() => {
    const cfg = this._config();
    const t = this._totals();
    if (!cfg) return [];
    return cfg.rows
      .map((r) => ({ payway: this.ar() ? r.labelAr : r.labelEn, total: this.num(t[r.totalKey]), _always: !!r.always }))
      .filter((r) => r.total !== 0 || r._always)
      .map(({ _always, ...r }) => ({ ...r, net: r.total }));
  });

  readonly grandTotal = computed(() => this.rows().reduce((a, r) => a + r.total, 0));

  money(n: number): string { return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
}
