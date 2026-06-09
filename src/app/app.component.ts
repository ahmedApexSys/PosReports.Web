import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/theme/theme.service';
import { LanguageService } from './core/i18n/language.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet></router-outlet>`,
})
export class AppComponent {
  // Eagerly instantiate Theme + Language services so they apply on boot.
  private readonly _theme = inject(ThemeService);
  private readonly _lang = inject(LanguageService);
}
