import {
  Component, inject, signal, computed, effect, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideAngularModule, RefreshCw, Loader, Building2, Search, ArrowRight,
  Activity, Users, FileStack,
} from 'lucide-angular';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { LanguageService } from '../../core/i18n/language.service';
import { FilterService } from '../../core/filters/filter.service';
import { MonitoringApi } from '../../core/api/monitoring.api';
import {
  AuditSummary, EntityChangeSummary, UnifiedAuditLog, UserActivitySummary,
} from '../../core/models/monitoring.models';
import { actionLabel, entityLabel, sourceLabel } from '../../core/i18n/monitoring-labels';

/**
 * Monitoring overview — aggregate action counts (by source / action type /
 * user / entity) for the window, plus a full audit-history lookup for any
 * single entity (Item, Customer, User, Order, …).
 */
@Component({
  selector: 'app-monitoring-summary',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">
            {{ lang.language() === 'ar' ? 'ملخص النشاط وسجل العنصر' : 'Activity Summary & Entity History' }}
          </h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {{ lang.language() === 'ar'
                ? 'نظرة شاملة على النشاط + تتبّع تاريخ أي عنصر.'
                : 'A bird\\'s-eye view of activity + the full trail of any entity.' }}
          </p>
        </div>
        <button (click)="loadOverview()" class="btn-ghost text-sm" [disabled]="loading() || !filter.canFetch()">
          <lucide-icon [img]="loading() ? LoaderIcon : RefreshIcon" class="h-4 w-4" [class.animate-spin]="loading()"></lucide-icon>
          {{ lang.language() === 'ar' ? 'تحديث' : 'Refresh' }}
        </button>
      </div>

      <!-- Gate -->
      <div *ngIf="!filter.canFetch()" class="card-padded text-center py-12 space-y-3">
        <div class="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-warning-soft text-warning">
          <lucide-icon [img]="BuildingIcon" class="h-6 w-6"></lucide-icon>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400">{{ filter.validateBilingual(lang.language()) }}</p>
      </div>

      <ng-container *ngIf="filter.canFetch()">
        <div *ngIf="error()" class="card-padded ring-1 ring-critical/30 bg-critical-soft text-critical">
          <strong>{{ lang.language() === 'ar' ? 'خطأ:' : 'Error:' }}</strong> {{ error() }}
        </div>

        <!-- Source KPI tiles -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="card-padded">
            <div class="text-[11px] uppercase tracking-wide text-slate-400">{{ lang.language() === 'ar' ? 'إجمالي الحركات' : 'Total actions' }}</div>
            <div class="text-2xl font-bold text-slate-900 dark:text-slate-50 tabular mt-1">{{ totals().total | number }}</div>
          </div>
          <div class="card-padded">
            <div class="text-[11px] uppercase tracking-wide text-info">{{ lang.language() === 'ar' ? 'أوردرات' : 'Order' }}</div>
            <div class="text-2xl font-bold text-slate-900 dark:text-slate-50 tabular mt-1">{{ totals().order | number }}</div>
          </div>
          <div class="card-padded">
            <div class="text-[11px] uppercase tracking-wide text-warning">{{ lang.language() === 'ar' ? 'النظام' : 'System' }}</div>
            <div class="text-2xl font-bold text-slate-900 dark:text-slate-50 tabular mt-1">{{ totals().system | number }}</div>
          </div>
          <div class="card-padded">
            <div class="text-[11px] uppercase tracking-wide text-good">{{ lang.language() === 'ar' ? 'المنيو' : 'Menu' }}</div>
            <div class="text-2xl font-bold text-slate-900 dark:text-slate-50 tabular mt-1">{{ totals().menu | number }}</div>
          </div>
        </div>

        <!-- Skeleton -->
        <div *ngIf="loading() && !summary().length" class="grid md:grid-cols-2 gap-4">
          <div class="card-padded animate-pulse h-64"></div>
          <div class="card-padded animate-pulse h-64"></div>
        </div>

        <div class="grid md:grid-cols-2 gap-4">
          <!-- Top action types -->
          <div class="card-padded">
            <h3 class="text-sm font-semibold mb-3 flex items-center gap-2 text-slate-900 dark:text-slate-50">
              <lucide-icon [img]="ActivityIcon" class="h-4 w-4 text-brand-600"></lucide-icon>
              {{ lang.language() === 'ar' ? 'أكثر الأفعال' : 'Top action types' }}
            </h3>
            <table class="w-full text-sm">
              <tbody>
                <tr *ngFor="let a of topActions()" class="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <td class="py-1.5">
                    <span class="text-[10px] px-1.5 py-0.5 rounded me-1.5" [class]="srcClass(a.logSource)">{{ srcLabel(a.logSource) }}</span>
                    <span class="text-slate-700 dark:text-slate-200">{{ actLabel(a.actionType) }}</span>
                    <span *ngIf="a.logSource !== 'Order'" class="text-xs text-slate-400 ms-1">{{ entLabel(a.entityType) }}</span>
                  </td>
                  <td class="py-1.5 text-end tabular font-medium text-slate-900 dark:text-slate-50">{{ a.totalCount | number }}</td>
                  <td class="py-1.5 text-end text-xs text-critical ps-2" [class.opacity-0]="!a.failCount">{{ a.failCount }} {{ lang.language() === 'ar' ? 'فشل' : 'fail' }}</td>
                </tr>
                <tr *ngIf="!loading() && !topActions().length"><td class="py-4 text-center text-slate-400 text-sm">—</td></tr>
              </tbody>
            </table>
          </div>

          <!-- Most active users -->
          <div class="card-padded">
            <h3 class="text-sm font-semibold mb-3 flex items-center gap-2 text-slate-900 dark:text-slate-50">
              <lucide-icon [img]="UsersIcon" class="h-4 w-4 text-brand-600"></lucide-icon>
              {{ lang.language() === 'ar' ? 'أكثر المستخدمين نشاطاً' : 'Most active users' }}
            </h3>
            <table class="w-full text-sm">
              <thead>
                <tr class="text-[10px] uppercase tracking-wide text-slate-400 text-end">
                  <th class="text-start font-medium pb-1">{{ lang.language() === 'ar' ? 'المستخدم' : 'User' }}</th>
                  <th class="font-medium pb-1">{{ lang.language() === 'ar' ? 'أوردر' : 'Ord' }}</th>
                  <th class="font-medium pb-1">{{ lang.language() === 'ar' ? 'نظام' : 'Sys' }}</th>
                  <th class="font-medium pb-1">{{ lang.language() === 'ar' ? 'منيو' : 'Menu' }}</th>
                  <th class="font-medium pb-1">{{ lang.language() === 'ar' ? 'إجمالي' : 'Total' }}</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let u of topUsers()" class="border-b border-slate-100 dark:border-slate-800 last:border-0 text-end">
                  <td class="py-1.5 text-start text-slate-700 dark:text-slate-200">{{ u.userName || '—' }}<span class="text-xs text-slate-400 ms-1">{{ u.userRole }}</span></td>
                  <td class="py-1.5 tabular text-slate-500">{{ u.orderActions }}</td>
                  <td class="py-1.5 tabular text-slate-500">{{ u.systemActions }}</td>
                  <td class="py-1.5 tabular text-slate-500">{{ u.menuActions }}</td>
                  <td class="py-1.5 tabular font-medium text-slate-900 dark:text-slate-50">{{ u.totalActions }}</td>
                </tr>
                <tr *ngIf="!loading() && !topUsers().length"><td colspan="5" class="py-4 text-center text-slate-400 text-sm">—</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Most changed entities -->
        <div class="card-padded">
          <h3 class="text-sm font-semibold mb-3 flex items-center gap-2 text-slate-900 dark:text-slate-50">
            <lucide-icon [img]="StackIcon" class="h-4 w-4 text-brand-600"></lucide-icon>
            {{ lang.language() === 'ar' ? 'أكثر العناصر تعديلاً' : 'Most changed entities' }}
          </h3>
          <div class="overflow-x-auto">
            <table class="w-full text-sm min-w-[520px]">
              <thead>
                <tr class="text-[10px] uppercase tracking-wide text-slate-400">
                  <th class="text-start font-medium pb-1">{{ lang.language() === 'ar' ? 'النوع' : 'Type' }}</th>
                  <th class="text-start font-medium pb-1">{{ lang.language() === 'ar' ? 'العنصر' : 'Entity' }}</th>
                  <th class="text-end font-medium pb-1">+</th>
                  <th class="text-end font-medium pb-1">~</th>
                  <th class="text-end font-medium pb-1">−</th>
                  <th class="text-end font-medium pb-1">{{ lang.language() === 'ar' ? 'إجمالي' : 'Total' }}</th>
                  <th class="text-start font-medium pb-1 ps-3">{{ lang.language() === 'ar' ? 'آخر تعديل' : 'Last by' }}</th>
                  <th class="text-end font-medium pb-1"></th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let e of topEntities()" class="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <td class="py-1.5 text-slate-500">{{ entLabel(e.entityType) }}</td>
                  <td class="py-1.5 text-slate-700 dark:text-slate-200">{{ e.entityName || ('#' + e.entityId) }}</td>
                  <td class="py-1.5 text-end tabular text-good">{{ e.createCount }}</td>
                  <td class="py-1.5 text-end tabular text-info">{{ e.updateCount }}</td>
                  <td class="py-1.5 text-end tabular text-critical">{{ e.deleteCount }}</td>
                  <td class="py-1.5 text-end tabular font-medium text-slate-900 dark:text-slate-50">{{ e.totalChanges }}</td>
                  <td class="py-1.5 ps-3 text-slate-500">{{ e.lastChangedBy }}</td>
                  <td class="py-1.5 text-end">
                    <button (click)="lookupEntity(e.entityType, e.entityId)" class="text-xs text-brand-600 hover:underline">
                      {{ lang.language() === 'ar' ? 'السجل' : 'History' }}
                    </button>
                  </td>
                </tr>
                <tr *ngIf="!loading() && !topEntities().length"><td colspan="8" class="py-4 text-center text-slate-400 text-sm">—</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Entity history lookup -->
        <div class="card-padded space-y-3">
          <h3 class="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-slate-50">
            <lucide-icon [img]="SearchIcon" class="h-4 w-4 text-brand-600"></lucide-icon>
            {{ lang.language() === 'ar' ? 'سجل أي عنصر' : 'Entity history lookup' }}
          </h3>
          <div class="flex flex-wrap items-center gap-2">
            <select [(ngModel)]="entityType"
                    class="bg-white dark:bg-surface-dark-subtle border border-slate-300 dark:border-slate-700 rounded-card-sm px-2 py-1.5 text-sm">
              <option *ngFor="let t of entityTypes" [value]="t">{{ t }}</option>
            </select>
            <input type="text" [(ngModel)]="entityId" (keyup.enter)="lookupEntity(entityType, entityId)"
                   class="w-40 px-3 py-1.5 text-sm rounded-card-sm bg-slate-50 dark:bg-surface-dark-muted border-0 focus:ring-2 focus:ring-brand-500/30"
                   [placeholder]="lang.language() === 'ar' ? 'رقم العنصر' : 'Entity ID'"/>
            <button (click)="lookupEntity(entityType, entityId)" class="btn-ghost text-sm" [disabled]="entityLoading()">
              <lucide-icon [img]="entityLoading() ? LoaderIcon : SearchIcon" class="h-4 w-4" [class.animate-spin]="entityLoading()"></lucide-icon>
              {{ lang.language() === 'ar' ? 'عرض' : 'Show' }}
            </button>
          </div>

          <div *ngIf="entityError()" class="text-sm text-critical">{{ entityError() }}</div>

          <div *ngIf="entityRows() as er">
            <div *ngIf="er.length; else noHist" class="space-y-1.5">
              <div *ngFor="let r of er"
                   class="rounded-card-sm ring-1 ring-slate-200 dark:ring-slate-800 px-3 py-2 flex items-start gap-3">
                <span class="shrink-0 mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded" [class]="srcClass(r.logSource)">{{ srcLabel(r.logSource) }}</span>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-slate-800 dark:text-slate-100">{{ actLabel(r.actionType) }}<span *ngIf="r.fieldName" class="text-xs text-slate-400 ms-1">{{ r.fieldName }}</span></div>
                  <p *ngIf="r.description" class="text-xs text-slate-600 dark:text-slate-300 truncate">{{ r.description }}</p>
                  <div *ngIf="r.oldValue || r.newValue" class="text-[11px] text-slate-500 flex items-center gap-1 min-w-0">
                    <span class="truncate max-w-[40%]">{{ r.oldValue }}</span>
                    <lucide-icon [img]="ArrowIcon" class="h-3 w-3 shrink-0"></lucide-icon>
                    <span class="truncate max-w-[40%]">{{ r.newValue }}</span>
                  </div>
                  <div class="text-[11px] text-slate-400 mt-0.5">{{ r.userName }} · {{ r.actionDate | date:'MMM d' }} {{ r.actionTime }}</div>
                </div>
              </div>
            </div>
            <ng-template #noHist>
              <div *ngIf="entitySearched()" class="text-sm text-slate-400 py-4 text-center">
                {{ lang.language() === 'ar' ? 'مفيش تاريخ للعنصر ده.' : 'No history for this entity.' }}
              </div>
            </ng-template>
          </div>
        </div>
      </ng-container>
    </div>
  `,
})
export class MonitoringSummaryComponent {
  readonly lang = inject(LanguageService);
  readonly filter = inject(FilterService);
  private readonly api = inject(MonitoringApi);

  readonly summary = signal<AuditSummary[]>([]);
  readonly users = signal<UserActivitySummary[]>([]);
  readonly entities = signal<EntityChangeSummary[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly entityRows = signal<UnifiedAuditLog[] | null>(null);
  readonly entityLoading = signal(false);
  readonly entityError = signal('');
  readonly entitySearched = signal(false);

  entityType = 'Item';
  entityId = '';
  readonly entityTypes = [
    'Item', 'ItemPricing', 'Category', 'SubCategory', 'Discount', 'PromoCode',
    'Service', 'Voucher', 'Menu', 'Customer', 'User', 'Role', 'Permission', 'Branch', 'Order',
  ];

  readonly totals = computed(() => {
    const s = this.summary();
    const by = (src: string) => s.filter((x) => x.logSource === src).reduce((a, b) => a + b.totalCount, 0);
    return { order: by('Order'), system: by('System'), menu: by('Menu'), total: s.reduce((a, b) => a + b.totalCount, 0) };
  });
  readonly topActions = computed(() => [...this.summary()].sort((a, b) => b.totalCount - a.totalCount).slice(0, 14));
  readonly topUsers = computed(() => [...this.users()].sort((a, b) => b.totalActions - a.totalActions).slice(0, 10));
  readonly topEntities = computed(() => [...this.entities()].sort((a, b) => b.totalChanges - a.totalChanges).slice(0, 12));

  readonly RefreshIcon = RefreshCw;
  readonly LoaderIcon = Loader;
  readonly BuildingIcon = Building2;
  readonly SearchIcon = Search;
  readonly ArrowIcon = ArrowRight;
  readonly ActivityIcon = Activity;
  readonly UsersIcon = Users;
  readonly StackIcon = FileStack;

  constructor() {
    effect(() => {
      if (this.filter.canFetch()) this.loadOverview();
      else { this.summary.set([]); this.users.set([]); this.entities.set([]); }
    });
  }

  loadOverview(): void {
    if (!this.filter.canFetch()) return;
    const b = this.filter.branchId() as number;
    const from = this.filter.fromDate();
    const to = this.filter.toDate();
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      summary: this.api.summary(b, from, to).pipe(catchError(() => of([] as AuditSummary[]))),
      users: this.api.userActivity(b, from, to).pipe(catchError(() => of([] as UserActivitySummary[]))),
      entities: this.api.entityChangeSummary(b, from, to).pipe(catchError(() => of([] as EntityChangeSummary[]))),
    }).pipe(
      finalize(() => this.loading.set(false)),
    ).subscribe((res) => {
      this.summary.set(res.summary);
      this.users.set(res.users);
      this.entities.set(res.entities);
    });
  }

  lookupEntity(type: string, id: string): void {
    const t = (type || '').trim();
    const i = (id || '').trim();
    if (!t || !i) { this.entityError.set(this.lang.language() === 'ar' ? 'اختر نوع وأدخل رقم العنصر.' : 'Pick a type and enter an entity ID.'); return; }
    this.entityType = t; this.entityId = i;
    this.entityLoading.set(true);
    this.entityError.set('');
    this.entitySearched.set(true);
    this.api.entityHistory(t, i, this.filter.fromDate(), this.filter.toDate()).pipe(
      catchError((e) => { this.entityError.set(e?.message || 'Failed to load history.'); return of([] as UnifiedAuditLog[]); }),
      finalize(() => this.entityLoading.set(false)),
    ).subscribe((rows) => this.entityRows.set(rows));
  }

  srcLabel(s: string): string { return sourceLabel(s, this.lang.language()); }
  actLabel(s: string): string { return actionLabel(s, this.lang.language()); }
  entLabel(s: string): string { return entityLabel(s, this.lang.language()); }

  srcClass(src: string): string {
    if (src === 'Order') return 'bg-info-soft text-info';
    if (src === 'System') return 'bg-warning-soft text-warning';
    if (src === 'Menu') return 'bg-good-soft text-good';
    return 'bg-slate-100 dark:bg-surface-dark-muted text-slate-500';
  }
}
