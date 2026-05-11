import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/theme/theme.service';
import { LanguageService } from './core/i18n/language.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  // Diagnostic banner is visible until we confirm bootstrap is working.
  // Remove once the dashboard renders correctly.
  template: `
    <div style="position:fixed;top:8px;left:8px;z-index:9999;padding:6px 10px;background:#0F766E;color:#fff;font:11px monospace;border-radius:6px;opacity:0.92;pointer-events:none;">
      app-root · boot OK · {{ now }}
    </div>
    <router-outlet></router-outlet>
  `,
})
export class AppComponent {
  // Eagerly instantiate Theme + Language services so their constructor
  // effects (apply html.dark / html[dir]) run on boot.
  private readonly _theme = inject(ThemeService);
  private readonly _lang  = inject(LanguageService);

  readonly now = new Date().toLocaleTimeString();
}
