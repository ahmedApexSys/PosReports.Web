import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Lightweight shimmer skeleton shown while a report's data is loading.
 * `rows` = how many placeholder lines/cards to render. Pure CSS (uses the
 * `animate-shimmer` keyframe); respects prefers-reduced-motion globally.
 */
@Component({
  selector: 'app-loading-skeleton',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-2" aria-busy="true" [attr.aria-label]="'Loading'">
      <div *ngFor="let r of lines(); let i = index"
           class="card-padded animate-shimmer"
           [style.animation-delay.ms]="i * 90">
        <div class="flex items-center gap-3">
          <div class="h-9 w-9 rounded-xl bg-surface-muted dark:bg-surface-dark-muted shrink-0"></div>
          <div class="flex-1 space-y-2">
            <div class="h-3 rounded-full bg-surface-muted dark:bg-surface-dark-muted w-1/3"></div>
            <div class="h-2.5 rounded-full bg-surface-muted/70 dark:bg-surface-dark-muted/70 w-2/3"></div>
          </div>
          <div class="h-5 w-16 rounded-full bg-surface-muted dark:bg-surface-dark-muted shrink-0"></div>
        </div>
      </div>
    </div>
  `,
})
export class LoadingSkeletonComponent {
  @Input() rows = 5;
  lines(): number[] { return Array.from({ length: Math.max(1, this.rows) }, (_, i) => i); }
}
