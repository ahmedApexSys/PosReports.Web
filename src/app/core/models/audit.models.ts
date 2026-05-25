/**
 * Mirrors the Phase 6 audit-narrative response shapes from
 * `PointOfSale.Application.DTOs.ReportingDtos.Phase6.AuditReportResponseDtos`.
 * Each of the 9 `/api/AuditNarrativeReport/*` endpoints returns one of these
 * — pick the right `T` when calling the api method.
 */

export interface BilingualText {
  /** Always populated. */
  descriptionEn: string;
  /** Always populated. */
  descriptionAr: string;
  /** Reflects the language the caller asked for in the request. */
  description: string;
}

export interface AuditNarrativeRow {
  id: number;
  actionDate: string; // ISO date
  actionTime: string;
  actionType: string;

  // Order context (zero / blank for non-order rows)
  orderId: number;
  receiptNumber: number;
  tableName: string;
  destinationTableName: string;
  transactionType: number;
  transactionTypeName: string;
  hallId: number;
  shiftId: number;

  // Operator
  userName: string;
  userRole: string;
  userPosition?: string;
  machineId: string;
  machineName?: string;
  branchName: string;
  branchId?: number;

  // Service-staff context — shown in the expanded detail panel
  waiterId?: string;
  waiterName?: string;
  cashierId?: string;
  cashierName?: string;

  // Financial deltas + item / guest counts — back the expandable detail panel
  totalSalesBefore: number;
  totalSalesAfter: number;
  totalBefore: number;
  totalAfter: number;
  netBefore: number;
  netAfter: number;
  netDiff: number;
  discountBefore: number;
  discountAfter: number;
  itemCountBefore: number;
  itemCountAfter: number;
  guestCountBefore: number;
  guestCountAfter: number;

  // Promo / discount source
  promoCode: string;
  discountName: string;

  // Bilingual narrative — primary text rendered in the card
  narrative: BilingualText;

  success: boolean;
  errorMessage: string;
  correlationId: string;

  // ── Item-level snapshots (Phase 2 — populated by Send / Pay / Void
  //    / Cancel / Transfer / Split hooks). JSON-encoded OrderSnapshot
  //    shape; parsed lazily by the audit-event-card. Empty for hooks
  //    that don't (yet) capture item state. ──
  beforeSnapshot?: string;
  afterSnapshot?: string;
  changedFields?: string;
}

/** Parsed shape of the JSON inside `beforeSnapshot` / `afterSnapshot`. */
export interface AuditOrderSnapshot {
  items: AuditOrderItemSnapshot[];
  itemCount: number;
  totalQty: number;
  subtotal: number;
}

export interface AuditOrderItemSnapshot {
  itemId: number;
  name: string;
  nameAr: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  variant?: string;
  notes?: string;
}

export interface AuditReportBucket {
  bucketStart: string;
  entryCount: number;
  successCount: number;
  failCount: number;
  uniqueUsers: number;
  uniqueOrders: number;
  totalNet: number;
  totalGross: number;
  totalDiscount: number;
}

export interface AuditReportPagedResult<T> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  conclusion: BilingualText;
  buckets: AuditReportBucket[];
}

export interface AuditTotalsSummary {
  totalEntries: number;
  totalSuccess: number;
  totalFail: number;
  uniqueUsers: number;
  uniqueOrders: number;
  uniqueBranches: number;
  uniqueMachines: number;
  totalNet: number;
  totalGross: number;
  totalDiscount: number;
  totalVoidedNet: number;
  totalCancelledNet: number;
  discountActions: number;
  voidActions: number;
  cancelActions: number;
  editPayActions: number;
  payActions: number;
  fromDate?: string;
  toDate?: string;
}

export interface AuditTotalsResult {
  buckets: AuditReportBucket[];
  summary: AuditTotalsSummary;
  conclusion: BilingualText;
}

export interface OrderJourneyResult {
  orderId: number;
  receiptNumber: number;
  transactionTypeName: string;
  tableName: string;
  branchId: number;
  branchName: string;
  openedAt?: string;
  lastActionAt?: string;
  finalNet: number;
  isCancelled: boolean;
  isPaid: boolean;
  usersInvolved: string[];
  timeline: AuditNarrativeRow[];
  conclusion: BilingualText;

