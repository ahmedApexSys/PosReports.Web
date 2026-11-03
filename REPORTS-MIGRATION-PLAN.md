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
| daily-sales | `salesPeriod` + its per-transaction / per-payment views (same `getDailySalesReport`) | ✓ already here |
| sales-details | `sold-items-details` (same `ItemAndModifierSalesDetails`) | ✓ already here |
| sales-settlements · total-settlements | `sales-deferred` · `total-deferred` — the API retired the settlements route onto CLedges | ✓ already here |
| order-time-after-prepar | **`order-prep-time`** — Kitchen & Delivery Time, with the gaps in minutes | ✓ **built + live 2026-11-03** (`a68108f`) |
| wasted-report | **`wasted-report`** — Wasted & Officer Orders | ✓ **built + live 2026-11-03** (`a68108f`) |
| view-cheque (the cheque reprint) | stays in the till for now — see Phase 3 | the till's reprint now prints the designed cheque (`3806c20`) |

### Every endpoint PosReports calls is present in the API

~~All 19 answer 401, so the routes exist~~ — **that proof was wrong**: the live
API answers **401 to a route that does not exist too** (`/api/zzz/NoSuchThing`
→ 401), because authentication runs before routing. Checked instead against the
API source (705 routes): every endpoint in the registry exists. The till's
`SalesReports/SalesReports`, `GetOrderDetailsPrint/GetOrderDetailsPrint` and
`reports/settlements/*` do NOT — but those are dead `url` fields on services
the screens never call; the screens call routes that do exist.

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

## Phase 3 — the cheques (2026-11-03)

Found: **every reprint printed the legacy cheque**, whatever the branch's
Cheque Template. Order-status drew `<app-print-order>` but `Print()` sent a
hidden hand-built copy; Reports › View Cheque rebuilt the cheque by hand. Both
now print `<app-print-order>`, the checkout's own component (till `3806c20`).

Moving the reprint INTO PosReports means copying the cheque engine (~1,600
lines: cheque-doc, cheque-slip, the component) into a second repo, to be kept
in step by hand.

**Decided 2026-11-03 — keep the reprint in the till** (owner: "the recommended
and safest"). It already prints the designed cheque; no second copy to drift.
Phase 4 therefore retires every till report screen EXCEPT View Cheque.

## Fields that are not recorded — and whether we need them (2026-11-03)

Asked: *"اي حاجة ناقصة مش بتتسجل لو احنا محتاجينها تتسجل في الـ database
نشوف محتاجينها فين ونحطها في مكانها صح"*.

Method: every report column the API fills with a constant instead of a
column, checked against what the order tables actually store.

| Field | Where it showed blank | Is it recorded? | Done |
|---|---|---|---|
| `PrintNo` (hospitality / officer) | Sales reports: 0 on every free order | **Yes** — on `OrderHeader_Hospitality`, PayEdit increments it. The report hard-coded 0 | **Fixed** — API `988bcd9de`, live |
| Prepare / pick-up / assign / return times | Prep-time report: NaN, or the report failing | **Yes**, nullable — a take-away never gets assign/return. The report cast them as non-null | **Fixed** — `988bcd9de`, live; a missing stamp now reads empty |
| Order date in the prep-time screen | "NaN" | Yes — sent preformatted `dd/MM/yyyy`, then re-parsed by the date pipe | **Fixed** — till `3806c20` |
| `MinimumChargeValue`, `AdditionValue` (hospitality / officer) | 0 | **No column** on the hospitality table | **Not needed**: a free order collects no money, so there is no minimum to top up and no cover charge — 0 is the true value |
| `NumberOfPrintAfterCheckOut` (hospitality / officer) | 0 in the category reports | **No column** | **Decided 2026-11-03 — not added.** A new column is a migration on the shared live database for 275 tills; `PrintNo` (now reported) already counts these reprints |
| Waiter / pilot / discount / online-app names | blank in the projection | placeholders, filled after the query from the ids | nothing missing |

## Blocked on the owner

- ~~The certificate for posreporting.tryasp.net~~ — SSL enabled by the owner 2026-11-03; verified serving: Let's Encrypt, expires 2026-12-22 (MonsterASP renews it), http redirects to https, deep links answer 200.
- Rotating the 3 leaked DeterministicCrypto keys — **postponed by the owner** ("متغيرش المفاتيح دلوقتي"); do not do it unasked.
- A login for PosReports, or the failing screen — so Phase 0 can see the
  failure rather than guess at it.
