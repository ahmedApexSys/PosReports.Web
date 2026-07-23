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

/**
 * The instant an action happened, rebuilt from actionDate (day) + actionTime (clock).
 *
 * actionTime is free text in whatever the writer produced — "10:20:04 PM", "22:20", "9:05 AM".
 * The old code sorted the raw string, so "10:20:04 PM" compared BELOW "12:55:30 PM"
 * lexically and every order whose actions cross the 12→1 or AM/PM boundary took its "final"
 * net, total, item count and lastAt from the WRONG row. This parses the clock the way the
 * server's OrderTimelineService.MomentOf does and returns a real epoch to sort on.
 */
function momentOf(r: AuditNarrativeRow): number {
  const day = (r.actionDate || '').slice(0, 10);
  const base = day ? new Date(day + 'T00:00:00').getTime() : 0;
  const clock = (r.actionTime || '').trim();
  if (!clock) return base;

  // 12-hour with AM/PM, or 24-hour, both with optional seconds.
  const m = clock.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm)?$/);
  if (!m) return base;
  let h = +m[1];
  const min = +m[2], sec = m[3] ? +m[3] : 0;
  const ap = (m[4] || '').toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return base + ((h * 3600 + min * 60 + sec) * 1000);
}

/** Display timestamp — the original date + clock text, unparsed. */
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
    const sorted = [...list].sort((a, b) => momentOf(a) - momentOf(b));
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
      // The FINAL discount, not the largest ever seen. A discount applied then removed used to
      // linger here as the max; the final state is what the order actually settled with.
      discount: Math.max(0, last.discountAfter ?? 0),
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
      // Net EXCLUDES cancelled orders. A cancelled reservation keeps its net on its terminal
      // audit row, so summing every row over-reported and would not reconcile with the POS
      // Totals report, which drops cancelled. The cancelled COUNT below still shows them.
      totalNet: round2(list.filter(o => !o.wasCancelled).reduce((s, o) => s + (o.finalNet || 0), 0)),
      totalDiscount: round2(list.reduce((s, o) => s + (o.discount || 0), 0)),
      voidedOrders: list.filter(o => o.wasVoided).length,
      cancelledOrders: list.filter(o => o.wasCancelled).length,
    });
  });

  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export { round2 };
