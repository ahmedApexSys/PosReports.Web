import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
  computed,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideAngularModule,
  Filter,
  X,
  ChevronDown,
  CalendarRange,
  CalendarDays,
  Clock,
  CreditCard,
  Users,
  Search,
  Settings2,
  LayoutGrid,
} from 'lucide-angular';
import { LanguageService } from '../../core/i18n/language.service';
import { FilterService, DatePresetKey, Grouping } from '../../core/filters/filter.service';
import { FilterPickerApi } from '../../core/api/filter-picker.api';
import { PickerItem } from '../../core/models/picker.models';
import {
  PaymentStatusFilter,
  Surface,
  TRANSACTION_TYPES,
  COMMON_ACTION_TYPES,
  ACTION_TYPE_TRANSACTION_SCOPE,
  DATE_PRESETS,
} from '../../core/models/audit.models';
import { PickerComponent } from '../picker/picker.component';

/**
 * Comprehensive filter bar shown above the body in `AuditReportPageComponent`.
 * Owns every page-local filter signal the audit DTOs accept. Emits a
 * `(filtersChange)` event whenever any signal changes; the page shell
 * listens and re-fires the fetch with the new context.
 *
 * Layout — a responsive 2-column card grid that breaks each filter
 * dimension into its own titled card (Period / Grouping / Transaction /
 * Payment / Surface / User+Search / Actions). Replaces the older flat
 * row stack — cleaner hierarchy, better scanability, RTL-aware.
 */
