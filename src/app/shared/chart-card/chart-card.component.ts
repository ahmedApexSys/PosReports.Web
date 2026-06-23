import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BilingualPipe } from '../bilingual.pipe';
import { BiText } from '../../core/models/bi.models';

@Component({
  selector: 'app-chart-card',
  standalone: true,
  imports: [CommonModule, BilingualPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card-padded h-full flex flex-col">
      <header class="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {{ title() | bilingual }}
          </h3>
          <p *ngIf="subtitle() as st" class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {{ st | bilingual }}
          </p>
        </div>
      </header>
      <div class="flex-1 min-h-0">
        <ng-content></ng-content>
      </div>
    </div>
  `,
})
export class ChartCardComponent {
  readonly title = input.required<BiText>();
  readonly subtitle = input<BiText | undefined>();
}
