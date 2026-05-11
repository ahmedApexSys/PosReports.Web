import { Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BiApi } from '../../core/api/bi.api';
import { BiPanel, BiReportRequest } from '../../core/models/bi.models';
import { BiPanelPageComponent } from '../../shared/bi-panel-page/bi-panel-page.component';

/**
 * `POST /api/BusinessIntelligence/ModifierPopularity` — Pareto of the
 * most-requested modifiers across the menu.
 */
@Component({
  selector: 'app-modifier-popularity',
  standalone: true,
  imports: [BiPanelPageComponent],
  template: `
    <app-bi-panel-page
      titleEn="Modifier Popularity" titleAr="شعبية الإضافات"
      subtitleEn="Most-requested modifiers — Pareto distribution"
      subtitleAr="أكثر الإضافات طلبًا — توزيع باريتو"
      [fetchFn]="fetch"></app-bi-panel-page>
  `,
})
export class ModifierPopularityComponent {
  private readonly api = inject(BiApi);
  readonly fetch = (req: BiReportRequest): Observable<BiPanel> => this.api.modifierPopularity(req);
}
