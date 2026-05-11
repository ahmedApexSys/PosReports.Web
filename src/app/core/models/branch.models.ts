/**
 * Mirrors BranchObjectDto from the POS API (HomeController.Branches.cs).
 * Returned by GET /api/Home/GetAllAvailableBranches inside
 * BaseQueryResponse<List<BranchObjectDto>>.
 */
export interface Branch {
  id: number;
  name_En: string;
  name_Ar: string;
  message?: string;
  isUseItemTax?: boolean;
  isStopped?: boolean;
  taxPercentage?: number;
  backupBranchId?: number;
  geoLocationPointId?: string;
  geoLocationId?: string;
  stoppedTimes?: unknown[];
}
