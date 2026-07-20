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
  description: string;
  userName?: string | null;
  date: string;
  time: string;
  severity?: string | null;
  success: boolean;
  details?: JourneyStepDetails | null;
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
  paymentMethod?: string | null;
  createdAt?: string | null;
  completedAt?: string | null;
  duration?: string | null;
  cashierName?: string | null;
  waiterName?: string | null;
  pilotName?: string | null;
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
}
