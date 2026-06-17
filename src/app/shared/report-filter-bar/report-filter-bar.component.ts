import {
  Component, Input, Output, EventEmitter, inject, signal, computed, effect, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideAngularModule, Filter, ChevronDown, X, CreditCard, LayoutGrid, Clock,
  BadgePercent, Ticket, Tags, Globe, UserCog, UserRound, Bike, Users,
} from 'lucide-angular';
import { LanguageService } from '../../core/i18n/language.service';
import { FilterService } from '../../core/filters/filter.service';
import { ReportLookupsService } from '../../core/filters/report-lookups.service';
import { SalesReportFilter, ReportFilterKey } from '../../core/models/sales-report.models';
import { PickerComponent } from '../picker/picker.component';

/**
 * Collapsible filter bar for the generic Sales report shell. Filters are
 * organised into three groups:
 *   1. General  — payment / transaction / shift / online-app
 *   2. Users    — cashier / waiter / pilot, shown by the chosen transaction:
 *                   Dine In  → Waiter
 *                   Delivery → Pilot + Cashier
 *                   TakeAway → Cashier
 *                   (no transaction picked) → all three
 *   3. Discounts — discount / promo / voucher (always last)
 *
 * Every list is populated from the live POS lookup endpoints via
 * ReportLookupsService. Emits a `Partial<SalesReportFilter>` whenever any
 * selection changes; the page merges it into the report request body.
 * Branch + date are owned by the header pickers, not here.
 */
