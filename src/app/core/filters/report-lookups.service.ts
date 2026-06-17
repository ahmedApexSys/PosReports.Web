import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, of, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PickerItem } from '../models/picker.models';

/**
 * Loads the dropdown lookup lists every Sales report's filter bar needs,
 * straight from the live POS API endpoints the owner specified:
 *
 *   payment methods  → GET PaymentMethods/GetAllPaymentMethods?payment={paid|unpaid|all}
 *   online apps      → GET OnlineApps/getall
 *   discounts        → GET Discounts/GetAll
 *   shifts           → GET Shifts/getall
 *   vouchers         → GET UtilityData/AllVouchers
 *   promo discounts  → GET UtilityData/AllPromoDiscounts
 *   transactions     → GET TransactionTypes/GetAll
 *   waiters/cashiers → GET Order/GetWaitersAndCashiersList?BranchId=
 *   pilots           → GET OrderManagments/GetAllPilots?branch=
 *   current shift    → GET CloseOperation/CurrentShiftForBranch/{branchId}
 *
 * Branches come from the header picker (BranchService) and dates from the
 * header date-range picker, so they are not duplicated here.
 *
 * Everything is normalised to `PickerItem` ({ id, nameEn, nameAr, extra }) so
 * the shared <app-picker> can render any of them. `id` carries the exact value
 * the report's filter DTO expects:
 *   - payment method  → id = payment-method English name  (sent as `payway`)
 *   - transaction     → id = transaction id               (sent as `transactionId`)
 *   - shift           → id = shift id                      (sent as `shiftId`)
 *   - discount        → id = discount id                   (sent as `discountId`)
 *   - promo           → id = discount id                   (sent as `promoCodeDiscountId`)
 *   - voucher         → id = voucher code                  (sent as `voucherName`)
 *   - online app      → id = online-app id                 (sent as `onlineApp`)
 *   - user/cashier    → id = userId                        (sent as `userId`)
 *   - waiter          → id = userId                        (sent as `waiterId`)
 *   - pilot           → id = userId                        (sent as `poiltId`)
 *
 * Inactive / disabled rows are filtered out so only usable options are shown.
 */
