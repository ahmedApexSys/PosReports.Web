/**
 * Client-side aggregation of the per-action audit feed into:
 *  - ONE summary row per ORDER  (Daily view — no repeated orders)
 *  - per-DAY rollups of order totals (Totals view — GroupBy date, summed)
 *
 * Doing this client-side avoids double-counting an order's net: a bucket that
 * sums `netAfter` across every action would count the same order many times.
 * Here we first collapse to one row per order (final net = net at the LAST
 * action), then sum those per day.
 */
import { AuditNarrativeRow, OrderSummaryRow, DayTotalsRow } from '../models/audit.models';

const PAID_ACTIONS   = ['Pay', 'EditPay'];
const DISCOUNT_ACTS  = ['Discount', 'PromoCode', 'Voucher'];
const VOID_ACTIONS   = ['VoidItem'];
const CANCEL_ACTIONS = ['Cancel', 'ApproveCancelOrder'];

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Combine actionDate (date) + actionTime into a sortable ISO string. */
function ts(r: AuditNarrativeRow): string {
  return `${(r.actionDate || '').slice(0, 10)}T${r.actionTime || '00:00:00'}`;
}

/** Group the action rows by orderId → one OrderSummaryRow each (newest first). */
export function aggregateOrders(rows: AuditNarrativeRow[]): OrderSummaryRow[] {
  const byOrder = new Map<number, AuditNarrativeRow[]>();
  for (const r of rows) {
    if (!r.orderId || r.orderId <= 0) continue;
    const list = byOrder.get(r.orderId);
    if (list) list.push(r);
    else byOrder.set(r.orderId, [r]);
  }

  const out: OrderSummaryRow[] = [];
  byOrder.forEach((list, orderId) => {
    const sorted = [...list].sort((a, b) => ts(a).localeCompare(ts(b)));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    out.push({
      orderId,
      receiptNumber: first.receiptNumber || last.receiptNumber || 0,
      tableName: first.tableName || last.tableName || '',
      transactionType: first.transactionType || last.transactionType || 0,
      transactionTypeName: first.transactionTypeName || last.transactionTypeName || '',
      branchName: first.branchName || '',
      finalNet: last.netAfter ?? 0,
      finalTotal: last.totalAfter ?? 0,
      discount: Math.max(0, ...sorted.map(r => r.discountAfter ?? 0)),
      itemCount: last.itemCountAfter ?? 0,
      actionCount: sorted.length,
      actionTypes: [...new Set(sorted.map(r => r.actionType).filter(Boolean))],
      users: [...new Set(sorted.map(r => r.userName).filter(Boolean))],
      waiterName: sorted.find(r => r.waiterName)?.waiterName || '',
      cashierName: sorted.find(r => r.cashierName)?.cashierName || '',
      firstAt: ts(first),
      lastAt: ts(last),
      wasPaid: sorted.some(r => PAID_ACTIONS.includes(r.actionType)),
      hadDiscount: sorted.some(r => DISCOUNT_ACTS.includes(r.actionType)),
      wasVoided: sorted.some(r => VOID_ACTIONS.includes(r.actionType)),
      wasCancelled: sorted.some(r => CANCEL_ACTIONS.includes(r.actionType)),
    });
  });

  return out.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

/** Roll the per-order summaries up by day → DayTotalsRow[] (oldest first). */
export function aggregateDays(orders: OrderSummaryRow[]): DayTotalsRow[] {
  const byDay = new Map<string, OrderSummaryRow[]>();
  for (const o of orders) {
    const day = (o.lastAt || o.firstAt || '').slice(0, 10);
    if (!day) continue;
    const list = byDay.get(day);
    if (list) list.push(o);
    else byDay.set(day, [o]);
  }

  const out: DayTotalsRow[] = [];
  byDay.forEach((list, date) => {
    out.push({
      date,
      orders: list.length,
      paidOrders: list.filter(o => o.wasPaid).length,
      totalNet: round2(list.reduce((s, o) => s + (o.finalNet || 0), 0)),
      totalDiscount: round2(list.reduce((s, o) => s + (o.discount || 0), 0)),
      voidedOrders: list.filter(o => o.wasVoided).length,
      cancelledOrders: list.filter(o => o.wasCancelled).length,
    });
  });

  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export { round2 };
