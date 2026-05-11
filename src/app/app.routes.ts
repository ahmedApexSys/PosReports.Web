import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

/**
 * Every route in the IA is named explicitly so:
 * - The sidebar in shell.component points at real URLs that resolve
 * - Unimplemented routes show a friendly "coming soon" placeholder
 *   rather than 404 OR a misleading Dashboard
 * - Lazy-loading is per-feature where the feature is implemented;
 *   placeholder routes share a single lightweight component
 *
 * The wiring covers all 22 read endpoints across the API:
 *   9 Audit Narrative      (/audit/*)
 *   8 Business Intelligence (/bi/*)
 *   3 Per-transaction       (/trx/*)
 *   5 Performance / Insights (/perf/*)
 *
 * As each report gets a real implementation, replace its
 * `loadPlaceholder` with the actual feature component.
 */

const loadDashboard = () =>
  import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent);

const loadPlaceholder = () =>
  import('./features/placeholder/placeholder.component').then(m => m.PlaceholderComponent);

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

      // ── Dashboard (implemented) ─────────────────────────────
      { path: 'dashboard',                 loadComponent: loadDashboard, title: 'Dashboard' },

      // ── Business Intelligence (8 endpoints) ─────────────────
      // Dashboard endpoint already exposed at /dashboard.
      { path: 'bi/kpi',                    loadComponent: loadPlaceholder, title: 'KPI Summary' },
      { path: 'bi/peak-hours',             loadComponent: loadPlaceholder, title: 'Peak Hours' },
      { path: 'bi/aov',                    loadComponent: loadPlaceholder, title: 'Average Order Value' },
      { path: 'bi/payment-mix',            loadComponent: loadPlaceholder, title: 'Payment Mix' },
      { path: 'bi/staff',                  loadComponent: loadPlaceholder, title: 'Staff Productivity' },
      { path: 'bi/retention',              loadComponent: loadPlaceholder, title: 'Customer Retention' },
      { path: 'bi/modifiers',              loadComponent: loadPlaceholder, title: 'Modifier Popularity' },

      // ── Audit Narrative (9 endpoints) ───────────────────────
      { path: 'audit/daily',               loadComponent: loadPlaceholder, title: 'Daily Audit Narrative' },
      { path: 'audit/totals',              loadComponent: loadPlaceholder, title: 'Audit Totals' },
      { path: 'audit/order-journey',       loadComponent: loadPlaceholder, title: 'Order Journey' },
      { path: 'audit/user-session',        loadComponent: loadPlaceholder, title: 'User Session' },
      { path: 'audit/suspicious',          loadComponent: loadPlaceholder, title: 'Suspicious Activity' },
      { path: 'audit/digest',              loadComponent: loadPlaceholder, title: 'Daily Digest' },

      // ── Per-Transaction (3 endpoints) ───────────────────────
      { path: 'trx/dinein',                loadComponent: loadPlaceholder, title: 'Dine-In' },
      { path: 'trx/takeaway',              loadComponent: loadPlaceholder, title: 'Take-away' },
      { path: 'trx/delivery',              loadComponent: loadPlaceholder, title: 'Delivery' },

      // ── Performance / Insights (5 endpoints) ────────────────
      { path: 'perf/items',                loadComponent: loadPlaceholder, title: 'Item Insights' },
      { path: 'perf/highly',               loadComponent: loadPlaceholder, title: 'Highly Sales' },
      { path: 'perf/low',                  loadComponent: loadPlaceholder, title: 'Low Sales' },
      { path: 'perf/speed',                loadComponent: loadPlaceholder, title: 'Service Speed' },
      { path: 'perf/speed-pilot',          loadComponent: loadPlaceholder, title: 'Speed by Pilot' },

      // ── Profile / Settings / Help (future) ──────────────────
      { path: 'profile',                   loadComponent: loadPlaceholder, title: 'Profile' },
      { path: 'settings',                  loadComponent: loadPlaceholder, title: 'Settings' },
      { path: 'help',                      loadComponent: loadPlaceholder, title: 'Help' },
      { path: 'notifications',             loadComponent: loadPlaceholder, title: 'Notifications' },

      // Any unrecognised authenticated path → placeholder (with the URL shown)
      { path: '**',                        loadComponent: loadPlaceholder },
    ],
  },

  // ── Anything else (unauthenticated) ─────────────────────────────
  { path: '**', redirectTo: '' },
];
