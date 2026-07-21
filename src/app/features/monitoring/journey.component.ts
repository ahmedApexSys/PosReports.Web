import {
  Component, inject, signal, computed, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LucideAngularModule, Search, Loader, RefreshCw } from 'lucide-angular';
import { catchError, finalize, of } from 'rxjs';
import { LanguageService } from '../../core/i18n/language.service';
import { FilterService } from '../../core/filters/filter.service';
import { MonitoringApi } from '../../core/api/monitoring.api';
import { OrderJourney, JourneyStep, JourneyDelivery } from '../../core/models/journey.models';

type SearchBy = 'receipt' | 'order';

/**
 * Order Journey — the money story of ONE order, for an owner.
 *
 * Two halves: a RECEIPT (items, discount, service, tax, minimum charge, addition, net) and a
 * business TIMELINE (who did what, when, and the money before -> after). Covers dine-in
 * (open / send / transfer / split / checkout / void / min-charge / addition / change waiter),
 * take-away (pay / pay-edit / void) and delivery (assign + change pilot / delivered / collect money).
 *
 * Deliberately NOT shown: raw developer log text, and internal repricing ("Calculate") events —
 * those sit behind a counted toggle. A money delta renders only when the server marks it
 * trustworthy, because most log rows leave the "before" side at zero.
 */
