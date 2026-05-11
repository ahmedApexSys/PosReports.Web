/**
 * Mirrors the C# BaseQueryResponse<T> envelope every POS API endpoint
 * returns. The Phase 6 / 7 / 8 reporting endpoints all wrap their
 * payload in this shape — never the bare data.
 */
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  succeeded: boolean;
  message: string;
  errors: string[] | null;
  id?: unknown;
  entityName?: string;
}

/** Login request — mirrors TokenRequestModel on the server. */
export interface LoginRequest {
  password: string;
  isDesktop: boolean;
  isPIN: boolean;
  machineId: string;
  isNotOrdering?: boolean;
}

/** Login response — mirrors AuthenticationModel. */
export interface AuthenticationModel {
  message: string;
  isAuthenticated: boolean;
  userProfile?: UserProfile;
  roles?: string[];
  permissions?: string[];
  token?: string;
  refreshToken?: string;
  refreshTokenExpiration?: string;
}

export interface UserProfile {
  userId?: string;
  userName?: string;
  email?: string;
  name_En?: string;
  name_Ar?: string;
  branchId?: number;
  branchName?: string;
  isOwner?: boolean;
}
