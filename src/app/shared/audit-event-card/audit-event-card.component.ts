import {
  Component,
  Input,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideAngularModule,
  ChevronDown,
  CreditCard,
  Edit3,
  Percent,
  Tag,
  Ticket,
  Trash2,
  Ban,
  X,
  Send,
  CheckCircle2,
  ArrowRightLeft,
  Scissors,
  User as UserIcon,
  Coins,
  CheckCheck,
  PackageCheck,
  Package,
  LogIn,
  LogOut,
  Clock,
  Calculator,
  Pencil,
  Activity,
  AlertTriangle,
  ListTree,
} from 'lucide-angular';
import { LanguageService } from '../../core/i18n/language.service';
import {
  AuditNarrativeRow,
  AuditOrderSnapshot,
  AuditOrderItemSnapshot,
} from '../../core/models/audit.models';

type LucideIcon = typeof Activity;

/**
 * Single audit row rendered as a card:
 *  - Action-type icon (with category-coloured background)
 *  - Primary bilingual narrative
 *  - Timestamp + user line
 *  - Money-delta badge (green for +, red for −) when NetDiff is non-zero
 *  - Failure pill + error message when the source row failed
 *  - Expandable details panel with order / item / total / promo / discount
 *    progressions
 *
 * Used by every audit / trx report that lists `AuditNarrativeRow` rows
 * — Daily, DineIn, TakeAway, Delivery, UserSession sessions list,
 * OrderJourney timeline. Single source of truth for the row layout so
 * a UX tweak on one report propagates to all.
 */