@Injectable({ providedIn: 'root' })
export class ReportLookupsService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiBaseUrl}/api`;

  // ── Static lists (branch-independent — loaded once, cached) ─────────────
  readonly onlineApps      = signal<PickerItem[]>([]);
  readonly discounts       = signal<PickerItem[]>([]);
  readonly shifts          = signal<PickerItem[]>([]);
  readonly vouchers        = signal<PickerItem[]>([]);
  readonly promoDiscounts  = signal<PickerItem[]>([]);
  readonly transactions    = signal<PickerItem[]>([]);

  // ── Branch-scoped lists ────────────────────────────────────────────────
  readonly waiters         = signal<PickerItem[]>([]);
  readonly cashiers        = signal<PickerItem[]>([]);
  readonly pilots          = signal<PickerItem[]>([]);
  /** id + bilingual name of the currently-open shift for the branch (or null). */
  readonly currentShift    = signal<PickerItem | null>(null);

  // ── Payment methods (depend on the Paid/Unpaid/All toggle) ──────────────
  readonly paymentMethods  = signal<PickerItem[]>([]);

  private staticLoaded = false;
  private lastBranch: number | null = null;
  private lastPayment = '';

  /** Pull the six branch-independent lists once. */
  ensureStatic(): void {
    if (this.staticLoaded) return;
    this.staticLoaded = true;

    this.list(`OnlineApps/getall`, (r) => ({
      id: String(this.num(r, 'id')),
      nameEn: this.str(r, 'nameEnglish', 'name_En', 'name'),
      nameAr: this.str(r, 'nameArabic', 'name_Ar'),
      extra: '',
    }), (r) => this.active(r)).subscribe((x) => this.onlineApps.set(x));

    this.list(`Discounts/GetAll?pageNumber=1&pageSize=100000`, (r) => ({
      id: String(this.num(r, 'id')),
      nameEn: this.str(r, 'name_En', 'nameEnglish', 'name'),
      nameAr: this.str(r, 'name_Ar', 'nameArabic'),
      extra: this.discExtra(r),
    }), (r) => this.active(r)).subscribe((x) => this.discounts.set(x));

    this.list(`Shifts/getall?pageNumber=1&pageSize=100000`, (r) => ({
      id: String(this.num(r, 'id')),
      nameEn: this.str(r, 'name_En', 'nameEnglish', 'name'),
      nameAr: this.str(r, 'name_Ar', 'nameArabic'),
      extra: '',
    })).subscribe((x) => this.shifts.set(x));

    this.list(`UtilityData/AllVouchers`, (r) => {
      const code = this.str(r, 'voucherCode', 'code', 'name_En');
      return { id: code, nameEn: code, nameAr: code, extra: '' };
    }, (r) => !!this.str(r, 'voucherCode', 'code', 'name_En')).subscribe((x) => this.vouchers.set(x));

    this.list(`UtilityData/AllPromoDiscounts`, (r) => ({
      id: String(this.num(r, 'id')),
      nameEn: this.str(r, 'name_En', 'nameEnglish', 'name'),
      nameAr: this.str(r, 'name_Ar', 'name_En'),
      extra: '',
    })).subscribe((x) => this.promoDiscounts.set(x));

    this.list(`TransactionTypes/GetAll?pageNumber=1&pageSize=100000`, (r) => ({
      id: String(this.num(r, 'id')),
      nameEn: this.str(r, 'transactionTypeName', 'name_En', 'name'),
      nameAr: this.str(r, 'transactionTypeName', 'name_Ar'),
      extra: '',
    }), (r) => this.bool(r, 'isDisable') !== true).subscribe((x) => this.transactions.set(x));
  }

  /** Pull the branch-scoped lists (waiters, cashiers, pilots, current shift). */
  loadBranch(branchId: number | null | undefined): void {
    if (branchId == null || branchId <= 0) {
      this.waiters.set([]); this.cashiers.set([]); this.pilots.set([]); this.currentShift.set(null);
      this.lastBranch = null;
      return;
    }
    if (branchId === this.lastBranch) return;
    this.lastBranch = branchId;

    // Waiters + cashiers come back as two groups in one call.
    this.http.get<any>(`${this.api}/Order/GetWaitersAndCashiersList?BranchId=${branchId}`).pipe(
      map((res) => this.arr(res)),
      catchError(() => of([] as any[])),
    ).subscribe((groups) => {
      const toItems = (g: any): PickerItem[] => (this.arr2(g?.userList) ?? []).map((u: any) => ({
        id: this.str(u, 'userId', 'id'),
        nameEn: this.str(u, 'name_En', 'nameEnglish', 'userName'),
        nameAr: this.str(u, 'name_Ar', 'nameArabic'),
        extra: '',
      })).filter((i: PickerItem) => !!i.id);
      let waiters: PickerItem[] = [], cashiers: PickerItem[] = [];
      for (const g of groups) {
        const msg = String(g?.message ?? '').toLowerCase();
        if (msg.includes('waiter')) waiters = toItems(g);
        else if (msg.includes('cashier')) cashiers = toItems(g);
      }
      // Fallback: if message tags are absent, treat the first group as waiters.
      if (!waiters.length && !cashiers.length && groups.length) {
        waiters = toItems(groups[0]);
        if (groups[1]) cashiers = toItems(groups[1]);
      }
      this.waiters.set(waiters);
      this.cashiers.set(cashiers);
    });

    this.list(`OrderManagments/GetAllPilots?branch=${branchId}`, (r) => ({
      id: this.str(r, 'id', 'userId'),
      nameEn: this.str(r, 'name_En', 'nameEnglish', 'userName'),
      nameAr: this.str(r, 'name_Ar', 'nameArabic'),
      extra: this.str(r, 'userName'),
    }), (r) => !!this.str(r, 'id', 'userId')).subscribe((x) => this.pilots.set(x));

    this.http.get<any>(`${this.api}/CloseOperation/CurrentShiftForBranch/${branchId}`).pipe(
      map((res) => (res?.data ?? res ?? null)),
      catchError(() => of(null)),
    ).subscribe((s) => {
      if (!s || typeof s !== 'object') { this.currentShift.set(null); return; }
      const id = this.num(s, 'shiftId', 'id');
      if (!id) { this.currentShift.set(null); return; }
      this.currentShift.set({
        id: String(id),
        nameEn: this.str(s, 'shiftName', 'name_En') || `Shift #${id}`,
        nameAr: this.str(s, 'shiftName', 'name_Ar') || `وردية #${id}`,
        extra: '',
      });
    });
  }

  /** Reload the payment-method list scoped to the Paid/Unpaid/All toggle. */
  loadPaymentMethods(ordersFilter: 'Paid' | 'UnPaid' | 'All'): void {
    const payment = ordersFilter === 'Paid' ? 'paid' : ordersFilter === 'UnPaid' ? 'unpaid' : 'all';
    if (payment === this.lastPayment) return;
    this.lastPayment = payment;
    this.list(`PaymentMethods/GetAllPaymentMethods?payment=${payment}`, (r) => {
      const name = this.str(r, 'paymentMethodNameEnglish', 'name_En', 'name');
      return {
        id: name,                                       // sent as `payway`
        nameEn: name,
        nameAr: this.str(r, 'paymentMethodNameArabic', 'name_Ar') || name,
        extra: '',
      };
      // NOTE: `unablePaymentMethod` is `true` on every method the API returns
      // (it does NOT mean "disabled") — filtering on it wiped the whole list
      // ("No results"). Keep active, named methods only.
    }, (r) => this.active(r) && !!this.str(r, 'paymentMethodNameEnglish', 'name_En'))
      .subscribe((x) => this.paymentMethods.set(x));
  }

  // ── helpers ─────────────────────────────────────────────────────────────
  private list(
    path: string,
    mapRow: (row: any) => PickerItem,
    keep?: (row: any) => boolean,
  ): Observable<PickerItem[]> {
    return this.http.get<any>(`${this.api}/${path}`).pipe(
      map((res) => this.arr(res)
        .filter((r) => (keep ? keep(r) : true))
        .map(mapRow)
        .filter((i) => i.id !== '' && i.id !== '0' && i.id != null)),
      catchError(() => of([] as PickerItem[])),
    );
  }

  /** Extract the row array from any of the envelope shapes the API uses. */
  private arr(res: any): any[] {
    const d = res?.data ?? res;
    if (Array.isArray(d)) return d;
    return this.arr2(d?.items ?? d?.data ?? d?.list ?? []);
  }
  private arr2(v: any): any[] { return Array.isArray(v) ? v : []; }

  private str(o: any, ...keys: string[]): string {
    for (const k of keys) {
      const v = o?.[k];
      if (v != null && String(v).trim() !== '') return String(v);
    }
    return '';
  }
  private num(o: any, ...keys: string[]): number {
    for (const k of keys) {
      const v = o?.[k];
      if (v != null && !isNaN(Number(v))) return Number(v);
    }
    return 0;
  }
  private bool(o: any, key: string): boolean | undefined {
    const v = o?.[key];
    return v == null ? undefined : v === true || v === 'true';
  }
  /** Active unless the row explicitly says isActive=false. */
  private active(r: any): boolean { return this.bool(r, 'isActive') !== false; }

  private discExtra(r: any): string {
    const val = this.num(r, 'discountValue');
    if (!val) return '';
    const isPct = this.bool(r, 'discountType') === true || this.bool(r, 'isPercentage') === true;
    return isPct ? `${val}%` : `${val}`;
  }
}
