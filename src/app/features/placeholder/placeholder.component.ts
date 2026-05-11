import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule, Hammer, ArrowLeft } from 'lucide-angular';
import { LanguageService } from '../../core/i18n/language.service';

/**
 * Placeholder for a route that's defined in the IA but not yet
 * implemented end-to-end. Shows a friendly "coming soon" with the
 * route name + a CTA back to the dashboard. Lets the shell render
 * so the user can navigate around and see the design system working
 * even before every report is wired.
 */
@Component({
  selector: 'app-placeholder',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-2xl mx-auto card-padded text-center space-y-4 py-12 md:py-16">
      <div class="inline-flex h-14 w-14 items-center justify-center rounded-2xl
                  bg-warning-soft text-warning ring-1 ring-warning/30">
        <lucide-icon [img]="Hammer" class="h-7 w-7"></lucide-icon>
      </div>

      <h1 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">
        {{ lang.language() === 'ar' ? 'الصفحة دي قيد التنفيذ' : 'This report is coming soon' }}
      </h1>

      <p class="text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto">
        {{ lang.language() === 'ar'
            ? 'الراوت موجود والـ API endpoint جاهز — الـ UI لسه بنبنيه. هنوصل له خلال الجلسات الجاية.'
            : 'The route is wired and the API endpoint is live — the visual layer is being built next. Drop by again soon.' }}
      </p>

      <div class="mt-4 inline-block rounded-card-sm bg-surface-muted dark:bg-surface-dark-muted px-3 py-1.5 font-mono text-xs text-slate-600 dark:text-slate-300">
        {{ routeLabel() }}
      </div>

      <div class="pt-4">
        <a routerLink="/dashboard" class="btn-primary">
          <lucide-icon [img]="ArrowLeft" class="h-4 w-4"></lucide-icon>
          {{ lang.language() === 'ar' ? 'ارجع للوحة الرئيسية' : 'Back to dashboard' }}
        </a>
      </div>
    </div>
  `,
})
export class PlaceholderComponent {
  readonly lang = inject(LanguageService);
  private readonly route = inject(ActivatedRoute);

  readonly Hammer = Hammer;
  readonly ArrowLeft = ArrowLeft;

  readonly routeLabel = computed(() => {
    const url = this.route.snapshot.url.map((s) => s.path).join('/');
    return url ? '/' + url : '/';
  });
}
