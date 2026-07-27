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

/** One item line inside a movement clip — the same shape on all three panels. */
export interface JourneyClipItem {
  itemName: string;
  variantName?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/** A single labelled fact about a movement (guests, reason, destination, …). */
export interface JourneyChip {
  labelAr: string;
  labelEn: string;
  value: string;
}

/**
 * The item-level clip of ONE movement: what was on the table, what this event
 * moved, and what was left. Headings come from the server because only it knows
 * whether the middle list is "اتبعت", "اتشال" or "اتحوّل".
 */
export interface JourneyMovement {
  /** 'Send' | 'VoidItem' | 'Transfer' | 'Split' | 'CheckOut' | 'Pay' */
  kind: string;
  movedHeadingAr: string;
  movedHeadingEn: string;
  before: JourneyClipItem[];
  moved: JourneyClipItem[];
  after: JourneyClipItem[];
  beforeTotal: number;
  movedTotal: number;
  afterTotal: number;
  /** before/after were folded from earlier events, not read from a stored snapshot. */
  beforeAfterDerived: boolean;
  /** Set when the item lists are empty because the data was never logged. */
  unavailableReasonAr?: string | null;
  unavailableReasonEn?: string | null;
  chips: JourneyChip[];
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
  /** Where the movement landed: the table a transfer went to, or the check a split opened. */
  destinationName?: string | null;
  /** The waiter the movement belongs to — not always the user who pressed the button. */
  waiterName?: string | null;
  /** The item-level clip. Absent on events that move no items (open, change waiter, …). */
  movement?: JourneyMovement | null;
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
  /** Minutes in the kitchen — placement to ready. Null when never stamped. */
  kitchenMinutes?: number | null;
  onlineAppName?: string | null;
}

/**
 * Who carries the cost when an order is not a plain paid sale — and who moved it there.
 * Present only when there is something to answer for; null on an ordinary untouched cash order.
 * The two names are deliberately separate: the officer who BENEFITS is almost never the cashier
 * who made the change, and an owner needs both.
 */
export interface JourneyAccountability {
  /** The officer the order is charged to — the one who benefits. */
  officerName?: string | null;
  /** Why it is not a normal paid sale (Officer / Hospitality / ...). */
  paymentStatusExplanation?: string | null;
  /** Hospitality only: made and charged but never served. */
  isOfficerWasted: boolean;
  /** Who bears that waste. */
  wastedOfficerName?: string | null;
  /** Settled AS now (e.g. Officer), when different from before. */
  payWayTo?: string | null;
  /** What it was BEFORE the change (e.g. Cash). */
  payWayFrom?: string | null;
  /** The user who performed the change / comp. */
  changedBy?: string | null;
  changedAt?: string | null;
  /** How many times the bill was printed — a repeat is worth flagging. */
  checkoutCount: number;
  /** Every logged pay-way change, earliest first — so a repeated cash→visa reads as its sequence. */
  payWayChanges?: PayWayChange[];
}

/** One logged pay-way change: when it happened and the method it changed TO (null if unparsed). */
export interface PayWayChange {
  at: string;
  to?: string | null;
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

/** One discounted line inside a discount: the item, how many, and how much came off it. */
export interface JourneyDiscountLine {
  itemName: string;
  variantName?: string | null;
  quantity: number;
  amount: number;
}

export interface JourneyDiscount {
  discountName: string;
  discountNameAr?: string | null;
  amount: number;
  isPromoCode: boolean;
  promoCode?: string | null;
  /** True when a rule applied it, not a person. */
  isAutomatic?: boolean;
  appliedBy?: string | null;
  appliedAt?: string | null;
  /**
   * "Order" — read off the persisted order (identity + amount are certain, the time may not be
   * recorded). "Log" — an audit row with no surviving line, i.e. applied and later removed.
   * The page says which, because the two carry different confidence.
   */
  source?: string | null;
  lines?: JourneyDiscountLine[];
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
  /** Who carries the cost — present only when the order is a comp, a pay-way change, or a waste. */
  accountability?: JourneyAccountability | null;
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
