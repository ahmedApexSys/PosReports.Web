import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

/**
 * Every route in the IA is named explicitly so:
 * - The sidebar in shell.component points at real URLs that resolve
 * - Each of the 22 report routes lands on a real component that fetches
 *   the matching API endpoint and renders through the shared shells
 *   (BiPanelPageComponent for the 13 BiPanel-returning endpoints,
 *    AuditReportPageComponent for the 9 audit-narrative endpoints).
 * - Lazy-loading is per-feature so users only pay the JS cost of the
 *   reports they actually open.
 *
 * The wiring covers all 22 read endpoints across the API:
 *   1 + 7 Business Intelligence (/dashboard + /bi/*)
 *   6 Audit Narrative + 3 Per-Transaction (/audit/* + /trx/*)
 *   5 Performance / Insights (/perf/*)
 *
 * The 4 utility routes (profile / settings / help / notifications) still
 * use the lightweight placeholder until their UIs are built.
 */

const lazy = {
  // ── Dashboard ──────────────────────────────────────────────────
  dashboard: () =>
    import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),

  // ── Business Intelligence (7 sub-pages, dashboard is the 8th) ──
  biKpi: () =>
    import('./features/bi/kpi-summary.component').then(m => m.KpiSummaryComponent),
  biPeakHours: () =>
    import('./features/bi/peak-hours.component').then(m => m.PeakHoursComponent),
  biAov: () =>
    import('./features/bi/aov.component').then(m => m.AovComponent),
  biPaymentMix: () =>
    import('./features/bi/payment-mix.component').then(m => m.PaymentMixComponent),
  biStaff: () =>
    import('./features/bi/staff-productivity.component').then(m => m.StaffProductivityComponent),
  biRetention: () =>
    import('./features/bi/customer-retention.component').then(m => m.CustomerRetentionComponent),
  biModifiers: () =>
    import('./features/bi/modifier-popularity.component').then(m => m.ModifierPopularityComponent),

  // ── Audit Narrative (6) ────────────────────────────────────────
  auditDaily: () =>
    import('./features/audit/daily.component').then(m => m.AuditDailyComponent),
  auditTotals: () =>
    import('./features/audit/totals.component').then(m => m.AuditTotalsComponent),
  auditOrderJourney: () =>
    import('./features/audit/order-journey.component').then(m => m.AuditOrderJourneyComponent),
  auditUserSession: () =>
    import('./features/audit/user-session.component').then(m => m.AuditUserSessionComponent),
  auditSuspicious: () =>
    import('./features/audit/suspicious.component').then(m => m.AuditSuspiciousComponent),
  auditDigest: () =>
    import('./features/audit/digest.component').then(m => m.AuditDigestComponent),

  // ── Per-Transaction (3) ────────────────────────────────────────
  trxDineIn: () =>
    import('./features/trx/dinein.component').then(m => m.TrxDineInComponent),
  trxTakeAway: () =>
    import('./features/trx/takeaway.component').then(m => m.TrxTakeAwayComponent),
  trxDelivery: () =>
    import('./features/trx/delivery.component').then(m => m.TrxDeliveryComponent),

  // ── Owner Insights (7 owner-decision pages) ────────────────────
  insightsTopCustomers: () =>
    import('./features/insights/top-customers.component').then(m => m.TopCustomersComponent),
  insightsPostCheckout: () =>
    import('./features/insights/post-checkout.component').then(m => m.PostCheckoutComponent),
  insightsGrowth: () =>
    import('./features/insights/growth-trends.component').then(m => m.GrowthTrendsComponent),
  insightsItemsNotPaid: () =>
    import('./features/insights/items-not-paid.component').then(m => m.ItemsNotPaidComponent),
  insightsStaffGaps: () =>
    import('./features/insights/staff-gaps.component').then(m => m.StaffGapsComponent),
  insightsLifecycleDelays: () =>
    import('./features/insights/lifecycle-delays.component').then(m => m.LifecycleDelaysComponent),
  insightsRevenueLeakage: () =>
    import('./features/insights/revenue-leakage-detail.component').then(m => m.RevenueLeakageDetailComponent),

  // ── Performance / Insights (5) ─────────────────────────────────
  perfItems: () =>
    import('./features/perf/items.component').then(m => m.PerfItemsComponent),
  perfHighly: () =>
    import('./features/perf/highly.component').then(m => m.PerfHighlyComponent),
  perfLow: () =>
    import('./features/perf/low.component').then(m => m.PerfLowComponent),
  perfSpeed: () =>
    import('./features/perf/speed.component').then(m => m.PerfSpeedComponent),
  perfSpeedPilot: () =>
    import('./features/perf/speed-pilot.component').then(m => m.PerfSpeedPilotComponent),

  // ── Placeholder (utility pages still pending UI) ───────────────
  placeholder: () =>
    import('./features/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
};

