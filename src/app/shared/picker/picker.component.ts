import {
  Component,
  input,
  output,
  computed,
  signal,
  inject,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, ChevronDown, Search, X, Check } from 'lucide-angular';
import { LanguageService } from '../../core/i18n/language.service';
import { PickerItem } from '../../core/models/picker.models';
import { PickerHubService } from './picker-hub.service';

/**
 * Generic bilingual searchable dropdown. Given a `PickerItem[]`, renders a
 * trigger that shows the current selection and a searchable popup list, and
 * emits the chosen id.
 *
 * All inputs are **signal inputs** — the previous version used a `computed()`
 * over plain `@Input` fields (`selectedId`, `items`, `search`), which never
 * recomputed, so the trigger never reflected the selection and the search box
 * did nothing. Signals fix both.
 *
 * Single-open behaviour is delegated to {@link PickerHubService} so two
 * dropdowns can never overlap.
 */
@Component({
  selector: 'app-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative w-full" (click)="$event.stopPropagation()">
      <!-- Trigger -->
      <button type="button" (click)="toggle($event)"
              class="group inline-flex w-full items-center justify-between gap-2
                     rounded-card-sm border bg-white dark:bg-surface-dark-subtle
                     px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200
                     hover:border-brand-300 dark:hover:border-brand-700
                     focus:outline-none transition-all duration-150"
              [ngClass]="{
                'border-slate-300 dark:border-slate-700': !open() && !(required() && !selected()),
                'border-brand-400 dark:border-brand-600 ring-2 ring-brand-500/30': open(),
                'border-warning ring-2 ring-warning/40': required() && !selected() && !open()
              }">
        <span class="flex min-w-0 items-center gap-2">
          <span *ngIf="selected()" class="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500"></span>
          <span *ngIf="selected() as s" class="truncate">{{ label(s) }}</span>
          <span *ngIf="!selected()" class="truncate"
                [class.text-warning]="required()"
                [class.font-semibold]="required()"
                [class.text-slate-400]="!required()"
                [class.dark:text-slate-500]="!required()">
            {{ lang.language() === 'ar' ? titleAr() : titleEn() }}
          </span>
        </span>
        <span class="flex shrink-0 items-center gap-0.5">
          <span *ngIf="selected() && !required()" (click)="clear($event)" role="button"
                class="rounded p-0.5 text-slate-400 hover:text-critical hover:bg-critical-soft transition-colors">
            <lucide-icon [img]="XIcon" class="h-3 w-3"></lucide-icon>
          </span>
          <lucide-icon [img]="ChevronIcon" class="h-3.5 w-3.5 text-slate-400"
                       [class.rotate-180]="open()"
                       style="transition: transform 180ms ease-out;"></lucide-icon>
        </span>
      </button>

      <!-- Dropdown -->
      <div *ngIf="open()"
           class="absolute start-0 top-full z-[60] mt-1.5 min-w-full max-w-[22rem] w-72
                  rounded-card bg-white dark:bg-surface-dark-subtle
                  shadow-card-dk ring-1 ring-slate-200 dark:ring-slate-700
                  overflow-hidden animate-fade-in">
        <!-- Search -->
        <div class="p-2 border-b border-slate-200 dark:border-slate-700">
          <div class="relative">
            <lucide-icon [img]="SearchIcon"
                         class="absolute start-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400"></lucide-icon>
            <input type="text" [ngModel]="search()" (ngModelChange)="search.set($event)"
                   class="w-full ps-7 pe-7 py-1.5 text-sm rounded-card-sm
                          bg-slate-50 dark:bg-surface-dark-muted text-slate-800 dark:text-slate-100
                          border-0 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
                   [placeholder]="lang.language() === 'ar' ? 'ابحث...' : 'Search...'"/>
            <button *ngIf="search()" (click)="search.set('')" type="button"
                    class="absolute end-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <lucide-icon [img]="XIcon" class="h-3 w-3"></lucide-icon>
            </button>
          </div>
        </div>

        <!-- Loading -->
        <div *ngIf="loading()" class="p-4 text-center text-xs text-slate-500">
          {{ lang.language() === 'ar' ? 'جاري التحميل...' : 'Loading...' }}
        </div>

        <!-- List -->
        <div *ngIf="!loading()" class="max-h-64 overflow-y-auto py-1">
          <button *ngIf="selected() && !required()"
                  type="button" (click)="pick(null)"
                  class="w-full px-3 py-1.5 text-sm text-start flex items-center gap-2
                         text-slate-500 dark:text-slate-400
                         hover:bg-slate-50 dark:hover:bg-surface-dark-muted">
            <lucide-icon [img]="XIcon" class="h-3 w-3"></lucide-icon>
            {{ lang.language() === 'ar' ? 'مسح الاختيار' : 'Clear selection' }}
          </button>

          <div *ngIf="filtered().length === 0" class="p-3 text-center text-xs text-slate-500">
            {{ lang.language() === 'ar' ? 'لا توجد نتائج' : 'No results' }}
          </div>

          <button *ngFor="let it of filtered()"
                  type="button" (click)="pick(it.id)"
                  class="w-full px-3 py-1.5 text-sm text-start flex items-center justify-between gap-2
                         hover:bg-slate-50 dark:hover:bg-surface-dark-muted transition-colors duration-120"
                  [ngClass]="isSelected(it) ? 'bg-brand-50 dark:bg-brand-900/20' : ''">
            <span class="flex min-w-0 items-center gap-2">
              <lucide-icon *ngIf="isSelected(it)" [img]="CheckIcon"
                           class="h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-400"></lucide-icon>
              <span class="truncate"
                    [ngClass]="isSelected(it) ? 'font-semibold text-brand-700 dark:text-brand-300' : 'text-slate-900 dark:text-slate-100'">
                {{ label(it) }}
              </span>
            </span>
            <span *ngIf="it.extra" class="text-xs text-slate-400 truncate max-w-[40%]">{{ it.extra }}</span>
          </button>
        </div>
      </div>
    </div>
  `,
})
export class PickerComponent {
  readonly titleEn = input.required<string>();
  readonly titleAr = input.required<string>();
  readonly items = input<PickerItem[]>([]);
  readonly selectedId = input<string | null>(null);
  readonly loading = input<boolean>(false);
  readonly required = input<boolean>(false);
  readonly selectedIdChange = output<string | null>();

  readonly lang = inject(LanguageService);
  private readonly hub = inject(PickerHubService);
  private readonly token = Symbol('picker');

  readonly search = signal('');

  readonly ChevronIcon = ChevronDown;
  readonly SearchIcon = Search;
  readonly XIcon = X;
  readonly CheckIcon = Check;

  /** This picker is the one the hub currently has open. */
  readonly open = computed(() => this.hub.openToken() === this.token);

  readonly selected = computed<PickerItem | undefined>(() => {
    const id = this.selectedId();
    if (id == null || id === '') return undefined;
    return this.items().find((it) => it.id === id);
  });

  readonly filtered = computed<PickerItem[]>(() => {
    const items = this.items();
    const raw = this.search().trim();
    if (!raw) return items;
    const q = raw.toLowerCase();
    return items.filter((it) =>
      (it.nameEn ?? '').toLowerCase().includes(q) ||
      (it.nameAr ?? '').includes(raw) ||
      (it.extra ?? '').toLowerCase().includes(q) ||
      (it.id ?? '').toLowerCase().includes(q));
  });

  constructor() {
    // Reset the search box whenever this picker closes, so it reopens clean.
    effect(() => { if (!this.open()) this.search.set(''); });
  }

  label(it: PickerItem): string {
    return this.lang.language() === 'ar'
      ? (it.nameAr || it.nameEn || it.id)
      : (it.nameEn || it.nameAr || it.id);
  }

  isSelected(it: PickerItem): boolean {
    return this.selectedId() === it.id;
  }

  toggle(ev: Event): void {
    ev.stopPropagation();
    this.hub.toggle(this.token);
  }

  clear(ev: Event): void {
    ev.stopPropagation();
    this.selectedIdChange.emit(null);
    this.hub.close();
  }

  pick(id: string | null): void {
    this.selectedIdChange.emit(id);
    this.hub.close();
  }
}
