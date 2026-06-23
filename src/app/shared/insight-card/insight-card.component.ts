import { Component, inject, input, output, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, CircleCheck, Info, TriangleAlert, CircleAlert, CircleX, X, Lightbulb } from 'lucide-angular';
import { BilingualPipe } from '../bilingual.pipe';
import { LanguageService } from '../../core/i18n/language.service';
import { BiInsight, InsightSeverity, SEVERITY_TONE } from '../../core/models/bi.models';

type LucideIcon = typeof Info;

@Component({
  selector: 'app-insight-card',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, BilingualPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card relative overflow-hidden p-4 md:p-5"
         [class]="cardRing()">
      <!-- Left rail accent -->
      <div class="absolute inset-y-0 start-0 w-1" [class]="accentBg()"></div>

      <div class="flex items-start gap-3 ps-2">
        <!-- Severity icon -->
        <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
             [class]="iconBg()">
          <lucide-icon [img]="iconForSeverity()" class="h-4 w-4" [class]="iconColour()"></lucide-icon>
        </div>

        <!-- Body -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="pill" [class]="pillClass()">{{ severityLabel() }}</span>
            <span class="text-xs text-slate-500 dark:text-slate-400 font-mono">{{ data().code }}</span>
          </div>

          <h3 class="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-50">
            {{ data().headline | bilingual }}
          </h3>

          <p *ngIf="data().recommendation as rec"
             class="mt-2 text-sm text-slate-600 dark:text-slate-300 flex gap-2">
            <lucide-icon [img]="Lightbulb" class="h-4 w-4 shrink-0 mt-0.5"></lucide-icon>
            <span>{{ rec | bilingual }}</span>
          </p>
        </div>

        <!-- Dismiss -->
        <button *ngIf="dismissible()"
                (click)="dismiss.emit(data().code)"
                class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                aria-label="Dismiss insight">
          <lucide-icon [img]="X" class="h-4 w-4"></lucide-icon>
        </button>
      </div>
    </div>
  `,
})
export class InsightCardComponent {
  readonly data = input.required<BiInsight>();
  readonly dismissible = input<boolean>(true);
  readonly dismiss = output<string>();

  private readonly lang = inject(LanguageService);

  readonly Lightbulb = Lightbulb;
  readonly X = X;

  iconForSeverity = computed<LucideIcon>(() => {
    const map: Record<InsightSeverity, LucideIcon> = {
      [InsightSeverity.Good]:     CircleCheck,
      [InsightSeverity.Info]:     Info,
      [InsightSeverity.Warning]:  TriangleAlert,
      [InsightSeverity.High]:     CircleAlert,
      [InsightSeverity.Critical]: CircleX,
    };
    return map[this.data().severity] ?? Info;
  });

  cardRing = computed(() => {
    const tone = SEVERITY_TONE[this.data().severity];
    return ({
      good:     'ring-1 ring-good/20',
      info:     'ring-1 ring-info/20',
      warning:  'ring-1 ring-warning/30',
      high:     'ring-1 ring-high/30',
      critical: 'ring-1 ring-critical/30',
    })[tone];
  });

  accentBg = computed(() => {
    const tone = SEVERITY_TONE[this.data().severity];
    return ({
      good:     'bg-good',
      info:     'bg-info',
      warning:  'bg-warning',
      high:     'bg-high',
      critical: 'bg-critical',
    })[tone];
  });

  iconBg = computed(() => {
    const tone = SEVERITY_TONE[this.data().severity];
    return ({
      good:     'bg-good-soft',
      info:     'bg-info-soft',
      warning:  'bg-warning-soft',
      high:     'bg-high-soft',
      critical: 'bg-critical-soft',
    })[tone];
  });

  iconColour = computed(() => {
    const tone = SEVERITY_TONE[this.data().severity];
    return ({
      good:     'text-good',
      info:     'text-info',
      warning:  'text-warning',
      high:     'text-high',
      critical: 'text-critical',
    })[tone];
  });

  pillClass = computed(() => {
    const tone = SEVERITY_TONE[this.data().severity];
    return `pill-${tone}`;
  });

  severityLabel = computed(() => {
    const ar = this.lang.language() === 'ar';
    return ({
      [InsightSeverity.Good]:     ar ? 'جيد'    : 'Good',
      [InsightSeverity.Info]:     ar ? 'معلومة' : 'Info',
      [InsightSeverity.Warning]:  ar ? 'تحذير'  : 'Warning',
      [InsightSeverity.High]:     ar ? 'مرتفع'  : 'High',
      [InsightSeverity.Critical]: ar ? 'حرج'    : 'Critical',
    })[this.data().severity];
  });
}
