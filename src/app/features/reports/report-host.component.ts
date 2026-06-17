import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { TabularReportPageComponent } from '../../shared/tabular-report-page/tabular-report-page.component';
import { LanguageService } from '../../core/i18n/language.service';
import { REPORT_REGISTRY } from '../../core/reports/report-registry';
import { ReportDef } from '../../core/models/sales-report.models';

/**
 * Generic host for every migrated legacy report. Reads the `:id` route param,
 * looks up its ReportDef in the registry, and renders it through the shared
 * TabularReportPage. The `@for … track d.id` recreates the inner page when the
 * id changes (report→report navigation) so the column layout + fetch reset.
 */
@Component({
  selector: 'app-report-host',
  standalone: true,
  imports: [CommonModule, TabularReportPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (d of defList(); track d.id) {
      <app-tabular-report-page [def]="d"></app-tabular-report-page>
    }
    @if (!def()) {
      <div class="card-padded text-center py-16 space-y-2">
        <p class="text-base font-semibold text-slate-700 dark:text-slate-200">
          {{ ar() ? 'التقرير غير موجود' : 'Report not found' }}
        </p>
        <p class="text-sm text-slate-500 dark:text-slate-400">{{ id() }}</p>
      </div>
    }
  `,
})
export class ReportHostComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly lang = inject(LanguageService);

  readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), { initialValue: null });
  readonly def = computed<ReportDef | null>(() => REPORT_REGISTRY[this.id() ?? ''] ?? null);
  readonly defList = computed<ReportDef[]>(() => { const d = this.def(); return d ? [d] : []; });
  readonly ar = computed(() => this.lang.language() === 'ar');
}
