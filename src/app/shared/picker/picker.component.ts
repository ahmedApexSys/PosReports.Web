import {
  Component,
  Input,
  Output,
  EventEmitter,
  computed,
  signal,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, ChevronDown, Search, X } from 'lucide-angular';
import { LanguageService } from '../../core/i18n/language.service';
import { PickerItem } from '../../core/models/picker.models';

/**
 * Generic dropdown picker — given a `PickerItem[]` list, renders a
 * bilingual searchable dropdown and emits the chosen id.
 *
 * Pattern matches BranchPickerComponent but is generic so any report
 * page can reuse it (pilot, user, waiter, cashier filters).
 *
 * Inputs:
 *   - titleEn / titleAr  – bilingual label shown on the trigger when nothing is selected
 *   - items              – the list to render
 *   - selectedId         – currently-selected id (one-way binding)
 *   - loading            – show a "Loading…" placeholder
 *   - required           – when true + nothing picked, the trigger gets a yellow ring
 *
 * Output:
 *   - selectedIdChange   – emits when the user picks an item or clears
 */
@Component({
  selector: 'app-picker',
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
                     px-3 py-1.5 text-sm font-medium
                     text-slate-700 dark:text-slate-200
                     hover:bg-slate-50 dark:hover:bg-surface-dark-muted
                     transition-colors duration-180
                     min-w-[180px] justify-between"
              [class.ring-2]="required && !selected()"
              [class.ring-warning]="required && !selected()"
              [class.ring-warning\\\\/40]="required && !selected()">
        <span class="flex items-center gap-2 truncate">
          <span *ngIf="selected() as s" class="truncate">{{ label(s) }}</span>
          <span *ngIf="!selected()"
                class="truncate"
                [class.text-warning]="required"
                [class.font-semibold]="required">
            {{ lang.language() === 'ar' ? titleAr : titleEn }}
          </span>
        </span>
        <lucide-icon [img]="ChevronIcon" class="h-3.5 w-3.5 shrink-0 text-slate-400"
                     [class.rotate-180]="open()"
                     style="transition: transform 180ms ease-out;"></lucide-icon>
      </button>

      <!-- Dropdown -->
      <div *ngIf="open()"
           class="absolute end-0 top-full mt-1 z-50
                  w-72 max-w-[90vw]
                  rounded-card bg-white dark:bg-surface-dark-subtle
                  shadow-card-dk ring-1 ring-slate-200 dark:ring-slate-700
                  overflow-hidden">
        <!-- Search -->
        <div class="p-2 border-b border-slate-200 dark:border-slate-700">
          <div class="relative">
            <lucide-icon [img]="SearchIcon"
                         class="absolute start-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400"></lucide-icon>
            <input type="text" [(ngModel)]="search"
                   class="w-full ps-7 pe-7 py-1 text-sm
                          rounded-card-sm bg-slate-50 dark:bg-surface-dark-muted
                          border-0 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                   [placeholder]="lang.language() === 'ar' ? 'ابحث...' : 'Search...'"/>
            <button *ngIf="search" (click)="search = ''" type="button"
                    class="absolute end-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <lucide-icon [img]="XIcon" class="h-3 w-3"></lucide-icon>
            </button>
          </div>
        </div>

        <!-- Loading -->
        <div *ngIf="loading" class="p-4 text-center text-xs text-slate-500">
          {{ lang.language() === 'ar' ? 'جاري التحميل...' : 'Loading...' }}
        </div>

        <!-- List -->
        <div *ngIf="!loading" class="max-h-64 overflow-y-auto py-1">
          <button *ngIf="selected() && !required"
                  type="button" (click)="pick(null)"
                  class="w-full px-3 py-1.5 text-sm text-start
                         flex items-center gap-2
                         text-slate-500 dark:text-slate-400
                         hover:bg-slate-50 dark:hover:bg-surface-dark-muted">
            <lucide-icon [img]="XIcon" class="h-3 w-3"></lucide-icon>
            {{ lang.language() === 'ar' ? 'مسح الاختيار' : 'Clear selection' }}
          </button>

          <div *ngIf="filtered().length === 0"
               class="p-3 text-center text-xs text-slate-500">
            {{ lang.language() === 'ar' ? 'لا توجد نتائج' : 'No results' }}
          </div>

          <button *ngFor="let it of filtered()"
                  type="button"
                  (click)="pick(it.id)"
                  class="w-full px-3 py-1.5 text-sm text-start
                         flex items-center justify-between gap-2
                         hover:bg-slate-50 dark:hover:bg-surface-dark-muted
                         transition-colors duration-120"
                  [class.bg-brand-50]="selectedId === it.id"
                  [class.dark:bg-brand-900\\\\/20]="selectedId === it.id">
            <span class="flex-1 truncate text-slate-900 dark:text-slate-100">
              {{ label(it) }}
            </span>
            <span *ngIf="it.extra" class="text-xs text-slate-400 truncate max-w-[40%]">
              {{ it.extra }}
            </span>
          </button>
        </div>
      </div>
    </div>
  `,
})
export class PickerComponent {
  @Input({ required: true }) titleEn!: string;
  @Input({ required: true }) titleAr!: string;
  @Input() items: PickerItem[] = [];
  @Input() selectedId: string | null = null;
  @Input() loading = false;
  @Input() required = false;
  @Output() selectedIdChange = new EventEmitter<string | null>();

  readonly lang = inject(LanguageService);
  readonly open = signal(false);
  search = '';

  readonly ChevronIcon = ChevronDown;
  readonly SearchIcon = Search;
  readonly XIcon = X;

  readonly selected = computed<PickerItem | undefined>(() => {
    if (!this.selectedId) return undefined;
    return this.items.find((it) => it.id === this.selectedId);
  });

  readonly filtered = computed<PickerItem[]>(() => {
    if (!this.search) return this.items;
    const q = this.search.toLowerCase().trim();
    return this.items.filter((it) =>
      (it.nameEn ?? '').toLowerCase().includes(q) ||
      (it.nameAr ?? '').includes(q) ||
      (it.extra ?? '').toLowerCase().includes(q) ||
      (it.id ?? '').toLowerCase().includes(q));
  });

  label(it: PickerItem): string {
    return this.lang.language() === 'ar'
      ? (it.nameAr || it.nameEn || it.id)
      : (it.nameEn || it.nameAr || it.id);
  }

  pick(id: string | null): void {
    this.selectedId = id;
    this.selectedIdChange.emit(id);
    this.open.set(false);
    this.search = '';
  }

  constructor() {
    // Close on outside click
    if (typeof document !== 'undefined') {
      document.addEventListener('click', () => this.open.set(false));
    }
  }
}