  /** Chip-strip data in the header: action-type → count. */
  actionBreakdown?: Record<string, number>;
  /** Visual money-flow points — drives the strip above the timeline. */
  moneyFlow?: OrderMoneyFlowPoint[];
  /** Σ of discount deltas applied across the journey. */
  totalDiscountApplied?: number;
  /** Σ of voided value (NetBefore − NetAfter for Void rows). */
  totalVoidedValue?: number;
}

/** One captured point on the Order Journey's money-flow strip. */
export interface OrderMoneyFlowPoint {
  actionType: string;
  at: string;
  netAfter: number;
  label: BilingualText;
}

/** Money-touched stats — shared by UserSession and SuspiciousActivity rows. */
export interface SessionMonetaryStats {
  totalPaidValue: number;
  totalNetTouched: number;
  totalVoidedValue: number;
  totalDiscountedValue: number;
  totalCancelledValue: number;
  ordersTouched: number;
}

export interface UserSession {
  loginAt: string;
  logoutAt?: string;
  loginIp: string;
  loginMachine: string;
  duration: string; // TimeSpan serialised "HH:MM:SS"
  orderActionCount: number;
  systemActionCount: number;
  menuActionCount: number;
  actions: AuditNarrativeRow[];
  summary: BilingualText;

  /** Action-type → count for the session. */
  actionBreakdown?: Record<string, number>;
  /** Money the session touched / paid / voided / discounted. */
  monetary?: SessionMonetaryStats;
}

export interface UserSessionResult {
  userId: string;
  userName: string;
  userRole: string;
  sessions: UserSession[];
  conclusion: BilingualText;
}

export interface RiskFlag {
  code: string;
  count: number;
  weight: number;
  score: number;
  description: BilingualText;
}

export interface UserRiskScore {
  userId: string;
  userName: string;
  userRole: string;
  totalScore: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  flags: RiskFlag[];

  /** Branch where most of the user's flagged activity happened. */
  topBranchId?: number;
  topBranchName?: string;
  /** Top 5 flagged audit rows for this user, ordered by money impact. */
  topEvents?: AuditNarrativeRow[];
  /** Action-type → count over the window. */
  actionBreakdown?: Record<string, number>;
  /** Money-touched summary for context. */
  monetary?: SessionMonetaryStats;
}

export interface SuspiciousActivityResult {
  users: UserRiskScore[];
  window: AuditTotalsSummary;
  conclusion: BilingualText;
}

export interface DailyDigestEntry {
  date: string;
  entries: number;
  pays: number;
  voids: number;
  cancels: number;
  discounts: number;
  editPays: number;
  uniqueUsers: number;
  uniqueOrders: number;
  netCollected: number;
  discountGiven: number;
  voidedAmount: number;
  cancelledAmount: number;
  story: BilingualText;
}

export interface DailyDigestResult {
  days: DailyDigestEntry[];
  conclusion: BilingualText;
}

export interface TransactionReportGroup {
  groupKey: string;
  groupLabel: string;
  rowCount: number;
  totalNet: number;
  totalDiscount: number;
  rows: AuditNarrativeRow[];
  summary: BilingualText;
}

