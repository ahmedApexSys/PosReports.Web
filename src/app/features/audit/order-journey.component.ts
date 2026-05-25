import { Component, ViewChild, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Observable, of } from 'rxjs';
import { LucideAngularModule, Search, ChevronLeft, Loader } from 'lucide-angular';
import { AuditApi } from '../../core/api/audit.api';
import {
  AuditPageContext,
  OrderJourneyResult,
  OrderJourneyCandidate,
} from '../../core/models/audit.models';
import { FilterService } from '../../core/filters/filter.service';
import { LanguageService } from '../../core/i18n/language.service';
import { AuditReportPageComponent } from '../../shared/audit-report-page/audit-report-page.component';
import { AuditEventCardComponent } from '../../shared/audit-event-card/audit-event-card.component';

/**
 * `POST /api/AuditNarrativeReport/OrderJourney` — single-order timeline.
 * Operator enters an Order ID (or Receipt Number); the page hits the
 * endpoint when they click Load or hit Enter. Until an id is entered,
 * the request is suppressed so the API doesn't keep returning "OrderId
 * required" every time the date filter ticks.
 */
@Component({
  selector: 'app-audit-order-journey',
  standalone: true,
  imports: [CommonModule, FormsModule, AuditReportPageComponent, AuditEventCardComponent, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Local lookup row -->
    <div class="flex items-center gap-2 flex-wrap mb-4">
      <span class="text-xs text-slate-500 dark:text-slate-400">
        {{ lang.language() === 'ar' ? 'البحث بـ' : 'Lookup by' }}:
      </span>
      <select [(ngModel)]="searchBy" (ngModelChange)="onSearchByChange()"
              class="bg-white dark:bg-surface-dark-subtle border border-slate-300 dark:border-slate-700
                     rounded-card-sm px-2 py-1 text-xs text-slate-700 dark:text-slate-200">
        <option value="orderId">{{ lang.language() === 'ar' ? 'رقم الأوردر' : 'Order ID' }}</option>
        <option value="receipt">{{ lang.language() === 'ar' ? 'رقم الإيصال' : 'Receipt #' }}</option>
        <option value="table">{{ lang.language() === 'ar' ? 'اسم الترابيزة' : 'Table name' }}</option>
        <option value="mobile">{{ lang.language() === 'ar' ? 'موبايل (ديليفري)' : 'Mobile (delivery)' }}</option>
      </select>

      <!-- Numeric input (OrderId / Receipt) -->
      <input *ngIf="searchBy === 'orderId' || searchBy === 'receipt'"
             type="number" inputmode="numeric" min="1" [(ngModel)]="lookupValue"
             (keyup.enter)="onLoad()"
             [placeholder]="searchBy === 'orderId'
                ? (lang.language() === 'ar' ? 'مثال: 5432' : 'e.g. 5432')
                : (lang.language() === 'ar' ? 'مثال: 2110520261458211' : 'e.g. 2110520261458211')"
             class="w-44 bg-white dark:bg-surface-dark-subtle
                    border border-slate-300 dark:border-slate-700
                    rounded-card-sm px-2.5 py-1 text-xs tabular
                    focus:ring-2 focus:ring-brand-500/30 focus:outline-none"/>

      <!-- Table-name input -->
      <input *ngIf="searchBy === 'table'"
             type="text" [(ngModel)]="tableInput"
             (keyup.enter)="onLoad()"
             [placeholder]="lang.language() === 'ar' ? 'مثال: 7' : 'e.g. 7'"
             class="w-32 bg-white dark:bg-surface-dark-subtle
                    border border-slate-300 dark:border-slate-700
                    rounded-card-sm px-2.5 py-1 text-xs
                    focus:ring-2 focus:ring-brand-500/30 focus:outline-none"/>

      <!-- Mobile input -->
      <input *ngIf="searchBy === 'mobile'"
             type="tel" inputmode="tel" [(ngModel)]="mobileInput"
             (keyup.enter)="onLoad()"
             [placeholder]="lang.language() === 'ar' ? 'مثال: 01012345678' : 'e.g. 01012345678'"
             class="w-44 bg-white dark:bg-surface-dark-subtle
                    border border-slate-300 dark:border-slate-700
                    rounded-card-sm px-2.5 py-1 text-xs tabular
                    focus:ring-2 focus:ring-brand-500/30 focus:outline-none"/>

      <button type="button" (click)="onLoad()"
              [disabled]="!hasInput() || lookupLoading()"
              class="btn-primary text-xs">
        <lucide-icon [img]="lookupLoading() ? LoaderIcon : SearchIcon"
                     class="h-3.5 w-3.5"
                     [class.animate-spin]="lookupLoading()"></lucide-icon>
        {{ loadButtonLabel() }}
      </button>
      <button *ngIf="candidates().length > 0 || selectedCandidate()"
              type="button" (click)="clearSearch()"
              class="btn-ghost text-xs">
        <lucide-icon [img]="BackIcon" class="h-3.5 w-3.5"></lucide-icon>
        {{ lang.language() === 'ar' ? 'بحث جديد' : 'New search' }}
      </button>
    </div>

    <!-- Lookup-mode filters — narrow the picker when searching by
         Table / Mobile (those identifiers aren't unique across days).
         Visible in OrderId / Receipt mode too as informational
         context, but they don't affect those lookups since OrderId
         and Receipt # are 1:1 unique identifiers already. -->
    <div class="flex items-center gap-2 flex-wrap mb-4 ms-4 ps-4 border-s border-slate-200 dark:border-slate-800">
      <span class="text-xs text-slate-500 dark:text-slate-400">
        {{ lang.language() === 'ar' ? 'فلترة:' : 'Filter:' }}
      </span>

      <!-- Transaction type filter -->
      <select [(ngModel)]="filterTransactionTypeId"
              class="bg-white dark:bg-surface-dark-subtle border border-slate-300 dark:border-slate-700
                     rounded-card-sm px-2 py-1 text-xs text-slate-700 dark:text-slate-200">
        <option [ngValue]="0">{{ lang.language() === 'ar' ? 'كل المعاملات' : 'All transactions' }}</option>
        <option [ngValue]="1">{{ lang.language() === 'ar' ? 'داخل المطعم' : 'DineIn' }}</option>
        <option [ngValue]="2">{{ lang.language() === 'ar' ? 'ديليفري' : 'Delivery' }}</option>
        <option [ngValue]="3">{{ lang.language() === 'ar' ? 'تيك أواي' : 'TakeAWay' }}</option>
      </select>

      <!-- Date range — datetime-local kept simple (date only on the wire). -->
      <span class="text-xs text-slate-500 dark:text-slate-400">
        {{ lang.language() === 'ar' ? 'من' : 'From' }}
      </span>
      <input type="date" [(ngModel)]="filterFromDate"
             class="bg-white dark:bg-surface-dark-subtle border border-slate-300 dark:border-slate-700
                    rounded-card-sm px-2 py-1 text-xs tabular
                    focus:ring-2 focus:ring-brand-500/30 focus:outline-none"/>
      <span class="text-xs text-slate-500 dark:text-slate-400">
        {{ lang.language() === 'ar' ? 'إلى' : 'To' }}
      </span>
      <input type="date" [(ngModel)]="filterToDate"
             class="bg-white dark:bg-surface-dark-subtle border border-slate-300 dark:border-slate-700
                    rounded-card-sm px-2 py-1 text-xs tabular
                    focus:ring-2 focus:ring-brand-500/30 focus:outline-none"/>

      <!-- Shift filter (numeric, only useful with a date) -->
      <span class="text-xs text-slate-500 dark:text-slate-400 ms-1">
        {{ lang.language() === 'ar' ? 'وردية' : 'Shift' }}:
      </span>
      <input type="number" min="0" [(ngModel)]="filterShiftId"
             [placeholder]="lang.language() === 'ar' ? 'كل' : 'all'"
             class="w-14 bg-white dark:bg-surface-dark-subtle border border-slate-300 dark:border-slate-700
                    rounded-card-sm px-2 py-1 text-xs tabular
                    focus:ring-2 focus:ring-brand-500/30 focus:outline-none"/>

      <button type="button" (click)="clearLookupFilters()"
              *ngIf="hasLookupFilters()"
              class="btn-ghost text-[10px] py-0.5">
        {{ lang.language() === 'ar' ? 'مسح الفلاتر' : 'Clear filters' }}
      </button>

      <!-- Hint when filters don't apply (OrderId / Receipt are 1:1) -->
      <span *ngIf="searchBy === 'orderId' || searchBy === 'receipt'"
            class="text-[10px] text-slate-400 dark:text-slate-500 ms-auto">
        {{ lang.language() === 'ar'
            ? 'الفلاتر تعمل مع البحث بالترابيزة أو الموبايل فقط'
            : 'Filters apply to Table / Mobile lookup only' }}
      </span>
    </div>

    <!-- Candidate picker — shown when the lookup returned >1 match -->
    <div *ngIf="candidates().length > 1 && !selectedCandidate()"
         class="card-padded mb-4 space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-50">
          {{ lang.language() === 'ar' ? 'اختر الأوردر' : 'Pick an order' }}
          <span class="text-xs text-slate-400 ms-1">({{ candidates().length }})</span>
        </h3>
        <span *ngIf="lookupMessage()" class="text-xs text-slate-500 dark:text-slate-400">
          {{ lookupMessage() }}
        </span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        <button *ngFor="let c of candidates()" type="button"
                (click)="pickCandidate(c)"
                class="text-start p-3 rounded-card-sm ring-1 ring-slate-200 dark:ring-slate-700
                       bg-white dark:bg-surface-dark-subtle hover:bg-slate-50 dark:hover:bg-surface-dark-muted
                       transition-colors duration-180">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-sm font-bold text-slate-900 dark:text-slate-50 tabular">
                  #{{ c.orderId }}
                </span>
                <span *ngIf="c.receiptNumber" class="text-xs text-slate-500 tabular truncate">
                  {{ c.receiptNumber }}
                </span>
              </div>
              <div class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap">
                <span *ngIf="c.transactionTypeName">{{ c.transactionTypeName }}</span>
                <span *ngIf="c.tableName">· {{ lang.language() === 'ar' ? 'ترابيزة' : 'Table' }} {{ c.tableName }}</span>
                <span *ngIf="c.orderDate" class="tabular">· {{ c.orderDate | date:'short' }}</span>
              </div>
              <div class="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                <span *ngIf="c.employeeName">{{ lang.language() === 'ar' ? 'بواسطة' : 'By' }}: {{ c.employeeName }}</span>
                <span *ngIf="c.cashierName">· {{ lang.language() === 'ar' ? 'كاشير' : 'Cashier' }}: {{ c.cashierName }}</span>
                <span *ngIf="c.waiterName">· {{ lang.language() === 'ar' ? 'ويتر' : 'Waiter' }}: {{ c.waiterName }}</span>
              </div>
              <div *ngIf="c.mobilePhone" class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {{ lang.language() === 'ar' ? 'موبايل' : 'Mobile' }}: <span class="tabular">{{ c.mobilePhone }}</span>
              </div>
            </div>
            <div class="shrink-0 text-end">
              <div class="tabular text-lg font-bold text-slate-900 dark:text-slate-50">
                {{ c.net | number:'1.0-2' }}
              </div>
              <div class="text-xs text-slate-500 mt-1 flex flex-col items-end gap-1">
                <span *ngIf="c.itemCount" class="tabular">
                  {{ c.itemCount }} {{ lang.language() === 'ar' ? 'صنف' : 'item(s)' }}
                </span>
                <span class="pill-success text-[10px] py-0" *ngIf="c.isPaid && !c.isCancelled">
                  {{ lang.language() === 'ar' ? 'مدفوع' : 'Paid' }}
                </span>
                <span class="pill-critical text-[10px] py-0" *ngIf="c.isCancelled">
                  {{ lang.language() === 'ar' ? 'ملغي' : 'Cancelled' }}
                </span>
                <span class="pill-warning text-[10px] py-0" *ngIf="!c.isPaid && !c.isCancelled">
                  {{ lang.language() === 'ar' ? 'مفتوح' : 'Open' }}
                </span>
              </div>
            </div>
          </div>
        </button>
      </div>

      <div *ngIf="truncated()" class="text-xs text-warning text-center pt-1">
        {{ lang.language() === 'ar'
            ? 'تم عرض أول النتائج فقط — ضيّق البحث للوصول للأوردر اللي عايزه.'
            : 'Showing the most recent matches — narrow your search to find an older order.' }}
      </div>
    </div>

    <!-- Lookup returned exactly 0 candidates -->
    <div *ngIf="lookupAttempted() && candidates().length === 0 && !lookupLoading()"
         class="card-padded text-center py-12 mb-4 space-y-3">
      <div class="inline-flex h-12 w-12 items-center justify-center rounded-2xl
                  bg-warning-soft text-warning ring-1 ring-warning/30">
        <lucide-icon [img]="SearchIcon" class="h-6 w-6"></lucide-icon>
      </div>
      <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-50">
        {{ lookupMessage() || (lang.language() === 'ar' ? 'مفيش نتائج' : 'No matches') }}
      </h3>
      <p class="text-xs text-slate-500 dark:text-slate-400">
        {{ lang.language() === 'ar'
            ? 'جرّب تعديل البحث أو ابحث برقم الأوردر/الإيصال مباشرة.'
            : 'Try a different value, or search by Order ID / Receipt directly.' }}
      </p>
    </div>

    <app-audit-report-page #page
      titleEn="Order Journey" titleAr="رحلة الأوردر"
      subtitleEn="One order's full lifecycle as a chronological narrative"
      subtitleAr="رحلة أوردر واحد كاملة بترتيب زمني"
      [fetchFn]="fetch"
      [showGroupBy]="false"
      [showPageSize]="false"
      [showFilterBar]="false">
      <ng-template #body let-data>
        <!-- Empty placeholder — shown when the user hasn't searched yet
             or when the search resolved to no matching journey. Replaces
             the ugly red API-error banner the shell would otherwise show. -->
        <section *ngIf="!data || !data.orderId" class="card-padded text-center py-12 md:py-16 space-y-4">
          <div class="inline-flex h-14 w-14 items-center justify-center rounded-2xl
                      bg-info-soft text-info ring-1 ring-info/30">
            <lucide-icon [img]="SearchIcon" class="h-7 w-7"></lucide-icon>
          </div>
          <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-50">
            {{ lang.language() === 'ar' ? 'ابحث عن رحلة أوردر' : 'Find an order journey' }}
          </h2>
          <p class="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {{ lang.language() === 'ar'
                ? 'اختر طريقة البحث من فوق (رقم الأوردر، رقم الإيصال، اسم الترابيزة، أو رقم الموبايل) واضغط Enter لتحميل الرحلة.'
                : 'Pick a search type above — Order ID, Receipt #, Table name, or Mobile — and press Enter to load the journey.' }}
          </p>
        </section>

        <!-- ── Header card: ID, status, final net ───────────────────── -->
        <section *ngIf="data && data.orderId" class="card-padded">
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 class="text-lg font-bold text-slate-900 dark:text-slate-50">
                {{ lang.language() === 'ar' ? 'أوردر رقم' : 'Order #' }}{{ data.orderId }}
                <span *ngIf="data.receiptNumber" class="text-sm text-slate-500 ms-2">({{ data.receiptNumber }})</span>
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ data.transactionTypeName }}
                <span *ngIf="data.tableName"> · {{ data.tableName }}</span>
                <span *ngIf="data.branchName"> · {{ data.branchName }}</span>
              </p>
            </div>
            <div class="flex items-center gap-2">
              <span *ngIf="data.isPaid" class="pill-success text-xs">{{ lang.language() === 'ar' ? 'مدفوع' : 'Paid' }}</span>
              <span *ngIf="data.isCancelled" class="pill-critical text-xs">{{ lang.language() === 'ar' ? 'ملغي' : 'Cancelled' }}</span>
              <span class="tabular text-lg font-semibold text-slate-900 dark:text-slate-50">{{ data.finalNet | number:'1.0-2' }}</span>
            </div>
          </div>

          <!-- Action breakdown chips -->
          <div *ngIf="hasBreakdown(data)" class="flex items-center gap-1.5 flex-wrap mt-3">
            <span class="text-[10px] text-slate-400">{{ lang.language() === 'ar' ? 'الإجراءات' : 'Actions' }}:</span>
            <span *ngFor="let kv of breakdownEntries(data)"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-card-sm text-[11px] ring-1 tabular"
                  [class]="chipClassFor(kv.key)">
              <span class="font-medium">{{ kv.key }}</span>
              <span class="opacity-75">·</span>
              <span class="font-semibold">{{ kv.value }}</span>
            </span>
          </div>

          <!-- People involved + summary stats -->
          <div class="flex items-center gap-4 flex-wrap mt-3 text-xs text-slate-500 dark:text-slate-400">
            <span *ngIf="data.usersInvolved?.length">
              {{ lang.language() === 'ar' ? 'اشتغل عليه' : 'Touched by' }}:
              <span class="text-slate-700 dark:text-slate-200 font-medium">{{ (data.usersInvolved || []).join(', ') }}</span>
            </span>
            <span *ngIf="(data.totalDiscountApplied || 0) > 0">
              {{ lang.language() === 'ar' ? 'خصومات' : 'Discounts' }}:
              <span class="text-warning tabular font-semibold">{{ data.totalDiscountApplied | number:'1.0-2' }}</span>
            </span>
            <span *ngIf="(data.totalVoidedValue || 0) > 0">
              {{ lang.language() === 'ar' ? 'Void' : 'Voided' }}:
              <span class="text-critical tabular font-semibold">{{ data.totalVoidedValue | number:'1.0-2' }}</span>
            </span>
            <span *ngIf="data.openedAt">
              {{ lang.language() === 'ar' ? 'افتتح' : 'Opened' }}:
              <span class="text-slate-700 dark:text-slate-200">{{ data.openedAt | date:'short' }}</span>
            </span>
          </div>
        </section>

        <!-- ── Money flow strip ─────────────────────────────────────── -->
        <section *ngIf="data && data.orderId && (data.moneyFlow?.length || 0) > 1" class="card-padded">
          <h3 class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            {{ lang.language() === 'ar' ? 'تدفق المال' : 'Money flow' }}
          </h3>
          <div class="flex items-center gap-2 overflow-x-auto pb-2">
            <ng-container *ngFor="let pt of data.moneyFlow; let i = index; let last = last">
              <div class="shrink-0 flex flex-col items-center text-center min-w-[80px]">
                <div class="inline-flex items-center justify-center h-8 w-8 rounded-card-sm ring-1 mb-1"
                     [class]="chipClassFor(pt.actionType)">
                  <span class="text-[10px] font-semibold">{{ shortLabel(pt.actionType) }}</span>
                </div>
                <div class="tabular text-sm font-bold text-slate-900 dark:text-slate-50">{{ pt.netAfter | number:'1.0-2' }}</div>
                <div class="text-[10px] text-slate-400">
                  {{ lang.language() === 'ar' ? pt.label.descriptionAr : pt.label.descriptionEn }}
                </div>
                <div class="text-[9px] text-slate-400 tabular">{{ pt.at | date:'HH:mm:ss' }}</div>
              </div>
              <div *ngIf="!last" class="shrink-0 text-slate-300 dark:text-slate-700">→</div>
            </ng-container>
          </div>
        </section>

        <!-- ── Timeline ─────────────────────────────────────────────── -->
        <section *ngIf="data && data.orderId" class="space-y-2">
          <div class="px-1 flex items-center justify-between flex-wrap gap-2">
            <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {{ lang.language() === 'ar' ? 'الجدول الزمني' : 'Timeline' }}
              <span class="text-xs text-slate-400">({{ data.timeline?.length || 0 }})</span>
            </h3>
            <label class="text-xs flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" [(ngModel)]="moneyEventsOnly"
                     class="rounded-sm border-slate-300 dark:border-slate-700"/>
              <span class="text-slate-500 dark:text-slate-400">
                {{ lang.language() === 'ar' ? 'أحداث المال فقط' : 'Money events only' }}
              </span>
            </label>
          </div>
          <ng-container *ngFor="let r of data.timeline">
            <app-audit-event-card *ngIf="!moneyEventsOnly || isMoneyEvent(r.actionType)"
                                  [row]="r"></app-audit-event-card>
          </ng-container>
        </section>
      </ng-template>
    </app-audit-report-page>
  `,
})
export class AuditOrderJourneyComponent implements OnInit {
  private readonly api = inject(AuditApi);
  private readonly route = inject(ActivatedRoute);
  private readonly filter = inject(FilterService);
  readonly lang = inject(LanguageService);

  searchBy: 'orderId' | 'receipt' | 'table' | 'mobile' = 'orderId';
  lookupValue: number | null = null;
  tableInput = '';
  mobileInput = '';
  /** Optional filters that narrow the candidate list for table / mobile
   *  searches. 0 / empty → not applied. */
  filterTransactionTypeId: number = 0;
  filterFromDate = '';
  filterToDate = '';
  filterShiftId: number | null = null;
  readonly loaded = signal(false);
  moneyEventsOnly = false;

  // ── Multi-match candidate flow ────────────────────────────────────
  /** Result of the latest table/mobile lookup. Empty when not in
   *  list-mode (i.e. searching by orderId/receipt). */
  readonly candidates = signal<OrderJourneyCandidate[]>([]);
  /** The candidate the user picked from the list — drives the
   *  Load-Journey API call with the resolved OrderId. */
  readonly selectedCandidate = signal<OrderJourneyCandidate | null>(null);
  readonly lookupLoading = signal(false);
  readonly lookupAttempted = signal(false);
  readonly truncated = signal(false);
  readonly lookupMessage = signal('');

  readonly SearchIcon = Search;
  readonly BackIcon = ChevronLeft;
  readonly LoaderIcon = Loader;

  @ViewChild('page') pageRef?: AuditReportPageComponent<OrderJourneyResult>;

  /** True when the current search-by mode has a usable input value. The
   *  Load button is disabled and the fetch short-circuits to an empty
   *  sentinel when this is false — so the user never sees the raw
   *  "OrderId or ReceiptNumber required" API error. */
  hasInput(): boolean {
    switch (this.searchBy) {
      case 'orderId':
      case 'receipt': return !!this.lookupValue && this.lookupValue > 0;
      case 'table':   return !!this.tableInput?.trim();
      case 'mobile':  return !!this.mobileInput?.trim();
      default:        return false;
    }
  }

  /** Switching search modes clears the other inputs AND the candidate
   *  list so a stale value or stale picker doesn't survive between
   *  mode switches. */
  onSearchByChange(): void {
    this.lookupValue = null;
    this.tableInput  = '';
    this.mobileInput = '';
    this.clearSearch();
  }

  /** Reset everything to the initial empty state — used by the
   *  "New search" button and on mode switch. */
  clearSearch(): void {
    this.candidates.set([]);
    this.selectedCandidate.set(null);
    this.lookupAttempted.set(false);
    this.lookupMessage.set('');
    this.truncated.set(false);
    this.loaded.set(false);
    this.pageRef?.reload();          // re-fires fetch which now returns the empty sentinel
  }

  /** True when any lookup-filter is set — drives the "Clear filters" button. */
  hasLookupFilters(): boolean {
    return this.filterTransactionTypeId > 0
        || !!this.filterFromDate
        || !!this.filterToDate
        || (this.filterShiftId !== null && this.filterShiftId > 0);
  }

  clearLookupFilters(): void {
    this.filterTransactionTypeId = 0;
    this.filterFromDate = '';
    this.filterToDate = '';
    this.filterShiftId = null;
  }

  /** Auto-load when arriving with `?orderId=…` / `?receipt=…` /
   *  `?table=…` / `?mobile=…` — used for deep-links from Suspicious +
   *  User Session reports. */
  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const oid    = Number(params.get('orderId') ?? 0);
    const rcpt   = Number(params.get('receipt') ?? 0);
    const table  = params.get('table');
    const mobile = params.get('mobile');

    if (oid > 0) {
      this.searchBy = 'orderId';
      this.lookupValue = oid;
    } else if (rcpt > 0) {
      this.searchBy = 'receipt';
      this.lookupValue = rcpt;
    } else if (table && table.trim()) {
      this.searchBy = 'table';
      this.tableInput = table.trim();
    } else if (mobile && mobile.trim()) {
      this.searchBy = 'mobile';
      this.mobileInput = mobile.trim();
    } else {
      return;     // nothing to auto-load — keep empty state
    }

    this.loaded.set(true);
    // Reload happens once the page shell + child views are wired up,
    // so defer to next tick via Promise.resolve to avoid ExpressionChanged.
    Promise.resolve().then(() => this.pageRef?.reload());
  }

  /**
   * Load handler. Two modes:
   *  • OrderId / ReceiptNumber → directly load the journey (the
   *    identifier is unique by definition).
   *  • Table name / Mobile     → first call the Lookup endpoint to get
   *    the candidate list. If the lookup returns exactly 1 candidate
   *    we auto-pick it. If >1, the picker UI renders; the operator
   *    selects one and we then load the journey.
   */
  onLoad(): void {
    if (!this.hasInput()) return;

    // Always start from a clean state — don't show stale results.
    this.candidates.set([]);
    this.selectedCandidate.set(null);
    this.lookupAttempted.set(false);
    this.lookupMessage.set('');

    if (this.searchBy === 'orderId' || this.searchBy === 'receipt') {
      // Direct load — no Lookup step needed.
      this.loaded.set(true);
      this.pageRef?.reload();
      return;
    }

    // Table / Mobile → list-mode lookup. Apply the optional filters so
    // the operator can pin a result down to "Table 11 on 2026-05-12,
    // DineIn, shift 1" rather than swimming through every order that
    // ever touched that table.
    this.lookupLoading.set(true);
    this.api.orderJourneyLookup({
      tableName:         this.searchBy === 'table'  ? this.tableInput.trim()  : undefined,
      mobilePhone:       this.searchBy === 'mobile' ? this.mobileInput.trim() : undefined,
      branchId:          this.filter.branchId() ?? undefined,
      transactionTypeId: this.filterTransactionTypeId > 0 ? this.filterTransactionTypeId : undefined,
      fromDate:          this.filterFromDate ? new Date(this.filterFromDate).toISOString() : undefined,
      toDate:            this.filterToDate   ? new Date(this.filterToDate).toISOString()   : undefined,
      shiftId:           (this.filterShiftId && this.filterShiftId > 0) ? this.filterShiftId : undefined,
      language:          this.lang.language(),
    }).subscribe({
      next: (res) => {
        this.lookupLoading.set(false);
        this.lookupAttempted.set(true);
        this.lookupMessage.set(
          this.lang.language() === 'ar' ? res.message.descriptionAr : res.message.descriptionEn,
        );
        this.truncated.set(res.truncated);
        this.candidates.set(res.candidates ?? []);

        // Auto-pick when exactly 1 candidate — saves the operator a click.
        if (res.candidates?.length === 1) {
          this.pickCandidate(res.candidates[0]);
        }
      },
      error: (err) => {
        this.lookupLoading.set(false);
        this.lookupAttempted.set(true);
        // Surface the real error so the operator (and future me) can
        // diagnose without opening the network panel. Falls back to a
        // generic message when the error has no useful detail.
        const detail = err?.error?.message
                    || err?.error?.errors?.[0]
                    || err?.message
                    || (this.lang.language() === 'ar' ? 'حدث خطأ أثناء البحث.' : 'Lookup failed.');
        this.lookupMessage.set(String(detail));
      },
    });
  }

  /** Operator picked one candidate from the list — load its journey. */
  pickCandidate(c: OrderJourneyCandidate): void {
    this.selectedCandidate.set(c);
    this.loaded.set(true);
    this.pageRef?.reload();
  }

  /** Bilingual Load-button label changes by mode so the operator knows
   *  whether they're about to "Load journey" (direct) or "Search" (list). */
  loadButtonLabel(): string {
    const isLookupMode = this.searchBy === 'table' || this.searchBy === 'mobile';
    if (isLookupMode) {
      return this.lang.language() === 'ar' ? 'بحث' : 'Search';
    }
    return this.lang.language() === 'ar' ? 'حمّل الرحلة' : 'Load journey';
  }

  // ── Action breakdown helpers ─────────────────────────────────────
  hasBreakdown(data: OrderJourneyResult): boolean {
    return !!data.actionBreakdown && Object.keys(data.actionBreakdown).length > 0;
  }

  breakdownEntries(data: OrderJourneyResult): { key: string; value: number }[] {
    if (!data.actionBreakdown) return [];
    return Object.entries(data.actionBreakdown)
      .map(([key, value]) => ({ key, value: value as number }))
      .sort((a, b) => b.value - a.value);
  }

  /** Compact 2-3 char label for the money-flow dots. */
  shortLabel(actionType: string): string {
    switch (actionType) {
      case 'Send':                return 'SND';
      case 'Discount':            return '%';
      case 'PromoCode':           return 'PRM';
      case 'Voucher':             return 'VCH';
      case 'VoidItem':            return 'VOID';
      case 'Pay':                 return 'PAY';
      case 'EditPay':             return 'PAY*';
      case 'Checkout':
      case 'CheckOut':            return 'CHK';
      case 'Cancel':              return 'CXL';
      case 'ApproveCancelOrder':  return 'APR';
      case 'OrderCompleted':      return 'OK';
      default:                    return actionType.slice(0, 3).toUpperCase();
    }
  }

  /** Whether the row counts as a "money-touching" event — drives the
   *  Money-events-only toggle on the timeline. */
  isMoneyEvent(actionType: string): boolean {
    return [
      'Pay', 'EditPay', 'Discount', 'PromoCode', 'Voucher',
      'VoidItem', 'Cancel', 'ApproveCancelOrder',
      'Checkout', 'CheckOut', 'OrderCompleted', 'CollectMoney',
    ].includes(actionType);
  }

  chipClassFor(actionType: string): string {
    switch (actionType) {
      case 'Pay': case 'Checkout': case 'CheckOut': case 'OrderCompleted':
      case 'OrderDelivered': case 'OrderPickedup': case 'CollectMoney':
        return 'bg-success-soft text-success ring-success/30';
      case 'VoidItem': case 'StopItem': case 'Cancel': case 'ApproveCancelOrder':
        return 'bg-critical-soft text-critical ring-critical/30';
      case 'Discount': case 'PromoCode': case 'Voucher': case 'EditPay':
        return 'bg-warning-soft text-warning ring-warning/30';
      case 'Send':
        return 'bg-info-soft text-info ring-info/30';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 ring-slate-200 dark:ring-slate-700';
    }
  }

  readonly fetch = (ctx: AuditPageContext): Observable<OrderJourneyResult> => {
    // In list-mode (Table / Mobile) we only load the journey AFTER the
    // operator has picked a candidate from the list. Until then return
    // the empty sentinel so the body shows a placeholder (or the
    // candidate picker which lives outside the page-shell body).
    const isLookupMode = this.searchBy === 'table' || this.searchBy === 'mobile';
    if (isLookupMode) {
      const picked = this.selectedCandidate();
      if (!picked) return of(this.emptyJourney());
      return this.api.orderJourney({
        orderId:  picked.orderId,
        branchId: ctx.branchId ?? undefined,
        language: ctx.language,
      });
    }

    // Direct mode (OrderId / ReceiptNumber).
    if (!this.hasInput()) return of(this.emptyJourney());

    const v = this.lookupValue ?? 0;
    return this.api.orderJourney({
      orderId:       this.searchBy === 'orderId' ? (v > 0 ? v : undefined) : undefined,
      receiptNumber: this.searchBy === 'receipt' ? (v > 0 ? v : undefined) : undefined,
      branchId:      ctx.branchId ?? undefined,
      language:      ctx.language,
    });
  };

  /** Sentinel "no journey" payload — orderId=0 signals the template to
   *  render the empty-state placeholder. */
  private emptyJourney(): OrderJourneyResult {
    return {
      orderId: 0, receiptNumber: 0,
      transactionTypeName: '', tableName: '',
      branchId: 0, branchName: '',
      finalNet: 0,
      isCancelled: false, isPaid: false,
      usersInvolved: [], timeline: [],
      conclusion: { description: '', descriptionEn: '', descriptionAr: '' },
      actionBreakdown: {}, moneyFlow: [],
      totalDiscountApplied: 0, totalVoidedValue: 0,
    } as OrderJourneyResult;
  }
}
