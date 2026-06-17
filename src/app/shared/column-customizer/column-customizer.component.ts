import {
  Component, Input, Output, EventEmitter, inject, signal, computed,
  ElementRef, HostListener, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import {
  LucideAngularModule, Columns3, GripVertical, RotateCcw, Eye, EyeOff, Check,
} from 'lucide-angular';
import { LanguageService } from '../../core/i18n/language.service';
import { ReportColumn } from '../../core/models/sales-report.models';

/**
 * Column customizer popover. Drag to reorder, toggle to show/hide, and the
 * chosen layout is saved per-user per-report by the parent (this component is
 * pure UI + events). "Reset" reverts to the report's default layout.
 */
@Component({
  selector: 'app-column-customizer',
  standalone: true,
  imports: [CommonModule, DragDropModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative" (click)="$event.stopPropagation()">
      <button type="button" (click)="open.set(!open())"
              class="btn-ghost text-sm ring-1 ring-slate-200 dark:ring-slate-700">
        <lucide-icon [img]="ColsIcon" class="h-4 w-4"></lucide-icon>
        <span class="tabular">{{ visibleCount() }}/{{ cols().length }}</span>
        {{ ar() ? 'أعمدة' : 'Columns' }}
      </button>

      <div *ngIf="open()"
           class="absolute end-0 mt-2 z-50 w-72 rounded-card bg-white dark:bg-surface-dark-subtle
                  shadow-card dark:shadow-card-dk ring-1 ring-slate-200 dark:ring-slate-800 overflow-hidden">
        <div class="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800">
          <span class="text-xs font-semibold text-slate-700 dark:text-slate-200">
            {{ ar() ? 'ترتيب وإظهار الأعمدة' : 'Arrange & show columns' }}
          </span>
          <span class="text-[10px] text-slate-400">{{ ar() ? 'اسحب للترتيب' : 'drag to reorder' }}</span>
        </div>

        <div cdkDropList (cdkDropListDropped)="drop($event)"
             class="max-h-[22rem] overflow-y-auto p-1.5 space-y-0.5">
          <div *ngFor="let c of cols()" cdkDrag
               class="group flex items-center gap-2 px-2 py-1.5 rounded-card-sm
                      hover:bg-surface-muted dark:hover:bg-surface-dark-muted transition-colors">
            <button type="button" cdkDragHandle
                    class="cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600
                           hover:text-slate-500 dark:hover:text-slate-400 shrink-0">
              <lucide-icon [img]="GripIcon" class="h-4 w-4"></lucide-icon>
            </button>
            <button type="button" (click)="toggle(c.key)"
                    class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded
                           ring-1 transition-colors"
                    [class.bg-brand-600]="!isHidden(c.key)"
                    [class.ring-brand-600]="!isHidden(c.key)"
                    [class.text-white]="!isHidden(c.key)"
                    [class.ring-slate-300]="isHidden(c.key)"
                    [class.dark:ring-slate-600]="isHidden(c.key)">
              <lucide-icon *ngIf="!isHidden(c.key)" [img]="CheckIcon" class="h-3 w-3"></lucide-icon>
            </button>
            <span class="flex-1 text-xs truncate"
                  [class.text-slate-700]="!isHidden(c.key)" [class.dark:text-slate-200]="!isHidden(c.key)"
                  [class.text-slate-400]="isHidden(c.key)" [class.dark:text-slate-500]="isHidden(c.key)">
              {{ ar() ? c.labelAr : c.labelEn }}
            </span>
          </div>
        </div>

        <div class="flex items-center justify-between gap-2 px-2 py-2 border-t border-slate-100 dark:border-slate-800">
          <button type="button" (click)="resetLayout()"
                  class="inline-flex items-center gap-1.5 px-2 py-1 rounded-card-sm text-[11px] font-medium
                         text-slate-600 dark:text-slate-300 hover:text-brand-700 dark:hover:text-brand-300
                         hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors">
            <lucide-icon [img]="ResetIcon" class="h-3.5 w-3.5"></lucide-icon>
            {{ ar() ? 'إعادة للافتراضي' : 'Reset to default' }}
          </button>
          <div class="flex items-center gap-1">
            <button type="button" (click)="showAll()" class="cc-mini" [title]="ar() ? 'إظهار الكل' : 'Show all'">
              <lucide-icon [img]="EyeIcon" class="h-3.5 w-3.5"></lucide-icon>
            </button>
            <button type="button" (click)="hideAll()" class="cc-mini" [title]="ar() ? 'إخفاء الكل' : 'Hide all'">
              <lucide-icon [img]="EyeOffIcon" class="h-3.5 w-3.5"></lucide-icon>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .cc-mini { @apply inline-flex h-7 w-7 items-center justify-center rounded-card-sm
               text-slate-500 dark:text-slate-400 hover:bg-surface-muted dark:hover:bg-surface-dark-muted; }
    .cdk-drag-preview { @apply rounded-card-sm bg-white dark:bg-surface-dark-muted shadow-popover ring-1 ring-slate-200 dark:ring-slate-700; }
    .cdk-drag-placeholder { opacity:.4; }
    .cdk-drag-animating { transition: transform 200ms cubic-bezier(0,0,0.2,1); }
  `],
})
export class ColumnCustomizerComponent {
  /** Columns in current display order (full list, incl. hidden). */
  @Input({ required: true }) set columns(v: ReportColumn[]) { this.cols.set([...(v ?? [])]); }
  /** Keys currently hidden. */
  @Input({ required: true }) set hidden(v: Set<string>) { this._hidden.set(new Set(v)); }

  /** Emits the new layout (order + hidden) whenever the user changes it. */
  @Output() layoutChange = new EventEmitter<{ order: string[]; hidden: string[] }>();
  /** Emits when the user clicks "Reset to default". */
  @Output() resetToDefault = new EventEmitter<void>();

  readonly lang = inject(LanguageService);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly cols = signal<ReportColumn[]>([]);
  private readonly _hidden = signal<Set<string>>(new Set());
  readonly open = signal(false);

  readonly ColsIcon = Columns3; readonly GripIcon = GripVertical; readonly ResetIcon = RotateCcw;
  readonly EyeIcon = Eye; readonly EyeOffIcon = EyeOff; readonly CheckIcon = Check;

  readonly ar = computed(() => this.lang.language() === 'ar');
  readonly visibleCount = computed(() => this.cols().filter((c) => !this._hidden().has(c.key)).length);

  isHidden(key: string): boolean { return this._hidden().has(key); }

  drop(ev: CdkDragDrop<ReportColumn[]>): void {
    const next = [...this.cols()];
    moveItemInArray(next, ev.previousIndex, ev.currentIndex);
    this.cols.set(next);
    this.emit();
  }

  toggle(key: string): void {
    const h = new Set(this._hidden());
    if (h.has(key)) h.delete(key); else h.add(key);
    this._hidden.set(h);
    this.emit();
  }

  showAll(): void { this._hidden.set(new Set()); this.emit(); }
  hideAll(): void { this._hidden.set(new Set(this.cols().map((c) => c.key))); this.emit(); }

  resetLayout(): void { this.resetToDefault.emit(); }

  private emit(): void {
    this.layoutChange.emit({
      order: this.cols().map((c) => c.key),
      hidden: [...this._hidden()],
    });
  }

  @HostListener('document:click')
  onDocClick(): void { if (this.open()) this.open.set(false); }
}