@Component({
  selector: 'app-report-filter-bar',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, PickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card-padded bg-gradient-to-b from-slate-50 to-white
                dark:from-surface-dark-muted/40 dark:to-surface-dark-muted/10
                ring-1 ring-slate-200 dark:ring-slate-800 shadow-sm">

      <!-- Toggle header -->
      <button type="button" (click)="open.set(!open())"
              class="flex items-center justify-between w-full text-start">
        <span class="flex items-center gap-2.5">
          <span class="inline-flex h-7 w-7 items-center justify-center rounded-card-sm
                       bg-brand-50 dark:bg-brand-900/30 ring-1 ring-brand-100 dark:ring-brand-800/50">
            <lucide-icon [img]="FilterIcon" class="h-4 w-4 text-brand-700 dark:text-brand-300"></lucide-icon>
          </span>
          <span class="text-base font-bold text-slate-700 dark:text-slate-200">
            {{ ar() ? 'الفلاتر' : 'Filters' }}
          </span>
          <span *ngIf="activeCount() > 0" class="pill-info text-[10px] px-1.5 py-0.5">{{ activeCount() }}</span>
          <span *ngIf="activeCount() > 0 && !open()"
                class="hidden md:inline text-xs font-normal text-slate-400 dark:text-slate-500 truncate max-w-[420px]">
            · {{ summary() }}
          </span>
        </span>
        <span class="flex items-center gap-2">
          <button *ngIf="activeCount() > 0" type="button" (click)="clearAll($event)"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-card-sm text-[11px] font-medium
                         text-slate-500 dark:text-slate-400 hover:text-critical hover:bg-critical-soft
                         ring-1 ring-slate-200 dark:ring-slate-700 transition-all duration-180">
            <lucide-icon [img]="XIcon" class="h-3 w-3"></lucide-icon>
            {{ ar() ? 'مسح الكل' : 'Clear' }}
          </button>
          <lucide-icon [img]="ChevronIcon" class="h-4 w-4 text-slate-400"
                       [class.rotate-180]="open()" style="transition: transform 220ms cubic-bezier(0.4,0,0.2,1);"></lucide-icon>
        </span>
      </button>

      <!-- Body -->
      <div *ngIf="open()" class="mt-4 space-y-5">

        <!-- ── General ─────────────────────────────────────────── -->
        <div *ngIf="generalVisible()" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
          <div *ngIf="show('payment')" class="space-y-1.5">
            <div class="fl-lbl"><lucide-icon [img]="PayIcon" class="fl-i"></lucide-icon><span>{{ ar() ? 'طريقة الدفع' : 'Payment method' }}</span></div>
            <app-picker class="block w-full" titleEn="All methods" titleAr="كل الطرق"
              [items]="lk.paymentMethods()" [selectedId]="payway()"
              (selectedIdChange)="payway.set($event); emit()"></app-picker>
          </div>

          <div *ngIf="show('transaction')" class="space-y-1.5">
            <div class="fl-lbl"><lucide-icon [img]="TrxIcon" class="fl-i"></lucide-icon><span>{{ ar() ? 'نوع المعاملة' : 'Transaction' }}</span></div>
            <app-picker class="block w-full" titleEn="All transactions" titleAr="كل المعاملات"
              [items]="lk.transactions()" [selectedId]="transactionId()"
              (selectedIdChange)="onTransaction($event)"></app-picker>
          </div>

          <div *ngIf="show('shift')" class="space-y-1.5">
            <div class="fl-lbl">
              <lucide-icon [img]="ShiftIcon" class="fl-i"></lucide-icon><span>{{ ar() ? 'الوردية' : 'Shift' }}</span>
              <button *ngIf="lk.currentShift() as cs" type="button"
                      (click)="shiftId.set(cs.id); emit()"
                      class="ms-auto text-[10px] font-medium text-brand-600 dark:text-brand-400 hover:underline">
                {{ ar() ? 'الحالية' : 'Current' }}
              </button>
            </div>
            <app-picker class="block w-full" titleEn="All shifts" titleAr="كل الورديات"
              [items]="lk.shifts()" [selectedId]="shiftId()"
              (selectedIdChange)="shiftId.set($event); emit()"></app-picker>
          </div>

          <div *ngIf="show('onlineApp')" class="space-y-1.5">
            <div class="fl-lbl"><lucide-icon [img]="OnlineIcon" class="fl-i"></lucide-icon><span>{{ ar() ? 'تطبيق أونلاين' : 'Online app' }}</span></div>
            <app-picker class="block w-full" titleEn="All apps" titleAr="كل التطبيقات"
              [items]="lk.onlineApps()" [selectedId]="onlineApp()"
              (selectedIdChange)="onlineApp.set($event); emit()"></app-picker>
          </div>
        </div>

        <!-- ── Users (conditional on transaction) ──────────────── -->
        <div *ngIf="usersVisible()" class="space-y-2">
          <div class="fl-group"><lucide-icon [img]="UsersIcon" class="h-3.5 w-3.5 shrink-0"></lucide-icon><span>{{ ar() ? 'المستخدمون' : 'Users' }}</span></div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
            <div *ngIf="showCashierFinal()" class="space-y-1.5">
              <div class="fl-lbl"><lucide-icon [img]="UserIcon" class="fl-i"></lucide-icon><span>{{ ar() ? 'الكاشير' : 'Cashier' }}</span></div>
              <app-picker class="block w-full" titleEn="All cashiers" titleAr="كل الكاشير"
                [items]="lk.cashiers()" [selectedId]="userId()"
                (selectedIdChange)="userId.set($event); emit()"></app-picker>
            </div>

            <div *ngIf="showWaiterFinal()" class="space-y-1.5">
              <div class="fl-lbl"><lucide-icon [img]="WaiterIcon" class="fl-i"></lucide-icon><span>{{ ar() ? 'الويتر' : 'Waiter' }}</span></div>
              <app-picker class="block w-full" titleEn="All waiters" titleAr="كل الويترز"
                [items]="lk.waiters()" [selectedId]="waiterId()"
                (selectedIdChange)="waiterId.set($event); emit()"></app-picker>
            </div>

            <div *ngIf="showPilotFinal()" class="space-y-1.5">
              <div class="fl-lbl"><lucide-icon [img]="PilotIcon" class="fl-i"></lucide-icon><span>{{ ar() ? 'الطيار' : 'Pilot' }}</span></div>
              <app-picker class="block w-full" titleEn="All pilots" titleAr="كل الطيارين"
                [items]="lk.pilots()" [selectedId]="pilotId()"
                (selectedIdChange)="pilotId.set($event); emit()"></app-picker>
            </div>
          </div>
        </div>

        <!-- ── Discounts (always last) ─────────────────────────── -->
        <div *ngIf="discountsVisible()" class="space-y-2">
          <div class="fl-group"><lucide-icon [img]="DiscIcon" class="h-3.5 w-3.5 shrink-0"></lucide-icon><span>{{ ar() ? 'الخصومات' : 'Discounts' }}</span></div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
            <div *ngIf="show('discount')" class="space-y-1.5">
              <div class="fl-lbl"><lucide-icon [img]="DiscIcon" class="fl-i"></lucide-icon><span>{{ ar() ? 'الخصم' : 'Discount' }}</span></div>
              <app-picker class="block w-full" titleEn="All discounts" titleAr="كل الخصومات"
                [items]="lk.discounts()" [selectedId]="discountId()"
                (selectedIdChange)="discountId.set($event); emit()"></app-picker>
            </div>

            <div *ngIf="show('promo')" class="space-y-1.5">
              <div class="fl-lbl"><lucide-icon [img]="TagsIcon" class="fl-i"></lucide-icon><span>{{ ar() ? 'كود البرومو' : 'Promo code' }}</span></div>
              <app-picker class="block w-full" titleEn="All promos" titleAr="كل البرومو"
                [items]="lk.promoDiscounts()" [selectedId]="promoId()"
                (selectedIdChange)="promoId.set($event); emit()"></app-picker>
            </div>

            <div *ngIf="show('voucher')" class="space-y-1.5">
              <div class="fl-lbl"><lucide-icon [img]="VoucherIcon" class="fl-i"></lucide-icon><span>{{ ar() ? 'القسيمة' : 'Voucher' }}</span></div>
              <app-picker class="block w-full" titleEn="All vouchers" titleAr="كل القسائم"
                [items]="lk.vouchers()" [selectedId]="voucherName()"
                (selectedIdChange)="voucherName.set($event); emit()"></app-picker>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .fl-lbl { display:flex; align-items:center; gap:.45rem; font-size:11px; font-weight:600;
              line-height:1rem; text-transform:uppercase; letter-spacing:.04em; color: rgb(100 116 139); }
    :host-context(.dark) .fl-lbl { color: rgb(148 163 184); }
    .fl-lbl > span { line-height:1rem; }
    /* Fixed-size, non-shrinking icon box, optically centred on the label text. */
    .fl-i { display:inline-flex; align-items:center; justify-content:center;
            height:.9rem; width:.9rem; flex:0 0 auto; line-height:1; color: rgb(148 163 184); }
    .fl-i ::ng-deep svg { height:.9rem; width:.9rem; display:block; }
    .fl-group { display:flex; align-items:center; gap:.5rem; font-size:11px; font-weight:700;
                line-height:1rem; text-transform:uppercase; letter-spacing:.05em; color: rgb(100 116 139); }
    :host-context(.dark) .fl-group { color: rgb(148 163 184); }
    .fl-group::after { content:''; flex:1 1 auto; height:1px; background: rgb(226 232 240); }
    :host-context(.dark) .fl-group::after { background: rgb(51 65 85); }
  `],
})
export class ReportFilterBarComponent {
  /** Which filter dimensions to show. Omit → all. */
  @Input() set filters(v: ReportFilterKey[] | undefined) { this._filters.set(v ?? null); }
  @Output() filtersChange = new EventEmitter<Partial<SalesReportFilter>>();

  readonly lang = inject(LanguageService);
  private readonly filter = inject(FilterService);
  readonly lk = inject(ReportLookupsService);

  readonly open = signal(false);
  private readonly _filters = signal<ReportFilterKey[] | null>(null);

  // selection signals (all picker ids → string|null)
  readonly payway        = signal<string | null>(null);
  readonly transactionId = signal<string | null>(null);
  readonly shiftId       = signal<string | null>(null);
  readonly discountId    = signal<string | null>(null);
  readonly promoId       = signal<string | null>(null);
  readonly voucherName   = signal<string | null>(null);
  readonly onlineApp     = signal<string | null>(null);
  readonly userId        = signal<string | null>(null);
  readonly waiterId      = signal<string | null>(null);
  readonly pilotId       = signal<string | null>(null);

  readonly FilterIcon = Filter; readonly ChevronIcon = ChevronDown; readonly XIcon = X;
  readonly PayIcon = CreditCard; readonly TrxIcon = LayoutGrid; readonly ShiftIcon = Clock;
  readonly DiscIcon = BadgePercent; readonly TagsIcon = Tags; readonly VoucherIcon = Ticket;
  readonly OnlineIcon = Globe; readonly UserIcon = UserCog; readonly WaiterIcon = UserRound;
  readonly PilotIcon = Bike; readonly UsersIcon = Users;

  readonly ar = computed(() => this.lang.language() === 'ar');

  readonly activeCount = computed(() =>
    [this.payway(), this.transactionId(), this.shiftId(), this.discountId(), this.promoId(),
     this.voucherName(), this.onlineApp(), this.userId(), this.waiterId(), this.pilotId()]
      .filter((v) => v != null && v !== '').length);

  // ── Transaction-driven Users visibility ──────────────────────────────
  /** Classify the selected transaction by its (bilingual) name. */
  readonly selectedTxnType = computed<'dineIn' | 'takeAway' | 'delivery' | 'other' | null>(() => {
    const id = this.transactionId();
    if (!id) return null;
    const it = this.lk.transactions().find((x) => String(x.id) === String(id));
    const name = `${it?.nameEn ?? ''} ${it?.nameAr ?? ''}`.toLowerCase();
    if (name.includes('dine') || name.includes('صالة') || name.includes('داخل')) return 'dineIn';
    if (name.includes('deliver') || name.includes('دليفري') || name.includes('توصيل')) return 'delivery';
    if (name.includes('take') || name.includes('away') || name.includes('تيك') || name.includes('سفري')) return 'takeAway';
    return 'other';
  });
  /** No transaction picked, or an unrecognised one → show every user filter. */
  private readonly showAllUsers = computed(() => {
    const t = this.selectedTxnType();
    return t === null || t === 'other';
  });
  readonly showCashier = computed(() => this.showAllUsers() || ['takeAway', 'delivery'].includes(this.selectedTxnType() as string));
  readonly showWaiter  = computed(() => this.showAllUsers() || this.selectedTxnType() === 'dineIn');
  readonly showPilot   = computed(() => this.showAllUsers() || this.selectedTxnType() === 'delivery');

  // Final visibility = report allows the key AND the transaction condition holds.
  readonly showCashierFinal = computed(() => this.show('user')   && this.showCashier());
  readonly showWaiterFinal  = computed(() => this.show('waiter') && this.showWaiter());
  readonly showPilotFinal   = computed(() => this.show('pilot')  && this.showPilot());

  // Group visibility
  readonly generalVisible   = computed(() => ['payment', 'transaction', 'shift', 'onlineApp'].some((k) => this.show(k as ReportFilterKey)));
  readonly usersVisible     = computed(() => this.showCashierFinal() || this.showWaiterFinal() || this.showPilotFinal());
  readonly discountsVisible = computed(() => ['discount', 'promo', 'voucher'].some((k) => this.show(k as ReportFilterKey)));

  readonly summary = computed(() => {
    const parts: string[] = [];
    const name = (items: { id: string; nameEn: string; nameAr: string }[], id: string | null) => {
      const it = items.find((x) => x.id === id); return it ? (this.ar() ? it.nameAr || it.nameEn : it.nameEn || it.nameAr) : id;
    };
    if (this.payway())        parts.push(name(this.lk.paymentMethods(), this.payway()) || '');
    if (this.transactionId()) parts.push(name(this.lk.transactions(), this.transactionId()) || '');
    if (this.shiftId())       parts.push(name(this.lk.shifts(), this.shiftId()) || '');
    if (this.userId())        parts.push(name(this.lk.cashiers(), this.userId()) || '');
    if (this.waiterId())      parts.push(name(this.lk.waiters(), this.waiterId()) || '');
    if (this.pilotId())       parts.push(name(this.lk.pilots(), this.pilotId()) || '');
    if (this.discountId())    parts.push(name(this.lk.discounts(), this.discountId()) || '');
    if (this.voucherName())   parts.push(this.voucherName() || '');
    return parts.filter(Boolean).join(' · ');
  });

  constructor() {
    // Clear branch-scoped selections when the branch changes (stale ids).
    let firstBranch = true;
    effect(() => {
      this.filter.branchId();
      if (firstBranch) { firstBranch = false; return; }
      this.shiftId.set(null); this.userId.set(null); this.waiterId.set(null); this.pilotId.set(null);
      this.emit();
    });
  }

  show(key: ReportFilterKey): boolean {
    const list = this._filters();
    return list == null ? true : list.includes(key);
  }

  /** Changing the transaction may hide some user filters → clear those selections. */
  onTransaction(id: string | null): void {
    this.transactionId.set(id);
    if (!this.showCashier()) this.userId.set(null);
    if (!this.showWaiter())  this.waiterId.set(null);
    if (!this.showPilot())   this.pilotId.set(null);
    this.emit();
  }

  emit(): void {
    const f: Partial<SalesReportFilter> = {};
    if (this.payway())        f.payway = this.payway()!;
    if (this.transactionId()) f.transactionId = Number(this.transactionId());
    if (this.shiftId())       f.shiftId = Number(this.shiftId());
    if (this.discountId())    f.discountId = Number(this.discountId());
    if (this.promoId())       f.promoCodeDiscountId = Number(this.promoId());
    if (this.voucherName())   f.voucherName = this.voucherName()!;
    if (this.onlineApp())     f.onlineApp = Number(this.onlineApp());
    if (this.userId())        f.userId = this.userId()!;
    if (this.waiterId())      f.waiterId = this.waiterId()!;
    if (this.pilotId())       f.poiltId = this.pilotId()!;
    this.filtersChange.emit(f);
  }

  clearAll(ev?: Event): void {
    ev?.stopPropagation();
    this.payway.set(null); this.transactionId.set(null); this.shiftId.set(null);
    this.discountId.set(null); this.promoId.set(null); this.voucherName.set(null);
    this.onlineApp.set(null); this.userId.set(null); this.waiterId.set(null); this.pilotId.set(null);
    this.emit();
  }
}
