import { Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet, NavigationStart, NavigationEnd, NavigationCancel, NavigationError, GuardsCheckEnd } from '@angular/router';
import { ThemeService } from './core/theme/theme.service';
import { LanguageService } from './core/i18n/language.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  // Diagnostic banner — top-left teal pill. Logs every router event
  // to the console so we can see exactly where routing stops.
  // Remove once the dashboard renders correctly.
  template: `
    <router-outlet></router-outlet>
  `,
})
export class AppComponent {
  // Eagerly instantiate Theme + Language services.
  private readonly _theme = inject(ThemeService);
  private readonly _lang  = inject(LanguageService);
  private readonly router = inject(Router);

  readonly routerInfo = signal<string>(`boot ${new Date().toLocaleTimeString()}`);

  constructor() {
    this.router.events.subscribe((e) => {
      // Log every event so we can trace.
      console.log('[Router]', e.constructor.name, (e as any).url ?? '');
      if (e instanceof NavigationStart)   this.routerInfo.set(`→ ${e.url}`);
      if (e instanceof GuardsCheckEnd)    this.routerInfo.set(`guards: ${e.shouldActivate ? 'PASS' : 'BLOCK'} → ${e.url}`);
      if (e instanceof NavigationEnd)     this.routerInfo.set(`✓ ${e.urlAfterRedirects}`);
      if (e instanceof NavigationCancel)  this.routerInfo.set(`✗ cancel: ${e.reason || e.url}`);
      if (e instanceof NavigationError)   this.routerInfo.set(`✗ error: ${e.error?.message ?? 'unknown'}`);
    });
  }
}
