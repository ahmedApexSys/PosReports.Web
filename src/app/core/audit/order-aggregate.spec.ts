import { aggregateOrders } from './order-aggregate';
import { AuditNarrativeRow } from '../models/audit.models';

function row(partial: Partial<AuditNarrativeRow>): AuditNarrativeRow {
  return {
    id: 1,
    actionDate: '2026-11-26',
    actionTime: '10:53:24 AM',
    orderId: 100,
    receiptNumber: 1,
    transactionType: 1,
    transactionTypeName: 'DineIn',
    tableName: '',
    branchName: '',
    userName: 'cashier',
    waiterName: '',
    cashierName: '',
    actionType: 'Open',
    netAfter: 0,
    totalAfter: 0,
    discountAfter: 0,
    itemCountAfter: 1,
    ...partial,
  } as AuditNarrativeRow;
}

describe('aggregateOrders', () => {
  it('formats firstAt and lastAt as ISO 24-hour datetimes parseable by DatePipe', () => {
    const orders = aggregateOrders([
      row({ orderId: 1, actionTime: '9:05 AM', netAfter: 50 }),
      row({ orderId: 1, actionTime: '10:53:24 PM', actionType: 'Pay', netAfter: 120 }),
      row({ orderId: 2, actionTime: '12:05:00 AM', netAfter: 30 }),
      row({ orderId: 3, actionTime: '12:15 PM', netAfter: 40 }),
    ]);

    const byId = new Map(orders.map(o => [o.orderId, o]));
    expect(byId.get(1)?.firstAt).toBe('2026-11-26T09:05:00');
    expect(byId.get(1)?.lastAt).toBe('2026-11-26T22:53:24');
    expect(byId.get(2)?.lastAt).toBe('2026-11-26T00:05:00');
    expect(byId.get(3)?.lastAt).toBe('2026-11-26T12:15:00');

    for (const o of orders) {
      expect(Number.isNaN(new Date(o.lastAt).getTime())).toBeFalse();
    }
    expect(orders.map(o => o.orderId)).toEqual([1, 3, 2]);
  });
});
