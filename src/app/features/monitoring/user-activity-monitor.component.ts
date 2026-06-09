import {
  Component, inject, signal, computed, effect, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideAngularModule, RefreshCw, Loader, Building2, Search, Users, ChevronLeft,
} from 'lucide-angular';
import { catchError, finalize, of } from 'rxjs';
import { LanguageService } from '../../core/i18n/language.service';
import { FilterService } from '../../core/filters/filter.service';
import { MonitoringApi } from '../../core/api/monitoring.api';
import { OrderActionLogRow, UserActivitySummary } from '../../core/models/monitoring.models';
import { OrderActionRowComponent } from '../../shared/order-action-row/order-action-row.component';
import { PagerComponent } from '../../shared/pager/pager.component';
import { ExportMenuComponent } from '../../shared/export-menu/export-menu.component';
import { actionLabel } from '../../core/i18n/monitoring-labels';
import { orderActionExportColumns } from '../../core/export/monitoring-export-columns';

/**
 * By-User monitoring — "who did what". Lists every user active in the branch +
 * date window (from /api/AuditReport/UserActivity) with their action counts and
 * role, lets you filter by role (cashier / waiter / pilot / …) or search by
 * name, then drill into one user to see their raw order actions step-by-step
 * (/api/OrderActionLog/ByBranchAndDate filtered by userId) with before/after.
 *
 * No new API surface: the existing ByBranchAndDate endpoint already accepts a
 * userId filter, and UserActivity already returns per-user roll-ups.
 */
