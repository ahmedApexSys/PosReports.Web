# PosReports.Web — Claude Code Project Memory

> **Remote** (added 2026-05-25): `github.com/ahmedApexSys/PosReports.Web`
> **Branches on origin**: `main` · `Production` · `FixReservationEdit-IsPaidOrder+09-06-2026`
> **Current working branch**: `SalesReports+15-06-2026` — **merged to `Production` 2026-06-17**.
>
> **Session 2026-06-15→17** — migrated all 22+ legacy "Sales reports" into a
> generic config-driven engine (`core/reports/report-registry.ts` →
> `ReportDef`/`ReportColumn`, `shared/tabular-report-page` host, `report/:id`
> route). Per-user column customizer (show/hide + drag + localStorage). Filter
> bar + lookups. Bilingual styled exports (Excel/PDF/CSV) + **thermal-receipt
> Flash/POS 72/80** (`ExportService.buildReceipt`) — pure-black high-contrast
> for real receipt printers, per-report curated short-named `receiptColumns`,
> smart transaction abbreviations (TakeAway→T.Away). **NEW "Daily Transactions"**
> bespoke multi-section report (`TotalsReport/TotalReport`) — `core/reports/
> total-report.model.ts` + `features/reports/total-report.component.ts` +
> `ExportService.totalReport()` sectioned receipt; route `/total-report`,
> company-wide (ForAllBranches:true), date-only API format. Deployed live via
> FTP to **posreporting.tryasp.net** (host site73506) throughout.
>
> **Session 2026-05-25** — repo pushed to GitHub for the first time. WIP audit /
> owner-insights work captured in commit `cd1c346` (18 files: routes, audit
> API, owner-insights API + models, daily/order-journey/suspicious/user-session
> audit pages, trx-page rebar, shell tweaks, NEW insights feature folder with
> 7 components — growth-trends, items-not-paid, lifecycle-delays, post-checkout,
> revenue-leakage-detail, staff-gaps, top-customers — and the audit-event-card
> shared component). All WIP — still needs design polish + the 21-remaining-
> pages work before merge.

## What this is
**Angular 21.2.12** frontend for ApexPointOfSale reports. Package name
`pos-reports-web`. Consumes the POS API report endpoints (the
`ApexPointOfSale` repo) and ultimately the SQL backend in the sibling
`Reporting` repo.

History: scaffolded as Angular 19 then upgraded to **Angular 21.2.12** after
Node 24.15 (commit `c56f4af`). The full auth flow, theme / language / filter
services, 5 design primitives, the shell, the Dashboard end-to-end, and a
22-route sidebar are in place. Stack:
- **ng-apexcharts 2.4** for charts.
- **Angular CDK 21**.
- **lucide-angular 1.0** for icons.
- 0 vulnerabilities, **strict peer deps** (no `legacy-peer-deps`).

## How to start / setup (fresh clone)

```bash
# Prereq: Node 24.15 + (Angular 21 requires it)
npm install
ng serve                # http://localhost:4200/
ng build                # production build → dist/
ng generate component <name>
ng test
```

The backend it talks to is the `ApexPointOfSale` API (.NET 10), so a typical
dev setup runs the POS API alongside this front-end.

## NEXT TO DO
- Verify the Angular 21 upgrade renders in the browser. During the upgrade a
  diagnostic banner + an `authGuard` console.log were left in — remove them
  once rendering is confirmed.
- Wire **ApexCharts** visuals + a **DateRangePicker** + a **BranchPicker**.
- The remaining **21 report pages** (the shell + Dashboard are done; the
  other 22-route sidebar pages need their per-page work).
- Design prompt is at `D:\Apex work\_state\PosReports.Web\CLAUDE-DESIGN-PROMPT.md`.

## Related projects on `D:\Apex work\`
- **ApexPointOfSale** — the POS API this frontend calls.
- **Reporting** — the SQL reports + report-service backend.
- The kitchen-slip projects (**SignalRProject**, **SlipPrinting_Service**,
  **PrintifyManager**) are unrelated to reports but live in the same
  workspace (currently on branch `KitchenSlipFix+21-05-2026`).

## Continuation aid
The NotebookLM notebook **"Apex POS Kitchen Slip Printing Resolution Brief"**
holds the cross-project context for the kitchen-slip pipeline — a separate
concern from this front-end, but useful for the wider workspace overview.
