import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, ArrowUp, ArrowDown, Minus } from 'lucide-angular';
import { BilingualPipe } from '../bilingual.pipe';
import { KpiCard, Tone } from '../../core/models/bi.models';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, BilingualPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card-padded relative overflow-hidden"
         [class]="toneClasses()">
      <!-- Left rail accent — coloured by tone -->
      <div class="absolute inset-y-0 start-0 w-1" [class]="toneAccent()"></div>

      <!-- Label -->
      <div class="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {{ data().label | bilingual }}
      </div>

      <!-- Value -->
      <div class="mt-2 flex items-baseline gap-2">
        <span class="kpi-value text-kpi-sm md:text-kpi text-slate-900 dark:text-slate-50">
          {{ formatValue() }}
        </span>
        <span class="text-sm text-slate-500 dark:text-slate-400">{{ data().unit }}</span>
      </div>

      <!-- Change vs reference -->
      <div *ngIf="data().changePercent != null" class="mt-2 flex items-center gap-1.5 text-xs">
        <lucide-icon
          [img]="trendIcon()"
          class="h-4 w-4"
          [class]="trendColour()">
        </lucide-icon>
        <span [class]="trendColour()" class="font-semibold tabular">
          {{ formatChange() }}
        </span>
        <span class="text-slate-500 dark:text-slate-400 text-xs">
          {{ data().annotation | bilingual }}
        </span>
      </div>
    </div>
  `,
})
export class KpiCardComponent {
  readonly data = input.required<KpiCard>();

  readonly Up = ArrowUp;
  readonly Down = ArrowDown;
  readonly Flat = Minus;

  toneClasses = computed(() => {
    const tone = this.data().tone ?? 'info';
    return ['ring-1', this.ringForTone(tone)].join(' ');
  });

  toneAccent = computed(() => {
    const tone = this.data().tone ?? 'info';
    return this.bgForTone(tone);
  });

  trendIcon = computed(() => {
    const t = this.data().trend;
    return t === 'up' ? ArrowUp : t === 'down' ? ArrowDown : Minus;
  });

  trendColour = computed(() => {
    const t = this.data().trend;
    return t === 'up' ? 'text-good' : t === 'down' ? 'text-critical' : 'text-slate-500';
  });

  formatValue(): string {
    const v = this.data().value;
    if (typeof v !== 'number') return String(v ?? '');
    return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  formatChange(): string {
    const cp = this.data().changePercent;
    if (cp == null) return '';
    const pct = cp * 100;
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}%`;
  }

  private bgForTone(tone: Tone): string {
    return ({
      good:     'bg-good',
      info:     'bg-info',
      warning:  'bg-warning',
      high:     'bg-high',
      critical: 'bg-critical',
    } as Record<Tone, string>)[tone];
  }

  private ringForTone(tone: Tone): string {
    return ({
      good:     'ring-good/20',
      info:     'ring-info/20',
      warning:  'ring-warning/30',
      high:     'ring-high/30',
      critical: 'ring-critical/30',
    } as Record<Tone, string>)[tone];
  }
}
