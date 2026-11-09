import { Component, inject, signal, computed, effect, untracked, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { LucideAngularModule, RefreshCw, Loader, Printer, FileSpreadsheet } from 'lucide-angular';
import { catchError, finalize, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LanguageService } from '../../core/i18n/language.service';
import { FilterService } from '../../core/filters/filter.service';
import { ExportService, ExportColumn, ExportMeta } from '../../core/export/export.service';
import { LoadingSkeletonComponent } from '../../shared/loading-skeleton/loading-skeleton.component';

/** One zone's out-of-zone requests over the period (api/OutOfZone/summary). */
export interface OutOfZoneZone {
  zoonId: number;
  zoonName: string | null;
  cityName: string | null;
  requests: number;
  lastAt: string;
  askedBranches: string | null;
}

/** The columns, shared by the table and the exports. */
export function outOfZoneColumns(ar: boolean): ExportColumn<OutOfZoneZone>[] {
  return [
    { headerEn: 'Zone', headerAr: 'المنطقة', value: (r) => r.zoonName || (ar ? 'غير مسماة' : 'Unnamed') + ` #${r.zoonId}` },
    { headerEn: 'City', headerAr: 'المدينة', value: (r) => r.cityName || '' },
    { headerEn: 'Requests', headerAr: 'عدد الطلبات', numeric: true, value: (r) => r.requests },
    { headerEn: 'Last request', headerAr: 'آخر طلب', value: (r) => (r.lastAt || '').replace('T', ' ').slice(0, 16) },
    { headerEn: 'Asked branches', headerAr: 'الفروع اللي اتطلب منها', value: (r) => r.askedBranches || '' },
  ];
}

/**
 * "Out of zone requests" (owner, 2026-11-09): deliveries a branch could not take because the
 * customer's area is not one it delivers to, logged from the till's customer sheet, counted per
 * zone so the company sees where customers keep asking. Dates and branch come from the header.
 * Permission 576 OutOfZoneReportPage (the till checks it before opening this page).
 */
@Component({
  selector: 'app-out-of-zone',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, LoadingSkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div class="min-w-0">
          <h1 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">{{ ar() ? 'طلبات خارج النطاق' : 'Out of zone requests' }}</h1>
          <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{{ ar() ? 'طلبات توصيل اترفضت لأن المنطقة مش تبع الفرع، لكل منطقة' : 'Deliveries a branch could not take, per zone' }}</p>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <button (click)="exportExcel()" [disabled]="!rows().length" class="btn-ghost text-sm ring-1 ring-slate-200 dark:ring-slate-700 disabled:opacity-40">
            <lucide-icon [img]="SheetIcon" class="h-4 w-4"></lucide-icon>{{ ar() ? 'إكسل' : 'Excel' }}
          </button>
          <button (click)="exportA4()" [disabled]="!rows().length" class="btn-ghost text-sm ring-1 ring-slate-200 dark:ring-slate-700 disabled:opacity-40">
            <lucide-icon [img]="PrinterIcon" class="h-4 w-4"></lucide-icon>A4
          </button>
          <button (click)="reload()" [disabled]="loading() || !filter.hasValidDates()" class="btn-ghost text-sm">
            <lucide-icon [img]="loading() ? Loader : Refresh" class="h-4 w-4" [class.animate-spin]="loading()"></lucide-icon>
            {{ ar() ? 'تحديث' : 'Refresh' }}
          </button>
        </div>
      </div>

      <div *ngIf="!filter.hasValidDates()" class="card-padded text-center py-10 text-sm text-slate-600 dark:text-slate-300">
        {{ filter.validateBilingual(ar() ? 'ar' : 'en') || (ar() ? 'برجاء تحديد فترة التقرير.' : 'Please pick a date range.') }}
      </div>

      <app-loading-skeleton *ngIf="filter.hasValidDates() && loading()"></app-loading-skeleton>
      <div *ngIf="error()" class="card-padded text-center py-10 text-rose-600 dark:text-rose-400">{{ error() }}</div>

      <div *ngIf="filter.hasValidDates() && !loading() && !error() && loaded() && !rows().length"
           class="card-padded text-center py-10 text-sm text-slate-500 dark:text-slate-400" data-test="empty">
        {{ ar() ? 'مفيش طلبات خارج النطاق في الفترة دي.' : 'No out-of-zone requests in this period.' }}
      </div>

      <ng-container *ngIf="filter.hasValidDates() && !loading() && !error() && rows().length">
        <div class="grid grid-cols-2 gap-3" data-test="kpis">
          <div class="card-padded">
            <div class="text-xs text-slate-500 dark:text-slate-400">{{ ar() ? 'إجمالي الطلبات' : 'Requests' }}</div>
            <div class="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50">{{ total() }}</div>
          </div>
          <div class="card-padded">
            <div class="text-xs text-slate-500 dark:text-slate-400">{{ ar() ? 'عدد المناطق' : 'Zones' }}</div>
            <div class="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50">{{ rows().length }}</div>
          </div>
        </div>

        <div class="card overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-sm whitespace-nowrap" data-test="zones">
              <thead class="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-surface-dark-muted/50">
                <tr>
                  <th *ngFor="let c of columns()" scope="col" class="px-3 py-2 font-semibold"
                      [class.text-end]="c.numeric" [class.text-start]="!c.numeric">{{ ar() ? c.headerAr : c.headerEn }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr *ngFor="let r of rows()" class="hover:bg-slate-50 dark:hover:bg-surface-dark-muted/50">
                  <td *ngFor="let c of columns()" class="px-3 py-1.5" [class.text-end]="c.numeric" [class.tabular-nums]="c.numeric">{{ c.value(r, ar() ? 'ar' : 'en') }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="font-bold border-t-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-50">
                  <td class="px-3 py-2">{{ ar() ? 'الإجمالي' : 'Total' }}</td>
                  <td></td>
                  <td class="px-3 py-2 text-end tabular-nums">{{ total() }}</td>
                  <td></td><td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </ng-container>
    </div>
  `,
})
export class OutOfZoneComponent {
  private readonly http = inject(HttpClient);
  private readonly lang = inject(LanguageService);
  readonly filter = inject(FilterService);
  private readonly exp = inject(ExportService);
  readonly ar = computed(() => this.lang.language() === 'ar');
  readonly Refresh = RefreshCw; readonly Loader = Loader; readonly PrinterIcon = Printer; readonly SheetIcon = FileSpreadsheet;

  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal('');
  readonly rows = signal<OutOfZoneZone[]>([]);
  readonly columns = computed(() => outOfZoneColumns(this.ar()));
  readonly total = computed(() => this.rows().reduce((s, r) => s + (Number(r.requests) || 0), 0));

  constructor() {
    effect(() => {
      const ok = this.filter.hasValidDates();
      this.filter.fromDate(); this.filter.toDate(); this.filter.branchId();
      untracked(() => (ok ? this.reload() : this.rows.set([])));
    });
  }

  reload(): void {
    if (!this.filter.hasValidDates()) return;
    let params = new HttpParams()
      .set('from', (this.filter.fromDate() || '').slice(0, 10))
      .set('to', (this.filter.toDate() || '').slice(0, 10));
    const branch = this.filter.branchId();
    if (branch) params = params.set('branchId', String(branch));
    this.loading.set(true);
    this.error.set('');
    this.http.get<{ data?: OutOfZoneZone[]; success?: boolean; message?: string }>(
      `${environment.apiBaseUrl}/api/OutOfZone/summary`, { params },
    ).pipe(
      catchError((err) => {
        this.error.set(err?.error?.message || err?.message || (this.ar() ? 'تعذر تحميل التقرير.' : 'Failed to load report.'));
        return of(null);
      }),
      finalize(() => this.loading.set(false)),
    ).subscribe((res) => {
      if (res && res.success === false) {
        this.error.set(res.message || (this.ar() ? 'تعذر تحميل التقرير.' : 'Failed to load report.'));
      }
      this.rows.set(res?.data ?? []);
      this.loaded.set(true);
    });
  }

  private meta(): ExportMeta {
    return {
      titleEn: 'Out of zone requests', titleAr: 'طلبات خارج النطاق',
      fromDate: this.filter.fromDate(), toDate: this.filter.toDate(),
      lang: this.ar() ? 'ar' : 'en', fileBase: 'out-of-zone',
    };
  }

  private exportAs(mode: 'excel' | 'a4'): void {
    if (!this.rows().length) return;
    this.exp.sections([{
      titleEn: 'Per zone', titleAr: 'لكل منطقة', rows: this.rows(), cols: this.columns(),
      footer: [this.ar() ? 'الإجمالي' : 'Total', null, this.total(), null, null],
    }], this.meta(), mode);
  }

  exportExcel(): void { this.exportAs('excel'); }
  exportA4(): void { this.exportAs('a4'); }
}
