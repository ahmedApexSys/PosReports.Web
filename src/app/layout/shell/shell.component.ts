import { Component, inject, signal, computed, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet, Router } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { LucideAngularModule, LayoutDashboard, ChartBar, FileText, Truck, Soup, Globe, Menu, X, LogOut, Sun, Moon, MonitorCog, TrendingUp, Banknote, UserCog, Timer, TriangleAlert, Activity, ScrollText, Armchair, Gauge, Bell, ChevronDown, ChevronRight, UserRound, Settings, CircleHelp, ReceiptText, Wallet, Tag, CalendarClock, Boxes, Sigma } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { ThemeService } from '../../core/theme/theme.service';
import { NotificationCenterService } from '../../core/notifications/notification-center.service';
import { BranchPickerComponent } from '../../shared/branch-picker/branch-picker.component';
import { DateRangePickerComponent } from '../../shared/date-range-picker/date-range-picker.component';
import { REPORT_NAV, REPORT_REGISTRY } from '../../core/reports/report-registry';

type LucideIcon = typeof Sun;

interface NavItem {
  labelEn: string;
  labelAr: string;
  route: string;
  icon: LucideIcon;
}

interface NavGroup {
  titleEn: string;
  titleAr: string;
  icon: LucideIcon;
  items: NavItem[];
  /** render as a single direct link (no accordion), e.g. Dashboard. */
  standalone?: boolean;
}