@Component({
  selector: 'app-audit-filter-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, PickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Outer container -->
    <div class="card-padded bg-gradient-to-b from-slate-50 to-white
                dark:from-surface-dark-muted/40 dark:to-surface-dark-muted/10
                ring-1 ring-slate-200 dark:ring-slate-800
                shadow-sm">

      <!-- Toggle header -->
      <button type="button" (click)="open.set(!open())"
              class="flex items-center justify-between w-full
                     text-sm font-semibold text-slate-700 dark:text-slate-200
                     group transition-colors duration-180">
        <span class="flex items-center gap-2.5">
          <span class="inline-flex h-7 w-7 items-center justify-center
                       rounded-card-sm bg-brand-50 dark:bg-brand-900/30
                       ring-1 ring-brand-100 dark:ring-brand-800/50">
            <lucide-icon [img]="FilterIcon"
                         class="h-4 w-4 text-brand-700 dark:text-brand-300"></lucide-icon>
          </span>
          <span class="text-base font-bold">
            {{ lang.language() === 'ar' ? 'الفلاتر' : 'Filters' }}
          </span>
          <span *ngIf="activeCount() > 0"
                class="pill-info text-[10px] px-1.5 py-0.5">
            {{ activeCount() }}
          </span>
          <!-- Live summary of which filter dimensions are active -->
          <span *ngIf="activeCount() > 0 && !open()"
                class="hidden md:inline text-xs font-normal text-slate-400 dark:text-slate-500 truncate max-w-[420px]">
            · {{ summary() }}
          </span>
        </span>
        <span class="flex items-center gap-2">
          <span class="hidden md:inline text-[11px] font-medium text-slate-400 dark:text-slate-500">
            {{ open()
                ? (lang.language() === 'ar' ? 'إخفاء' : 'Hide')
                : (lang.language() === 'ar' ? 'إظهار' : 'Show') }}
          </span>
          <lucide-icon [img]="ChevronIcon" class="h-4 w-4 text-slate-400"
                       [class.rotate-180]="open()"
                       style="transition: transform 220ms cubic-bezier(0.4, 0, 0.2, 1);"></lucide-icon>
        </span>
      </button>

      <!-- Body — modern card grid -->
      <div *ngIf="open()" class="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">

        <!-- ── Card 1: Period (spans full width) ─────────────────────────-->
        <div class="lg:col-span-2 rounded-card-sm ring-1 ring-slate-200 dark:ring-slate-800
                    bg-white/80 dark:bg-surface-dark-subtle/60 p-3 backdrop-blur-sm">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div class="flex items-center gap-2">
              <lucide-icon [img]="CalendarRangeIcon"
                           class="h-4 w-4 text-slate-500 dark:text-slate-400"></lucide-icon>
              <span class="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                {{ lang.language() === 'ar' ? 'الفترة' : 'Period' }}
              </span>
            </div>
            <span *ngIf="dateValidationMsg()" class="text-[11px] text-warning">
              {{ dateValidationMsg() }}
            </span>
          </div>

          <!-- Preset chips -->
          <div class="flex items-center gap-1.5 flex-wrap mt-3">
            <button *ngFor="let p of datePresets" type="button"
                    (click)="applyPreset(p.key)"
                    class="px-2.5 py-1 rounded-card-sm text-[11px] font-medium ring-1
                           transition-all duration-180"
                    [class.bg-brand-600]="activePreset() === p.key"
                    [class.text-white]="activePreset() === p.key"
                    [class.ring-brand-600]="activePreset() === p.key"
                    [class.shadow-sm]="activePreset() === p.key"
                    [class.bg-white]="activePreset() !== p.key"
                    [class.dark:bg-surface-dark-subtle]="activePreset() !== p.key"
                    [class.text-slate-700]="activePreset() !== p.key"
                    [class.dark:text-slate-200]="activePreset() !== p.key"
                    [class.ring-slate-200]="activePreset() !== p.key"
                    [class.dark:ring-slate-700]="activePreset() !== p.key"
                    [class.hover:ring-brand-300]="activePreset() !== p.key">
              {{ lang.language() === 'ar' ? p.labelAr : p.labelEn }}
            </button>
          </div>

          <!-- Custom range inputs -->
          <div class="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/50">
            <span class="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {{ lang.language() === 'ar' ? 'من' : 'From' }}
            </span>
            <input type="datetime-local"
                   [ngModel]="fromLocal()" (ngModelChange)="onFromChange($event)"
                   class="bg-white dark:bg-surface-dark-subtle
                          border border-slate-200 dark:border-slate-700
                          rounded-card-sm px-2.5 py-1.5 text-xs tabular
                          focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
                          focus:outline-none transition-shadow duration-180"/>
            <span class="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {{ lang.language() === 'ar' ? 'إلى' : 'To' }}
            </span>
            <input type="datetime-local"
                   [ngModel]="toLocal()" (ngModelChange)="onToChange($event)"
                   class="bg-white dark:bg-surface-dark-subtle
                          border border-slate-200 dark:border-slate-700
                          rounded-card-sm px-2.5 py-1.5 text-xs tabular
                          focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
                          focus:outline-none transition-shadow duration-180"/>
          </div>
        </div>

        <!-- ── Card 2: Grouping (NEW) ─────────────────────────────────────-->
        <div class="rounded-card-sm ring-1 ring-slate-200 dark:ring-slate-800
                    bg-white/80 dark:bg-surface-dark-subtle/60 p-3 backdrop-blur-sm">
          <div class="flex items-center gap-2 mb-3">
            <lucide-icon [img]="GroupingIcon"
                         class="h-4 w-4 text-slate-500 dark:text-slate-400"></lucide-icon>
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              {{ lang.language() === 'ar' ? 'التجميع' : 'Grouping' }}
            </span>
            <span class="text-[10px] text-slate-400 dark:text-slate-500">
              ({{ lang.language() === 'ar' ? 'محور الوقت' : 'time bucket' }})
            </span>
          </div>
          <!-- Segmented control -->
          <div class="inline-flex rounded-card-sm bg-slate-100 dark:bg-surface-dark-muted/40
                      p-0.5 ring-1 ring-slate-200 dark:ring-slate-800"
               role="radiogroup">
            <button *ngFor="let g of groupings" type="button"
                    role="radio"
                    [attr.aria-checked]="filter.grouping() === g.value"
                    (click)="setGrouping(g.value)"
                    class="px-3 py-1 rounded-card-sm text-[11px] font-semibold
                           transition-all duration-180"
                    [class.bg-white]="filter.grouping() === g.value"
                    [class.dark:bg-surface-dark-subtle]="filter.grouping() === g.value"
                    [class.text-brand-700]="filter.grouping() === g.value"
                    [class.dark:text-brand-300]="filter.grouping() === g.value"
                    [class.shadow-sm]="filter.grouping() === g.value"
                    [class.ring-1]="filter.grouping() === g.value"
                    [class.ring-brand-200]="filter.grouping() === g.value"
                    [class.dark:ring-brand-800]="filter.grouping() === g.value"
                    [class.text-slate-500]="filter.grouping() !== g.value"
                    [class.dark:text-slate-400]="filter.grouping() !== g.value"
                    [class.hover:text-slate-700]="filter.grouping() !== g.value">
              {{ lang.language() === 'ar' ? g.labelAr : g.labelEn }}
            </button>
          </div>
        </div>

        <!-- ── Card 3: Payment status ─────────────────────────────────────-->
        <div class="rounded-card-sm ring-1 ring-slate-200 dark:ring-slate-800
                    bg-white/80 dark:bg-surface-dark-subtle/60 p-3 backdrop-blur-sm">
          <div class="flex items-center gap-2 mb-3">
            <lucide-icon [img]="CreditCardIcon"
                         class="h-4 w-4 text-slate-500 dark:text-slate-400"></lucide-icon>
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              {{ lang.language() === 'ar' ? 'حالة الدفع' : 'Payment status' }}
            </span>
          </div>
          <div class="inline-flex rounded-card-sm bg-slate-100 dark:bg-surface-dark-muted/40
                      p-0.5 ring-1 ring-slate-200 dark:ring-slate-800"
               role="radiogroup">
            <button *ngFor="let p of paymentOptions" type="button"
                    role="radio"
                    [attr.aria-checked]="paymentStatus() === p.value"
                    (click)="paymentStatus.set(p.value); emit()"
                    class="px-3 py-1 rounded-card-sm text-[11px] font-semibold
                           transition-all duration-180"
                    [class.bg-white]="paymentStatus() === p.value"
                    [class.dark:bg-surface-dark-subtle]="paymentStatus() === p.value"
                    [class.text-brand-700]="paymentStatus() === p.value"
                    [class.dark:text-brand-300]="paymentStatus() === p.value"
                    [class.shadow-sm]="paymentStatus() === p.value"
                    [class.ring-1]="paymentStatus() === p.value"
                    [class.ring-brand-200]="paymentStatus() === p.value"
                    [class.dark:ring-brand-800]="paymentStatus() === p.value"
                    [class.text-slate-500]="paymentStatus() !== p.value"
                    [class.dark:text-slate-400]="paymentStatus() !== p.value">
              {{ lang.language() === 'ar' ? p.labelAr : p.labelEn }}
            </button>
          </div>
        </div>

        <!-- ── Card 4: Transaction type ───────────────────────────────────-->
        <div class="rounded-card-sm ring-1 ring-slate-200 dark:ring-slate-800
                    bg-white/80 dark:bg-surface-dark-subtle/60 p-3 backdrop-blur-sm">
          <div class="flex items-center justify-between gap-2 mb-3">
            <div class="flex items-center gap-2">
              <lucide-icon [img]="LayoutGridIcon"
                           class="h-4 w-4 text-slate-500 dark:text-slate-400"></lucide-icon>
              <span class="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                {{ lang.language() === 'ar' ? 'نوع المعاملة' : 'Transaction' }}
              </span>
            </div>
            <span *ngIf="transactionTypes().length > 0"
                  class="text-[10px] text-brand-600 dark:text-brand-400 font-medium">
              {{ transactionTypes().length }} {{ lang.language() === 'ar' ? 'محدد' : 'selected' }}
            </span>
          </div>
          <div class="flex items-center gap-1.5 flex-wrap">
            <button *ngFor="let t of trxTypes" type="button"
                    (click)="toggleTrx(t.id)"
                    class="px-2.5 py-1 rounded-card-sm text-[11px] font-medium ring-1
                           transition-all duration-180"
                    [class.bg-brand-600]="hasTrx(t.id)"
                    [class.text-white]="hasTrx(t.id)"
                    [class.ring-brand-600]="hasTrx(t.id)"
                    [class.shadow-sm]="hasTrx(t.id)"
                    [class.bg-white]="!hasTrx(t.id)"
                    [class.dark:bg-surface-dark-subtle]="!hasTrx(t.id)"
                    [class.text-slate-600]="!hasTrx(t.id)"
                    [class.dark:text-slate-300]="!hasTrx(t.id)"
                    [class.ring-slate-200]="!hasTrx(t.id)"
                    [class.dark:ring-slate-700]="!hasTrx(t.id)"
                    [class.hover:ring-brand-300]="!hasTrx(t.id)">
              {{ lang.language() === 'ar' ? t.nameAr : t.nameEn }}
            </button>
          </div>
        </div>

        <!-- ── Card 5: Surface ────────────────────────────────────────────-->
        <div class="rounded-card-sm ring-1 ring-slate-200 dark:ring-slate-800
                    bg-white/80 dark:bg-surface-dark-subtle/60 p-3 backdrop-blur-sm">
          <div class="flex items-center justify-between gap-2 mb-3">
            <div class="flex items-center gap-2">
              <lucide-icon [img]="SettingsIcon"
                           class="h-4 w-4 text-slate-500 dark:text-slate-400"></lucide-icon>
              <span class="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                {{ lang.language() === 'ar' ? 'المصدر' : 'Surface' }}
              </span>
            </div>
            <span *ngIf="surfaces().length > 0"
                  class="text-[10px] text-brand-600 dark:text-brand-400 font-medium">
              {{ surfaces().length }} {{ lang.language() === 'ar' ? 'محدد' : 'selected' }}
            </span>
          </div>
          <div class="flex items-center gap-1.5 flex-wrap">
            <button *ngFor="let s of surfaceOptions" type="button"
                    (click)="toggleSurface(s.value)"
                    class="px-2.5 py-1 rounded-card-sm text-[11px] font-medium ring-1
                           transition-all duration-180"
                    [class.bg-brand-600]="hasSurface(s.value)"
                    [class.text-white]="hasSurface(s.value)"
                    [class.ring-brand-600]="hasSurface(s.value)"
                    [class.shadow-sm]="hasSurface(s.value)"
                    [class.bg-white]="!hasSurface(s.value)"
                    [class.dark:bg-surface-dark-subtle]="!hasSurface(s.value)"
                    [class.text-slate-600]="!hasSurface(s.value)"
                    [class.dark:text-slate-300]="!hasSurface(s.value)"
                    [class.ring-slate-200]="!hasSurface(s.value)"
                    [class.dark:ring-slate-700]="!hasSurface(s.value)"
                    [class.hover:ring-brand-300]="!hasSurface(s.value)">
              {{ lang.language() === 'ar' ? s.labelAr : s.labelEn }}
            </button>
          </div>
        </div>

        <!-- ── Card 6: User + Search (full width on lg) ──────────────────-->
        <div class="lg:col-span-2 rounded-card-sm ring-1 ring-slate-200 dark:ring-slate-800
                    bg-white/80 dark:bg-surface-dark-subtle/60 p-3 backdrop-blur-sm">
          <div class="flex items-center gap-2 mb-3">
            <lucide-icon [img]="UsersIcon"
                         class="h-4 w-4 text-slate-500 dark:text-slate-400"></lucide-icon>
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              {{ lang.language() === 'ar' ? 'مستخدم وبحث' : 'User & search' }}
            </span>
          </div>
          <div class="flex items-center gap-3 flex-wrap">
            <div class="flex-1 min-w-[200px] max-w-[320px]">
              <app-picker
                titleEn="All users" titleAr="كل المستخدمين"
                [items]="users()"
                [selectedId]="userId()"
                [loading]="usersLoading()"
                (selectedIdChange)="onUserChange($event)"></app-picker>
            </div>
            <div class="flex-1 min-w-[200px] relative">
              <lucide-icon [img]="SearchIcon"
                           class="h-3.5 w-3.5 text-slate-400 absolute top-1/2 -translate-y-1/2 start-2.5 pointer-events-none"></lucide-icon>
              <input type="text" [(ngModel)]="searchTextDraft"
                     (keyup.enter)="applySearch()"
                     [placeholder]="lang.language() === 'ar' ? 'ابحث في الوصف... (Enter)' : 'Search descriptions... (Enter)'"
                     class="w-full bg-white dark:bg-surface-dark-subtle
                            border border-slate-200 dark:border-slate-700
                            rounded-card-sm ps-8 pe-2.5 py-1.5 text-xs
                            focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
                            focus:outline-none transition-shadow duration-180"/>
            </div>
          </div>
        </div>

        <!-- ── Card 7: Action types (full width) ─────────────────────────-->
        <div class="lg:col-span-2 rounded-card-sm ring-1 ring-slate-200 dark:ring-slate-800
                    bg-white/80 dark:bg-surface-dark-subtle/60 p-3 backdrop-blur-sm">
          <div class="flex items-center justify-between gap-2 mb-3">
            <div class="flex items-center gap-2">
              <lucide-icon [img]="ClockIcon"
                           class="h-4 w-4 text-slate-500 dark:text-slate-400"></lucide-icon>
              <span class="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                {{ lang.language() === 'ar' ? 'نوع الإجراء' : 'Action types' }}
              </span>
              <span *ngIf="transactionTypes().length > 0"
                    class="text-[10px] text-slate-400 dark:text-slate-500">
                ({{ lang.language() === 'ar'
                    ? 'مفلتر حسب نوع المعاملة'
                    : 'filtered by transaction' }})
              </span>
            </div>
            <span *ngIf="actionTypes().length > 0"
                  class="text-[10px] text-brand-600 dark:text-brand-400 font-medium">
              {{ actionTypes().length }} {{ lang.language() === 'ar' ? 'محدد' : 'selected' }}
            </span>
          </div>
          <div class="flex items-center gap-1.5 flex-wrap">
            <button *ngFor="let a of visibleActionChips()" type="button"
                    (click)="toggleAction(a)"
                    class="px-2 py-0.5 rounded-card-sm text-[11px] font-medium ring-1
                           transition-all duration-180"
                    [class.bg-brand-600]="hasAction(a)"
                    [class.text-white]="hasAction(a)"
                    [class.ring-brand-600]="hasAction(a)"
                    [class.shadow-sm]="hasAction(a)"
                    [class.bg-white]="!hasAction(a)"
                    [class.dark:bg-surface-dark-subtle]="!hasAction(a)"
                    [class.text-slate-600]="!hasAction(a)"
                    [class.dark:text-slate-300]="!hasAction(a)"
                    [class.ring-slate-200]="!hasAction(a)"
                    [class.dark:ring-slate-700]="!hasAction(a)"
                    [class.hover:ring-brand-300]="!hasAction(a)">
              {{ a }}
            </button>
          </div>
        </div>

        <!-- ── Footer: clear all ────────────────────────────────────────-->
        <div *ngIf="activeCount() > 0"
             class="lg:col-span-2 flex items-center justify-between gap-3
                    pt-3 border-t border-slate-200 dark:border-slate-800">
          <span class="text-[11px] text-slate-500 dark:text-slate-400">
            {{ activeCount() }} {{ lang.language() === 'ar' ? 'فلتر فعّال' : 'active filter(s)' }}
          </span>
          <button type="button" (click)="clearAll()"
                  class="inline-flex items-center gap-1.5 px-2.5 py-1
                         rounded-card-sm text-[11px] font-medium
                         text-slate-600 dark:text-slate-300
                         hover:text-critical hover:bg-critical-soft
                         ring-1 ring-slate-200 dark:ring-slate-700
                         hover:ring-critical/30
                         transition-all duration-180">
            <lucide-icon [img]="XIcon" class="h-3 w-3"></lucide-icon>
            {{ lang.language() === 'ar' ? 'مسح كل الفلاتر' : 'Clear all filters' }}
          </button>
        </div>

      </div>
    </div>
  `,
})
export class AuditFilterBarComponent {
  @Input() open = signal(false);
  @Output() filtersChange = new EventEmitter<void>();

  readonly lang = inject(LanguageService);
  readonly filter = inject(FilterService);
  private readonly picker = inject(FilterPickerApi);

  // ── Public filter signals — the page shell reads these on each reload ──
  readonly transactionTypes = signal<number[]>([]);
  readonly paymentStatus = signal<PaymentStatusFilter>('All');
  readonly surfaces = signal<Surface[]>([]);
  readonly userId = signal<string | null>(null);
  readonly actionTypes = signal<string[]>([]);
  readonly searchText = signal<string>('');

  // Draft text — applied on Enter so we don't refire on every keystroke.
  searchTextDraft = '';

  // User picker state (loaded per branch)
  readonly users = signal<PickerItem[]>([]);
  readonly usersLoading = signal(false);

  readonly trxTypes = TRANSACTION_TYPES;
  readonly actionTypeOptions = COMMON_ACTION_TYPES;
  readonly datePresets = DATE_PRESETS;

  readonly surfaceOptions: { value: Surface; labelEn: string; labelAr: string }[] = [
    { value: 'Paid',         labelEn: 'Paid',         labelAr: 'مدفوع' },
    { value: 'Hospitality',  labelEn: 'Hospitality',  labelAr: 'هوسبيتاليتي' },
    { value: 'Office',       labelEn: 'Office',       labelAr: 'الأوفيس' },
    { value: 'Online',       labelEn: 'Online',       labelAr: 'أونلاين' },
    { value: 'Reservation',  labelEn: 'Reservation',  labelAr: 'الحجوزات' },
    { value: 'Kiosk',        labelEn: 'Kiosk',        labelAr: 'كيوسك' },
  ];

  readonly paymentOptions: { value: PaymentStatusFilter; labelEn: string; labelAr: string }[] = [
    { value: 'All',         labelEn: 'All',     labelAr: 'الكل' },
    { value: 'PaidOnly',    labelEn: 'Paid',    labelAr: 'مدفوع' },
    { value: 'UnpaidOnly',  labelEn: 'Unpaid',  labelAr: 'غير مدفوع' },
  ];

  readonly groupings: { value: Grouping; labelEn: string; labelAr: string }[] = [
    { value: 'day',   labelEn: 'Day',   labelAr: 'يوم' },
    { value: 'week',  labelEn: 'Week',  labelAr: 'أسبوع' },
    { value: 'month', labelEn: 'Month', labelAr: 'شهر' },
    { value: 'year',  labelEn: 'Year',  labelAr: 'سنة' },
  ];

  readonly FilterIcon = Filter;
  readonly CalendarRangeIcon = CalendarRange;
  readonly GroupingIcon = CalendarDays;
  readonly CreditCardIcon = CreditCard;
  readonly LayoutGridIcon = LayoutGrid;
  readonly SettingsIcon = Settings2;
  readonly UsersIcon = Users;
  readonly SearchIcon = Search;
  readonly ClockIcon = Clock;
  readonly XIcon = X;
  readonly ChevronIcon = ChevronDown;

  // ── Date range derived from global FilterService ──────────────────
  /** From-date as a `datetime-local` input value (YYYY-MM-DDTHH:mm). */
  readonly fromLocal = computed(() => this.toDatetimeLocal(this.filter.fromDate()));
  readonly toLocal   = computed(() => this.toDatetimeLocal(this.filter.toDate()));

  /** Detect which preset (if any) matches the current range — so we can
   *  highlight the right preset chip. */
  readonly activePreset = computed<DatePresetKey>(() => {
    const f = this.filter.fromDate();
    const t = this.filter.toDate();
    for (const p of DATE_PRESETS) {
      if (p.key === 'custom') continue;
      const range = this.filter.computePreset(p.key as DatePresetKey);
      if (range && range.from === f && range.to === t) return p.key as DatePresetKey;
    }
    return 'custom';
  });

  /** Bilingual validation message for the date inputs. */
  readonly dateValidationMsg = computed(() => this.filter.validateBilingual(this.lang.language()));

  /**
   * Action-type chips to render. When at least one transaction type is
   * selected, narrow to actions whose scope is 'all' OR includes one of
   * the selected transaction-type ids.
   */
  readonly visibleActionChips = computed<readonly string[]>(() => {
    const picked = this.transactionTypes();
    if (picked.length === 0) return this.actionTypeOptions;
    return this.actionTypeOptions.filter((a) => {
      const scope = ACTION_TYPE_TRANSACTION_SCOPE[a];
      if (scope === 'all' || scope === undefined) return true;
      return picked.some((id) => scope.includes(id));
    });
  });

  /** Count of active filter dimensions — drives the badge on the toggle header. */
  readonly activeCount = computed<number>(() => {
    let n = 0;
    if (this.transactionTypes().length) n++;
    if (this.paymentStatus() !== 'All') n++;
    if (this.surfaces().length) n++;
    if (this.userId()) n++;
    if (this.actionTypes().length) n++;
    if (this.searchText()) n++;
    return n;
  });

  /** Short readable summary shown in the collapsed header (e.g. "Paid · DineIn · 2 users"). */
  readonly summary = computed<string>(() => {
    const parts: string[] = [];
    const ar = this.lang.language() === 'ar';
    if (this.transactionTypes().length)
      parts.push(`${this.transactionTypes().length} ${ar ? 'معاملة' : 'tx'}`);
    if (this.paymentStatus() !== 'All')
      parts.push(this.paymentStatus() === 'PaidOnly' ? (ar ? 'مدفوع' : 'paid') : (ar ? 'غير مدفوع' : 'unpaid'));
    if (this.surfaces().length)
      parts.push(`${this.surfaces().length} ${ar ? 'مصدر' : 'surface'}`);
    if (this.userId())
      parts.push(ar ? 'مستخدم محدد' : '1 user');
    if (this.actionTypes().length)
      parts.push(`${this.actionTypes().length} ${ar ? 'إجراء' : 'action'}`);
    if (this.searchText())
      parts.push(ar ? `بحث: "${this.searchText()}"` : `"${this.searchText()}"`);
    return parts.join(' · ');
  });

  constructor() {
    // Reload user list whenever branch OR the picked transaction type
    // changes. When exactly one transaction type is selected we ask the
    // picker to filter users to the roles that legitimately handle that
    // transaction.
    effect(() => {
      const branchId = this.filter.branchId();
      const txTypes  = this.transactionTypes();
      const singleTxType = txTypes.length === 1 ? txTypes[0] : null;
      this.users.set([]);
      this.userId.set(null);
      if (branchId != null && branchId > 0) {
        this.usersLoading.set(true);
        this.picker.users({
          branchId,
          transactionTypeId: singleTxType,
        }).subscribe((list) => {
          this.users.set(list);
          this.usersLoading.set(false);
        });
      }
    });
  }

  // ── Toggles ──────────────────────────────────────────────────────
  hasTrx(id: number): boolean { return this.transactionTypes().includes(id); }
  toggleTrx(id: number): void {
    const cur = this.transactionTypes();
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    this.transactionTypes.set(next);
    if (next.length > 0 && this.actionTypes().length > 0) {
      const visible = new Set(this.visibleActionChips());
      const kept = this.actionTypes().filter((a) => visible.has(a));
      if (kept.length !== this.actionTypes().length) this.actionTypes.set(kept);
    }
    this.emit();
  }

  hasSurface(s: Surface): boolean { return this.surfaces().includes(s); }
  toggleSurface(s: Surface): void {
    const cur = this.surfaces();
    this.surfaces.set(cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]);
    this.emit();
  }

  hasAction(a: string): boolean { return this.actionTypes().includes(a); }
  toggleAction(a: string): void {
    const cur = this.actionTypes();
    this.actionTypes.set(cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]);
    this.emit();
  }

  onUserChange(id: string | null): void {
    this.userId.set(id);
    this.emit();
  }

  applySearch(): void {
    this.searchText.set(this.searchTextDraft.trim());
    this.emit();
  }

  setGrouping(g: Grouping): void {
    this.filter.setGrouping(g);
    this.emit();
  }

  // ── Date range handlers ──────────────────────────────────────────
  applyPreset(key: DatePresetKey): void {
    if (key === 'custom') return;
    this.filter.applyPreset(key);
    this.emit();
  }

  onFromChange(value: string): void {
    const iso = this.fromDatetimeLocal(value);
    if (iso) {
      this.filter.setDateRange(iso, this.filter.toDate());
      this.emit();
    }
  }

  onToChange(value: string): void {
    const iso = this.fromDatetimeLocal(value);
    if (iso) {
      this.filter.setDateRange(this.filter.fromDate(), iso);
      this.emit();
    }
  }

  /** Convert ISO (UTC) → "YYYY-MM-DDTHH:mm" for <input datetime-local>. */
  private toDatetimeLocal(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /**
   * Convert "YYYY-MM-DDTHH:mm" (datetime-local, already local-wall-clock)
   * to a LOCAL-NAIVE string ("YYYY-MM-DDTHH:mm:ss", no `Z`). NEVER emit a
   * UTC/`toISOString()` value — that trailing-Z poisons the shared
   * FilterService state (read raw by many report components) and re-introduces
   * the day-boundary off-by-one in Egypt (UTC+2/+3).
   */
  private fromDatetimeLocal(value: string): string | null {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : this.filter.localIso(d);
  }

  clearAll(): void {
    this.transactionTypes.set([]);
    this.paymentStatus.set('All');
    this.surfaces.set([]);
    this.userId.set(null);
    this.actionTypes.set([]);
    this.searchText.set('');
    this.searchTextDraft = '';
    this.emit();
  }

  emit(): void { this.filtersChange.emit(); }
}
