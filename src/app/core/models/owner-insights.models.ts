import { BilingualText } from './audit.models';

/**
 * DTOs for `/api/OwnerInsights/*` endpoints — owner-decision reports
 * that surface fraud / customer / operational insights with bilingual
 * conclusions naming the action the owner should take.
 *
 * Also re-exports the request/response shapes for the three existing
 * `/api/BusinessIntelligence/*` endpoints the Owner Insights group
 * surfaces (StaffAccountabilityScorecard, OrderLifecycleDelays,
 * RevenueLeakageSummary) so the Insights pages can stay in one
 * cohesive feature folder.
 */

/** Request — same shape as the existing BIFilterDto. */
export interface OwnerInsightsRequest {
  fromDate: string;       // ISO
  toDate: string;         // ISO
  branchId?: number | null;
  language?: 'en' | 'ar';
  /** Time-series granularity for endpoints that return a per-bucket series. */
  grouping?: 'day' | 'week' | 'month' | 'year';
}

// ── Post-Checkout Modifications ───────────────────────────────────────

export interface PostCheckoutModificationsResult {
  totalEvents: number;
  totalMoneyImpact: number;
  byUser: PostCheckoutUserRollup[];
  events: PostCheckoutEvent[];
  conclusion: BilingualText;
}

export interface PostCheckoutUserRollup {
  userId: string;
  userName: string;
  eventCount: number;
  totalImpact: number;
  byActionType: { [actionType: string]: number };
}

export interface PostCheckoutEvent {
  id: number;
  orderId: number;
  receiptNumber: number;
  actionType: string;
  actionDate: string;
  actionTime: string;
  minutesAfterPay: number;
  userId: string;
  userName: string;
  branchId: number;
  branchName: string;
  tableName: string;
  transactionTypeName: string;
  netBefore: number;
  netAfter: number;
  netDiff: number;
  moneyImpact: number;
  promoCode: string;
  discountName: string;
  description: string;
}

// ── Top Paying Customers ──────────────────────────────────────────────

export interface TopPayingCustomersResult {
  customers: TopCustomerRow[];
  totalNet: number;
  totalOrders: number;
  identifiedCount: number;
  top10Percentage: number;
  conclusion: BilingualText;
}

export interface TopCustomerRow {
  mobilePhone: string;
  customerName: string;
  ordersCount: number;
  totalNet: number;
  avgTicket: number;
  firstOrderAt?: string;
  lastOrderAt?: string;
  branchesSeen: number;
  topTransaction: string;
}

// ── Growth Trends ─────────────────────────────────────────────────────

export interface GrowthTrendsResult {
  currentNet: number;
  currentOrders: number;
  previousNet: number;
  previousOrders: number;
  netDeltaPercent: number;
  ordersDeltaPercent: number;
  currentFrom: string;
  currentTo: string;
  previousFrom: string;
  previousTo: string;
  series: GrowthTrendPoint[];
  conclusion: BilingualText;
}

export interface GrowthTrendPoint {
  date: string;
  bucket: 'current' | 'previous' | string;
  net: number;
  orders: number;
}

// ── Items Not Paid (voided / cancelled item frequency) ────────────────

export interface ItemsNotPaidResult {
  items: ItemsNotPaidRow[];
  totalEvents: number;
  totalImpact: number;
  conclusion: BilingualText;
}

export interface ItemsNotPaidRow {
  itemId: number;
  itemName: string;
  voidedCount: number;
  voidedQty: number;
  voidedValue: number;
  source: string;                // "Void" | "Cancel" | "Void+Cancel"
}

// ══════════════════════════════════════════════════════════════════════
//  Existing /api/BusinessIntelligence/* shapes — surfaced under
//  Owner Insights nav so all of the "manager decision" pages live
//  in one cohesive group.
// ══════════════════════════════════════════════════════════════════════

// ── Revenue Leakage Summary ───────────────────────────────────────────

