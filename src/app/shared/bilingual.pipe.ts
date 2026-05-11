import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from '../core/i18n/language.service';
import { BiText } from '../core/models/bi.models';

/**
 * Renders a `BiText` as a plain string in the active language.
 * Usage: <span>{{ kpi.label | bilingual }}</span>
 */
@Pipe({ name: 'bilingual', standalone: true, pure: false })
export class BilingualPipe implements PipeTransform {
  private readonly lang = inject(LanguageService);

  transform(value: BiText | null | undefined): string {
    return this.lang.pick(value);
  }
}
