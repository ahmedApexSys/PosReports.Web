import {
  Component, inject, signal, effect, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, RefreshCw, Loader, Building2, Search, Armchair } from 'lucide-angular';
import { catchError, finalize, of } from 'rxjs';
import { LanguageService } from '../../core/i18n/language.service';
import { FilterService } from '../../core/filters/filter.service';
import { MonitoringApi } from '../../core/api/monitoring.api';
import { OrderActionLogRow } from '../../core/models/monitoring.models';
import { OrderActionRowComponent } from '../../shared/order-action-row/order-action-row.component';
import { PagerComponent } from '../../shared/pager/pager.component';
import { ExportMenuComponent } from '../../shared/export-menu/export-menu.component';
import { orderActionExportColumns } from '../../core/export/monitoring-export-columns';

/**
 * Table Actions — every change on a dine-in table within the date window,
 * INCLUDING transfers in/out (the API matches both TableName and
 * DestinationTableName). Search by table name.
 */
@Component({
  selector: 'app-table-actions',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, OrderActionRowComponent, PagerComponent, ExportMenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5">
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">
            {{ lang.language() === 'ar' ? 'حركات الطاولات' : 'Table Actions' }}
          </h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {{ lang.language() === 'ar'
                ? 'كل ما حصل على طاولة معينة — شامل التحويل من وإلى الطاولة.'
                : 'Everything that happened on a table — including transfers in and out.' }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <app-export-menu
            [rows]="rows()" [columns]="exportCols"
            titleEn="Table Actions" titleAr="حركات الطاولات"
            subtitleEn="Everything on a table, including transfers"
            subtitleAr="كل ما حصل على الطاولة، شامل التحويلات"
            [branch]="rows()[0]?.branchName"
            [fromDate]="filter.fromDate()" [toDate]="filter.toDate()"
            fileBase="table-actions"></app-export-menu>
          <button (click)="run()" class="btn-ghost text-sm" [disabled]="loading() || !filter.canFetch() || !tableText.trim()">
            <lucide-icon [img]="loading() ? LoaderIcon : RefreshIcon" class="h-4 w-4" [class.animate-spin]="loading()"></lucide-icon>
            {{ lang.language() === 'ar' ? 'تحديث' : 'Refresh' }}
          </button>
        </div>
      </div>

      <!-- Table search -->
      <div class="card-padded flex flex-wrap items-center gap-2">
        <div class="relative flex-1 min-w-[200px] max-w-sm">
          <lucide-icon [img]="TableIcon" class="absolute start-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"></lucide-icon>
          <input type="text" [(ngModel)]="tableText" (keyup.enter)="run()"
                 class="w-full ps-8 pe-2 py-2 text-sm rounded-card-sm bg-slate-50 dark:bg-surface-dark-muted border-0 focus:ring-2 focus:ring-brand-500/30"
                 [placeholder]="lang.language() === 'ar' ? 'اسم الطاولة ثم Enter' : 'Table name, then Enter'"/>
        </div>
        <button (click)="run()" class="btn-ghost text-sm" [disabled]="!filter.canFetch() || !tableText.trim()">
          <lucide-icon [img]="SearchIcon" class="h-4 w-4"></lucide-icon>{{ lang.language() === 'ar' ? 'عرض' : 'Show' }}
        </button>
        <select [ngModel]="pageSize()" (ngModelChange)="setPageSize(+$event)"
                class="bg-white dark:bg-surface-dark-subtle border border-slate-300 dark:border-slate-700 rounded-card-sm px-2 py-1.5 text-xs">
          <option [ngValue]="25">25</option><option [ngValue]="50">50</option>
          <option [ngValue]="100">100</option><option [ngValue]="200">200</option>
        </select>
      </div>

      <!-- Gate -->
      <div *ngIf="!filter.canFetch()" class="card-padded text-center py-12 space-y-3">
        <div class="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-warning-soft text-warning">
          <lucide-icon [img]="BuildingIcon" class="h-6 w-6"></lucide-icon>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400">{{ filter.validateBilingual(lang.language()) }}</p>
      </div>

      <div *ngIf="filter.canFetch() && !started()" class="card-padded text-center py-12 text-sm text-slate-500">
        {{ lang.language() === 'ar' ? 'اكتب اسم طاولة لعرض تاريخها.' : 'Enter a table name to view its history.' }}
      </div>

      <div *ngIf="loading() && !rows().length" class="space-y-2">
        <div *ngFor="let i of [1,2,3,4]" class="card-padded animate-pulse h-16"></div>
      </div>
      <div *ngIf="error()" class="card-padded ring-1 ring-critical/30 bg-critical-soft text-critical">
        <strong>{{ lang.language() === 'ar' ? 'خطأ:' : 'Error:' }}</strong> {{ error() }}
      </div>

      <ng-container *ngIf="!error() && started()">
        <div *ngIf="!loading() && !rows().length" class="card-padded text-center py-12 text-sm text-slate-500">
          {{ lang.language() === 'ar' ? 'مفيش حركات على الطاولة دي.' : 'No actions found for this table.' }}
        </div>
        <div class="space-y-1.5">
          <app-order-action-row *ngFor="let r of rows()" [row]="r"></app-order-action-row>
        </div>
        <app-pager [page]="page()" [pageSize]="pageSize()" [totalCount]="totalCount()" (pageChange)="setPage($event)"></app-pager>
      </ng-container>
    </div>
  `,
})
export class TableActionsComponent {
  readonly lang = inject(LanguageService);
  readonly filter = inject(FilterService);
  private readonly api = inject(MonitoringApi);

  readonly rows = signal<OrderActionLogRow[]>([]);
  readonly exportCols = orderActionExportColumns();
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly started = signal(false);

  readonly tableName = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(50);

  tableText = '';

  readonly RefreshIcon = RefreshCw;
  readonly LoaderIcon = Loader;
  readonly BuildingIcon = Building2;
  readonly SearchIcon = Search;
  readonly TableIcon = Armchair;

  constructor() {
    effect(() => {
      const ok = this.filter.canFetch();
      const name = this.tableName();
      this.page(); this.pageSize();
      if (ok && name) this.load();
      else if (!ok) { this.rows.set([]); this.started.set(false); }
    });
  }

  run(): void {
    const name = this.tableText.trim();
    if (!name || !this.filter.canFetch()) return;
    this.page.set(1);
    this.tableName.set(name); // triggers effect → load
  }

  setPageSize(n: number): void { this.page.set(1); this.pageSize.set(n); }
  setPage(p: number): void { this.page.set(p); }

  private load(): void {
    if (!this.filter.canFetch() || !this.tableName()) return;
    this.loading.set(true); this.error.set(''); this.started.set(true);
    this.api.orderByTable(
      this.filter.branchId() as number, this.tableName(),
      this.filter.fromDate(), this.filter.toDate(), this.page(), this.pageSize(),
    ).pipe(
      catchError((e) => { this.error.set(e?.message || 'Failed to load.'); return of(null); }),
      finalize(() => this.loading.set(false)),
    ).subscribe((res) => { if (res) { this.rows.set(res.data ?? []); this.totalCount.set(res.totalCount ?? 0); } });
  }
}
