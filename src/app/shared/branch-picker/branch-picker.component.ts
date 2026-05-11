import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Building2, ChevronDown, Search, X, RefreshCw, TriangleAlert } from 'lucide-angular';
import { BranchService } from '../../core/branches/branch.service';
import { FilterService } from '../../core/filters/filter.service';
import { LanguageService } from '../../core/i18n/language.service';
import { Branch } from '../../core/models/branch.models';

/**
 * Persistent branch picker shown in the shell header. Every report
 * is REQUIRED to have a selected branch before any data fetch — the
 * picker is the gate.
 *
 * - Loads branches from /api/Home/GetAllAvailableBranches on first render.
 * - User must select a branch explicitly; no default.
 * - Selection persists via FilterService (localStorage-backed).
 * - Search box filters by name (EN or AR).
 * - Stopped branches are excluded from the dropdown.
 */
@Component({
  selector: 'app-branch-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative" (click)="$event.stopPropagation()">
      <!-- Trigger -->
      <button type="button"
              (click)="open.set(!open())"
              class="inline-flex items-center gap-2 rounded-card-sm
                     border border-slate-300 dark:border-slate-700
                     bg-white dark:bg-surface-dark-subtle
                     px-3 py-2 text-sm font-medium
                     text-slate-700 dark:text-slate-200
                     hover:bg-slate-50 dark:hover:bg-surface-dark-muted
                     transition-colors duration-180
                     min-w-[180px] justify-between"
              [class.ring-2]="!selected()"
              [class.ring-warning]="!selected()"
              [class.ring-warning\\\\/40]="!selected()">
        <span class="flex items-center gap-2 truncate">
          <lucide-icon [img]="BuildingIcon" class="h-4 w-4 shrink-0"
                       [class.text-warning]="!selected()"
                       [class.text-brand-700]="selected()"></lucide-icon>
          <span *ngIf="selected() as b" class="truncate">{{ branchLabel(b) }}</span>
          <span *ngIf="!selected()" class="truncate text-warning font-semibold">
            {{ lang.language() === 'ar' ? 'اختر فرع' : 'Select a branch' }}
          </span>
        </span>
        <lucide-icon [img]="ChevronIcon" class="h-4 w-4 shrink-0 text-slate-400"
                     [class.rotate-180]="open()"
                     style="transition: transform 180ms ease-out;"></lucide-icon>
      </button>

      <!-- Dropdown -->
      <div *ngIf="open()"
           class="absolute end-0 top-full mt-1 z-50
                  w-80 max-w-[90vw]
                  rounded-card bg-white dark:bg-surface-dark-subtle
                  shadow-card-dk ring-1 ring-slate-200 dark:ring-slate-700
                  overflow-hidden">
        <!-- Search -->
        <div class="p-2 border-b border-slate-200 dark:border-slate-700">
          <div class="relative">
            <lucide-icon [img]="SearchIcon"
                         class="absolute start-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"></lucide-icon>
            <input type="text" [(ngModel)]="searchText"
                   class="w-full ps-8 pe-8 py-1.5 text-sm
                          rounded-card-sm bg-slate-50 dark:bg-surface-dark-muted
                          border-0 focus:ring-2 focus:ring-brand-500/30"
                   [placeholder]="lang.language() === 'ar' ? 'ابحث عن فرع...' : 'Search branch...'"/>
            <button *ngIf="searchText" (click)="searchText = ''" type="button"
                    class="absolute end-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <lucide-icon [img]="XIcon" class="h-3 w-3"></lucide-icon>
            </button>
          </div>
        </div>

        <!-- Loading -->
        <div *ngIf="branchService.loading()" class="p-6 text-center text-sm text-slate-500">
          {{ lang.language() === 'ar' ? 'جاري التحميل...' : 'Loading branches...' }}
        </div>

        <!-- Error -->
        <div *ngIf="!branchService.loading() && branchService.error() as err"
             class="p-4 text-center space-y-2">
          <div class="pill-critical text-xs justify-center py-1.5">
            <lucide-icon [img]="WarningIcon" class="h-3 w-3"></lucide-icon>
            {{ err }}
          </div>
          <button type="button" (click)="reload()" class="btn-ghost text-xs">
            <lucide-icon [img]="ReloadIcon" class="h-3 w-3"></lucide-icon>
            {{ lang.language() === 'ar' ? 'إعادة المحاولة' : 'Retry' }}
          </button>
        </div>

        <!-- List -->
        <div *ngIf="!branchService.loading() && !branchService.error()"
             class="max-h-72 overflow-y-auto py-1">
          <div *ngIf="filteredBranches().length === 0"
               class="p-4 text-center text-sm text-slate-500">
            {{ lang.language() === 'ar' ? 'مفيش فروع متاحة' : 'No branches available' }}
          </div>

          <button *ngFor="let b of filteredBranches()"
                  type="button"
                  (click)="select(b)"
                  class="w-full px-3 py-2 text-sm text-start
                         flex items-center justify-between gap-2
                         hover:bg-slate-50 dark:hover:bg-surface-dark-muted
                         transition-colors duration-120"
                  [class.bg-brand-50]="selected()?.id === b.id"
                  [class.dark:bg-brand-900\\\\/20]="selected()?.id === b.id">
            <span class="truncate">
              <span class="font-medium text-slate-900 dark:text-slate-100">
                {{ branchLabel(b) }}
              </span>
              <span *ngIf="b.id" class="text-xs text-slate-400 ms-2">#{{ b.id }}</span>
            </span>
            <span *ngIf="b.isStopped" class="pill-warning text-[10px] py-0.5">
              {{ lang.language() === 'ar' ? 'متوقف' : 'Stopped' }}
            </span>
          </button>
        </div>
      </div>
    </div>
  `,
})
export class BranchPickerComponent implements OnInit {
  readonly branchService = inject(BranchService);
  readonly filter = inject(FilterService);
  readonly lang = inject(LanguageService);

  readonly open = signal(false);
  searchText = '';

  readonly BuildingIcon = Building2;
  readonly ChevronIcon = ChevronDown;
  readonly SearchIcon = Search;
  readonly XIcon = X;
  readonly ReloadIcon = RefreshCw;
  readonly WarningIcon = TriangleAlert;

  readonly selected = computed<Branch | undefined>(() => {
    const id = this.filter.branchId();
    return this.branchService.findById(id);
  });

  readonly filteredBranches = computed<Branch[]>(() => {
    const list = this.branchService.activeBranches();
    if (!this.searchText) return list;
    const q = this.searchText.toLowerCase().trim();
    return list.filter(b =>
      (b.name_En ?? '').toLowerCase().includes(q) ||
      (b.name_Ar ?? '').includes(q) ||
      String(b.id).includes(q));
  });

  ngOnInit(): void {
    this.branchService.load().subscribe();
    // Close on outside click
    document.addEventListener('click', () => this.open.set(false));
  }

  select(b: Branch): void {
    this.filter.setBranch(b.id);
    this.open.set(false);
    this.searchText = '';
  }

  reload(): void {
    this.branchService.reload().subscribe();
  }

  branchLabel(b: Branch): string {
    return this.lang.language() === 'ar'
      ? (b.name_Ar || b.name_En || `Branch #${b.id}`)
      : (b.name_En || b.name_Ar || `Branch #${b.id}`);
  }
}
