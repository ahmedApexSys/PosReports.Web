import { Component, inject, signal, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet, Router } from '@angular/router';
import { LucideAngularModule, LayoutDashboard, ChartBar, FileText, Truck, Soup, Globe, Menu, X, LogOut, Sun, Moon, MonitorCog } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { ThemeService } from '../../core/theme/theme.service';

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
  items: NavItem[];
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen flex flex-col bg-surface dark:bg-surface-dark">
      <!-- Mobile drawer overlay -->
      <div *ngIf="mobileNavOpen()"
           (click)="mobileNavOpen.set(false)"
           class="fixed inset-0 z-30 bg-black/40 lg:hidden"></div>

      <!-- ── Sidebar ────────────────────────────────────────────── -->
      <aside class="fixed lg:sticky top-0 z-40 h-screen
                    bg-white dark:bg-surface-dark-subtle
                    border-e border-slate-200 dark:border-slate-800
                    transition-transform duration-220
                    flex flex-col"
             [class.translate-x-0]="mobileNavOpen()"
             [class.-translate-x-full]="!mobileNavOpen()"
             [class.rtl:translate-x-0]="mobileNavOpen()"
             [class.rtl:translate-x-full]="!mobileNavOpen()"
             [class]="sidebarWidthClass()">

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

        <!-- Nav -->
        <nav class="flex-1 overflow-y-auto px-2 py-4 space-y-6">
          <div *ngFor="let g of groups" class="space-y-1">
            <div *ngIf="!collapsed()"
                 class="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {{ lang.language() === 'ar' ? g.titleAr : g.titleEn }}
            </div>
            <a *ngFor="let item of g.items"
               [routerLink]="item.route"
               routerLinkActive="bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300"
               #rla="routerLinkActive"
               class="flex items-center gap-3 px-3 py-2 rounded-card-sm text-sm font-medium
                      text-slate-700 dark:text-slate-300
                      hover:bg-slate-50 dark:hover:bg-surface-dark-muted
                      transition-colors duration-180"
               (click)="mobileNavOpen.set(false)">
              <lucide-icon [img]="item.icon" class="h-4 w-4 shrink-0"></lucide-icon>
              <span *ngIf="!collapsed()" class="truncate">
                {{ lang.language() === 'ar' ? item.labelAr : item.labelEn }}
              </span>
            </a>
          </div>
        </nav>

        <!-- Footer of sidebar — toggles + profile -->
        <div class="border-t border-slate-200 dark:border-slate-800 p-2 space-y-1">
          <button (click)="theme.cycle()" class="btn-ghost w-full justify-start text-sm">
            <lucide-icon [img]="themeIcon()" class="h-4 w-4"></lucide-icon>
            <span *ngIf="!collapsed()">{{ themeLabel() }}</span>
          </button>
          <button (click)="lang.toggle()" class="btn-ghost w-full justify-start text-sm">
            <lucide-icon [img]="GlobeIcon" class="h-4 w-4"></lucide-icon>
            <span *ngIf="!collapsed()">{{ lang.language() === 'ar' ? 'English' : 'عربي' }}</span>
          </button>
          <button (click)="auth.logout()" class="btn-ghost w-full justify-start text-sm text-critical">
            <lucide-icon [img]="LogoutIcon" class="h-4 w-4"></lucide-icon>
            <span *ngIf="!collapsed()">{{ lang.language() === 'ar' ? 'تسجيل خروج' : 'Sign out' }}</span>
          </button>
        </div>
      </aside>

      <!-- ── Main content ──────────────────────────────────────── -->
      <div class="flex-1 flex flex-col min-h-screen"
           [class]="mainOffsetClass()">

        <!-- Header -->
        <header class="sticky top-0 z-20 h-16 bg-white dark:bg-surface-dark-subtle
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

          <div class="flex-1 min-w-0">
            <!-- Filter bar placeholder — wire FilterService next iteration -->
            <div class="text-xs text-slate-500 dark:text-slate-400 truncate">
              {{ lang.language() === 'ar' ? 'الفترة الحالية: آخر 7 أيام' : 'Current window: last 7 days' }}
            </div>
          </div>

          <div class="flex items-center gap-2">
            <div class="text-xs text-slate-600 dark:text-slate-300 hidden md:block">
              {{ auth.profile()?.name_En || auth.profile()?.userName || 'User' }}
            </div>
            <div class="h-9 w-9 rounded-full bg-brand-700 text-white flex items-center justify-center text-sm font-semibold">
              {{ initials() }}
            </div>
          </div>
        </header>

        <!-- Content -->
        <main id="main" class="flex-1 p-4 md:p-6 max-w-screen-3xl mx-auto w-full">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly lang = inject(LanguageService);
  readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  readonly collapsed = signal(false);
  readonly mobileNavOpen = signal(false);

  readonly MenuIcon = Menu;
  readonly CloseIcon = X;
  readonly GlobeIcon = Globe;
  readonly LogoutIcon = LogOut;

  readonly groups: NavGroup[] = [
    {
      titleEn: 'Overview', titleAr: 'لوحة العامة',
      items: [
        { labelEn: 'Dashboard',   labelAr: 'الرئيسية',   route: '/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      titleEn: 'Business Intelligence', titleAr: 'ذكاء الأعمال',
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
      titleEn: 'Audit', titleAr: 'تدقيق',
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
      titleEn: 'Per Transaction', titleAr: 'حسب نوع الطلب',
      items: [
        { labelEn: 'Dine-in',   labelAr: 'صالة',     route: '/trx/dinein',   icon: Soup },
        { labelEn: 'Take-away', labelAr: 'تيك أواي', route: '/trx/takeaway', icon: Soup },
        { labelEn: 'Delivery',  labelAr: 'ديليفري',  route: '/trx/delivery', icon: Truck },
      ],
    },
    {
      titleEn: 'Performance', titleAr: 'الأداء',
      items: [
        { labelEn: 'Item Insights',  labelAr: 'تحليل الأصناف',  route: '/perf/items',         icon: ChartBar },
        { labelEn: 'Highly Sales',   labelAr: 'الأعلى مبيعاً',   route: '/perf/highly',        icon: ChartBar },
        { labelEn: 'Low Sales',      labelAr: 'الأقل مبيعاً',    route: '/perf/low',           icon: ChartBar },
        { labelEn: 'Service Speed',  labelAr: 'سرعة الخدمة',    route: '/perf/speed',         icon: Truck },
        { labelEn: 'Speed by Pilot', labelAr: 'سرعة لكل سواق',  route: '/perf/speed-pilot',   icon: Truck },
      ],
    },
  ];

  sidebarWidthClass(): string {
    return this.collapsed() ? 'w-16' : 'w-64';
  }

  mainOffsetClass(): string {
    return this.collapsed() ? 'lg:ms-16' : 'lg:ms-64';
  }

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
  }
}