/** Per-group icon for the migrated report categories (keyed by English title). */
const REPORT_GROUP_ICONS: Record<string, LucideIcon> = {
  'Sales': ReceiptText,
  'Daily': CalendarClock,
  'Totals': Sigma,
  'Items': Boxes,
  'Orders': ScrollText,
  'Discounts': Tag,
  'Promo Codes': Tag,
  'Vouchers': Tag,
  'Discounts & Vouchers': Tag,
  'Expenses & Settlements': Wallet,
  'Reservations & Deferred': CalendarClock,
};

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet, DragDropModule, LucideAngularModule, BranchPickerComponent, DateRangePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Layout: outer container uses row-flex so sidebar + main column
         render side by side on desktop. On mobile the sidebar is fixed
         (slides in as a drawer). On lg+ the sidebar is sticky top-0 so
         it pins while the main column scrolls. The previous version
         used flex-col which made the sticky sidebar stack ABOVE the
         main content — the layout corruption under scroll. -->
    <div class="min-h-screen flex bg-surface dark:bg-surface-dark">
      <!-- Mobile drawer overlay -->
      <div *ngIf="mobileNavOpen()"
           (click)="mobileNavOpen.set(false)"
           class="fixed inset-0 z-30 bg-black/40 lg:hidden"></div>

      <!-- User-menu close backdrop (invisible; click anywhere to dismiss) -->
      <div *ngIf="userMenuOpen()"
           (click)="userMenuOpen.set(false)"
           class="fixed inset-0 z-40"></div>

      <!-- ── Sidebar ────────────────────────────────────────────── -->
      <aside class="fixed lg:sticky top-0 z-40 h-screen lg:shrink-0
                    bg-white dark:bg-surface-dark-subtle
                    border-e border-slate-200 dark:border-slate-800
                    transition-transform duration-220
                    flex flex-col"
             [class]="asideClasses()">

        <!-- Logo -->
        <div class="h-16 flex items-center gap-3 px-4 border-b border-slate-200 dark:border-slate-800">
          <div class="flex h-9 w-9 items-center justify-center rounded-card-sm bg-brand-700 text-white shrink-0">
            <span class="font-bold">A</span>
          </div>
          <div *ngIf="!collapsed()" class="overflow-hidden">
            <div class="text-sm font-bold text-slate-900 dark:text-slate-50">Apex Reports</div>
            <div class="text-xs text-slate-500 dark:text-slate-400">Owner Dashboard</div>
          </div>
        </div>

        <!-- Nav — collapsible accordion; drag a category header to reorder (saved). -->
        <nav cdkDropList (cdkDropListDropped)="dropGroup($event)"
             class="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          <div *ngFor="let g of orderedGroups()" cdkDrag class="nav-drag">

            <!-- Standalone direct link (e.g. Dashboard) -->
            <a *ngIf="g.standalone" cdkDragHandle
               [routerLink]="g.items[0].route"
               routerLinkActive="bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-semibold"
               class="flex items-center gap-3 px-2.5 py-2 rounded-card-sm text-sm font-medium cursor-grab active:cursor-grabbing
                      text-slate-700 dark:text-slate-300
                      hover:bg-slate-50 dark:hover:bg-surface-dark-muted hover:text-slate-900 dark:hover:text-slate-100
                      transition-colors duration-150"
               [title]="collapsed() ? (lang.language() === 'ar' ? g.titleAr : g.titleEn) : ''"
               (click)="mobileNavOpen.set(false)">
              <lucide-icon [img]="g.icon" class="h-[18px] w-[18px] shrink-0"></lucide-icon>
              <span *ngIf="!collapsed()" class="truncate">{{ lang.language() === 'ar' ? g.titleAr : g.titleEn }}</span>
            </a>

            <!-- Collapsible category -->
            <div *ngIf="!g.standalone">
              <button type="button" cdkDragHandle (click)="toggleGroup(g.titleEn)"
                      class="nav-group cursor-grab active:cursor-grabbing" [class.active]="groupActive(g)"
                      [title]="collapsed() ? (lang.language() === 'ar' ? g.titleAr : g.titleEn) : ''">
                <lucide-icon [img]="g.icon" class="h-[18px] w-[18px] shrink-0"></lucide-icon>
                <span *ngIf="!collapsed()" class="flex-1 text-start truncate">{{ lang.language() === 'ar' ? g.titleAr : g.titleEn }}</span>
                <span *ngIf="!collapsed() && groupActive(g) && !isExpanded(g.titleEn)"
                      class="h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0"></span>
                <lucide-icon *ngIf="!collapsed()" [img]="ChevronRightIcon"
                             class="h-4 w-4 shrink-0 opacity-50 transition-transform duration-200"
                             [class.rotate-90]="isExpanded(g.titleEn)"></lucide-icon>
              </button>

              <!-- Items -->
              <div *ngIf="!collapsed() && isExpanded(g.titleEn)"
                   class="mt-0.5 ms-[1.45rem] ps-3 border-s border-slate-200 dark:border-slate-700
                          space-y-0.5 overflow-hidden animate-fade-in">
                <a *ngFor="let item of g.items"
                   [routerLink]="item.route"
                   routerLinkActive="text-brand-700 dark:text-brand-300 font-semibold bg-brand-50/60 dark:bg-brand-900/20"
                   class="flex items-center gap-2.5 px-2.5 py-1.5 rounded-card-sm text-[13px] font-medium
                          text-slate-600 dark:text-slate-400
                          hover:bg-slate-50 dark:hover:bg-surface-dark-muted hover:text-slate-900 dark:hover:text-slate-100
                          transition-colors duration-150"
                   (click)="mobileNavOpen.set(false)">
                  <lucide-icon [img]="item.icon" class="h-4 w-4 shrink-0 opacity-70"></lucide-icon>
                  <span class="truncate">{{ lang.language() === 'ar' ? item.labelAr : item.labelEn }}</span>
                </a>
              </div>
            </div>
          </div>
        </nav>

        <!-- Footer of sidebar — prominent account button + compact toggles -->
        <div class="border-t border-slate-200 dark:border-slate-800 p-2 space-y-2">
          <a routerLink="/profile" (click)="mobileNavOpen.set(false)"
             class="flex items-center gap-2.5 px-2.5 py-2.5 rounded-card
                    bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm
                    transition-colors duration-150"
             [class.justify-center]="collapsed()"
             [title]="collapsed() ? accountName() : ''">
            <span class="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 shrink-0">
              <lucide-icon [img]="AccountIcon" class="h-4 w-4"></lucide-icon>
            </span>
            <span *ngIf="!collapsed()" class="block text-sm font-semibold truncate">{{ accountName() }}</span>
          </a>
          <div class="flex items-center gap-1" [class.flex-col]="collapsed()">
            <button (click)="theme.cycle()" class="foot-btn" [title]="themeLabel()">
              <lucide-icon [img]="themeIcon()" class="h-4 w-4"></lucide-icon>
            </button>
            <button (click)="lang.toggle()" class="foot-btn" [title]="lang.language() === 'ar' ? 'English' : 'عربي'">
              <lucide-icon [img]="GlobeIcon" class="h-4 w-4"></lucide-icon>
            </button>
            <button (click)="auth.logout()" class="foot-btn text-critical hover:text-critical"
                    [title]="lang.language() === 'ar' ? 'تسجيل خروج' : 'Sign out'">
              <lucide-icon [img]="LogoutIcon" class="h-4 w-4"></lucide-icon>
            </button>
          </div>
        </div>
      </aside>

      <!-- ── Main content ──────────────────────────────────────── -->
      <div class="flex-1 flex flex-col min-h-screen min-w-0"
           [class]="mainOffsetClass()">

        <!-- Header -->
        <header class="sticky top-0 z-20 h-16 glass
                       border-b border-slate-200 dark:border-slate-800
                       flex items-center gap-3 px-4 md:px-6">
          <button (click)="mobileNavOpen.set(!mobileNavOpen())"
                  class="btn-ghost lg:hidden p-1.5"
                  aria-label="Toggle navigation">
            <lucide-icon [img]="mobileNavOpen() ? CloseIcon : MenuIcon" class="h-5 w-5"></lucide-icon>
          </button>
          <button (click)="collapsed.set(!collapsed())"
                  class="btn-ghost hidden lg:inline-flex p-1.5"
                  aria-label="Collapse sidebar">
            <lucide-icon [img]="MenuIcon" class="h-5 w-5"></lucide-icon>
          </button>

          <div class="flex-1 min-w-0 flex items-center gap-3">
            <!-- Branch picker — REQUIRED before any data fetch -->
            <app-branch-picker></app-branch-picker>
            <app-date-range-picker></app-date-range-picker>
          </div>

          <div class="flex items-center gap-1.5">
            <!-- Notifications bell -->
            <a routerLink="/notifications" class="relative btn-ghost p-2"
               [attr.aria-label]="lang.language() === 'ar' ? 'الإشعارات' : 'Notifications'">
              <lucide-icon [img]="BellIcon" class="h-5 w-5"></lucide-icon>
              <span *ngIf="notif.unreadCount() > 0"
                    class="absolute -top-0.5 -end-0.5 min-w-[1rem] h-4 px-1 rounded-full bg-critical
                           text-white text-[10px] font-bold leading-4 text-center">
                {{ notif.unreadCount() > 9 ? '9+' : notif.unreadCount() }}
              </span>
            </a>

            <!-- User menu -->
            <div class="relative">
              <button (click)="userMenuOpen.set(!userMenuOpen())"
                      class="flex items-center gap-2 rounded-card-sm p-1 md:pe-2
                             hover:bg-surface-muted dark:hover:bg-surface-dark-muted transition-colors"
                      aria-haspopup="menu" [attr.aria-expanded]="userMenuOpen()">
                <div class="h-9 w-9 rounded-full bg-brand-700 text-white flex items-center justify-center text-sm font-semibold shrink-0">
                  {{ initials() }}
                </div>
                <div class="text-start hidden md:block max-w-[10rem]">
                  <div class="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate leading-tight">
                    {{ auth.profile()?.name_En || auth.profile()?.userName || 'User' }}
                  </div>
                  <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate leading-tight">
                    {{ auth.profile()?.branchName || (lang.language() === 'ar' ? 'تقارير' : 'Reports') }}
                  </div>
                </div>
                <lucide-icon [img]="ChevronDownIcon"
                             class="h-4 w-4 text-slate-400 hidden md:block transition-transform duration-200"
                             [class.rotate-180]="userMenuOpen()"></lucide-icon>
              </button>

              <!-- Dropdown -->
              <div *ngIf="userMenuOpen()"
                   class="absolute end-0 mt-2 w-56 z-50 rounded-card bg-white dark:bg-surface-dark-subtle
                          shadow-card dark:shadow-card-dk ring-1 ring-slate-200 dark:ring-slate-800 p-1.5"
                   role="menu">
                <a *ngFor="let m of userMenu"
                   [routerLink]="m.route" (click)="userMenuOpen.set(false)" role="menuitem"
                   class="flex items-center gap-3 px-3 py-2 rounded-card-sm text-sm font-medium
                          text-slate-700 dark:text-slate-200
                          hover:bg-surface-muted dark:hover:bg-surface-dark-muted transition-colors">
                  <lucide-icon [img]="m.icon" class="h-4 w-4 text-slate-400"></lucide-icon>
                  {{ lang.language() === 'ar' ? m.labelAr : m.labelEn }}
                </a>
                <div class="my-1 h-px bg-slate-100 dark:bg-slate-800"></div>
                <button (click)="userMenuOpen.set(false); auth.logout()" role="menuitem"
                        class="w-full flex items-center gap-3 px-3 py-2 rounded-card-sm text-sm font-medium
                               text-critical hover:bg-critical-soft/60 dark:hover:bg-critical/10 transition-colors">
                  <lucide-icon [img]="LogoutIcon" class="h-4 w-4"></lucide-icon>
                  {{ lang.language() === 'ar' ? 'تسجيل خروج' : 'Sign out' }}
                </button>
              </div>
            </div>
          </div>
        </header>

        <!-- Content -->
        <main id="main" class="flex-1 p-4 md:p-6 max-w-screen-3xl mx-auto w-full min-w-0 animate-fade-in">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .foot-btn { @apply flex-1 inline-flex items-center justify-center h-9 rounded-card-sm
                text-slate-500 dark:text-slate-400
                hover:bg-surface-muted dark:hover:bg-surface-dark-muted transition-colors; }
    .nav-group { @apply w-full flex items-center gap-3 px-2.5 py-2 rounded-card-sm text-sm font-medium
                 text-slate-700 dark:text-slate-300
                 hover:bg-slate-50 dark:hover:bg-surface-dark-muted transition-colors duration-150; }
    .nav-group.active { @apply bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300; }
    .cdk-drag-preview { @apply rounded-card-sm bg-white dark:bg-surface-dark-subtle shadow-popover ring-1 ring-slate-200 dark:ring-slate-700; }
    .cdk-drag-placeholder { @apply opacity-40; }
    .cdk-drag-animating { transition: transform 200ms cubic-bezier(0,0,0.2,1); }
    .cdk-drop-list-dragging .cdk-drag:not(.cdk-drag-dragging) { transition: transform 200ms cubic-bezier(0,0,0.2,1); }
  `],
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly lang = inject(LanguageService);
  readonly theme = inject(ThemeService);
  readonly notif = inject(NotificationCenterService);
  private readonly router = inject(Router);

  readonly collapsed = signal(false);
  readonly mobileNavOpen = signal(false);
  readonly userMenuOpen = signal(false);

  readonly MenuIcon = Menu;
  readonly CloseIcon = X;
  readonly GlobeIcon = Globe;
  readonly LogoutIcon = LogOut;
  readonly BellIcon = Bell;
  readonly ChevronDownIcon = ChevronDown;
  readonly ChevronRightIcon = ChevronRight;
  readonly AccountIcon = UserRound;

  /** titleEn keys of the expanded accordion groups (key-based so it survives reordering). */
  private readonly expandedKeys = signal<Set<string>>(new Set());

  isExpanded(key: string): boolean { return this.expandedKeys().has(key); }

  toggleGroup(key: string): void {
    // From the collapsed icon-rail, first expand the sidebar, then open the group.
    if (this.collapsed()) { this.collapsed.set(false); this.expandedKeys.set(new Set([key])); this.persistExpanded(); return; }
    const s = new Set(this.expandedKeys());
    if (s.has(key)) s.delete(key); else s.add(key);
    this.expandedKeys.set(s);
    this.persistExpanded();
  }

  // ── Main-group order (drag-to-reorder, persisted per-user) ──────────────
  /** Saved order of group titleEn keys (empty → default order). */
  private readonly navOrder = signal<string[]>([]);
  /** Groups in the user's saved order; any groups not in the saved list keep their default position at the end. */
  readonly orderedGroups = computed<NavGroup[]>(() => {
    const order = this.navOrder();
    if (!order.length) return this.groups;
    const byKey = new Map(this.groups.map((g) => [g.titleEn, g] as const));
    const out: NavGroup[] = [];
    for (const k of order) { const g = byKey.get(k); if (g) out.push(g); }
    for (const g of this.groups) if (!order.includes(g.titleEn)) out.push(g);
    return out;
  });

  dropGroup(ev: CdkDragDrop<unknown>): void {
    if (ev.previousIndex === ev.currentIndex) return;
    const keys = this.orderedGroups().map((g) => g.titleEn);
    moveItemInArray(keys, ev.previousIndex, ev.currentIndex);
    this.navOrder.set(keys);
    try { localStorage.setItem('pos-reports.nav.order', JSON.stringify(keys)); } catch { /* noop */ }
  }

  private restoreOrder(): void {
    try {
      const raw = localStorage.getItem('pos-reports.nav.order');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) this.navOrder.set(arr.filter((x): x is string => typeof x === 'string'));
      }
    } catch { /* noop */ }
  }

  /** True when one of the group's items matches the current route. */
  groupActive(g: NavGroup): boolean {
    const url = this.router.url.split('?')[0];
    return g.items.some((it) => url === it.route || url.startsWith(it.route + '/'));
  }

  accountName(): string {
    return this.auth.profile()?.name_En || this.auth.profile()?.userName || (this.lang.language() === 'ar' ? 'الحساب' : 'Account');
  }

  private persistExpanded(): void {
    try { localStorage.setItem('pos-reports.nav.expanded', JSON.stringify([...this.expandedKeys()])); } catch { /* noop */ }
  }
  private restoreExpanded(): void {
    let restored = false;
    try {
      const raw = localStorage.getItem('pos-reports.nav.expanded');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) { this.expandedKeys.set(new Set(arr.filter((x): x is string => typeof x === 'string'))); restored = true; }
      }
    } catch { /* noop */ }
    // Always make sure the group holding the current route is open.
    const active = this.groups.find((g) => !g.standalone && this.groupActive(g));
    if (active) { const s = new Set(this.expandedKeys()); s.add(active.titleEn); this.expandedKeys.set(s); }
    else if (!restored) { const first = this.groups.find((g) => !g.standalone); if (first) this.expandedKeys.set(new Set([first.titleEn])); }
  }

  /** Items in the header user-avatar dropdown. */
  readonly userMenu: NavItem[] = [
    { labelEn: 'Profile',       labelAr: 'الملف الشخصي', route: '/profile',       icon: UserRound },
    { labelEn: 'Settings',      labelAr: 'الإعدادات',    route: '/settings',      icon: Settings },
    { labelEn: 'Notifications', labelAr: 'الإشعارات',    route: '/notifications', icon: Bell },
    { labelEn: 'Help',          labelAr: 'المساعدة',     route: '/help',          icon: CircleHelp },
  ];

  readonly groups: NavGroup[] = [
    {
      titleEn: 'Overview', titleAr: 'لوحة العامة', icon: LayoutDashboard, standalone: true,
      items: [
        { labelEn: 'Dashboard',   labelAr: 'الرئيسية',   route: '/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      // Itemized single-order lifecycle — the money story of one order from
      // open to pay. Promoted to a standalone top item so an owner can jump
      // straight to "what happened on this order" without hunting a module.
      titleEn: 'Order Journey', titleAr: 'رحلة الأوردر', icon: ScrollText, standalone: true,
      items: [
        { labelEn: 'Order Journey', labelAr: 'رحلة الأوردر', route: '/journey', icon: ScrollText },
      ],
    },
    {
      // Raw action-log monitoring — who did what on every order/table,
      // with before/after. Surfaces /api/AuditReport/* + /api/OrderActionLog/*.
      titleEn: 'Monitoring', titleAr: 'المراقبة', icon: Activity,
      items: [
        { labelEn: 'Live Activity Feed', labelAr: 'النشاط المباشر',  route: '/monitoring/feed',    icon: Activity },
        { labelEn: 'Order Actions',      labelAr: 'حركات الأوردرات', route: '/monitoring/orders',  icon: ScrollText },
        { labelEn: 'Table Actions',      labelAr: 'حركات الطاولات',  route: '/monitoring/tables',  icon: Armchair },
        { labelEn: 'Activity Summary',   labelAr: 'ملخص النشاط',     route: '/monitoring/summary', icon: Gauge },
        { labelEn: 'By User',            labelAr: 'حسب المستخدم',    route: '/monitoring/by-user', icon: UserCog },
      ],
    },
    {
      titleEn: 'Business Intelligence', titleAr: 'ذكاء الأعمال', icon: ChartBar,
      items: [
        { labelEn: 'KPI Summary',          labelAr: 'مؤشرات سريعة',     route: '/bi/kpi',              icon: ChartBar },
        { labelEn: 'Peak Hours',           labelAr: 'ساعات الذروة',     route: '/bi/peak-hours',       icon: ChartBar },
        { labelEn: 'Average Order Value',  labelAr: 'متوسط قيمة الطلب', route: '/bi/aov',              icon: ChartBar },
        { labelEn: 'Payment Mix',          labelAr: 'توزيع طرق الدفع',  route: '/bi/payment-mix',      icon: ChartBar },
        { labelEn: 'Staff Productivity',   labelAr: 'إنتاجية الكاشير',  route: '/bi/staff',            icon: ChartBar },
        { labelEn: 'Customer Retention',   labelAr: 'احتفاظ بالعملاء',  route: '/bi/retention',        icon: ChartBar },
        { labelEn: 'Modifier Popularity',  labelAr: 'شعبية الإضافات',   route: '/bi/modifiers',        icon: ChartBar },
      ],
    },
    {
      titleEn: 'Audit', titleAr: 'تدقيق', icon: FileText,
      items: [
        { labelEn: 'Daily',                labelAr: 'يومي',             route: '/audit/daily',         icon: FileText },
        { labelEn: 'Totals',               labelAr: 'إجمالي',           route: '/audit/totals',        icon: FileText },
        { labelEn: 'Order Journey',        labelAr: 'رحلة الأوردر',     route: '/audit/order-journey', icon: FileText },
        { labelEn: 'User Session',         labelAr: 'جلسة مستخدم',      route: '/audit/user-session',  icon: FileText },
        { labelEn: 'Suspicious Activity',  labelAr: 'أنشطة مريبة',       route: '/audit/suspicious',    icon: FileText },
        { labelEn: 'Daily Digest',         labelAr: 'ملخص يومي',         route: '/audit/digest',        icon: FileText },
      ],
    },
    {
      titleEn: 'Per Transaction', titleAr: 'حسب نوع الطلب', icon: Soup,
      items: [
        { labelEn: 'Dine-in',   labelAr: 'صالة',     route: '/trx/dinein',   icon: Soup },
        { labelEn: 'Take-away', labelAr: 'تيك أواي', route: '/trx/takeaway', icon: Soup },
        { labelEn: 'Delivery',  labelAr: 'ديليفري',  route: '/trx/delivery', icon: Truck },
      ],
    },
    {
      // Owner-decision insights — every page answers a specific manager
      // question (grow / who-steals / who's-lazy / why-slow / what-not-paid)
      // and surfaces a bilingual conclusion naming the action to take.
      // The pages either consume `/api/OwnerInsights/*` or wrap a matching
      // `/api/BusinessIntelligence/*` endpoint, and link out to the audit
      // narratives (Order Journey, User Session) for drill-down.
      titleEn: 'Owner Insights', titleAr: 'رؤى للمالك', icon: TrendingUp,
      items: [
        { labelEn: 'Growth Trends',                labelAr: 'اتجاهات النمو',          route: '/insights/growth',           icon: TrendingUp },
        { labelEn: 'Top Paying Customers',         labelAr: 'أفضل العملاء دفعاً',     route: '/insights/top-customers',    icon: ChartBar },
        { labelEn: 'Post-Checkout Modifications',  labelAr: 'تعديلات بعد الدفع',      route: '/insights/post-checkout',    icon: FileText },
        { labelEn: 'Items Not Paid',               labelAr: 'أصناف غير مدفوعة',      route: '/insights/items-not-paid',   icon: TriangleAlert },
        { labelEn: 'Staff Productivity Gaps',      labelAr: 'فجوات أداء الموظفين',   route: '/insights/staff-gaps',       icon: UserCog },
        { labelEn: 'Operational Time Gaps',        labelAr: 'فجوات وقت العمليات',    route: '/insights/lifecycle-delays', icon: Timer },
        { labelEn: 'Revenue Leakage Detail',       labelAr: 'تسرّب الإيرادات',        route: '/insights/revenue-leakage',  icon: Banknote },
      ],
    },
    {
      titleEn: 'Performance', titleAr: 'الأداء', icon: Gauge,
      items: [
        { labelEn: 'Item Insights',  labelAr: 'تحليل الأصناف',  route: '/perf/items',         icon: ChartBar },
        { labelEn: 'Highly Sales',   labelAr: 'الأعلى مبيعاً',   route: '/perf/highly',        icon: ChartBar },
        { labelEn: 'Low Sales',      labelAr: 'الأقل مبيعاً',    route: '/perf/low',           icon: ChartBar },
        { labelEn: 'Service Speed',  labelAr: 'سرعة الخدمة',    route: '/perf/speed',         icon: Truck },
        { labelEn: 'Speed by Pilot', labelAr: 'سرعة لكل سواق',  route: '/perf/speed-pilot',   icon: Truck },
      ],
    },
    // ── Migrated legacy reports (config-driven, see report-registry) ──
    //    The flagship "Daily Sales" page (/sales/period) leads the Sales group.
    ...REPORT_NAV.map((g) => ({
      titleEn: g.titleEn, titleAr: g.titleAr,
      icon: REPORT_GROUP_ICONS[g.titleEn] ?? ReceiptText,
      items: [
        ...(g.titleEn === 'Daily'
          ? [{ labelEn: 'Daily Sales', labelAr: 'المبيعات اليومية', route: '/sales/period', icon: ReceiptText }]
          : []),
        ...(g.titleEn === 'Sales'
          ? [{ labelEn: 'Daily Transactions', labelAr: 'حركة المبيعات اليومية', route: '/total-report', icon: ReceiptText }]
          : []),
        ...g.ids.map((id) => ({
          labelEn: REPORT_REGISTRY[id]?.titleEn ?? id,
          labelAr: REPORT_REGISTRY[id]?.titleAr ?? id,
          route: `/report/${id}`,
          icon: REPORT_GROUP_ICONS[g.titleEn] ?? ReceiptText,
        })),
      ],
    })),
  ];

  constructor() { this.restoreOrder(); this.restoreExpanded(); }

  /**
   * One computed class string for the aside element. Combines:
   * - width (collapsed vs expanded)
   * - mobile drawer transform (slide-in / slide-out)
   * - desktop visibility (always visible at lg+, regardless of drawer state)
   *
   * Composing the string in TS (rather than `[class.X]` per token) keeps
   * Tailwind's JIT happy — every class appears literally in source — and
   * avoids the Angular parser hiccup on class tokens that contain `:`
   * (which Tailwind variants like `rtl:` and `lg:` use).
   */
  readonly asideClasses = computed(() => {
    const width = this.collapsed() ? 'w-16' : 'w-64';
    const open  = this.mobileNavOpen();
    // Mobile (default): drawer slides off-screen when closed.
    //   LTR: hidden = -translate-x-full  (off-screen left)
    //   RTL: hidden =  translate-x-full  (off-screen right)
    // Desktop (lg:): always visible — lg:translate-x-0 overrides the
    // mobile transform on large screens.
    let transform = 'translate-x-0 lg:translate-x-0';
    if (!open) {
      transform = this.lang.language() === 'ar'
        ? 'translate-x-full lg:translate-x-0'
        : '-translate-x-full lg:translate-x-0';
    }
    return `${width} ${transform}`;
  });

  /**
   * Returns inline-margin classes for the main column.
   *
   * With the outer container now using row-flex (was column-flex), the
   * sidebar naturally occupies its width on `lg:` and the main column
   * takes the remaining space via `flex-1`. So NO margin offset is
   * needed on desktop. The class is kept (returning empty) so existing
   * `[class]="mainOffsetClass()"` bindings still type-check; we can
   * delete the binding entirely in a follow-up cleanup.
   */
  readonly mainOffsetClass = computed(() => '');

  themeIcon(): LucideIcon {
    const m = this.theme.mode();
    if (m === 'light') return Sun;
    if (m === 'dark') return Moon;
    return MonitorCog;
  }

  themeLabel(): string {
    const m = this.theme.mode();
    const ar = m === 'light' ? 'فاتح' : m === 'dark' ? 'داكن' : 'تلقائي';
    const en = m === 'light' ? 'Light' : m === 'dark' ? 'Dark' : 'System';
    return this.lang.language() === 'ar' ? ar : en;
  }

  initials(): string {
    const name = this.auth.profile()?.name_En || this.auth.profile()?.userName || 'U';
    return name.slice(0, 2).toUpperCase();
  }

  @HostListener('window:keydown.escape')
  onEsc(): void {
    this.mobileNavOpen.set(false);
    this.userMenuOpen.set(false);
  }
}
