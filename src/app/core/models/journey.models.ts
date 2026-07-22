/**
 * Types for the itemized Order Journey — the shape returned by
 * `POST /api/activity-log/order-timeline` (OrderTimelineDto on the server).
 *
 * The journey is the full lifecycle of one order: every action from open to
 * pay, the money before→after at each step, and the real item lines involved
 * (sent / voided) with name, quantity, and price.
 */

export interface JourneyStepDetails {
  totalSalesBefore?: number;
  totalSalesAfter?: number;
  netBefore?: number;
  netAfter?: number;
  itemCountBefore?: number;
  itemCountAfter?: number;
  guestCountBefore?: number;
  guestCountAfter?: number;
  durationMs?: number;
}

export interface JourneyStep {
  step: number;
  action: string;
  actionAr: string;
  /** Raw developer log line — for the technical expander only, never the headline. */
  description: string;
  /** Owner-facing sentence assembled server-side from structured columns. */
  summaryAr?: string | null;
  summaryEn?: string | null;
  userName?: string | null;
  date: string;
  time: string;
  severity?: string | null;
  success: boolean;
  /** 'Order' = keyed to the paid order; 'Table' = matched from the dine-in table session. */
  stage: string;
  /** Internal repricing/technical event — hidden unless the user opts in. */
  isNoise: boolean;
  /** Only true when the before/after money on this row is trustworthy. */
  hasMoneyDelta: boolean;
  details?: JourneyStepDetails | null;
}

/** The receipt: what the order actually cost, broken down. */
export interface JourneyMoney {
  itemsTotal: number;
  discount: number;
  service: number;
  itemTax: number;
  serviceTax: number;
  totalTax: number;
  taxRatio: number;
  minimumChargePerGuest: number;
  minimumChargeDifference: number;
  /**
   * The branch's dine-in IncludeTaxAndService option — WHAT the minimum was compared
   * against. The same spend can clear the minimum in one branch and fall short in
   * another, so the figures are only readable alongside this. Null when no minimum applies.
   */
  minimumChargeIncludesTaxAndService?: boolean | null;
  addition: number;
  net: number;
  total: number;
}

/**
 * The delivery leg — present only on delivery orders, which is exactly how the
 * page decides to draw the courier layout instead of the table or counter one.
 * Every stamp is optional: an order voided before dispatch never gets one.
 */
export interface JourneyDelivery {
  customerName?: string | null;
  mobilePhone?: string | null;
  address?: string | null;
  pilotName?: string | null;
  prepareTime?: string | null;
  assignTime?: string | null;
  pickUpTime?: string | null;
  returnTime?: string | null;
  roundTripMinutes?: number | null;
  onlineAppName?: string | null;
}

export interface JourneyVoidedItem {
  itemName: string;
  quantity: number;
  price: number;
  reason?: string | null;
  voidedBy?: string | null;
  voidedAt?: string | null;
  /** 'BeforeSend' | 'AfterSend' | 'AfterCheckout' */
  stage?: string | null;
  stageAr?: string | null;
}

export interface JourneyLineItem {
  itemName: string;
  variantName?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  net: number;
}

export interface JourneyDiscount {
  discountName: string;
  amount: number;
  isPromoCode: boolean;
  appliedBy?: string | null;
  appliedAt?: string | null;
}

export interface OrderJourney {
  orderId: number;
  receiptNumber?: string | null;
  transactionType: string;
  transactionTypeAr: string;
  branchName?: string | null;
  tableName?: string | null;
  status: string;
  statusAr: string;
  totalSales: number;
  net: number;
  total: number;
  /** The receipt breakdown (items / discount / service / tax / min charge / addition / net). */
  money: JourneyMoney;
  /** Stored settlement method: Cash / Visa / Ledge / Officer / Hospitality / PayTabs. */
  paymentMethod?: string | null;
  /** The method it was changed FROM, when a pay-way change happened (e.g. Cash -> Visa). */
  previousPaymentMethod?: string | null;
  /** True for genuinely-paid methods; false for Officer / Hospitality / PayTabs. */
  isPaidOrder: boolean;
  createdAt?: string | null;
  completedAt?: string | null;
  duration?: string | null;
  cashierName?: string | null;
  waiterName?: string | null;
  pilotName?: string | null;
  /** Courier detail — null on dine-in and take-away. */
  delivery?: JourneyDelivery | null;
  timeline: JourneyStep[];
  voidedItems: JourneyVoidedItem[];
  items: JourneyLineItem[];
  discounts: JourneyDiscount[];
  itemCount: number;
  guestCount: number;
  totalSteps: number;
}

export interface OrderJourneyRequest {
  orderId?: number | null;
  receiptNumber?: string | null;
  userId?: string | null;
  /** Receipt numbers are a per-branch sequence — scope the lookup or you can match another branch. */
  branchId?: number | null;
}
