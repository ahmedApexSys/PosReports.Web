/**
 * Types for the API Traffic report — the shape returned by
 * `POST /api/activity-log/api-traffic` (ApiTrafficDto on the server).
 *
 * The server reads `[OrderLog].[RequestAuditLogs]`, a row per request that the
 * API has always written and nothing ever read: who called, which endpoint,
 * the status, the duration, the branch, the machine.
 *
 * ONE HONEST LIMIT, and it shapes what this screen may claim. The house
 * convention returns **HTTP 200 with `success=false`** for business failures
 * (~273 call sites), so the stored status says 200 for a great many real
 * failures. Every error figure here is therefore a FLOOR, never a total —
 * which is what `errorRateIsALowerBound` exists to say out loud. Durations are
 * untouched by that convention and are trustworthy: the screen names the SLOW
 * endpoints with confidence and the FAILING ones only as a lower bound.
 */

/** One endpoint's traffic over the window. */
export interface ApiEndpointStat {
  path: string;
  httpMethod: string;
  calls: number;
  avgMs: number;
  /** 95th percentile — what the slow tail actually feels like, not the average. */
  p95Ms: number;
  maxMs: number;
  /** Transport-level failures and unhandled exceptions only — a floor. */
  errorCalls: number;
  /** Percentage, 0..100, one decimal. A floor, for the same reason. */
  errorRate: number;
  /** calls x duration — the total time this endpoint took off the server. */
  totalMs: number;
}

/** Traffic attributed to one signed-in user. */
export interface ApiUserStat {
  userId?: string | null;
  userName?: string | null;
  calls: number;
  avgMs: number;
  errorCalls: number;
  distinctPaths: number;
  lastSeen?: string | null;
}

/** Calls per hour of the Cairo day — where the load actually lands. */
export interface ApiHourStat {
  hour: number;
  calls: number;
  avgMs: number;
}

/** One request slow enough to be worth naming. An average hides it. */
export interface ApiSlowCall {
  path: string;
  httpMethod: string;
  durationMs: number;
  responseStatus: number;
  userName?: string | null;
  machineName?: string | null;
  at?: string | null;
  correlationId?: string | null;
}

/** The whole report. */
export interface ApiTraffic {
  fromDate?: string | null;
  toDate?: string | null;

  totalCalls: number;
  avgMs: number;
  errorCalls: number;
  distinctUsers: number;
  distinctEndpoints: number;

  /**
   * Always true while handled failures return 200. A field rather than a
   * hard-coded note on the client so that if the convention ever changes, one
   * place decides and this screen follows.
   */
  errorRateIsALowerBound: boolean;

  /** Ordered by TOTAL time consumed, descending — the server decides, we keep it. */
  endpoints: ApiEndpointStat[];
  users: ApiUserStat[];
  byHour: ApiHourStat[];
  slowestCalls: ApiSlowCall[];

  /** Set when the log table has no data on this database, or could not be read. */
  unavailableReasonAr?: string | null;
  unavailableReasonEn?: string | null;
}

/** Request body. Dates are Cairo-local; the server defaults to the last 7 days. */
export interface ApiTrafficRequest {
  fromDate?: string | null;
  toDate?: string | null;
  branchId?: number | null;
  /** One endpoint path, or a fragment of one. */
  path?: string | null;
  /** Rows per list. Server clamps to 1..100, defaults to 20. */
  top?: number | null;
}
