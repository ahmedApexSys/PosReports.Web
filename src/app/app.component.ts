import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/theme/theme.service';
import { LanguageService } from './core/i18n/language.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<router-outlet />`,
})
export class AppComponent {
  // Eagerly instantiate Theme + Language services so their constructor
  // effects (apply html.dark / html[dir]) run on boot.
  private readonly _theme = inject(ThemeService);
  private readonly _lang  = inject(LanguageService);
}
