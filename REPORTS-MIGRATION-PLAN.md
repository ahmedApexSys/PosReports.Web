# Moving every report into PosReports.Web

> Opened 2026-11-03 at the owner's request: *"كل الـ reports ضاربة ومش شغالة،
> وعايز أنقل كل الـ reports اللي عندي في project PosReports"* — and, after it,
> *"متنساش الـ cheques برده"*.
>
> Branch: `ReportsMigration+03-11-2026` (never `Production` or `main`).

## Where things stand — measured, not assumed

### The till has 29 report screens (`POSOrdering/src/app/report/`)

### PosReports.Web already carries most of them

24 config-driven reports in `src/app/core/reports/report-registry.ts`, plus
bespoke routes (`total-report`, `journey`, `takeaway-day`, `delivery-day`,
`table-day`, `dashboard`).

| Till screen | In PosReports | |
|---|---|---|
| salesPeriod | `salesPeriod` (+ by-transaction, by-payment) | ✓ |
| sold-items · sold-item-waiter · sold-items-summary | `sold-items` · `sold-item-waiter` · `SoldItemsSummary` | ✓ |
| ItemRankingTopItems · worst-Items | `TopItems` · `worst-Items` | ✓ |
| cancelled-order · void-items | `cancelled-order-report` · `void-items-report` | ✓ |
| total-pos · total-discount | `total-pos` · `total-discount` | ✓ |
| promo-code-details · vouchers-details | same ids | ✓ |
| sales-expenses · total-expenses | same ids | ✓ |
| sales-reservation · total-reservations | `sales-reservations` · `total-reservations` | ✓ |
| sales-deferred · total-deferred | same ids | ✓ |
| daily-transactions | bespoke `total-report` (Daily Transactions) | ✓ |
| orderLog · order-control | bespoke `journey` (order journey / audit) | likely ✓ — confirm |
| **daily-sales** | — | **to build** |
| **sales-details** | — | **to build** |
| **sales-settlements · total-settlements** | — | **to build** |
| **order-time-after-prepar** | — | **to build** |
| **wasted-report** | — | **to build** |
| **view-cheque** (the cheque reprint) | — | **to build — and it must print the designed cheque, not the legacy one** |

### Every endpoint PosReports calls is present on the live API

All 19 distinct endpoints in the registry answer **401** on
`ts9api.tryasp.net` unauthenticated — the route exists. None is 404. So
"broken" is not a removed route.

### What IS wrong, found so far

1. **`https://posreporting.tryasp.net` fails** — an SSL connect error. Over
   `http://` the site serves (200, "PosReports — Apex Point of Sale"). Anyone
   opening it as https sees nothing load. *Owner's action: bind/renew the
   certificate for that host in the MonsterASP panel.*
2. **There is no WebDeploy profile for PosReports on this machine** (site
   `site73506`). The repo's `deploy-reports-webdeploy.ps1` targets it, but the
   password comes from the owner's `.publishSettings`, and there is none in
   Downloads. *Needed before anything here can ship.*
3. Still to establish: **what "broken" looks like on screen.** Every route is
   there, so the failure is in auth, response shape or the page — and it
   cannot be seen without a session.

## The plan

| Phase | What | Done when |
|---|---|---|
| **0** | Reproduce "broken" on the live site, report by report | each report: works / fails, with the failing request |
| **1** | Fix what fails in the 24 that already exist | every existing report renders real data |
| **2** | Build the missing ones in the registry: daily-sales, sales-details, sales-settlements, total-settlements, order-time-after-prepar, wasted-report | each reachable from the sidebar, with its export |
| **3** | **The cheques** — cheque reprint (view-cheque) in PosReports, printing the shared designed cheque (`POSOrdering/src/app/shared/cheque`), not the legacy markup | a reprint looks like the cheque the till printed |
| **4** | Point the till's Reports menu at PosReports, and retire `src/app/report/` once every screen has a home | the till has one report path, not two |
| **5** | https on posreporting, deploy, verify live | each report opened from the live site |

Phase 4 deletes code from the till — 29 screens — which is the point of the
move; it happens only after each one is confirmed working in PosReports.

## Blocked on the owner

- The `.publishSettings` for **site73506** (posreporting) — nothing can be
  deployed here without it.
- The certificate for **posreporting.tryasp.net** (https).
- A login for PosReports, or the failing screen — so Phase 0 can see the
  failure rather than guess at it.