export interface TransactionReportResult {
  transactionTypeName: string;
  rows: AuditNarrativeRow[];
  groups: TransactionReportGroup[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  conclusion: BilingualText;
}

/** Server-side `PaymentStatusFilter` enum. */
export type PaymentStatusFilter = 'All' | 'PaidOnly' | 'UnpaidOnly';

/** Server-side `Surface` values — order-table source the row originated from. */
export type Surface = 'Paid' | 'Hospitality' | 'PayTab' | 'Reservation'
                    | 'CheckedOut' | 'Office' | 'Online' | 'Kiosk';

/** Server-side `LogSource` — which audit table the row came from. */
export type LogSource = 'Order' | 'System' | 'Menu';

/** Built-in transaction types in the POS data model. */
export const TRANSACTION_TYPES = [
  { id: 1, nameEn: 'Dine-In',    nameAr: 'داخل المطعم' },
  { id: 2, nameEn: 'Delivery',   nameAr: 'ديليفري' },
  { id: 3, nameEn: 'Take-Away',  nameAr: 'تيك أواي' },
] as const;

/** Common action types — the ones operators filter on most. The audit
 *  endpoint accepts arbitrary strings, but the UI lists these as chips. */
export const COMMON_ACTION_TYPES = [
  'Pay', 'EditPay', 'Discount', 'PromoCode', 'Voucher',
  'VoidItem', 'StopItem', 'Cancel', 'ApproveCancelOrder',
  'Transfer', 'Split', 'Assign', 'CollectMoney',
  'OrderCompleted', 'OrderDelivered', 'OrderPickedup',
  'Login', 'Logout', 'CloseShift', 'OpenShift',
] as const;

/**
 * Map an action type to the transaction-type ids it can plausibly belong
 * to. When the user picks one or more transaction types in the filter bar,
 * we narrow the action-type chips to the union of types each picked
 * transaction allows. Actions in the universal set are always shown.
 *
 * Transaction-type ids: 1=DineIn, 2=Delivery, 3=TakeAway.
 *
 * The classification is conservative — when in doubt, keep the action in
 * the universal set so the operator never loses a needed filter.
 */
export const ACTION_TYPE_TRANSACTION_SCOPE: Record<string, number[] | 'all'> = {
  // ── Universal (every transaction type can produce these) ──
  Pay: 'all', EditPay: 'all',
  Discount: 'all', PromoCode: 'all', Voucher: 'all',
  VoidItem: 'all', StopItem: 'all', ApproveStop: 'all', CancelStop: 'all',
  Cancel: 'all', ApproveCancelOrder: 'all', RejectCancelOrder: 'all',
  ChangePayWay: 'all', NoTax: 'all', RemoveDiscount: 'all', RemovePromoCode: 'all',
  EditOrder: 'all', PrintCheckOut: 'all', ReOpen: 'all',
  Send: 'all', Checkout: 'all', Calculate: 'all', CheckOut: 'all',

  // ── DineIn-specific ──
  Transfer: [1], Split: [1], MergeTable: [1], SplitTable: [1], TransferTable: [1],
  OpenTable: [1], EndTable: [1], ChangeGuest: [1], ChangeWaiter: [1],
  ChangeMinCharge: [1], ChangeAddition: [1], ChangeNoService: [1],
  ChangeTransaction: [1],

  // ── Delivery-specific ──
  Assign: [2], CollectMoney: [2], OrderCompleted: [2], OrderDelivered: [2],
  FollowOrder: [2], ChangePilot: [2], Return: [2],

  // ── TakeAway-specific ──
  OrderPickedup: [3], OrderPrepared: [3],

  // ── Auth / shift / system (no transaction context) ──
  Login: 'all', Logout: 'all',
  OpenShift: 'all', CloseShift: 'all',
  OpenDay: 'all', CloseDay: 'all',

  // ── Kiosk ──
  ActivateKioskOrder: 'all', CancelKioskOrder: 'all',
};

/** Date-range preset keys exposed by the audit filter bar — mirror the
 *  ones the global FilterService already supports, plus "custom". */
export const DATE_PRESETS = [
  { key: 'today',     labelEn: 'Today',         labelAr: 'اليوم' },
  { key: 'yesterday', labelEn: 'Yesterday',     labelAr: 'أمس' },
  { key: 'last7',     labelEn: 'Last 7 days',   labelAr: 'آخر 7 أيام' },
  { key: 'last30',    labelEn: 'Last 30 days',  labelAr: 'آخر 30 يوم' },
  { key: 'thisMonth', labelEn: 'This month',    labelAr: 'الشهر الحالي' },
  { key: 'lastMonth', labelEn: 'Last month',    labelAr: 'الشهر اللي فات' },
  { key: 'custom',    labelEn: 'Custom',        labelAr: 'مخصص' },
] as const;

/**
 * Generic filter context that the audit + trx page shells pass to each
 * route's `fetchFn`. Captures the global filter (from FilterService) +
 * every page-local control (groupBy, pageSize, user, transaction types,
 * payment status, surfaces, action types, search). Each caller turns
 * this into its endpoint-specific request via one of the to*Request
 * helpers below.
 */
export interface AuditPageContext {
  // ── Global filter (from FilterService) ─────────────────────────
  fromDate: string;
  toDate: string;
  branchId: number | null;
  language: 'en' | 'ar';

