/**
 * Models for the Monitoring module — surfaces the raw action-log endpoints
 * the POS API exposes but the narrative-audit pages don't:
 *   - /api/AuditReport/*       (unified timeline + summaries + entity history)
 *   - /api/OrderActionLog/*    (every order/table mutation with before/after)
 *
 * Field names are camelCase to match the server's JSON contract
 * (PascalCase C# → camelCase via the global resolver).
 */

/** A row in the unified audit timeline — OrderActionLog ∪ SystemActionLog ∪ MenuActionLog. */
export interface UnifiedAuditLog {
  id: number;
  /** "Order" | "System" | "Menu" */
  logSource: string;
  /** "OrderAction" | "Identity" | "POSSession" | "Customer" | "Integration" | "MenuCRUD" */
  category: string;
  actionType: string;
  entityType: string;
  entityId: string;
  entityName: string;
  description: string;
  userId: string;
  userName: string;
  userRole: string;
  userPosition: string;
  branchId: number;
  branchName: string;
  actionDate: string;   // ISO
  actionTime: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  machineId: string;
  machineName: string;
  ipAddress: string;
  sessionId: string;
  success: boolean;
  errorMessage: string;

  // ── The money, as numbers (order rows only) ──
  // oldValue/newValue carry the same figures as "Sales:.. Net:.. Total:..", which is a sentence
  // and cannot be subtracted. These can. Null on system and menu rows: a login has no net, and 0
  // would read as "the bill was zero" rather than "this was never about a bill".
  netBefore?: number | null;
  netAfter?: number | null;
  totalSalesBefore?: number | null;
  totalSalesAfter?: number | null;
  itemCountBefore?: number | null;
  itemCountAfter?: number | null;
  guestCountBefore?: number | null;
  guestCountAfter?: number | null;

  // ── Which order / table, so the feed can GROUP rather than merely print ──
  orderId?: number;
  receiptNumber?: number;
  tableName?: string;
  destinationTableName?: string;
  transactionTypeName?: string;
  waiterName?: string;
}

/** Request body for POST /api/AuditReport/Timeline (mirrors AuditLogFilterDto). */
export interface AuditLogFilter {
  fromDate: string;          // ISO, required
  toDate: string;            // ISO, required
  logSource?: string | null; // "Order" | "System" | "Menu" | null (= all)
  branchId?: number | null;
  userId?: string | null;
  userName?: string | null;
  userRole?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  actionType?: string | null;
  category?: string | null;
  orderId?: number | null;
  tableName?: string | null;
  transactionType?: number | null;
  machineId?: string | null;
  successOnly?: boolean | null;
  page: number;
  pageSize: number;          // server validator caps Timeline at 1..200
  searchText?: string | null;
}

/** Mirrors PaginatedAuditResult<T>. */
export interface PaginatedAudit<T> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** A row from /api/OrderActionLog/* — the OrderActionLog entity (every order/table mutation). */
export interface OrderActionLogRow {
  id: number;
  orderId: number;
  orderHeaderId: number;
  receiptNumber: number;
  tableName: string;
  destinationTableName: string;
  transactionType: number;
  transactionTypeName: string;
  actionType: number;
  actionTypeName: string;
  userId: string;
  userName: string;
  userRole: string;
  userPosition: string;
  waiterId: string;
  waiterName: string;
  cashierId: string;
  cashierName: string;
  branchId: number;
  branchName: string;
  hallId: number;
  shiftId: number;
  machineId: string;
  machineName: string;
  ipAddress: string;
  sessionId: string;
  actionDate: string;   // ISO
  actionTime: string;
  totalSalesBefore: number;
  netBefore: number;
  totalBefore: number;
  itemCountBefore: number;
  guestCountBefore: number;
  discountBefore: number;
  totalSalesAfter: number;
  netAfter: number;
  totalAfter: number;
  itemCountAfter: number;
  guestCountAfter: number;
  discountAfter: number;
  totalSalesDiff: number;
  netDiff: number;
  totalDiff: number;
  itemCountDiff: number;
  guestCountDiff: number;
  numOfCheckOut: number;
  isTransfered: boolean;
  isSplited: boolean;
  isAutoDiscount: boolean;
  promoCode: string;
  discountId: number;
  discountName: string;
  description: string;
  correlationId: string;
  durationMs: number;
  success: boolean;
  errorMessage: string;
  operationScope: string;
  batchSequence: number;
  beforeSnapshot: string;
  afterSnapshot: string;
  changedFields: string;
}

/** Mirrors AuditSummaryDto. */
export interface AuditSummary {
  logSource: string;
  category: string;
  actionType: string;
  entityType: string;
  totalCount: number;
  successCount: number;
  failCount: number;
}

/** Mirrors UserActivitySummaryDto. */
export interface UserActivitySummary {
  userId: string;
  userName: string;
  userRole: string;
  orderActions: number;
  systemActions: number;
  menuActions: number;
  totalActions: number;
  firstAction: string | null;
  lastAction: string | null;
}

/** Mirrors EntityChangeSummaryDto. */
export interface EntityChangeSummary {
  entityType: string;
  entityId: string;
  entityName: string;
  createCount: number;
  updateCount: number;
  deleteCount: number;
  totalChanges: number;
  lastChangedBy: string;
  lastChangeDate: string | null;
}

/** Query params for OrderActionLog/ByBranchAndDate (all optional except branch + dates). */
export interface OrderActionQuery {
  branchId: number;
  fromDate: string;
  toDate: string;
  actionType?: number | null;
  transactionType?: number | null;
  userId?: string | null;
  tableName?: string | null;
  receiptNumber?: number | null;
  machineId?: string | null;
  successOnly?: boolean | null;
  page: number;
  pageSize: number;
}
