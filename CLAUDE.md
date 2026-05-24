# PosReports.Web — Claude Code Project Memory

> **Branch**: `main`. **Local-only repo** — no `origin` remote configured.
> Before pushing, run `git remote add origin <url>`.

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
