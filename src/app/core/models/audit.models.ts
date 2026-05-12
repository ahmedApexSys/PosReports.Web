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
  orderId: number;
  receiptNumber: number;
  tableName: string;
  transactionType: number;
  transactionTypeName: string;
  userName: string;
  userRole: string;
  machineId: string;
  branchName: string;
  netBefore: number;
  netAfter: number;
  netDiff: number;
  discountAfter: number;
  narrative: BilingualText;
  success: boolean;
  errorMessage: string;
  correlationId: string;
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
  branchId?: number;
  language?: 'en' | 'ar';
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
