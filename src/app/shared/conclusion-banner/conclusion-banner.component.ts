import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Sparkles } from 'lucide-angular';
import { BilingualPipe } from '../bilingual.pipe';
import { BiText } from '../../core/models/bi.models';

@Component({
  selector: 'app-conclusion-banner',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, BilingualPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card-padded bg-gradient-to-r from-brand-50 to-info-soft
                dark:from-brand-900/20 dark:to-info/10
                flex items-start gap-3">
      <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                  bg-brand-700 text-white">
        <lucide-icon [img]="Sparkles" class="h-5 w-5"></lucide-icon>
      </div>
      <p class="flex-1 text-sm md:text-base text-slate-700 dark:text-slate-200 leading-relaxed">
        {{ text() | bilingual }}
      </p>
    </div>
  `,
})
export class ConclusionBannerComponent {
  readonly text = input.required<BiText>();
  readonly Sparkles = Sparkles;
}