@Component({
  selector: 'app-user-activity-monitor',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, OrderActionRowComponent, PagerComponent, ExportMenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5">
      <!-- Header -->
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 class="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">
            {{ ar() ? 'حسب المستخدم' : 'By User' }}
          </h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {{ ar()
                ? 'مين عمل إيه — كل مستخدم وحركاته (كاشير، ويتر، طيار) خطوة بخطوة.'
                : 'Who did what — every user and their actions (cashiers, waiters, pilots) step by step.' }}
          </p>
        </div>
        <button (click)="reloadUsers()" class="btn-ghost text-sm" [disabled]="usersLoading() || !filter.canFetch()">
          <lucide-icon [img]="usersLoading() ? LoaderIcon : RefreshIcon" class="h-4 w-4" [class.animate-spin]="usersLoading()"></lucide-icon>
          {{ ar() ? 'تحديث' : 'Refresh' }}
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
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5">
          <!-- ── Left: user list ─────────────────────────────────── -->
          <div class="lg:col-span-5 xl:col-span-4 space-y-3">
            <!-- Role chips -->
            <div class="flex flex-wrap gap-1.5">
              <button type="button" (click)="setRole(null)"
                      class="pill text-xs"
                      [class.pill-info]="roleFilter() === null"
                      [class.bg-slate-100]="roleFilter() !== null"
                      [class.dark:bg-surface-dark-muted]="roleFilter() !== null">
                {{ ar() ? 'الكل' : 'All' }} ({{ users().length }})
              </button>
              <button *ngFor="let r of roles()" type="button" (click)="setRole(r.role)"
                      class="pill text-xs"
                      [class.pill-info]="roleFilter() === r.role"
                      [class.bg-slate-100]="roleFilter() !== r.role"
                      [class.dark:bg-surface-dark-muted]="roleFilter() !== r.role">
                {{ roleLabel(r.role) }} ({{ r.count }})
              </button>
            </div>

            <!-- Search -->
            <div class="relative">
              <lucide-icon [img]="SearchIcon" class="absolute start-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"></lucide-icon>
              <input type="text" [ngModel]="search()" (ngModelChange)="search.set($event)"
                     class="w-full ps-8 pe-2 py-2 text-sm rounded-card-sm bg-slate-50 dark:bg-surface-dark-muted border-0 focus:ring-2 focus:ring-brand-500/30"
                     [placeholder]="ar() ? 'دوّر باسم المستخدم…' : 'Search user name…'"/>
            </div>

            <!-- States -->
            <div *ngIf="usersLoading()" class="space-y-2">
              <div *ngFor="let i of [1,2,3,4,5]" class="card-padded animate-pulse h-14"></div>
            </div>
            <div *ngIf="usersErr()" class="card-padded ring-1 ring-critical/30 bg-critical-soft text-critical text-sm">
              {{ usersErr() }}
            </div>
            <div *ngIf="!usersLoading() && !usersErr() && !filteredUsers().length"
                 class="card-padded text-center py-10 text-sm text-slate-500">
              {{ ar() ? 'مفيش مستخدمين في الفترة دي.' : 'No users in this window.' }}
            </div>

            <!-- User cards -->
            <div class="space-y-1.5">
              <button *ngFor="let u of filteredUsers()" type="button" (click)="select(u)"
                      class="w-full text-start card-padded !py-3 flex items-center gap-3 transition-colors hover:bg-slate-50 dark:hover:bg-surface-dark-muted"
                      [class.ring-2]="selected()?.userId === u.userId"
                      [class.ring-brand-500]="selected()?.userId === u.userId">
                <div class="h-9 w-9 rounded-full bg-brand-600/10 text-brand-600 flex items-center justify-center text-xs font-bold shrink-0">
                  {{ initials(u.userName) }}
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">{{ u.userName || '—' }}</span>
                    <span *ngIf="u.userRole" class="pill pill-info text-[10px] shrink-0">{{ roleLabel(u.userRole) }}</span>
                  </div>
                  <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {{ ar() ? 'أوردرات' : 'orders' }} <span class="tabular font-semibold text-slate-700 dark:text-slate-300">{{ u.orderActions }}</span>
                    · {{ ar() ? 'إجمالي' : 'total' }} <span class="tabular">{{ u.totalActions }}</span>
                  </div>
                </div>
                <lucide-icon [img]="ChevronIcon" class="h-4 w-4 text-slate-300 shrink-0 rtl:rotate-180"></lucide-icon>
              </button>
            </div>
          </div>

          <!-- ── Right: selected-user detail ─────────────────────── -->
          <div class="lg:col-span-7 xl:col-span-8 space-y-4">
            <ng-container *ngIf="selected() as u">
              <!-- Back (mobile) -->
              <button type="button" (click)="back()" class="btn-ghost text-sm lg:hidden">
                <lucide-icon [img]="ChevronIcon" class="h-4 w-4 rtl:rotate-180"></lucide-icon>
                {{ ar() ? 'رجوع للقائمة' : 'Back to list' }}
              </button>

              <!-- Summary tiles -->
              <div class="card-padded">
                <div class="flex items-center gap-3 mb-4">
                  <div class="h-11 w-11 rounded-full bg-brand-600/10 text-brand-600 flex items-center justify-center text-sm font-bold">
                    {{ initials(u.userName) }}
                  </div>
                  <div>
                    <div class="font-semibold text-slate-900 dark:text-slate-50">{{ u.userName || '—' }}</div>
                    <div class="text-xs text-slate-500 dark:text-slate-400">
                      <span *ngIf="u.userRole" class="pill pill-info text-[10px] me-1">{{ roleLabel(u.userRole) }}</span>
                      <span *ngIf="u.lastAction">{{ ar() ? 'آخر نشاط' : 'last seen' }}: {{ u.lastAction | date:'short' }}</span>
                    </div>
                  </div>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div class="rounded-card-sm bg-slate-50 dark:bg-surface-dark-muted p-3">
                    <div class="text-2xl font-bold tabular text-slate-900 dark:text-slate-50">{{ u.orderActions }}</div>
                    <div class="text-xs text-slate-500">{{ ar() ? 'حركات أوردرات' : 'Order actions' }}</div>
                  </div>
                  <div class="rounded-card-sm bg-slate-50 dark:bg-surface-dark-muted p-3">
                    <div class="text-2xl font-bold tabular text-slate-900 dark:text-slate-50">{{ u.systemActions }}</div>
                    <div class="text-xs text-slate-500">{{ ar() ? 'حركات نظام' : 'System' }}</div>
                  </div>
                  <div class="rounded-card-sm bg-slate-50 dark:bg-surface-dark-muted p-3">
                    <div class="text-2xl font-bold tabular text-slate-900 dark:text-slate-50">{{ u.menuActions }}</div>
                    <div class="text-xs text-slate-500">{{ ar() ? 'حركات منيو' : 'Menu' }}</div>
                  </div>
                  <div class="rounded-card-sm bg-brand-600/10 p-3">
                    <div class="text-2xl font-bold tabular text-brand-700 dark:text-brand-300">{{ u.totalActions }}</div>
                    <div class="text-xs text-brand-700/70 dark:text-brand-300/70">{{ ar() ? 'الإجمالي' : 'Total' }}</div>
                  </div>
                </div>

                <!-- Action-type breakdown (from the loaded actions) -->
                <div *ngIf="breakdown().length" class="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span *ngFor="let b of breakdown()" class="pill bg-slate-100 dark:bg-surface-dark-muted text-xs">
                    {{ actLabel(b.name) }} <span class="tabular font-semibold ms-1">{{ b.count }}</span>
                  </span>
                </div>
              </div>

              <!-- Their order actions -->
              <div class="flex items-center justify-between gap-2">
                <h2 class="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {{ ar() ? 'حركات الأوردرات' : 'Order actions' }}
                  <span class="text-xs text-slate-400">({{ totalCount() }})</span>
                </h2>
                <app-export-menu *ngIf="rows().length"
                  [rows]="rows()" [columns]="exportCols"
                  [titleEn]="'User actions — ' + (u.userName || '')"
                  [titleAr]="'حركات المستخدم — ' + (u.userName || '')"
                  [branch]="rows()[0]?.branchName"
                  [fromDate]="filter.fromDate()" [toDate]="filter.toDate()"
                  fileBase="user-actions"></app-export-menu>
              </div>

              <div *ngIf="rowsLoading() && !rows().length" class="space-y-2">
                <div *ngFor="let i of [1,2,3]" class="card-padded animate-pulse h-16"></div>
              </div>
              <div *ngIf="rowsErr()" class="card-padded ring-1 ring-critical/30 bg-critical-soft text-critical text-sm">
                {{ rowsErr() }}
              </div>
              <div *ngIf="!rowsLoading() && !rowsErr() && !rows().length"
                   class="card-padded text-center py-10 text-sm text-slate-500">
                {{ ar() ? 'المستخدم ده معندوش حركات أوردرات في الفترة دي.' : 'This user has no order actions in this window.' }}
              </div>
              <div class="space-y-1.5">
                <app-order-action-row *ngFor="let r of rows()" [row]="r"></app-order-action-row>
              </div>
              <app-pager [page]="page()" [pageSize]="pageSize()" [totalCount]="totalCount()"
                         (pageChange)="setPage($event)"></app-pager>
            </ng-container>

            <!-- Nothing selected (desktop hint) -->
            <div *ngIf="!selected()" class="hidden lg:flex card-padded items-center justify-center py-20 text-sm text-slate-400">
              <div class="text-center space-y-2">
                <lucide-icon [img]="UsersIcon" class="h-8 w-8 mx-auto opacity-40"></lucide-icon>
                <p>{{ ar() ? 'اختر مستخدم من القائمة لعرض حركاته.' : 'Pick a user to see their actions.' }}</p>
              </div>
            </div>
          </div>
        </div>
      </ng-container>
    </div>
  `,
})
export class UserActivityMonitorComponent {
  readonly lang = inject(LanguageService);
  readonly filter = inject(FilterService);
  private readonly api = inject(MonitoringApi);

  // ── user list state ──────────────────────────────────────────────
  readonly users = signal<UserActivitySummary[]>([]);
  readonly usersLoading = signal(false);
  readonly usersErr = signal('');
  readonly roleFilter = signal<string | null>(null);
  readonly search = signal('');

  // ── drill-down state ─────────────────────────────────────────────
  readonly selected = signal<UserActivitySummary | null>(null);
  readonly rows = signal<OrderActionLogRow[]>([]);
  readonly exportCols = orderActionExportColumns();
  readonly rowsLoading = signal(false);
  readonly rowsErr = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(50);
  readonly totalCount = signal(0);

  readonly RefreshIcon = RefreshCw;
  readonly LoaderIcon = Loader;
  readonly BuildingIcon = Building2;
  readonly SearchIcon = Search;
  readonly UsersIcon = Users;
  readonly ChevronIcon = ChevronLeft;

  readonly ar = computed(() => this.lang.language() === 'ar');

  /** Distinct roles present in the loaded users, with counts, for the chip row. */
  readonly roles = computed(() => {
    const map = new Map<string, number>();
    for (const u of this.users()) {
      const r = (u.userRole || '').trim();
      if (!r) continue;
      map.set(r, (map.get(r) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => b.count - a.count);
  });

  /** Users filtered by the active role chip + search box, busiest first. */
  readonly filteredUsers = computed(() => {
    const role = this.roleFilter();
    const q = this.search().trim().toLowerCase();
    return this.users()
      .filter((u) => (role === null || (u.userRole || '').trim() === role))
      .filter((u) => (!q || (u.userName || '').toLowerCase().includes(q)))
      .sort((a, b) => (b.orderActions - a.orderActions) || (b.totalActions - a.totalActions));
  });

  /** Action-type tallies for the currently-loaded actions of the selected user. */
  readonly breakdown = computed(() => {
    const map = new Map<string, number>();
    for (const r of this.rows()) {
      const k = r.actionTypeName || '—';
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  });

  constructor() {
    // Reload the user list whenever branch / date window changes.
    effect(() => {
      const ok = this.filter.canFetch();
      this.filter.branchId(); this.filter.fromDate(); this.filter.toDate();
      if (ok) this.reloadUsers();
      else { this.users.set([]); this.selected.set(null); }
    });

    // Reload the selected user's actions on selection / paging change.
    effect(() => {
      const u = this.selected();
      this.page(); this.pageSize();
      if (u && this.filter.canFetch()) this.loadRows();
    });
  }

  reloadUsers(): void {
    if (!this.filter.canFetch()) return;
    this.usersLoading.set(true);
    this.usersErr.set('');
    this.api.userActivity(this.filter.branchId() as number, this.filter.fromDate(), this.filter.toDate()).pipe(
      catchError((e) => { this.usersErr.set(e?.message || 'Failed to load users.'); return of([] as UserActivitySummary[]); }),
      finalize(() => this.usersLoading.set(false)),
    ).subscribe((list) => {
      this.users.set(list ?? []);
      // Keep a valid selection (or clear it) after a reload.
      const sel = this.selected();
      if (sel && !(list ?? []).some((u) => u.userId === sel.userId)) this.selected.set(null);
    });
  }

  private loadRows(): void {
    const u = this.selected();
    if (!u || !this.filter.canFetch()) return;
    this.rowsLoading.set(true);
    this.rowsErr.set('');
    this.api.orderByBranch({
      branchId: this.filter.branchId() as number,
      fromDate: this.filter.fromDate(), toDate: this.filter.toDate(),
      userId: u.userId, page: this.page(), pageSize: this.pageSize(),
    }).pipe(
      catchError((e) => { this.rowsErr.set(e?.message || 'Failed to load actions.'); return of(null); }),
      finalize(() => this.rowsLoading.set(false)),
    ).subscribe((res) => {
      if (res) { this.rows.set(res.data ?? []); this.totalCount.set(res.totalCount ?? 0); }
    });
  }

  setRole(r: string | null): void { this.roleFilter.set(r); }

  select(u: UserActivitySummary): void {
    this.selected.set(u);
    this.page.set(1);
    this.rows.set([]);
  }

  back(): void { this.selected.set(null); }
  setPage(p: number): void { this.page.set(p); }

  actLabel(name: string): string { return actionLabel(name, this.lang.language()); }

  initials(name: string | null | undefined): string {
    const s = (name || '').trim();
    if (!s) return '؟';
    const parts = s.split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || s[0].toUpperCase();
  }

  /** Bilingual role label (best-effort map; falls back to the raw role). */
  roleLabel(role: string | null | undefined): string {
    const raw = (role || '').trim();
    if (!raw) return '—';
    if (!this.ar()) return raw;
    const k = raw.toLowerCase().replace(/[^a-z]/g, '');
    const map: Record<string, string> = {
      cashier: 'كاشير', waiter: 'ويتر', captain: 'كابتن', pilot: 'طيار',
      delivery: 'دليفري', driver: 'سائق', manager: 'مدير', admin: 'أدمن',
      administrator: 'أدمن', owner: 'مالك', supervisor: 'مشرف', accountant: 'محاسب',
      callcenter: 'كول سنتر', kitchen: 'مطبخ', steward: 'ستيوارد', host: 'مضيف',
      user: 'مستخدم', staff: 'موظف',
    };
    return map[k] || raw;
  }
}
