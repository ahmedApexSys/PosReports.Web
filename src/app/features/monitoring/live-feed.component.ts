import {
  Component, OnDestroy, inject, signal, effect, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideAngularModule, RefreshCw, Loader, Building2, Search, Download,
  Play, Pause, ArrowRight, User, Clock, CheckCircle2, XCircle,
} from 'lucide-angular';
import { catchError, finalize, of } from 'rxjs';
import { LanguageService } from '../../core/i18n/language.service';
import { FilterService } from '../../core/filters/filter.service';
import { MonitoringApi } from '../../core/api/monitoring.api';
import { UnifiedAuditLog } from '../../core/models/monitoring.models';
import { PagerComponent } from '../../shared/pager/pager.component';

type SourceTab = 'all' | 'Order' | 'System' | 'Menu';

/**
 * Live Activity Feed — unified timeline of EVERY action (order + table +
 * system + menu) from /api/AuditReport/Timeline. Source tabs, free-text
 * search, success filter, optional 20s auto-refresh and client-side CSV
 * export of the loaded page.
 */
@Component({
  selector: 'app-live-feed',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, PagerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5">
      <!-- Header -->
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">
            {{ lang.language() === 'ar' ? 'سجل النشاط المباشر' : 'Live Activity Feed' }}
          </h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {{ lang.language() === 'ar'
                ? 'كل حركة على الأوردرات والطاولات والنظام والمنيو في خط زمني واحد.'
                : 'Every order, table, system and menu action in one timeline.' }}
          </p>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <button (click)="toggleAuto()" class="btn-ghost text-sm"
                  [class.text-good]="autoRefresh()">
            <lucide-icon [img]="autoRefresh() ? PauseIcon : PlayIcon" class="h-4 w-4"></lucide-icon>
            {{ autoRefresh()
                ? (lang.language() === 'ar' ? 'إيقاف التحديث' : 'Stop auto')
                : (lang.language() === 'ar' ? 'تحديث تلقائي' : 'Auto-refresh') }}
          </button>
          <button (click)="exportCsv()" class="btn-ghost text-sm" [disabled]="!data().length">
            <lucide-icon [img]="DownloadIcon" class="h-4 w-4"></lucide-icon>
            {{ lang.language() === 'ar' ? 'تصدير CSV' : 'Export CSV' }}
          </button>
          <button (click)="reload()" class="btn-ghost text-sm" [disabled]="loading() || !filter.canFetch()">
            <lucide-icon [img]="loading() ? LoaderIcon : RefreshIcon" class="h-4 w-4"
                         [class.animate-spin]="loading()"></lucide-icon>
            {{ lang.language() === 'ar' ? 'تحديث' : 'Refresh' }}
          </button>
        </div>
      </div>

      <!-- Filter bar -->
      <div class="card-padded flex flex-wrap items-center gap-2">
        <!-- Source tabs -->
        <div class="inline-flex rounded-card-sm ring-1 ring-slate-200 dark:ring-slate-700 overflow-hidden">
          <button *ngFor="let t of tabs" type="button" (click)="setSource(t.key)"
                  class="px-3 py-1.5 text-xs font-medium transition-colors"
                  [class.bg-brand-600]="source() === t.key"
                  [class.text-white]="source() === t.key"
                  [class.text-slate-600]="source() !== t.key"
                  [class.dark:text-slate-300]="source() !== t.key">
            {{ lang.language() === 'ar' ? t.ar : t.en }}
          </button>
        </div>

        <!-- Search -->
        <div class="relative flex-1 min-w-[180px] max-w-xs">
          <lucide-icon [img]="SearchIcon" class="absolute start-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"></lucide-icon>
          <input type="text" [(ngModel)]="searchText" (keyup.enter)="applySearch()"
                 class="w-full ps-8 pe-2 py-1.5 text-sm rounded-card-sm bg-slate-50 dark:bg-surface-dark-muted
                        border-0 focus:ring-2 focus:ring-brand-500/30"
                 [placeholder]="lang.language() === 'ar' ? 'بحث (Enter)...' : 'Search (Enter)...'"/>
        </div>

        <!-- Success filter -->
        <select [ngModel]="successFilter()" (ngModelChange)="setSuccess($event)"
                class="bg-white dark:bg-surface-dark-subtle border border-slate-300 dark:border-slate-700
                       rounded-card-sm px-2 py-1.5 text-xs">
          <option value="all">{{ lang.language() === 'ar' ? 'الكل' : 'All results' }}</option>
          <option value="ok">{{ lang.language() === 'ar' ? 'ناجح فقط' : 'Success only' }}</option>
          <option value="fail">{{ lang.language() === 'ar' ? 'فشل فقط' : 'Failed only' }}</option>
        </select>

        <!-- Page size -->
        <select [ngModel]="pageSize()" (ngModelChange)="setPageSize(+$event)"
                class="bg-white dark:bg-surface-dark-subtle border border-slate-300 dark:border-slate-700
                       rounded-card-sm px-2 py-1.5 text-xs">
          <option [ngValue]="25">25</option>
          <option [ngValue]="50">50</option>
          <option [ngValue]="100">100</option>
          <option [ngValue]="200">200</option>
        </select>
      </div>

      <!-- Branch gate -->
      <div *ngIf="!filter.canFetch()" class="card-padded text-center py-12 space-y-3">
        <div class="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-warning-soft text-warning">
          <lucide-icon [img]="BuildingIcon" class="h-6 w-6"></lucide-icon>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400">{{ filter.validateBilingual(lang.language()) }}</p>
      </div>

      <!-- Skeleton -->
      <div *ngIf="filter.canFetch() && loading() && !data().length" class="space-y-2">
        <div *ngFor="let i of [1,2,3,4,5,6]" class="card-padded animate-pulse h-14"></div>
      </div>

      <!-- Error -->
      <div *ngIf="error()" class="card-padded ring-1 ring-critical/30 bg-critical-soft text-critical">
        <strong>{{ lang.language() === 'ar' ? 'خطأ:' : 'Error:' }}</strong> {{ error() }}
      </div>

      <!-- Feed -->
      <ng-container *ngIf="filter.canFetch() && !error()">
        <div *ngIf="!loading() && !data().length" class="card-padded text-center py-12 text-sm text-slate-500">
          {{ lang.language() === 'ar' ? 'مفيش نشاط في الفترة دي.' : 'No activity in this period.' }}
        </div>

        <div class="space-y-1.5">
          <div *ngFor="let r of data()"
               class="rounded-card ring-1 ring-slate-200 dark:ring-slate-800 bg-white dark:bg-surface-dark-subtle
                      px-3 py-2.5 flex items-start gap-3">
            <span class="shrink-0 mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded" [class]="srcClass(r.logSource)">
              {{ r.logSource }}
            </span>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap text-sm">
                <span class="font-semibold text-slate-900 dark:text-slate-50">{{ r.actionType }}</span>
                <span class="text-xs text-slate-500 dark:text-slate-400">{{ r.entityType }}<span *ngIf="r.entityName"> · {{ r.entityName }}</span></span>
                <span class="text-[10px] uppercase tracking-wide text-slate-400">{{ r.category }}</span>
              </div>
              <p *ngIf="r.description" class="text-xs text-slate-600 dark:text-slate-300 mt-0.5 truncate">{{ r.description }}</p>
              <div *ngIf="changed(r)" class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 min-w-0">
                <span class="truncate max-w-[40%]">{{ r.oldValue }}</span>
                <lucide-icon [img]="ArrowIcon" class="h-3 w-3 shrink-0"></lucide-icon>
                <span class="truncate max-w-[40%]">{{ r.newValue }}</span>
              </div>
              <div class="flex items-center gap-3 flex-wrap mt-1 text-[11px] text-slate-400">
                <span class="inline-flex items-center gap-1"><lucide-icon [img]="UserIcon" class="h-3 w-3"></lucide-icon>{{ r.userName || '—' }}</span>
                <span class="inline-flex items-center gap-1"><lucide-icon [img]="ClockIcon" class="h-3 w-3"></lucide-icon>{{ r.actionDate | date:'MMM d' }} {{ r.actionTime }}</span>
                <span *ngIf="r.branchName">{{ r.branchName }}</span>
              </div>
            </div>
            <lucide-icon [img]="r.success ? OkIcon : FailIcon" class="h-4 w-4 shrink-0 mt-0.5"
                         [class.text-good]="r.success" [class.text-critical]="!r.success"></lucide-icon>
          </div>
        </div>

        <app-pager [page]="page()" [pageSize]="pageSize()" [totalCount]="totalCount()"
                   (pageChange)="setPage($event)"></app-pager>
      </ng-container>
    </div>
  `,
})
export class LiveFeedComponent implements OnDestroy {
  readonly lang = inject(LanguageService);
  readonly filter = inject(FilterService);
  private readonly api = inject(MonitoringApi);

  readonly data = signal<UnifiedAuditLog[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly source = signal<SourceTab>('all');
  readonly successFilter = signal<'all' | 'ok' | 'fail'>('all');
  readonly searchTerm = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(50);

  readonly autoRefresh = signal(false);
  private timer: ReturnType<typeof setInterval> | null = null;

  searchText = '';

  readonly tabs: { key: SourceTab; en: string; ar: string }[] = [
    { key: 'all', en: 'All', ar: 'الكل' },
    { key: 'Order', en: 'Orders', ar: 'أوردرات' },
    { key: 'System', en: 'System', ar: 'النظام' },
    { key: 'Menu', en: 'Menu', ar: 'المنيو' },
  ];

  readonly RefreshIcon = RefreshCw;
  readonly LoaderIcon = Loader;
  readonly BuildingIcon = Building2;
  readonly SearchIcon = Search;
  readonly DownloadIcon = Download;
  readonly PlayIcon = Play;
  readonly PauseIcon = Pause;
  readonly ArrowIcon = ArrowRight;
  readonly UserIcon = User;
  readonly ClockIcon = Clock;
  readonly OkIcon = CheckCircle2;
  readonly FailIcon = XCircle;

  constructor() {
    effect(() => {
      const ok = this.filter.canFetch();
      // dependencies — effect re-runs when any change:
      this.page(); this.pageSize(); this.source(); this.successFilter(); this.searchTerm();
      if (ok) this.reload();
      else this.data.set([]);
    });
  }

  ngOnDestroy(): void { this.stopTimer(); }

  setSource(s: SourceTab): void { this.page.set(1); this.source.set(s); }
  setSuccess(v: 'all' | 'ok' | 'fail'): void { this.page.set(1); this.successFilter.set(v); }
  setPageSize(n: number): void { this.page.set(1); this.pageSize.set(n); }
  setPage(p: number): void { this.page.set(p); }
  applySearch(): void { this.page.set(1); this.searchTerm.set(this.searchText.trim()); }

  toggleAuto(): void {
    this.autoRefresh.set(!this.autoRefresh());
    if (this.autoRefresh()) {
      this.timer = setInterval(() => { if (this.filter.canFetch() && !this.loading()) this.reload(); }, 20000);
    } else {
      this.stopTimer();
    }
  }
  private stopTimer(): void { if (this.timer) { clearInterval(this.timer); this.timer = null; } }

  reload(): void {
    if (!this.filter.canFetch()) return;
    this.loading.set(true);
    this.error.set('');
    this.api.timeline({
      fromDate: this.filter.fromDate(),
      toDate: this.filter.toDate(),
      branchId: this.filter.branchId(),
      logSource: this.source() === 'all' ? null : this.source(),
      successOnly: this.successFilter() === 'all' ? null : this.successFilter() === 'ok',
      searchText: this.searchTerm() || null,
      page: this.page(),
      pageSize: this.pageSize(),
    }).pipe(
      catchError((err) => {
        this.error.set(err?.message || 'Failed to load activity.');
        return of(null);
      }),
      finalize(() => this.loading.set(false)),
    ).subscribe((res) => {
      if (res) { this.data.set(res.data ?? []); this.totalCount.set(res.totalCount ?? 0); }
    });
  }

  changed(r: UnifiedAuditLog): boolean {
    return !!(r.oldValue || r.newValue) && r.oldValue !== r.newValue;
  }

  srcClass(src: string): string {
    if (src === 'Order') return 'bg-info-soft text-info';
    if (src === 'System') return 'bg-warning-soft text-warning';
    if (src === 'Menu') return 'bg-good-soft text-good';
    return 'bg-slate-100 dark:bg-surface-dark-muted text-slate-500';
  }

  exportCsv(): void {
    const rows = this.data();
    if (!rows.length) return;
    const headers = ['Date', 'Time', 'Source', 'Category', 'Action', 'EntityType', 'EntityName',
      'User', 'Role', 'Branch', 'Old', 'New', 'Success', 'Description'];
    const esc = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const lines = [headers.join(',')];
    for (const r of rows) {
      lines.push([
        (r.actionDate || '').slice(0, 10), r.actionTime, r.logSource, r.category, r.actionType,
        r.entityType, r.entityName, r.userName, r.userRole, r.branchName,
        r.oldValue, r.newValue, r.success, r.description,
      ].map(esc).join(','));
    }
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-feed-${(this.filter.fromDate() || '').slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