@Component({
  selector: 'app-journey',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="space-y-5" dir="rtl">
    <div>
      <h1 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">
        {{ ar() ? 'رحلة الأوردر' : 'Order Journey' }}
      </h1>
      <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
        {{ ar()
          ? 'الأوردر ده اتعمل فيه إيه بالظبط — مين، وإمتى، والفلوس راحت فين.'
          : 'Exactly what happened to this order — who, when, and where the money went.' }}
      </p>
    </div>

    <div class="flex gap-2 flex-wrap items-center">
      <div class="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <button type="button" (click)="by.set('receipt')" class="px-3 py-2 text-sm"
          [class.bg-slate-900]="by() === 'receipt'" [class.text-white]="by() === 'receipt'"
          [class.text-slate-600]="by() !== 'receipt'">{{ ar() ? 'رقم الإيصال' : 'Receipt #' }}</button>
        <button type="button" (click)="by.set('order')"
          class="px-3 py-2 text-sm border-e border-slate-200 dark:border-slate-700"
          [class.bg-slate-900]="by() === 'order'" [class.text-white]="by() === 'order'"
          [class.text-slate-600]="by() !== 'order'">{{ ar() ? 'رقم الأوردر' : 'Order #' }}</button>
      </div>
      <div class="relative flex-1 min-w-[200px] max-w-sm">
        <lucide-icon [img]="Search" class="absolute end-3 top-2.5 w-4 h-4 text-slate-400"></lucide-icon>
        <input type="text" [(ngModel)]="term" (keyup.enter)="load()"
          [placeholder]="ar() ? 'اكتب الرقم واضغط Enter' : 'Type the number and press Enter'"
          class="w-full pe-9 ps-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" />
      </div>
      <button type="button" (click)="load()"
        class="px-4 py-2 text-sm rounded-lg bg-slate-900 text-white inline-flex items-center gap-2">
        <lucide-icon [img]="loading() ? Loader : RefreshCw" class="w-4 h-4" [class.animate-spin]="loading()"></lucide-icon>
        {{ ar() ? 'عرض' : 'Load' }}
      </button>
    </div>

    <p *ngIf="error()" class="text-sm text-red-600 dark:text-red-400">{{ error() }}</p>

    <div *ngIf="notFound()" class="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-4 text-sm text-amber-800 dark:text-amber-300">
      {{ ar() ? 'مفيش أوردر بالرقم ده.' : 'No order found for that number.' }}
    </div>

    <div *ngIf="!data() && !loading() && !error() && !notFound()"
      class="text-center py-16 text-slate-400 dark:text-slate-500 text-sm">
      {{ ar() ? 'اكتب رقم إيصال أو أوردر عشان تشوف رحلته.' : 'Enter a receipt or order number.' }}
    </div>

    <ng-container *ngIf="data() as d">
      <!-- ── Identity + headline ─────────────────────────────── -->
      <div class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 md:p-5">
        <div class="flex justify-between items-start flex-wrap gap-3">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-lg font-semibold text-slate-900 dark:text-slate-50">
                {{ d.receiptNumber ? (ar() ? 'إيصال #' : 'Receipt #') + d.receiptNumber
                                   : (ar() ? 'أوردر #' : 'Order #') + d.orderId }}
              </span>
              <span class="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {{ ar() ? d.transactionTypeAr : d.transactionType }}
              </span>
              <span class="text-xs px-2.5 py-1 rounded-full" [ngClass]="statusClass(d.status)">
                {{ ar() ? d.statusAr : d.status }}
              </span>
              <span *ngIf="d.paymentMethod" class="text-xs px-2.5 py-1 rounded-full"
                [ngClass]="d.isPaidOrder ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                         : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'">
                {{ payAr(d.paymentMethod) }}<span *ngIf="!d.isPaidOrder"> · {{ ar() ? 'غير محصّل' : 'unpaid' }}</span>
              </span>
            </div>
            <div class="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-7">
              <span *ngIf="d.tableName">{{ ar() ? 'ترابيزة' : 'Table' }} {{ d.tableName }} · </span>
              <span *ngIf="d.guestCount">{{ d.guestCount }} {{ ar() ? 'ضيف' : 'guests' }} · </span>
              <span *ngIf="d.waiterName">{{ ar() ? 'النادل' : 'Waiter' }}: {{ d.waiterName }} · </span>
              <span *ngIf="d.cashierName">{{ ar() ? 'الكاشير' : 'Cashier' }}: {{ d.cashierName }}</span>
              <span *ngIf="d.pilotName"> · {{ ar() ? 'الطيّار' : 'Pilot' }}: <b class="text-slate-700 dark:text-slate-200">{{ d.pilotName }}</b></span>
            </div>
            <!-- pay-way change: the thing an owner wants flagged -->
            <div *ngIf="d.previousPaymentMethod"
              class="mt-2 inline-flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
              {{ ar() ? 'اتغيرت طريقة الدفع:' : 'Payment method changed:' }}
              <bdi>{{ payAr(d.previousPaymentMethod) }} ← {{ payAr(d.paymentMethod) }}</bdi>
            </div>
          </div>
          <div class="text-start">
            <div class="text-xs text-slate-500 dark:text-slate-400">{{ ar() ? 'الصافي' : 'Net' }}</div>
            <div class="text-2xl font-semibold text-slate-900 dark:text-slate-50"><bdi>{{ money(d.money.net) }}</bdi></div>
            <div class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              <bdi>{{ d.createdAt }}<span *ngIf="d.completedAt"> ← {{ d.completedAt }}</span></bdi>
            </div>
          </div>
        </div>
      </div>

      <!-- ── The receipt ─────────────────────────────────────── -->
      <div class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 md:p-5">
        <div class="font-medium text-slate-900 dark:text-slate-100 mb-3">{{ ar() ? 'تفاصيل الفاتورة' : 'Receipt' }}</div>

        <div *ngIf="d.items.length" class="text-sm mb-3">
          <div *ngFor="let it of d.items"
            class="flex justify-between gap-3 py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
            <span class="text-slate-700 dark:text-slate-200">
              {{ num(it.quantity) }} × {{ it.itemName }}<span *ngIf="it.variantName" class="text-slate-400"> ({{ it.variantName }})</span>
            </span>
            <span class="text-slate-500 dark:text-slate-400 tabular-nums"><bdi>{{ money(it.lineTotal) }}</bdi></span>
          </div>
        </div>

        <div class="text-sm">
          <div class="flex justify-between py-1"><span class="text-slate-500 dark:text-slate-400">{{ ar() ? 'قيمة الأصناف' : 'Items' }}</span><span class="tabular-nums"><bdi>{{ money(d.money.itemsTotal) }}</bdi></span></div>
          <div class="flex justify-between py-1" *ngIf="d.money.discount"><span class="text-slate-500 dark:text-slate-400">{{ ar() ? 'الخصم' : 'Discount' }}</span><span class="tabular-nums text-red-600"><bdi>− {{ money(d.money.discount) }}</bdi></span></div>
          <!-- Service is a dine-in concept. Printing it as 0.00 on a counter or courier
               receipt is noise, so it only appears where it can be non-zero. -->
          <div class="flex justify-between py-1" *ngIf="isDineIn() || d.money.service">
            <span class="text-slate-500 dark:text-slate-400">{{ ar() ? 'الخدمة' : 'Service' }}</span>
            <span class="tabular-nums"><bdi>{{ money(d.money.service) }}</bdi></span>
          </div>
          <div class="flex justify-between py-1">
            <span class="text-slate-500 dark:text-slate-400">
              {{ ar() ? 'الضريبة' : 'Tax' }}<span *ngIf="d.money.taxRatio"> {{ num(d.money.taxRatio) }}%</span>
              <span class="text-xs text-slate-400"> ({{ ar() ? 'أصناف' : 'items' }} {{ money(d.money.itemTax) }} + {{ ar() ? 'خدمة' : 'service' }} {{ money(d.money.serviceTax) }})</span>
            </span>
            <span class="tabular-nums"><bdi>{{ money(d.money.totalTax) }}</bdi></span>
          </div>
          <!-- Minimum charge, shown as the comparison it actually is: the rate, what that
               came to for this many guests, and the top-up that reached the bill. A top-up
               of zero is a real answer ("the table spent enough"), so it is shown too. -->
          <ng-container *ngIf="d.money.minimumChargePerGuest">
            <div class="flex justify-between py-1">
              <span class="text-slate-500 dark:text-slate-400">{{ ar() ? 'الحد الأدنى للضيف' : 'Minimum charge / guest' }}</span>
              <span class="tabular-nums text-slate-500 dark:text-slate-400"><bdi>{{ money(d.money.minimumChargePerGuest) }}</bdi></span>
            </div>
            <div class="flex justify-between py-1" *ngIf="d.guestCount">
              <span class="text-slate-500 dark:text-slate-400">
                {{ ar() ? 'المطلوب' : 'Required' }}
                <span class="text-xs text-slate-400">({{ d.guestCount }} {{ ar() ? 'ضيف' : 'guests' }})</span>
              </span>
              <span class="tabular-nums text-slate-500 dark:text-slate-400"><bdi>{{ money(minimumRequired()) }}</bdi></span>
            </div>
            <div class="flex justify-between py-1">
              <span class="text-slate-500 dark:text-slate-400">{{ ar() ? 'الفرق المضاف' : 'Top-up added' }}</span>
              <span class="tabular-nums" [class.text-slate-400]="!d.money.minimumChargeDifference">
                <bdi>{{ money(d.money.minimumChargeDifference) }}</bdi>
              </span>
            </div>
            <!-- Which rule the comparison used. Without it the three numbers above are
                 unreadable: the same spend clears the minimum under one setting and
                 falls short under the other. -->
            <p *ngIf="d.money.minimumChargeIncludesTaxAndService !== null && d.money.minimumChargeIncludesTaxAndService !== undefined"
              class="text-xs text-slate-500 dark:text-slate-400 pb-1">
              {{ d.money.minimumChargeIncludesTaxAndService
                  ? (ar() ? 'الحد الأدنى يشمل الضريبة والخدمة — المقارنة تمت على الإجمالي شامل الضريبة والخدمة.'
                          : 'The minimum includes tax and service — compared against the all-in total.')
                  : (ar() ? 'الحد الأدنى لا يشمل الضريبة والخدمة — المقارنة تمت على قيمة الأصناف بعد الخصم.'
                          : 'The minimum excludes tax and service — compared against items after discount.') }}
            </p>
            <p *ngIf="!d.money.minimumChargeDifference" class="text-xs text-slate-400 dark:text-slate-500 pb-1">
              {{ ar() ? 'الطاولة صرفت أكتر من الحد الأدنى، فمفيش فرق اتضاف.'
                      : 'The table spent above the minimum, so nothing was added.' }}
            </p>
          </ng-container>
          <div class="flex justify-between py-1" *ngIf="d.money.addition"><span class="text-slate-500 dark:text-slate-400">{{ ar() ? 'إضافات' : 'Addition' }}</span><span class="tabular-nums"><bdi>{{ money(d.money.addition) }}</bdi></span></div>
          <div class="flex justify-between pt-2.5 mt-2 border-t border-slate-300 dark:border-slate-600 font-semibold text-base">
            <span>{{ ar() ? 'الصافي' : 'Net' }}</span><span class="tabular-nums"><bdi>{{ money(d.money.net) }}</bdi></span>
          </div>
        </div>
      </div>

      <!-- ── The delivery leg — courier orders only ──────────── -->
      <div *ngIf="d.delivery as dv"
        class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 md:p-5">
        <div class="font-medium text-slate-900 dark:text-slate-100 mb-3">{{ ar() ? 'التوصيل' : 'Delivery' }}</div>

        <div class="text-sm text-slate-600 dark:text-slate-300 leading-7">
          <span *ngIf="dv.customerName">{{ ar() ? 'العميل' : 'Customer' }}: <b class="text-slate-800 dark:text-slate-100">{{ dv.customerName }}</b></span>
          <span *ngIf="dv.mobilePhone"> · <bdi>{{ dv.mobilePhone }}</bdi></span>
          <span *ngIf="dv.address"> · {{ dv.address }}</span>
          <span *ngIf="dv.onlineAppName"> · {{ ar() ? 'تطبيق' : 'App' }}: {{ dv.onlineAppName }}</span>
        </div>
        <div class="text-sm text-slate-600 dark:text-slate-300 mt-1" *ngIf="dv.pilotName">
          {{ ar() ? 'الطيّار' : 'Pilot' }}: <b class="text-slate-800 dark:text-slate-100">{{ dv.pilotName }}</b>
          <span *ngIf="dv.roundTripMinutes" class="text-slate-400"> · {{ ar() ? 'الرحلة' : 'round trip' }} <bdi>{{ num(dv.roundTripMinutes) }}</bdi> {{ ar() ? 'دقيقة' : 'min' }}</span>
        </div>

        <!-- The four stamps the courier flow writes. A missing one is stated, not hidden:
             "no pick-up time" is exactly what an owner chasing a late order needs to see. -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div *ngFor="let st of deliveryStamps(dv)">
            <div class="text-xs text-slate-400 dark:text-slate-500">{{ ar() ? st.labelAr : st.labelEn }}</div>
            <div class="text-sm mt-0.5" [class.text-slate-400]="!st.value" [class.dark:text-slate-600]="!st.value">
              <bdi>{{ st.value || (ar() ? 'لم يحدث' : 'not recorded') }}</bdi>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Voided items ────────────────────────────────────── -->
      <div *ngIf="d.voidedItems.length"
        class="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/20 p-4">
        <div class="text-sm font-medium text-red-700 dark:text-red-300 mb-2">{{ ar() ? 'أصناف ملغية' : 'Voided items' }}</div>
        <div *ngFor="let v of d.voidedItems" class="text-sm py-1.5 border-b border-red-100 dark:border-red-900/40 last:border-0">
          <div class="flex justify-between gap-3">
            <span class="text-red-700 dark:text-red-300">{{ num(v.quantity) }} × {{ v.itemName }}</span>
            <span class="text-red-700 dark:text-red-300 tabular-nums"><bdi>− {{ money(v.price) }}</bdi></span>
          </div>
          <div class="text-xs text-red-500 dark:text-red-400/80 mt-0.5">
            <span *ngIf="v.stageAr || v.stage">{{ ar() ? v.stageAr : v.stage }}</span>
            <span *ngIf="v.reason"> · {{ v.reason }}</span>
            <span *ngIf="v.voidedBy"> · {{ v.voidedBy }}</span>
            <span *ngIf="v.voidedAt"> · <bdi>{{ v.voidedAt }}</bdi></span>
          </div>
        </div>
      </div>

      <!-- ── Timeline ────────────────────────────────────────── -->
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div class="font-medium text-slate-900 dark:text-slate-100">{{ ar() ? 'رحلة الأوردر' : 'Timeline' }}</div>
        <label *ngIf="noiseCount() > 0" class="text-xs text-slate-500 dark:text-slate-400 inline-flex items-center gap-2 cursor-pointer">
          <input type="checkbox" [ngModel]="showNoise()" (ngModelChange)="showNoise.set($event)" class="rounded" />
          {{ ar() ? 'إظهار عمليات إعادة الحساب' : 'Show recalculations' }} ({{ noiseCount() }})
        </label>
      </div>

      <div class="relative pe-6">
        <div class="absolute end-2 top-1 bottom-1 w-0.5 bg-slate-200 dark:bg-slate-700"></div>
        <div *ngFor="let s of visibleSteps()" class="relative mb-4">
          <span class="absolute -end-[26px] top-1 w-4 h-4 rounded-full bg-white dark:bg-slate-950 border-2"
            [style.borderColor]="stepColor(s.action)"></span>

          <div class="flex justify-between gap-2 flex-wrap">
            <span class="font-medium text-slate-900 dark:text-slate-100">
              {{ ar() ? s.actionAr : s.action }}
              <span *ngIf="s.stage === 'Table'" class="ms-1 text-[11px] font-normal px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                {{ ar() ? 'على الترابيزة' : 'table session' }}
              </span>
            </span>
            <span class="text-xs text-slate-400 dark:text-slate-500">
              <span *ngIf="s.userName">{{ s.userName }} · </span><bdi>{{ s.time || s.date }}</bdi>
            </span>
          </div>

          <div *ngIf="summary(s)" class="text-sm text-slate-600 dark:text-slate-300 mt-0.5">{{ summary(s) }}</div>

          <div *ngIf="s.hasMoneyDelta && delta(s) as dl" class="text-sm mt-1">
            <span class="text-slate-500 dark:text-slate-400">{{ ar() ? 'الصافي' : 'Net' }}:</span>
            <bdi class="tabular-nums">{{ money(dl.before) }} ← <span class="font-medium"
              [class.text-emerald-600]="dl.diff > 0" [class.text-red-600]="dl.diff < 0">{{ money(dl.after) }}</span></bdi>
            <span class="text-xs" [class.text-emerald-600]="dl.diff > 0" [class.text-red-600]="dl.diff < 0">
              ({{ dl.diff > 0 ? '+' : '−' }} <bdi>{{ money(abs(dl.diff)) }}</bdi>)
            </span>
          </div>
        </div>
      </div>
    </ng-container>
  </div>
  `,
})
export class JourneyComponent {
  protected readonly Search = Search;
  protected readonly Loader = Loader;
  protected readonly RefreshCw = RefreshCw;

  private readonly api = inject(MonitoringApi);
  private readonly route = inject(ActivatedRoute);
  private readonly filter = inject(FilterService);
  protected readonly lang = inject(LanguageService);

  protected readonly by = signal<SearchBy>('receipt');
  protected term = '';
  protected readonly data = signal<OrderJourney | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notFound = signal(false);
  protected readonly showNoise = signal(false);

  protected readonly noiseCount = computed(() => (this.data()?.timeline ?? []).filter(s => s.isNoise).length);
  protected readonly visibleSteps = computed(() => {
    const steps = this.data()?.timeline ?? [];
    return this.showNoise() ? steps : steps.filter(s => !s.isNoise);
  });

  constructor() {
    const p = this.route.snapshot.queryParamMap;
    const rcpt = p.get('receipt');
    const oid = p.get('orderId');
    if (oid) { this.by.set('order'); this.term = oid; this.load(); }
    else if (rcpt) { this.by.set('receipt'); this.term = rcpt; this.load(); }
  }

  protected ar(): boolean { return this.lang.language() === 'ar'; }

  /**
   * Which of the three layouts to draw. The server now derives the type from the
   * order header rather than the action log, so this is reliable even for an order
   * whose log rows were pruned.
   */
  protected readonly isDineIn = computed(() => {
    const t = (this.data()?.transactionType ?? '').replace(/\s/g, '').toLowerCase();
    return t === 'dinein' || t === 'reservation' || t === 'hospitality';
  });

  /** The minimum the table had to reach: the per-guest rate × the guests on the bill. */
  protected minimumRequired(): number {
    const d = this.data();
    if (!d) { return 0; }
    return this.num(d.money.minimumChargePerGuest * d.guestCount);
  }

  /** The four courier stamps in the order they happen, missing ones included. */
  protected deliveryStamps(dv: JourneyDelivery): ReadonlyArray<{ labelAr: string; labelEn: string; value?: string | null }> {
    return [
      { labelAr: 'التحضير', labelEn: 'Prepared', value: dv.prepareTime },
      { labelAr: 'إسناد الطيّار', labelEn: 'Assigned', value: dv.assignTime },
      { labelAr: 'الاستلام', labelEn: 'Picked up', value: dv.pickUpTime },
      { labelAr: 'العودة', labelEn: 'Returned', value: dv.returnTime },
    ];
  }

  protected load(): void {
    const t = (this.term || '').trim();
    if (!t) { return; }
    this.loading.set(true);
    this.error.set(null);
    this.notFound.set(false);
    // Branch scopes the lookup: receipt numbers are a per-branch sequence.
    const branchId = this.filter.branchId() ?? undefined;
    const req = this.by() === 'order'
      ? { orderId: Number(t), branchId }
      : { receiptNumber: t, branchId };
    this.api.orderJourney(req).pipe(
      catchError((e: Error) => { this.error.set(e?.message || 'Failed to load'); return of(null); }),
      finalize(() => this.loading.set(false)),
    ).subscribe((res) => {
      this.data.set(res);
      this.notFound.set(!res && !this.error());
    });
  }

  protected summary(s: JourneyStep): string {
    const v = this.ar() ? (s.summaryAr || '') : (s.summaryEn || s.summaryAr || '');
    return v.trim();
  }

  protected delta(s: JourneyStep): { before: number; after: number; diff: number } | null {
    const d = s.details;
    if (!d) { return null; }
    const before = d.netBefore ?? 0;
    const after = d.netAfter ?? 0;
    return { before, after, diff: Math.round((after - before) * 100) / 100 };
  }

  /** Arabic label for a stored payment method. Never shows the raw enum key. */
  protected payAr(m?: string | null): string {
    const k = (m || '').trim().toLowerCase();
    if (!this.ar()) { return (m || '').trim() || '—'; }
    switch (k) {
      case 'cash': return 'كاش';
      case 'visa': return 'فيزا';
      case 'ledge': case 'leadge': return 'آجل';
      case 'officer': return 'ضيافة ضابط';
      case 'hospitality': return 'ضيافة';
      case 'paytabs': case 'paytap': return 'PayTabs';
      default: return (m || '').trim() || 'غير معروف';
    }
  }

  protected stepColor(action: string): string {
    const a = (action || '').toLowerCase();
    if (a.includes('open')) { return '#888780'; }
    if (a.includes('sent') || a.includes('send')) { return '#185FA5'; }
    if (a.includes('transfer') || a.includes('split')) { return '#534AB7'; }
    if (a.includes('void') || a.includes('cancel')) { return '#A32D2D'; }
    if (a.includes('checked') || a.includes('checkout')) { return '#0F6E56'; }
    if (a.includes('paid') || a.includes('collect') || a.includes('closed table')) { return '#0F6E56'; }
    if (a.includes('pilot') || a.includes('driver') || a.includes('assign')) { return '#534AB7'; }
    if (a.includes('discount') || a.includes('promo') || a.includes('change')) { return '#BA7517'; }
    return '#888780';
  }

  protected statusClass(status: string): string {
    const s = (status || '').toLowerCase();
    if (s.includes('complete') || s.includes('paid') || s.includes('deliver')) {
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    }
    if (s.includes('cancel')) { return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'; }
    return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  }

  /** Western digits, 2dp, in both languages — money must align and export cleanly. */
  protected money(n: number | null | undefined): string {
    const v = Math.round((n ?? 0) * 100) / 100;
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  protected num(n: number | null | undefined): number { return Math.round((n ?? 0) * 100) / 100; }
  protected abs(n: number): number { return Math.abs(n); }
}
