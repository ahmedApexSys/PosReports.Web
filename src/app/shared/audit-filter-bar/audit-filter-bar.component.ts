import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Filter, X, ChevronDown } from 'lucide-angular';
import { LanguageService } from '../../core/i18n/language.service';
import { FilterService } from '../../core/filters/filter.service';
import { FilterPickerApi } from '../../core/api/filter-picker.api';
import { PickerItem } from '../../core/models/picker.models';
import {
  PaymentStatusFilter,
  Surface,
  TRANSACTION_TYPES,
  COMMON_ACTION_TYPES,
} from '../../core/models/audit.models';
import { PickerComponent } from '../picker/picker.component';

/**
 * Comprehensive filter bar shown above the body in `AuditReportPageComponent`.
 * Owns every page-local filter signal the audit DTOs accept. Emits a
 * `(filtersChange)` event whenever any signal changes; the page shell
 * listens and re-fires the fetch with the new context.
 *
 * Layout — collapsible chip set; click "Filters" to expand. Mirrors the
 * pattern in the Phase 8 BI dashboard.
 */
@Component({
  selector: 'app-audit-filter-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, PickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card-padded bg-slate-50 dark:bg-surface-dark-muted/40 ring-1 ring-slate-200 dark:ring-slate-800">
      <!-- Toggle header -->
      <button type="button" (click)="open.set(!open())"
              class="flex items-center justify-between w-full text-sm font-semibold text-slate-700 dark:text-slate-200">
        <span class="flex items-center gap-2">
          <lucide-icon [img]="FilterIcon" class="h-4 w-4"></lucide-icon>
          {{ lang.language() === 'ar' ? 'الفلاتر' : 'Filters' }}
          <span *ngIf="activeCount() > 0"
                class="pill-info text-[10px] px-1.5 py-0.5">
            {{ activeCount() }}
          </span>
        </span>
        <lucide-icon [img]="ChevronIcon" class="h-4 w-4 text-slate-400"
                     [class.rotate-180]="open()"
                     style="transition: transform 180ms ease-out;"></lucide-icon>
      </button>

      <!-- Body -->
      <div *ngIf="open()" class="mt-4 space-y-4 text-sm">
        <!-- Row 1: Transaction types + Payment status -->
        <div class="flex items-center gap-3 flex-wrap">
          <span class="text-xs text-slate-500 dark:text-slate-400 min-w-[80px]">
            {{ lang.language() === 'ar' ? 'نوع المعاملة' : 'Transaction' }}:
          </span>
          <button *ngFor="let t of trxTypes" type="button"
                  (click)="toggleTrx(t.id)"
                  class="px-2.5 py-1 rounded-card-sm text-xs font-medium ring-1 transition-colors duration-180"
                  [class.bg-brand-600]="hasTrx(t.id)"
                  [class.text-white]="hasTrx(t.id)"
                  [class.ring-brand-600]="hasTrx(t.id)"
                  [class.bg-white]="!hasTrx(t.id)"
                  [class.dark:bg-surface-dark-subtle]="!hasTrx(t.id)"
                  [class.text-slate-700]="!hasTrx(t.id)"
                  [class.dark:text-slate-200]="!hasTrx(t.id)"
                  [class.ring-slate-300]="!hasTrx(t.id)"
                  [class.dark:ring-slate-700]="!hasTrx(t.id)">
            {{ lang.language() === 'ar' ? t.nameAr : t.nameEn }}
          </button>
        </div>

        <div class="flex items-center gap-3 flex-wrap">
          <span class="text-xs text-slate-500 dark:text-slate-400 min-w-[80px]">
            {{ lang.language() === 'ar' ? 'حالة الدفع' : 'Payment status' }}:
          </span>
          <select [ngModel]="paymentStatus()" (ngModelChange)="paymentStatus.set($event); emit()"
                  class="bg-white dark:bg-surface-dark-subtle border border-slate-300 dark:border-slate-700
                         rounded-card-sm px-2 py-1 text-xs">
            <option value="All">{{ lang.language() === 'ar' ? 'الكل' : 'All' }}</option>
            <option value="PaidOnly">{{ lang.language() === 'ar' ? 'المدفوع فقط' : 'Paid only' }}</option>
            <option value="UnpaidOnly">{{ lang.language() === 'ar' ? 'غير المدفوع فقط' : 'Unpaid only' }}</option>
          </select>
        </div>

        <!-- Row 3: Surfaces -->
        <div class="flex items-center gap-3 flex-wrap">
          <span class="text-xs text-slate-500 dark:text-slate-400 min-w-[80px]">
            {{ lang.language() === 'ar' ? 'المصدر' : 'Surface' }}:
          </span>
          <button *ngFor="let s of surfaceOptions" type="button"
                  (click)="toggleSurface(s.value)"
                  class="px-2.5 py-1 rounded-card-sm text-xs font-medium ring-1 transition-colors duration-180"
                  [class.bg-brand-600]="hasSurface(s.value)"
                  [class.text-white]="hasSurface(s.value)"
                  [class.ring-brand-600]="hasSurface(s.value)"
                  [class.bg-white]="!hasSurface(s.value)"
                  [class.dark:bg-surface-dark-subtle]="!hasSurface(s.value)"
                  [class.text-slate-700]="!hasSurface(s.value)"
                  [class.dark:text-slate-200]="!hasSurface(s.value)"
                  [class.ring-slate-300]="!hasSurface(s.value)"
                  [class.dark:ring-slate-700]="!hasSurface(s.value)">
            {{ lang.language() === 'ar' ? s.labelAr : s.labelEn }}
          </button>
        </div>

        <!-- Row 4: User picker + Search -->
        <div class="flex items-center gap-3 flex-wrap">
          <span class="text-xs text-slate-500 dark:text-slate-400 min-w-[80px]">
            {{ lang.language() === 'ar' ? 'مستخدم' : 'User' }}:
          </span>
          <app-picker
            titleEn="All users" titleAr="كل المستخدمين"
            [items]="users()"
            [selectedId]="userId()"
            [loading]="usersLoading()"
            (selectedIdChange)="onUserChange($event)"></app-picker>

          <span class="text-xs text-slate-500 dark:text-slate-400 ms-2">
            {{ lang.language() === 'ar' ? 'بحث' : 'Search' }}:
          </span>
          <input type="text" [(ngModel)]="searchTextDraft"
                 (keyup.enter)="applySearch()"
                 [placeholder]="lang.language() === 'ar' ? 'ابحث في الوصف...' : 'Search descriptions...'"
                 class="flex-1 min-w-[160px] max-w-[280px] bg-white dark:bg-surface-dark-subtle
                        border border-slate-300 dark:border-slate-700
                        rounded-card-sm px-2.5 py-1 text-xs
                        focus:ring-2 focus:ring-brand-500/30 focus:outline-none"/>
        </div>

        <!-- Row 5: Action types -->
        <div class="flex items-start gap-3 flex-wrap">
          <span class="text-xs text-slate-500 dark:text-slate-400 min-w-[80px] mt-1">
            {{ lang.language() === 'ar' ? 'نوع الإجراء' : 'Action types' }}:
          </span>
          <div class="flex items-center gap-1.5 flex-wrap flex-1">
            <button *ngFor="let a of actionTypeOptions" type="button"
                    (click)="toggleAction(a)"
                    class="px-2 py-0.5 rounded-card-sm text-[11px] font-medium ring-1 transition-colors duration-180"
                    [class.bg-brand-600]="hasAction(a)"
                    [class.text-white]="hasAction(a)"
                    [class.ring-brand-600]="hasAction(a)"
                    [class.bg-white]="!hasAction(a)"
                    [class.dark:bg-surface-dark-subtle]="!hasAction(a)"
                    [class.text-slate-600]="!hasAction(a)"
                    [class.dark:text-slate-300]="!hasAction(a)"
                    [class.ring-slate-300]="!hasAction(a)"
                    [class.dark:ring-slate-700]="!hasAction(a)">
              {{ a }}
            </button>
          </div>
        </div>

        <!-- Footer: clear all -->
        <div class="flex items-center justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
          <button type="button" (click)="clearAll()"
                  *ngIf="activeCount() > 0"
                  class="btn-ghost text-xs">
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
  readonly surfaceOptions: { value: Surface; labelEn: string; labelAr: string }[] = [
    { value: 'Paid',         labelEn: 'Paid',         labelAr: 'مدفوع' },
    { value: 'Hospitality',  labelEn: 'Hospitality',  labelAr: 'هوسبيتاليتي' },
    { value: 'Office',       labelEn: 'Office',       labelAr: 'الأوفيس' },
    { value: 'Online',       labelEn: 'Online',       labelAr: 'أونلاين' },
    { value: 'Reservation',  labelEn: 'Reservation',  labelAr: 'الحجوزات' },
    { value: 'Kiosk',        labelEn: 'Kiosk',        labelAr: 'كيوسك' },
  ];

  readonly FilterIcon = Filter;
  readonly XIcon = X;
  readonly ChevronIcon = ChevronDown;

  /** Count of active filter dimensions — drives the badge on the toggle header. */
  readonly activeCount = (): number => {
    let n = 0;
    if (this.transactionTypes().length) n++;
    if (this.paymentStatus() !== 'All') n++;
    if (this.surfaces().length) n++;
    if (this.userId()) n++;
    if (this.actionTypes().length) n++;
    if (this.searchText()) n++;
    return n;
  };

  constructor() {
    // Reload user list whenever branch changes.
    effect(() => {
      const branchId = this.filter.branchId();
      this.users.set([]);
      this.userId.set(null);
      if (branchId != null && branchId > 0) {
        this.usersLoading.set(true);
        this.picker.users(branchId).subscribe((list) => {
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
    this.transactionTypes.set(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
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