export const routes: Routes = [
  // ── Public ──────────────────────────────────────────────────────
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent),
    title: 'Sign in — Apex Reports',
  },

  // ── Authenticated shell ─────────────────────────────────────────
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell.component').then(m => m.ShellComponent),
    children: [
      // Default landing
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },

      // ── Dashboard (1) ───────────────────────────────────────
      { path: 'dashboard',                 loadComponent: lazy.dashboard,         title: 'Dashboard' },

      // ── Business Intelligence (7 sub-pages) ─────────────────
      { path: 'bi/kpi',                    loadComponent: lazy.biKpi,             title: 'KPI Summary' },
      { path: 'bi/peak-hours',             loadComponent: lazy.biPeakHours,       title: 'Peak Hours' },
      { path: 'bi/aov',                    loadComponent: lazy.biAov,             title: 'Average Order Value' },
      { path: 'bi/payment-mix',            loadComponent: lazy.biPaymentMix,      title: 'Payment Mix' },
      { path: 'bi/staff',                  loadComponent: lazy.biStaff,           title: 'Staff Productivity' },
      { path: 'bi/retention',              loadComponent: lazy.biRetention,       title: 'Customer Retention' },
      { path: 'bi/modifiers',              loadComponent: lazy.biModifiers,       title: 'Modifier Popularity' },

      // ── Audit Narrative (6) ─────────────────────────────────
      { path: 'audit/daily',               loadComponent: lazy.auditDaily,        title: 'Daily Audit Narrative' },
      { path: 'audit/totals',              loadComponent: lazy.auditTotals,       title: 'Audit Totals' },
      { path: 'audit/order-journey',       loadComponent: lazy.auditOrderJourney, title: 'Order Journey' },
      { path: 'audit/user-session',        loadComponent: lazy.auditUserSession,  title: 'User Session' },
      { path: 'audit/suspicious',          loadComponent: lazy.auditSuspicious,   title: 'Suspicious Activity' },
      { path: 'audit/digest',              loadComponent: lazy.auditDigest,       title: 'Daily Digest' },

      // ── Per-Transaction (3) ─────────────────────────────────
      { path: 'trx/dinein',                loadComponent: lazy.trxDineIn,         title: 'Dine-In' },
      { path: 'trx/takeaway',              loadComponent: lazy.trxTakeAway,       title: 'Take-away' },
      { path: 'trx/delivery',              loadComponent: lazy.trxDelivery,       title: 'Delivery' },

      // ── Owner Insights (7 owner-decision pages) ─────────────
      { path: 'insights/top-customers',    loadComponent: lazy.insightsTopCustomers,     title: 'Top Paying Customers' },
      { path: 'insights/post-checkout',    loadComponent: lazy.insightsPostCheckout,     title: 'Post-Checkout Modifications' },
      { path: 'insights/growth',           loadComponent: lazy.insightsGrowth,           title: 'Growth Trends' },
      { path: 'insights/items-not-paid',   loadComponent: lazy.insightsItemsNotPaid,     title: 'Items Not Paid' },
      { path: 'insights/staff-gaps',       loadComponent: lazy.insightsStaffGaps,        title: 'Staff Productivity Gaps' },
      { path: 'insights/lifecycle-delays', loadComponent: lazy.insightsLifecycleDelays,  title: 'Operational Time Gaps' },
      { path: 'insights/revenue-leakage',  loadComponent: lazy.insightsRevenueLeakage,   title: 'Revenue Leakage Detail' },

      // ── Performance / Insights (5) ──────────────────────────
      { path: 'perf/items',                loadComponent: lazy.perfItems,         title: 'Item Insights' },
      { path: 'perf/highly',               loadComponent: lazy.perfHighly,        title: 'Highly Sales' },
      { path: 'perf/low',                  loadComponent: lazy.perfLow,           title: 'Low Sales' },
      { path: 'perf/speed',                loadComponent: lazy.perfSpeed,         title: 'Service Speed' },
      { path: 'perf/speed-pilot',          loadComponent: lazy.perfSpeedPilot,    title: 'Speed by Pilot' },

      // ── Utility (still using PlaceholderComponent) ──────────
      { path: 'profile',                   loadComponent: lazy.placeholder,       title: 'Profile' },
      { path: 'settings',                  loadComponent: lazy.placeholder,       title: 'Settings' },
      { path: 'help',                      loadComponent: lazy.placeholder,       title: 'Help' },
      { path: 'notifications',             loadComponent: lazy.placeholder,       title: 'Notifications' },

      // Catch-all → placeholder (the URL chip on the card shows where you are)
      { path: '**',                        loadComponent: lazy.placeholder },
    ],
  },

  // ── Anything else (unauthenticated) ─────────────────────────────
  { path: '**', redirectTo: '' },
];
