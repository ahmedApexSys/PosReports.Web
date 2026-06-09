import { Component, ViewChild, inject, signal, effect, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { BiApi } from '../../core/api/bi.api';
import { FilterPickerApi } from '../../core/api/filter-picker.api';
import { BiPanel, BiReportRequest } from '../../core/models/bi.models';
import { PickerItem } from '../../core/models/picker.models';
import { FilterService } from '../../core/filters/filter.service';
import { LanguageService } from '../../core/i18n/language.service';
import { BiPanelPageComponent } from '../../shared/bi-panel-page/bi-panel-page.component';
import { PickerComponent } from '../../shared/picker/picker.component';

/**
 * `POST /api/SerrviceSpeedByPilot/Insights` — per-pilot delivery
 * insights. The server requires a `PilotId`; this page wires that up
 * via a pilot dropdown (loaded from `/api/FilterPickers/Pilots` scoped
 * to the currently-selected branch). Changing the pilot triggers a
 * refresh on the shared <app-bi-panel-page> shell.
 */
@Component({
  selector: 'app-perf-speed-pilot',
  standalone: true,
  imports: [CommonModule, BiPanelPageComponent, PickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Local filter row — branch comes from the global filter, pilot lives here -->
    <div class="flex items-center gap-2 flex-wrap mb-4">
      <span class="text-xs text-slate-500 dark:text-slate-400">
        {{ lang.language() === 'ar' ? 'الطيار' : 'Pilot' }}:
      </span>
      <app-picker
        titleEn="Select pilot" titleAr="اختر طيار"
        [items]="pilots()"
        [selectedId]="pilotId()"
        [loading]="pilotsLoading()"
        [required]="true"
        (selectedIdChange)="onPilotChange($event)"></app-picker>
      <span *ngIf="!pilotId()" class="text-xs text-warning">
        {{ lang.language() === 'ar'
            ? 'مفيش بيانات هتظهر قبل ما تختار طيار'
            : 'No data will load until a pilot is selected' }}
      </span>
    </div>

    <app-bi-panel-page #panel
      titleEn="Speed by Pilot" titleAr="سرعة كل طيار"
      subtitleEn="Single-pilot drill-down — daily averages and SLA buckets"
      subtitleAr="تحليل طيار واحد — متوسطات يومية وفترات SLA"
      [fetchFn]="fetch"></app-bi-panel-page>
  `,
})
export class PerfSpeedPilotComponent {
  private readonly api = inject(BiApi);
  private readonly picker = inject(FilterPickerApi);
  private readonly filter = inject(FilterService);
  readonly lang = inject(LanguageService);

  // Pilot picker state — owned here, not in the shared shell.
  readonly pilots = signal<PickerItem[]>([]);
  readonly pilotsLoading = signal(false);
  readonly pilotId = signal<string | null>(null);

  @ViewChild('panel') panelRef?: BiPanelPageComponent;

  constructor() {
    // Re-load pilot list whenever the global branch filter changes.
    effect(() => {
      const branchId = this.filter.branchId();
      this.pilots.set([]);
      this.pilotId.set(null);
      if (branchId != null && branchId > 0) {
        this.pilotsLoading.set(true);
        this.picker.pilots(branchId).subscribe((list) => {
          this.pilots.set(list);
          this.pilotsLoading.set(false);
        });
      }
    });
  }

  onPilotChange(id: string | null): void {
    this.pilotId.set(id);
    // Force the panel to refetch with the new pilot id.
    // The shell's effect only watches global filter signals; the pilot
    // signal lives on this component, so we trigger reload() manually.
    this.panelRef?.reload();
  }

  readonly fetch = (req: BiReportRequest): Observable<BiPanel> => {
    const id = this.pilotId();
    return this.api.serviceSpeedByPilotInsights({
      fromDate: req.fromDate,
      toDate: req.toDate,
      branchId: req.branchId,
      language: req.language,
      pilotId: id ?? '',
    });
  };
}