export interface RevenueLeakageSummaryDto {
  grossRevenue: number;
  grossRevenueDescription: string;
  grossRevenueDescriptionAr: string;
  netRevenue: number;
  totalLeakage: number;
  leakagePercent: number;
  leakageInsight: string;
  leakageInsightAr: string;
  byChannel: LeakageChannelDto[];
  trendByDay: LeakageTrendDto[];
  topLeakingUsers: LeakingUserDto[];
  alerts: BIAlertDto[];
}

export interface LeakageChannelDto {
  channel: string;
  channelAr: string;
  amount: number;
  percent: number;
  orderCount: number;
  eventCount: number;
  description: string;
  descriptionAr: string;
  severity: string;
}

export interface LeakageTrendDto {
  date: string;
  grossRevenue: number;
  netRevenue: number;
  leakagePercent: number;
}

export interface LeakingUserDto {
  userName: string;
  totalLeakage: number;
  topChannel: string;
  topChannelAr: string;
}

export interface BIAlertDto {
  title?: string;
  titleAr?: string;
  message?: string;
  messageAr?: string;
  severity?: string;
}

// ── Order Lifecycle Delays ────────────────────────────────────────────

export interface OrderLifecycleDelaysDto {
  totalOrdersAnalyzed: number;
  avgTotalLifecycleMinutes: number;
  insight: string;
  insightAr: string;
  stageMetrics: StageMetricDto[];
  bottleneckStage: string;
  bottleneckStageAr: string;
  delayedOrders: DelayedOrderDto[];
  byHour: HourlyDelayDto[];
  byTransactionType: TransactionDelayDto[];
}

export interface StageMetricDto {
  stage: string;
  stageAr: string;
  avgMinutes: number;
  medianMinutes: number;
  p95Minutes: number;
  maxMinutes: number;
  delayedCount: number;
  description: string;
  descriptionAr: string;
  severity: string;
}

export interface DelayedOrderDto {
  orderId: number;
  receiptNumber?: string | null;
  totalMinutes: number;
  bottleneckStage: string;
  bottleneckMinutes: number;
  branchName?: string | null;
  description: string;
  descriptionAr: string;
}

export interface HourlyDelayDto {
  hour: number;
  hourLabel: string;
  avgLifecycleMinutes: number;
  orderCount: number;
  description: string;
  descriptionAr: string;
}

export interface TransactionDelayDto {
  transactionName: string;
  transactionNameAr: string;
  avgLifecycleMinutes: number;
  orderCount: number;
}

// ── Staff Accountability Scorecard ────────────────────────────────────

export interface StaffScorecardDto {
  staff: StaffScoreDto[];
  branchAverages: BranchAveragesDto;
}

export interface StaffScoreDto {
  userId?: string | null;
  userName: string;
  userRole?: string | null;
  branchName?: string | null;

  ordersProcessed: number;
  totalRevenue: number;
  avgOrderValue: number;

  discountsApplied: number;
  discountAmount: number;
  discountInsight: string;
  discountInsightAr: string;

  voidsPerformed: number;
  voidAmount: number;
  voidInsight: string;
  voidInsightAr: string;

  cancellationsInitiated: number;
  avgOrderTimeMinutes: number;
  errorCount: number;
  paymentEdits: number;
  paymentEditInsight: string;
  paymentEditInsightAr: string;
  transfersInitiated: number;

  efficiencyScore: number;
  efficiencyDescription: string;
  efficiencyDescriptionAr: string;
  integrityScore: number;
  integrityDescription: string;
  integrityDescriptionAr: string;
  productivityScore: number;
  overallScore: number;
  overallDescription: string;
  overallDescriptionAr: string;
}

export interface BranchAveragesDto {
  avgOrderValue: number;
  avgOrderTimeMinutes: number;
  avgVoidRate: number;
  avgDiscountRate: number;
}
