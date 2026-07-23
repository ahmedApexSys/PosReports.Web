/**
 * The three "day" journeys — a table across a day, a day of deliveries, a day of take-aways.
 *
 * Each is deliberately its OWN shape, not a merged report: a table-day is sittings in sequence, a
 * delivery-day is a milestone strip per order, a take-away-day is three dots. They share only that
 * every row drills into the one order journey by orderId. Field names match the server DTOs on the
 * wire (camelCase via the resolver).
 */

// ── Table day ────────────────────────────────────────────────────────────

export interface TableDayRequest {
  tableName: string;
  branchId?: number | null;
  date?: string | null; // ISO; the Cairo business day
}

export interface TableSitting {
  orderId: number;
  receiptNumber?: string | null;
  /** The sitting's own table name — a split child settles under "X-1" and is rolled into X's day. */
  sittingTableName?: string | null;
  openedAt?: string | null;
  closedAt?: string | null;
  durationMinutes?: number | null;
  guests: number;
  waiterName?: string | null;
  cashierName?: string | null;
  net: number;
  total: number;
  paymentMethod?: string | null;
  isPaidOrder: boolean;
  transactionType: string;
  transactionTypeAr: string;
  sends: number;
  voids: number;
  transfers: number;
  splits: number;
  discounts: number;
  closedWithoutPayment: boolean;
}

export interface TableDay {
  tableName: string;
  branchName?: string | null;
  date: string;
  sittings: TableSitting[];
  sittingCount: number;
  totalGuests: number;
  totalNet: number;
  totalOccupiedMinutes?: number | null;
  emptyReasonAr?: string | null;
  emptyReasonEn?: string | null;
}

// ── Delivery day ─────────────────────────────────────────────────────────

export interface DeliveryDayRequest {
  branchId?: number | null;
  pilotId?: number | null;
  date?: string | null;
}

export interface DeliveryOrderRow {
  orderId: number;
  receiptNumber?: string | null;
  customerName?: string | null;
  mobilePhone?: string | null;
  pilotName?: string | null;
  isAggregator: boolean;
  onlineAppName?: string | null;
  createdAt?: string | null;
  paidAt?: string | null;
  preparedAt?: string | null;
  assignedAt?: string | null;
  assignedBy?: string | null;
  deliveredAt?: string | null;
  returnedAt?: string | null;
  kitchenMinutes?: number | null;
  dispatchWaitMinutes?: number | null;
  dispatchToDoorMinutes?: number | null;
  roundTripMinutes?: number | null;
  status: string;
  net: number;
  paymentMethod?: string | null;
  isCollected: boolean;
  isReturned: boolean;
}

export interface DeliveryDay {
  date: string;
  branchName?: string | null;
  orders: DeliveryOrderRow[];
  orderCount: number;
  delivered: number;
  notReturned: number;
  totalNet: number;
  avgKitchenMinutes?: number | null;
  avgDispatchToDoorMinutes?: number | null;
  emptyReasonAr?: string | null;
  emptyReasonEn?: string | null;
}

// ── Take-away day ────────────────────────────────────────────────────────

export interface TakeAwayDayRequest {
  branchId?: number | null;
  date?: string | null;
}

export interface TakeAwayOrderRow {
  orderId: number;
  receiptNumber?: string | null;
  createdAt?: string | null;
  paidAt?: string | null;
  collectedAt?: string | null;
  waitMinutes?: number | null;
  status: string;
  net: number;
  paymentMethod?: string | null;
  cashierName?: string | null;
  isCollected: boolean;
}

export interface TakeAwayDay {
  date: string;
  branchName?: string | null;
  orders: TakeAwayOrderRow[];
  orderCount: number;
  collected: number;
  uncollected: number;
  totalNet: number;
  avgWaitMinutes?: number | null;
  emptyReasonAr?: string | null;
  emptyReasonEn?: string | null;
}
