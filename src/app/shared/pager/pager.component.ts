import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-angular';
import { LanguageService } from '../../core/i18n/language.service';

/**
 * Reusable pagination footer. Takes the current page / pageSize /
 * totalCount and emits `(pageChange)` when the operator navigates.
 *
 * Hides itself when the result fits on one page (totalCount <= pageSize)
 * so reports with little data don't show useless "Page 1 of 1" footers.
 *
 * Bilingual labels + RTL-friendly icon flips when the language is Arabic.
 */
@Component({
  selector: 'app-pager',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div *ngIf="totalCount > pageSize"
         class="flex items-center justify-between flex-wrap gap-3 mt-3 py-2 px-3
                bg-slate-50 dark:bg-surface-dark-muted/40
                ring-1 ring-slate-200 dark:ring-slate-800
                rounded-card-sm text-xs">
      <!-- Range label -->
      <span class="text-slate-500 dark:text-slate-400">
        {{ lang.language() === 'ar'
            ? (rangeStart() + ' – ' + rangeEnd() + ' من ' + (totalCount | number))
            : (rangeStart() + ' – ' + rangeEnd() + ' of ' + (totalCount | number)) }}
      </span>

      <!-- Buttons -->
      <div class="flex items-center gap-1">
        <button type="button" (click)="emit(1)"
                [disabled]="page <= 1"
                class="pager-btn">
          <lucide-icon [img]="FirstIcon" class="h-3.5 w-3.5"></lucide-icon>
        </button>
        <button type="button" (click)="emit(page - 1)"
                [disabled]="page <= 1"
                class="pager-btn">
          <lucide-icon [img]="PrevIcon" class="h-3.5 w-3.5"></lucide-icon>
        </button>

        <span class="px-3 tabular text-slate-700 dark:text-slate-200">
          {{ page }} / {{ totalPages() }}
        </span>

        <button type="button" (click)="emit(page + 1)"
                [disabled]="page >= totalPages()"
                class="pager-btn">
          <lucide-icon [img]="NextIcon" class="h-3.5 w-3.5"></lucide-icon>
        </button>
        <button type="button" (click)="emit(totalPages())"
                [disabled]="page >= totalPages()"
                class="pager-btn">
          <lucide-icon [img]="LastIcon" class="h-3.5 w-3.5"></lucide-icon>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .pager-btn {
      @apply inline-flex items-center justify-center
             h-7 w-7 rounded-card-sm
             ring-1 ring-slate-300 dark:ring-slate-700
             bg-white dark:bg-surface-dark-subtle
             text-slate-700 dark:text-slate-200
             hover:bg-slate-50 dark:hover:bg-surface-dark-muted
             disabled:opacity-40 disabled:cursor-not-allowed
             transition-colors duration-180;
    }
  `],
})
export class PagerComponent {
  @Input({ required: true }) page = 1;
  @Input({ required: true }) pageSize = 50;
  @Input({ required: true }) totalCount = 0;
  @Output() pageChange = new EventEmitter<number>();

  readonly lang = inject(LanguageService);

  readonly FirstIcon = ChevronsLeft;
  readonly PrevIcon = ChevronLeft;
  readonly NextIcon = ChevronRight;
  readonly LastIcon = ChevronsRight;

  totalPages(): number {
    if (this.pageSize <= 0) return 1;
    return Math.max(1, Math.ceil(this.totalCount / this.pageSize));
  }

  rangeStart(): number {
    if (this.totalCount === 0) return 0;
    return (this.page - 1) * this.pageSize + 1;
  }

  rangeEnd(): number {
    return Math.min(this.page * this.pageSize, this.totalCount);
  }

  emit(p: number): void {
    const clamped = Math.max(1, Math.min(p, this.totalPages()));
    if (clamped !== this.page) this.pageChange.emit(clamped);
  }
}