@Component({
  selector: 'app-audit-event-card',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card-padded transition-colors duration-180
                hover:bg-slate-50/60 dark:hover:bg-surface-dark-muted/30"
         [ngClass]="!row.success ? 'ring-1 ring-critical/40' : ''">
      <!-- Header row -->
      <div class="flex items-start gap-3">
        <!-- Icon with category-coloured background -->
        <div class="shrink-0 inline-flex items-center justify-center
                    h-8 w-8 rounded-card-sm ring-1"
             [class]="iconBgClass()">
          <lucide-icon [img]="iconFor(row.actionType)" class="h-4 w-4"></lucide-icon>
        </div>

        <!-- Narrative + meta -->
        <div class="flex-1 min-w-0">
          <p class="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
            {{ lang.language() === 'ar' ? row.narrative.descriptionAr : row.narrative.descriptionEn }}
          </p>
          <div class="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
            <span class="tabular">{{ row.actionDate | date:'short' }}</span>
            <span *ngIf="row.userName" class="flex items-center gap-1">
              <span class="h-1 w-1 rounded-full bg-slate-400"></span>
              <span class="truncate">{{ row.userName }}</span>
              <span *ngIf="row.userRole" class="text-slate-400">· {{ row.userRole }}</span>
            </span>
            <span *ngIf="row.branchName" class="flex items-center gap-1">
              <span class="h-1 w-1 rounded-full bg-slate-400"></span>
              <span class="truncate">{{ row.branchName }}</span>
            </span>
            <span *ngIf="row.orderId" class="flex items-center gap-1">
              <span class="h-1 w-1 rounded-full bg-slate-400"></span>
              <span class="tabular">#{{ row.orderId }}</span>
            </span>
          </div>
        </div>

        <!-- Money delta badge -->
        <div *ngIf="row.netDiff" class="shrink-0 inline-flex items-center
                                        rounded-card-sm px-2 py-0.5
                                        text-xs font-semibold tabular ring-1"
             [ngClass]="row.netDiff > 0
                          ? 'text-good bg-good-soft ring-good/30'
                          : (row.netDiff < 0 ? 'text-critical bg-critical-soft ring-critical/30' : '')">
          {{ row.netDiff > 0 ? '+' : '' }}{{ row.netDiff | number:'1.0-2' }}
        </div>

        <!-- Failure pill -->
        <span *ngIf="!row.success"
              class="shrink-0 pill-critical text-[10px] py-0.5">
          <lucide-icon [img]="AlertIcon" class="h-3 w-3"></lucide-icon>
          {{ lang.language() === 'ar' ? 'فشل' : 'Failed' }}
        </span>

        <!-- Expand toggle -->
        <button type="button" (click)="open.set(!open())"
                *ngIf="hasDetails()"
                class="shrink-0 inline-flex items-center justify-center
                       h-7 w-7 rounded-card-sm
                       text-slate-400 hover:text-slate-700
                       dark:hover:text-slate-200
                       transition-colors duration-180"
                [title]="lang.language() === 'ar' ? 'تفاصيل' : 'Details'">
          <lucide-icon [img]="ChevronIcon" class="h-3.5 w-3.5"
                       [class.rotate-180]="open()"
                       style="transition: transform 180ms ease-out;"></lucide-icon>
        </button>
      </div>

      <!-- Expandable detail panel -->
      <div *ngIf="open()"
           class="mt-3 ps-11 pt-3 border-t border-slate-200 dark:border-slate-700/60
                  grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">

        <!-- ── Order / table context ────────────────────────────── -->
        <div *ngIf="row.receiptNumber">
          <div class="text-slate-400">{{ lang.language() === 'ar' ? 'إيصال' : 'Receipt' }}</div>
          <div class="tabular text-slate-700 dark:text-slate-200 font-medium">#{{ row.receiptNumber }}</div>
        </div>
        <div *ngIf="row.tableName">
          <div class="text-slate-400">{{ lang.language() === 'ar' ? 'ترابيزة' : 'Table' }}</div>
          <div class="text-slate-700 dark:text-slate-200 font-medium">{{ row.tableName }}</div>
        </div>
        <div *ngIf="row.destinationTableName">
          <div class="text-slate-400">{{ lang.language() === 'ar' ? 'الوجهة' : 'To table' }}</div>
          <div class="text-slate-700 dark:text-slate-200 font-medium">{{ row.destinationTableName }}</div>
        </div>
        <div *ngIf="row.transactionTypeName">
          <div class="text-slate-400">{{ lang.language() === 'ar' ? 'النوع' : 'Transaction' }}</div>
          <div class="text-slate-700 dark:text-slate-200 font-medium">{{ row.transactionTypeName }}</div>
        </div>

        <!-- ── When / Where ─────────────────────────────────────── -->
        <div *ngIf="row.actionTime">
          <div class="text-slate-400">{{ lang.language() === 'ar' ? 'الوقت' : 'Time' }}</div>
          <div class="tabular text-slate-700 dark:text-slate-200 font-medium">{{ row.actionTime }}</div>
        </div>
        <div *ngIf="row.shiftId">
          <div class="text-slate-400">{{ lang.language() === 'ar' ? 'وردية' : 'Shift' }}</div>
          <div class="tabular text-slate-700 dark:text-slate-200 font-medium">{{ row.shiftId }}</div>
        </div>
        <div *ngIf="row.hallId">
          <div class="text-slate-400">{{ lang.language() === 'ar' ? 'صالة' : 'Hall' }}</div>
          <div class="tabular text-slate-700 dark:text-slate-200 font-medium">{{ row.hallId }}</div>
        </div>
        <div *ngIf="row.branchName">
          <div class="text-slate-400">{{ lang.language() === 'ar' ? 'الفرع' : 'Branch' }}</div>
          <div class="text-slate-700 dark:text-slate-200 font-medium truncate">{{ row.branchName }}</div>
        </div>

        <!-- ── Who ─────────────────────────────────────────────── -->
        <div *ngIf="row.userName">
          <div class="text-slate-400">{{ lang.language() === 'ar' ? 'بواسطة' : 'By' }}</div>
          <div class="text-slate-700 dark:text-slate-200 font-medium truncate">
            {{ row.userName }}
            <span *ngIf="row.userRole" class="text-slate-400 ms-1">· {{ row.userRole }}</span>
          </div>
        </div>
        <div *ngIf="row.waiterName">
          <div class="text-slate-400">{{ lang.language() === 'ar' ? 'الويتر' : 'Waiter' }}</div>
          <div class="text-slate-700 dark:text-slate-200 font-medium truncate">{{ row.waiterName }}</div>
        </div>
        <div *ngIf="row.cashierName">
          <div class="text-slate-400">{{ lang.language() === 'ar' ? 'الكاشير' : 'Cashier' }}</div>
          <div class="text-slate-700 dark:text-slate-200 font-medium truncate">{{ row.cashierName }}</div>
        </div>
        <div *ngIf="row.machineName || row.machineId">
          <div class="text-slate-400">{{ lang.language() === 'ar' ? 'جهاز' : 'Machine' }}</div>
          <div class="text-slate-700 dark:text-slate-200 font-medium truncate">{{ row.machineName || row.machineId }}</div>
        </div>

        <!-- ── Item / guest progressions — only show when changed ── -->
        <div *ngIf="row.itemCountBefore !== row.itemCountAfter">
          <div class="text-slate-400">{{ lang.language() === 'ar' ? 'الأصناف' : 'Items' }}</div>
          <div class="tabular text-slate-700 dark:text-slate-200">
            {{ row.itemCountBefore }} <span class="text-slate-400">→</span> {{ row.itemCountAfter }}
            <span class="text-slate-400 ms-1">({{ row.itemCountAfter - row.itemCountBefore > 0 ? '+' : '' }}{{ row.itemCountAfter - row.itemCountBefore }})</span>
          </div>
        </div>
        <div *ngIf="row.guestCountBefore !== row.guestCountAfter">
          <div class="text-slate-400">{{ lang.language() === 'ar' ? 'الضيوف' : 'Guests' }}</div>
          <div class="tabular text-slate-700 dark:text-slate-200">
            {{ row.guestCountBefore }} <span class="text-slate-400">→</span> {{ row.guestCountAfter }}
          </div>
        </div>

        <!-- ── Money progressions — only show when before ≠ after ── -->
        <div *ngIf="row.totalSalesBefore !== row.totalSalesAfter">
          <div class="text-slate-400">{{ lang.language() === 'ar' ? 'إجمالي المبيعات' : 'Total sales' }}</div>
          <div class="tabular text-slate-700 dark:text-slate-200">
            {{ row.totalSalesBefore | number:'1.0-2' }} <span class="text-slate-400">→</span> {{ row.totalSalesAfter | number:'1.0-2' }}
          </div>
        </div>
        <div *ngIf="row.totalBefore !== row.totalAfter && row.totalBefore !== row.totalSalesBefore">
          <div class="text-slate-400">{{ lang.language() === 'ar' ? 'الإجمالي' : 'Total' }}</div>
          <div class="tabular text-slate-700 dark:text-slate-200">
            {{ row.totalBefore | number:'1.0-2' }} <span class="text-slate-400">→</span> {{ row.totalAfter | number:'1.0-2' }}
          </div>
        </div>
        <div *ngIf="row.netBefore !== row.netAfter">
          <div class="text-slate-400">{{ lang.language() === 'ar' ? 'الصافي' : 'Net' }}</div>
          <div class="tabular text-slate-700 dark:text-slate-200">
            {{ row.netBefore | number:'1.0-2' }} <span class="text-slate-400">→</span> {{ row.netAfter | number:'1.0-2' }}
          </div>
        </div>
        <div *ngIf="row.discountAfter && row.discountAfter !== row.discountBefore">
          <div class="text-slate-400">{{ lang.language() === 'ar' ? 'الخصم' : 'Discount' }}</div>
          <div class="tabular text-slate-700 dark:text-slate-200">
            {{ row.discountBefore | number:'1.0-2' }} <span class="text-slate-400">→</span> {{ row.discountAfter | number:'1.0-2' }}
          </div>
        </div>

        <!-- Single-state money snapshot — for events whose Before equals After
             (a Pay row populates only After). Saves the operator from seeing
             three identical "0 → X" rows. -->
        <div *ngIf="showFinalsOnly()" class="col-span-2 sm:col-span-3 lg:col-span-4
                                              flex items-center gap-4 flex-wrap text-xs">
          <span class="text-slate-400">{{ lang.language() === 'ar' ? 'لقطة المال' : 'Money snapshot' }}:</span>
          <span class="tabular">
            <span class="text-slate-400">{{ lang.language() === 'ar' ? 'مبيعات' : 'Sales' }}</span>
            <span class="text-slate-700 dark:text-slate-200 ms-1 font-medium">{{ row.totalSalesAfter | number:'1.0-2' }}</span>
          </span>
          <span class="tabular">
            <span class="text-slate-400">{{ lang.language() === 'ar' ? 'صافي' : 'Net' }}</span>
            <span class="text-slate-700 dark:text-slate-200 ms-1 font-medium">{{ row.netAfter | number:'1.0-2' }}</span>
          </span>
          <span *ngIf="row.discountAfter" class="tabular">
            <span class="text-slate-400">{{ lang.language() === 'ar' ? 'خصم' : 'Discount' }}</span>
            <span class="text-slate-700 dark:text-slate-200 ms-1 font-medium">{{ row.discountAfter | number:'1.0-2' }}</span>
          </span>
          <span *ngIf="row.itemCountAfter" class="tabular">
            <span class="text-slate-400">{{ lang.language() === 'ar' ? 'أصناف' : 'Items' }}</span>
            <span class="text-slate-700 dark:text-slate-200 ms-1 font-medium">{{ row.itemCountAfter }}</span>
          </span>
        </div>

        <!-- ── Promo / discount labels ─────────────────────────── -->
        <div *ngIf="row.discountName">
          <div class="text-slate-400">{{ lang.language() === 'ar' ? 'اسم الخصم' : 'Discount name' }}</div>
          <div class="text-slate-700 dark:text-slate-200 font-medium truncate">{{ row.discountName }}</div>
        </div>
        <div *ngIf="row.promoCode">
          <div class="text-slate-400">{{ lang.language() === 'ar' ? 'كود الخصم' : 'Promo code' }}</div>
          <div class="text-slate-700 dark:text-slate-200 font-medium truncate">{{ row.promoCode }}</div>
        </div>

        <!-- ── Item-level diff (ChangedFields one-liner) ───────── -->
        <div *ngIf="row.changedFields" class="col-span-full">
          <div class="text-slate-400">{{ lang.language() === 'ar' ? 'تغييرات الأصناف' : 'Item changes' }}</div>
          <div class="text-slate-700 dark:text-slate-200 font-medium text-xs">{{ row.changedFields }}</div>
        </div>

        <!-- ── Item table (BeforeSnapshot — for void / cancel / transfer) ── -->
        <div *ngIf="beforeItems().length > 0" class="col-span-full pt-2 mt-1 border-t border-slate-100 dark:border-slate-800/60">
          <div class="flex items-center justify-between text-xs mb-1.5">
            <span class="text-slate-400">
              {{ lang.language() === 'ar' ? 'الأصناف قبل الإجراء' : 'Items before action' }}
              ({{ beforeItems().length }})
            </span>
            <span *ngIf="beforeSubtotal() > 0" class="tabular text-slate-500">
              {{ lang.language() === 'ar' ? 'الإجمالي' : 'Subtotal' }}:
              <span class="text-slate-700 dark:text-slate-200 font-semibold">{{ beforeSubtotal() | number:'1.0-2' }}</span>
            </span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-xs tabular">
              <thead>
                <tr class="text-slate-400">
                  <th class="text-start py-1 font-normal">{{ lang.language() === 'ar' ? 'الصنف' : 'Item' }}</th>
                  <th class="text-end py-1 font-normal w-16">{{ lang.language() === 'ar' ? 'الكمية' : 'Qty' }}</th>
                  <th class="text-end py-1 font-normal w-20">{{ lang.language() === 'ar' ? 'السعر' : 'Unit' }}</th>
                  <th class="text-end py-1 font-normal w-24">{{ lang.language() === 'ar' ? 'إجمالي' : 'Total' }}</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let it of beforeItems()" class="border-t border-slate-100 dark:border-slate-800/40">
                  <td class="py-1 text-slate-700 dark:text-slate-200">
                    {{ lang.language() === 'ar' && it.nameAr ? it.nameAr : it.name }}
                    <span *ngIf="it.variant" class="text-slate-400 text-[10px] ms-1">({{ it.variant }})</span>
                    <div *ngIf="it.notes" class="text-slate-400 text-[10px] truncate">{{ it.notes }}</div>
                  </td>
                  <td class="py-1 text-end">{{ it.qty | number:'1.0-2' }}</td>
                  <td class="py-1 text-end text-slate-500">{{ it.unitPrice | number:'1.0-2' }}</td>
                  <td class="py-1 text-end text-slate-700 dark:text-slate-200">{{ it.lineTotal | number:'1.0-2' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ── Item table (AfterSnapshot — for send / pay / checkout) ── -->
        <div *ngIf="afterItems().length > 0" class="col-span-full pt-2 mt-1 border-t border-slate-100 dark:border-slate-800/60">
          <div class="flex items-center justify-between text-xs mb-1.5">
            <span class="text-slate-400">
              {{ lang.language() === 'ar' ? 'الأصناف بعد الإجراء' : 'Items after action' }}
              ({{ afterItems().length }})
            </span>
            <span *ngIf="afterSubtotal() > 0" class="tabular text-slate-500">
              {{ lang.language() === 'ar' ? 'الإجمالي' : 'Subtotal' }}:
              <span class="text-slate-700 dark:text-slate-200 font-semibold">{{ afterSubtotal() | number:'1.0-2' }}</span>
            </span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-xs tabular">
              <thead>
                <tr class="text-slate-400">
                  <th class="text-start py-1 font-normal">{{ lang.language() === 'ar' ? 'الصنف' : 'Item' }}</th>
                  <th class="text-end py-1 font-normal w-16">{{ lang.language() === 'ar' ? 'الكمية' : 'Qty' }}</th>
                  <th class="text-end py-1 font-normal w-20">{{ lang.language() === 'ar' ? 'السعر' : 'Unit' }}</th>
                  <th class="text-end py-1 font-normal w-24">{{ lang.language() === 'ar' ? 'إجمالي' : 'Total' }}</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let it of afterItems()" class="border-t border-slate-100 dark:border-slate-800/40">
                  <td class="py-1 text-slate-700 dark:text-slate-200">
                    {{ lang.language() === 'ar' && it.nameAr ? it.nameAr : it.name }}
                    <span *ngIf="it.variant" class="text-slate-400 text-[10px] ms-1">({{ it.variant }})</span>
                    <div *ngIf="it.notes" class="text-slate-400 text-[10px] truncate">{{ it.notes }}</div>
                  </td>
                  <td class="py-1 text-end">{{ it.qty | number:'1.0-2' }}</td>
                  <td class="py-1 text-end text-slate-500">{{ it.unitPrice | number:'1.0-2' }}</td>
                  <td class="py-1 text-end text-slate-700 dark:text-slate-200">{{ it.lineTotal | number:'1.0-2' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Error -->
        <div *ngIf="!row.success && row.errorMessage" class="col-span-full">
          <div class="text-slate-400">{{ lang.language() === 'ar' ? 'الخطأ' : 'Error' }}</div>
          <div class="text-critical text-xs">{{ row.errorMessage }}</div>
        </div>

        <!-- Correlation id (debug aid) -->
        <div *ngIf="row.correlationId" class="col-span-full pt-1 mt-1 border-t border-slate-100 dark:border-slate-800/60">
          <div class="text-slate-400 text-[10px]">
            <lucide-icon [img]="TraceIcon" class="h-2.5 w-2.5 inline -mt-0.5"></lucide-icon>
            {{ lang.language() === 'ar' ? 'معرّف الربط' : 'CorrelationId' }}:
            <span class="font-mono text-slate-500">{{ row.correlationId }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class AuditEventCardComponent {
  @Input({ required: true }) row!: AuditNarrativeRow;

  readonly lang = inject(LanguageService);
  readonly open = signal(false);

  readonly ChevronIcon = ChevronDown;
  readonly AlertIcon = AlertTriangle;
  readonly TraceIcon = ListTree;

  /** Action-type → lucide icon. Falls back to Activity for unknowns. */
  iconFor(actionType: string): LucideIcon {
    switch (actionType) {
      case 'Pay':              return CreditCard;
      case 'EditPay':          return Edit3;
      case 'Discount':         return Percent;
      case 'PromoCode':        return Tag;
      case 'Voucher':          return Ticket;
      case 'VoidItem':         return Trash2;
      case 'StopItem':         return Ban;
      case 'Cancel':           return Ban;
      case 'ApproveCancelOrder': return X;
      case 'RejectCancelOrder':  return X;
      case 'Send':             return Send;
      case 'Checkout':         return CheckCircle2;
      case 'Transfer':         return ArrowRightLeft;
      case 'Split':            return Scissors;
      case 'Assign':           return UserIcon;
      case 'CollectMoney':     return Coins;
      case 'Return':           return ArrowRightLeft;
      case 'FollowOrder':      return Activity;
      case 'OrderCompleted':   return CheckCheck;
      case 'OrderDelivered':   return PackageCheck;
      case 'OrderPickedup':    return Package;
      case 'Login':            return LogIn;
      case 'Logout':           return LogOut;
      case 'CloseShift':
      case 'OpenShift':
      case 'CloseDay':
      case 'OpenDay':          return Clock;
      case 'Calculate':        return Calculator;
      case 'EditOrder':        return Pencil;
      default:                 return Activity;
    }
  }

  /**
   * Action-type → ring + text background colour. Three families:
   *   green/brand  → revenue-positive (Pay, Checkout, Completed, Delivered)
   *   red/critical → loss-touching   (Void, Cancel, Discount, Promo, Voucher)
   *   slate        → neutral / context
   */
  iconBgClass(): string {
    switch (this.row.actionType) {
      case 'Pay':
      case 'Checkout':
      case 'OrderCompleted':
      case 'OrderDelivered':
      case 'OrderPickedup':
      case 'CollectMoney':
        return 'bg-good-soft text-good ring-good/30';
      case 'VoidItem':
      case 'StopItem':
      case 'Cancel':
      case 'ApproveCancelOrder':
      case 'RejectCancelOrder':
        return 'bg-critical-soft text-critical ring-critical/30';
      case 'Discount':
      case 'PromoCode':
      case 'Voucher':
      case 'EditPay':
        return 'bg-warning-soft text-warning ring-warning/30';
      case 'Login':
      case 'Logout':
      case 'OpenShift':
      case 'CloseShift':
      case 'OpenDay':
      case 'CloseDay':
        return 'bg-info-soft text-info ring-info/30';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-500 ring-slate-200 dark:ring-slate-700';
    }
  }

  /** Anything worth showing in the expanded panel. */
  hasDetails(): boolean {
    const r = this.row;
    return !!(
      r.receiptNumber || r.tableName || r.destinationTableName ||
      r.transactionTypeName || r.shiftId || r.hallId ||
      r.machineId || r.machineName ||
      r.userName || r.waiterName || r.cashierName ||
      r.itemCountBefore !== r.itemCountAfter ||
      r.guestCountBefore !== r.guestCountAfter ||
      r.totalSalesBefore !== r.totalSalesAfter ||
      r.totalBefore !== r.totalAfter ||
      r.netBefore !== r.netAfter ||
      r.discountAfter !== r.discountBefore ||
      r.discountName || r.promoCode ||
      r.changedFields ||
      this.beforeItems().length > 0 || this.afterItems().length > 0 ||
      this.showFinalsOnly() ||
      (!r.success && r.errorMessage) ||
      r.correlationId
    );
  }

  // ── Snapshot parsing (cached per row via simple memoization) ──────
  private _parsedBefore?: AuditOrderSnapshot | null;
  private _parsedAfter?:  AuditOrderSnapshot | null;
  private _lastRowId?: number;

  private parseSnapshot(json?: string): AuditOrderSnapshot | null {
    if (!json) return null;
    try {
      const obj = JSON.parse(json) as AuditOrderSnapshot;
      if (!obj || !Array.isArray(obj.items)) return null;
      return obj;
    } catch {
      return null;
    }
  }

  private ensureParsed(): void {
    if (this._lastRowId === this.row?.id) return;
    this._lastRowId = this.row?.id;
    this._parsedBefore = this.parseSnapshot(this.row.beforeSnapshot);
    this._parsedAfter  = this.parseSnapshot(this.row.afterSnapshot);
  }

  /** Items captured BEFORE the action — for void / cancel / transfer.
   *  Returns [] when nothing was captured for this row. */
  beforeItems(): AuditOrderItemSnapshot[] {
    this.ensureParsed();
    return this._parsedBefore?.items ?? [];
  }

  /** Items captured AFTER the action — for send / pay / checkout / editorder. */
  afterItems(): AuditOrderItemSnapshot[] {
    this.ensureParsed();
    return this._parsedAfter?.items ?? [];
  }

  beforeSubtotal(): number {
    this.ensureParsed();
    return this._parsedBefore?.subtotal ?? 0;
  }

  afterSubtotal(): number {
    this.ensureParsed();
    return this._parsedAfter?.subtotal ?? 0;
  }

  /**
   * Pay / Checkout / OrderCompleted / OrderDelivered / OrderPickedup all
   * populate only the "After" snapshot — Before stays 0. Show those as a
   * single "Money snapshot" line instead of three confusing "0 → X" rows.
   */
  showFinalsOnly(): boolean {
    const r = this.row;
    const finalsOnlyActions = new Set([
      'Pay', 'Checkout', 'CheckOut',
      'OrderCompleted', 'OrderDelivered', 'OrderPickedup',
      'CollectMoney',
    ]);
    if (!finalsOnlyActions.has(r.actionType)) return false;
    const beforeAllZero =
      (r.totalSalesBefore ?? 0) === 0 &&
      (r.netBefore ?? 0) === 0 &&
      (r.totalBefore ?? 0) === 0;
    const hasAfter =
      (r.totalSalesAfter ?? 0) > 0 ||
      (r.netAfter ?? 0) > 0 ||
      (r.totalAfter ?? 0) > 0;
    return beforeAllZero && hasAfter;
  }
}