  // ── Page-local filters owned by the filter bar ─────────────────
  /** ReportGroupBy enum (time-bucket). Only relevant for the 4 paged
   *  audit endpoints (Daily / Totals / Suspicious / DailyDigest). */
  groupBy: 'None' | 'Daily' | 'Weekly' | 'Monthly';
  page: number;
  pageSize: number;

  // ── Optional filter dimensions (audit DTO supports all of them) ─
  userIds?: string[];
  transactionTypes?: number[];     // 1=DineIn, 2=Delivery, 3=TakeAway
  payWays?: number[];
  paymentStatus?: PaymentStatusFilter;
  surfaces?: Surface[];
  actionTypes?: string[];
  searchText?: string;
}

/** Subset of AuditReportFilterDto fields the SPA can send. */
export interface AuditReportFilterRequest {
  fromDate: string;
  toDate: string;
  branchIds?: number[];
  userIds?: string[];
  transactionTypes?: number[];
  orderIds?: number[];
  payWays?: number[];
  paymentStatus?: PaymentStatusFilter;
  surfaces?: Surface[];
  actionTypes?: string[];
  searchText?: string;
  /** ReportGroupBy enum on the server — string value works for the JSON binding. */
  groupBy?: 'None' | 'Daily' | 'Weekly' | 'Monthly';
  page?: number;
  pageSize?: number;
  language?: 'en' | 'ar';
}

/**
 * The per-transaction endpoints (`DineIn` / `TakeAway` / `Delivery`)
 * accept their OWN focused request DTOs — NOT the generic
 * AuditReportFilterDto. Their `groupBy` is a different enum
 * (TransactionReportGroupBy) with values like ByTable/ByWaiter/ByOrder
 * etc., not the time-bucket ones. Sending `"Daily"` here is a 400.
 */
export type TransactionReportGroupBy =
  | 'None' | 'ByTable' | 'ByWaiter' | 'ByCashier' | 'ByOrder' | 'ByPilot';

export interface DineInReportRequest {
  fromDate: string;
  toDate: string;
  branchIds?: number[];
  hallIds?: number[];
  tableNames?: string[];
  waiterIds?: string[];
  actionTypes?: string[];
  groupBy?: TransactionReportGroupBy;
  page?: number;
  pageSize?: number;
  searchText?: string;
  language?: 'en' | 'ar';
}

export interface TakeAwayReportRequest {
  fromDate: string;
  toDate: string;
  branchIds?: number[];
  cashierIds?: string[];
  orderIds?: number[];
  actionTypes?: string[];
  groupBy?: TransactionReportGroupBy;
  page?: number;
  pageSize?: number;
  searchText?: string;
  language?: 'en' | 'ar';
}

export interface DeliveryReportRequest {
  fromDate: string;
  toDate: string;
  branchIds?: number[];
  cashierIds?: string[];
  orderIds?: number[];
  actionTypes?: string[];
  groupBy?: TransactionReportGroupBy;
  page?: number;
  pageSize?: number;
  searchText?: string;
  language?: 'en' | 'ar';
}

/** OrderJourney endpoint — pass an OrderId OR a ReceiptNumber. */
export interface OrderJourneyRequest {
  orderId?: number;
  receiptNumber?: number;
  /** Resolved to most-recent order on that table in the past 30 days. */
  tableName?: string;
  /** Resolved to most-recent OrderHeader matching the phone. */
  mobilePhone?: string;
  branchId?: number;
  language?: 'en' | 'ar';
  /** Show Calculate rows on the timeline (default: false — they're noise). */
  includeCalculate?: boolean;
}

/** List-mode lookup for table-name / mobile-phone searches. Returns
 *  candidate orders the operator can pick from. */
export interface OrderJourneyLookupRequest {
  tableName?: string;
  mobilePhone?: string;
  branchId?: number;
  /** 1=DineIn, 2=Delivery, 3=TakeAway. Narrows tables that host
   *  multiple transaction types in the same day. */
  transactionTypeId?: number;
  /** Explicit [from, to] window — overrides lookbackDays. ISO strings. */
  fromDate?: string;
  toDate?: string;
  /** Sliding-window default when fromDate / toDate aren't set. */
  lookbackDays?: number;
  /** Per-shift filter — only meaningful WITH a date. */
  shiftId?: number;
  language?: 'en' | 'ar';
  maxResults?: number;
}

export interface OrderJourneyCandidate {
  orderId: number;
  receiptNumber: number;
  tableName: string;
  transactionTypeName: string;
  branchId: number;
  branchName: string;
  orderDate?: string;
  orderTime: string;
  net: number;
  employeeName: string;
  waiterName: string;
  cashierName: string;
  mobilePhone: string;
  isPaid: boolean;
  isCancelled: boolean;
  itemCount: number;
  /** "Paid" or "Temp". */
  source: string;
}

export interface OrderJourneyLookupResult {
  candidates: OrderJourneyCandidate[];
  totalMatches: number;
  truncated: boolean;
  message: BilingualText;
}

/** UserSession endpoint — pass a UserId. */
export interface UserSessionRequest {
  userId: string;
  fromDate: string;
  toDate: string;
  branchId?: number;
  language?: 'en' | 'ar';
}

// ── Context-to-request helpers ────────────────────────────────────────
// Each audit / trx component receives an AuditPageContext from the page
// shell and turns it into the endpoint-specific DTO via one of these.

export function toAuditFilterRequest(ctx: AuditPageContext): AuditReportFilterRequest {
  return {
    fromDate: ctx.fromDate,
    toDate: ctx.toDate,
    branchIds: ctx.branchId != null ? [ctx.branchId] : [],
    userIds: ctx.userIds,
    transactionTypes: ctx.transactionTypes,
    payWays: ctx.payWays,
    paymentStatus: ctx.paymentStatus,
    surfaces: ctx.surfaces,
    actionTypes: ctx.actionTypes,
    searchText: ctx.searchText,
    groupBy: ctx.groupBy,
    page: ctx.page,
    pageSize: ctx.pageSize,
    language: ctx.language,
  };
}

export function toDineInRequest(
  ctx: AuditPageContext,
  groupBy: TransactionReportGroupBy = 'None',
): DineInReportRequest {
  return {
    fromDate: ctx.fromDate,
    toDate: ctx.toDate,
    branchIds: ctx.branchId != null ? [ctx.branchId] : [],
    actionTypes: ctx.actionTypes,
    searchText: ctx.searchText,
    groupBy,
    page: ctx.page,
    pageSize: ctx.pageSize,
    language: ctx.language,
  };
}

export function toTakeAwayRequest(
  ctx: AuditPageContext,
  groupBy: TransactionReportGroupBy = 'None',
): TakeAwayReportRequest {
  return {
    fromDate: ctx.fromDate,
    toDate: ctx.toDate,
    branchIds: ctx.branchId != null ? [ctx.branchId] : [],
    actionTypes: ctx.actionTypes,
    searchText: ctx.searchText,
    groupBy,
    page: ctx.page,
    pageSize: ctx.pageSize,
    language: ctx.language,
  };
}

export function toDeliveryRequest(
  ctx: AuditPageContext,
  groupBy: TransactionReportGroupBy = 'ByOrder',
): DeliveryReportRequest {
  return {
    fromDate: ctx.fromDate,
    toDate: ctx.toDate,
    branchIds: ctx.branchId != null ? [ctx.branchId] : [],
    actionTypes: ctx.actionTypes,
    searchText: ctx.searchText,
    groupBy,
    page: ctx.page,
    pageSize: ctx.pageSize,
    language: ctx.language,
  };
}
