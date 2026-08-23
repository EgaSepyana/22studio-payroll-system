# 22STUDIO Owner Panel — Clone Specification

**Source analyzed:** Google Apps Script web app, deployed at
`https://script.google.com/macros/s/AKfycbwYxLAr34lBxL3maKMKtBdZdo2ZTaGbq8joEtoHm5ZkZPE_BkzyagOrcubI5Y1h2Tq7/exec`,
backed by Google Sheets (spreadsheet ID `1oBbrPbTfcspnf0jON4mld-uubIccyVv0N_Z8sDzAoEc`).
Also branded internally as **"KONVEKSI APPS by Kang Oky"** / **"OSP KONVEKSI"**.

**Method:** Full read of the two source files provided (`Code.gs` — 4,257 lines backend logic, and
`owner.html` — 12,428 lines single-page frontend). No live interaction with the deployed app was
possible (see note at end), so this spec is derived entirely from source code, not observed runtime
behavior.

**Purpose of this document:** a high-level, implementation-ready definition of every feature,
workflow, and data entity in the existing app, organized so it can be rebuilt on a different stack
(e.g. a proper backend + relational database instead of Apps Script + Google Sheets) while
preserving 100% feature parity. Known bugs and fragile patterns in the original are flagged
separately so they are **fixed, not reproduced**.

---

## 1. What this app is

A back-office / owner's dashboard for a small **garment manufacturing business** ("konveksi" —
Indonesian for a custom-clothing workshop). It is not a customer-facing storefront; it is the
internal tool the owner (and possibly one admin) uses to run the books: cash, income, expenses,
inventory, fixed assets, payables, and two accounting reports (P&L and Balance Sheet). All labels
and terminology in the app are Indonesian; the clone should keep the same terms unless the user
wants a translated UI (flag this as an open decision — see §8).

It is single-tenant (one business, one dataset) and appears to have **no login screen and no
role-based permissions** in the app itself — access control today is entirely delegated to Google's
"who can open this link" deployment setting. A clone must design real authentication from scratch
(see §7).

The order-taking / order-creation flow itself (where an invoice first gets created with a customer,
items, quantity, and total) is **not part of this app** — this Owner Panel only reads existing orders
from a `DATABASE` table and layers financial tracking on top. If the business also has a separate
order-entry app, that should be scoped as a companion system, not assumed to be inside this clone.

---

## 2. High-level architecture recommendation

| Concern | Original (Apps Script) | Recommended for clone |
|---|---|---|
| Backend | ~130 standalone functions invoked via `google.script.run` (RPC style), no REST routing, no `doPost` | A conventional REST or RPC API, one endpoint group per module below (§4) |
| Database | One Google Sheet, ~18 tabs, several with inconsistent/overlapping schemas | A real relational database (PostgreSQL/MySQL) with one properly normalized table per entity (§5) |
| Reporting (P&L, Balance Sheet) | Computed by **spreadsheet formulas** in two dedicated sheets (`REKAP_LR`, `NERACA`); Apps Script only sets a period cell, forces recalculation, and reads fixed cell addresses | Computed by application code / SQL aggregation queries directly from the ledger tables — the exact formulas were not visible in the provided source, so this logic needs to be re-derived from the ledger definitions in §5–§6 and validated against real historical numbers from the business |
| Frontend | One 12k-line static HTML file, all 11 pages in the DOM at once, shown/hidden via inline styles, no router | A normal SPA (React/Vue/etc.) with real client-side routing, one route per module |
| Auth | None (delegated to Apps Script deployment ACL) | Real login (username/password or SSO) + a simple role system (Owner / Admin at minimum, see §7) |
| File storage (logo, PDFs) | Google Drive | Any object storage (S3-compatible, or local disk for a single-tenant on-prem deploy) |
| PDF export | Server builds an HTML string with print CSS, converts to a PDF blob, saves to Drive, returns a link | Any standard server-side HTML-to-PDF pipeline (e.g. Puppeteer/wkhtmltopdf) reusing the same layout described in §6.7/§6.8 |

The feature surface maps naturally onto **10 modules**, each becoming its own API resource group and
frontend route:

1. Dashboard
2. Pemasukan (Income)
3. Pengeluaran (Expenses)
4. Kewajiban (Liabilities/Payables)
5. Mutasi & Penyesuaian Kas (Cash transfers & reconciliation)
6. Aset (Fixed Assets)
7. Stok Persediaan (Inventory)
8. Laba Rugi (Profit & Loss report)
9. Neraca (Balance Sheet report)
10. Pengaturan (Settings / master data)

(plus a static Bantuan/Help page, which carries no logic worth specifying beyond its own copy.)

---

## 3. Cross-cutting conventions to preserve

These conventions show up in every module and should be treated as global rules in the clone:

- **Currency**: Indonesian Rupiah, formatted as `Rp 1.234.567` (dot as thousands separator, no
  decimals shown). All money inputs should mask-format live as the user types.
- **Dates**: displayed `dd/MM/yyyy` (and `dd/MM/yyyy HH:mm:ss` for timestamps); form inputs use
  `yyyy-MM-dd`. Timezone: Asia/Jakarta.
- **Soft "categories everywhere"**: nearly every module's dropdown options (expense categories,
  income categories, stock categories, asset categories, order statuses, admin names) are sourced
  from one central **Settings/master-data** area (§6.10), not hardcoded per module (with two
  exceptions the original hardcodes and the clone should probably keep configurable instead —
  Kewajiban's category list and the location lists — see §6.10 and §9).
- **Every list view loads its full dataset in one call** and does client-side search/filter/sort. This
  is acceptable to keep for now given small data volumes, but the clone's API should be paginated/
  filterable server-side from day one so it isn't a rewrite later.
- **Toast/confirm UX**: every destructive action (delete) requires a confirmation dialog; every
  save/delete shows a brief success/error toast. Loading states show a "Memuat data..." placeholder
  row in tables while a request is in flight.
- **Auto-generated codes**: several entities get a sequential human-readable code on creation
  (assets `AST-###`, raw stock `BRG-###`, finished-goods stock `PRD-###`, liabilities `HTG-###`,
  capital entries `MDL-###`). The clone should implement this as **one atomic sequence generator per
  entity type** (e.g. a DB sequence or a `counters` table with row-level locking) — the original scans
  spreadsheet columns for the "next" number, which is both slow and a race condition under concurrent
  use; do not reproduce that approach.
- **Ledger-first accounting pattern**: cash, inventory, and assets are all modeled as **append-only
  ledgers** (every change is a new row: "in", "out", "adjustment"), with current balances derived by
  summing the ledger rather than storing a mutable running total. This is the right pattern to keep
  for audit trail purposes — but the clone should additionally maintain a **materialized
  current-balance table** per entity (recomputed transactionally on every write) so reads don't have
  to re-sum full history every time, which is a real bug in the original at any scale.

---

## 4. Feature inventory by module

### 4.1 Dashboard

**Purpose:** at-a-glance daily overview when the owner opens the app.

Shows:
- Revenue (Omset), Expenses (Pengeluaran), and Gross Profit (Laba Kotor) for the current period, as
  three stat cards.
- A balance-sheet health indicator: "BALANCE" vs "TIDAK BALANCE" (not balanced), driven by whether the
  Balance Sheet's asset/liability+equity discrepancy is (near) zero.
- Per-account cash balances (all configured "kas"/bank accounts) plus a total, and a rolled-up
  "unpaid receivables" figure.
- Orders received in the last 2 days (today + yesterday), pulled from the master Orders/Invoices
  table: order name, customer name, quantity, invoice total.
- An "unverified incoming payments" worklist: payments recorded in the income-reconciliation queue
  that haven't yet been manually checked off, enriched with the customer/order they belong to. Each
  row has a checkbox the owner ticks to mark it reviewed; ticking it removes it from the list and
  refreshes the dashboard totals.
- A manual "Refresh" action that reloads all of the above at once.

**Workflow to replicate:** "mark income as reviewed" is a one-way state flip (unreviewed → reviewed);
there's no "un-review" action in the original — decide whether the clone should allow reversing this.

### 4.2 Pemasukan (Income)

**Purpose:** log miscellaneous income not otherwise captured by the inventory-sale flow (§4.6).

- List view with filters: category, month, cash account. Four summary tiles: total record count,
  total income, "Penjualan" (sales) subtotal, "Pendapatan Lainnya" (other income) subtotal — the
  sales-vs-other split in the original is a fragile client-side string match against the literal
  category names "PENJUALAN"/"PENDAPATAN LAINNYA"; the clone should instead have an explicit
  `is_sales_category` flag (or similar) on each income category so this doesn't silently break if
  category wording changes.
- Table columns: date, category, cash account, description, amount, action (delete only — no edit in
  the original; consider adding edit to the clone).
- "Input Pemasukan" form: date, category (from master list), destination cash account, amount,
  description. On save, appends a new income record and increases the target cash account's
  effective balance (since balances are derived from the ledger, not stored).

### 4.3 Pengeluaran (Expenses)

**Purpose:** log operating expenses, optionally tied to a specific customer order/invoice, to compute
a live per-order profitability estimate.

- List view with filters: category, order name (debounced search), cash account. Four summary tiles:
  total records, total expense, "Biaya Order" (expenses linked to an invoice) vs "Operasional Umum"
  (general/unlinked expenses) — again split purely by whether an invoice is attached, computed
  client-side; fine to keep as a computed view rather than a stored field.
- Table columns: date, category, cash account, invoice number, customer, order name, description,
  amount, delete action.
- "Input Pengeluaran" form: date, category, cash account, amount, description, plus an **optional**
  "link to order" section — the user opens an "Pilih Invoice PROSES" (pick an in-progress invoice)
  picker, which lists only orders whose status is "in progress" (from the master Orders table),
  searchable by invoice/customer/order name. Selecting one auto-fills customer/order/invoice-total
  (read-only) and immediately shows two live-computed figures: total expenses already logged against
  that invoice, and an estimated profit (`invoice total − expenses so far`) — this calculation should
  be a reusable "per-invoice P&L" query, since it's useful standalone too (e.g. an "order profitability"
  report).
- Deleting an expense row removes it and recalculates any per-invoice totals on next view.

### 4.4 Mutasi & Penyesuaian Kas (Cash transfers & reconciliation)

**Purpose:** move money between the business's own cash/bank accounts, and reconcile the app's
computed balance against a physically-counted balance.

Two distinct record types shown in one unified "cash activity" feed, filterable by type
(Mutasi/Penyesuaian/All), account, date range, and free-text search:

- **Mutasi Kas (transfer)**: date, amount, source account, destination account (must differ from
  source; UI narrows the destination list to exclude whichever source is selected), description.
  Editable and deletable. Purely moves value between two accounts; does not by itself change the
  business's total cash.
- **Penyesuaian Kas (adjustment/reconciliation)**: date, account, "system balance" (auto-filled from
  the live computed balance for that account at the moment the form opens), "actual/counted balance"
  (entered by the user, formatted as currency), and a **live-computed** difference and status
  (`Lebih`/over, `Kurang`/short, `Sesuai`/matched — computed as `actual − system`, `> 0` /`< 0`/`= 0`
  respectively). Editable and deletable.

**Important correctness fix for the clone:** in the original, the "system balance" used to compute the
adjustment is read from a client-side cache captured at page-load time, not re-verified at save time —
if the balance changed in between (e.g. another transaction posted), the saved discrepancy is
computed against stale data. The clone should recompute the system balance server-side at the moment
of save, atomically, before persisting the adjustment.

A live summary panel on this page shows every account's current balance plus a grand total,
labeled "Realtime".

### 4.5 Aset (Fixed Assets)

**Purpose:** track fixed assets the business owns (machines, equipment, etc.) — purchases, sales, and
current holdings.

- List view: search by name, filter by location and category, sort (name / qty ascending / qty
  descending). Summary tiles: total distinct assets, total quantity, total value.
- Table columns: code, name, category, location, quantity, unit price, total value, actions
  (Buy-more/Sell/Delete — Sell disabled when quantity is 0).
- **Register a new asset** ("Input Aset Baru"): date, auto-generated sequential code, location, name,
  category (from master list), notes. Creates the asset "identity" with zero quantity/value.
- **Buy more of an asset** ("Aset Beli / Masuk"): date, pick existing asset (searchable), quantity in,
  unit price, **funding source** — one of Cash / Payable(credit) / Capital:
  - Cash: requires picking which cash account paid for it.
  - Payable (Hutang): requires creditor/supplier name, address, due date — automatically creates a
    matching Liability record (§4.8) with status "unpaid".
  - Capital (Modal): requires source-of-capital name and a note — automatically creates a Capital
    Contribution record referencing this purchase.
  Increases the asset's on-hand quantity and value.
- **Sell an asset** ("Jual / Keluar"): date, pick asset, quantity out (≤ on-hand), sale price (defaults
  to last known unit price if left blank), destination cash account (asset sales are cash-only in the
  original — consider whether the clone should allow credit sales of assets too). Decreases on-hand
  quantity/value and posts the sale amount into the chosen cash account.
- **Delete an asset**: in the original this wipes the asset's *entire* transaction history, not just
  today's balance — **the clone should not reproduce this**; prefer archiving/soft-delete, or require
  zero quantity and zero history before allowing a hard delete.

**Data-model note (important):** the original source has **two incompatible schemas sharing the same
sheet name** for assets — one treats assets as a running purchase/sale ledger (the one described
above, with `MASTER/AWAL/BELI/JUAL` entry types), the other treats the same sheet as a straight-line
**depreciation register** (value, useful life in months, depreciation method, monthly depreciation
amount, book value). These were clearly built at different times and never reconciled; **the clone
must pick one model**. Recommendation: keep the ledger model above as "Asset Transactions" (purchases/
sales/valuation) and add depreciation as a **separate**, explicit feature — a `fixed_assets` table with
`acquisition_value`, `useful_life_months`, `depreciation_method`, and a computed (or scheduled-job-
generated) monthly depreciation entry, rather than overloading one table with two meanings.

### 4.6 Stok Persediaan (Inventory)

**Purpose:** track raw materials and finished goods, including the "convert raw material into
finished goods" production step, and selling finished goods either for cash or on credit.

- List view: search by name/code, filter by location and category, sort (name / stock ascending /
  descending). Summary tiles: total distinct items, total stock quantity, estimated total value.
- Table columns: code, name, category, location, on-hand quantity, unit price, total value, actions
  (Edit / Stock-in / Stock-out / Delete).
- **Register new item** ("Input Stok"): date, auto code, location, name, category, opening quantity,
  price, funding source (Cash/Payable/Capital — same pattern and same auto-postings as Aset above).
- **Stock in / restock** ("Stok Masuk"): date, pick existing item, quantity in, purchase price
  (defaults to last known price), same funding-source pattern as above.
- **Stock out** ("Stok Keluar"): date, pick item, quantity out, and a required **exit type**:
  - **PRODUKSI** (production/transformation): consumes the picked item and, in the same action,
    creates or restocks a **finished-goods item** at an equivalent value — i.e. raw material becomes a
    new SKU with no revenue/expense recognized (pure internal transformation of value). Requires the
    output item's code (auto-generated), name, category, and location.
  - **TERJUAL** (sold): requires a sale price. Payment method is either:
    - **Tunai** (cash): requires a destination cash account; posts the sale amount to Income (§4.2).
    - **Piutang** (credit/receivable): no cash account required; posts to a Receivables ledger instead
      (money not yet collected).
  - **RUSAK** (damaged/lost): optional "loss value" (defaults to the item's own carrying cost); posts
    a **negative** entry against retained earnings/equity — i.e. this directly reduces the balance
    sheet's equity rather than looking like a normal business expense.
- **Edit item**: rename/recategorize/relocate an item, or (only meaningful for an item's very first/
  opening entry) directly correct its quantity or price.
- **Delete item**: same caution as Aset — the original wipes all history for that item; the clone
  should prefer soft-delete / require empty history.

**Location taxonomy note:** the original's location dropdown for inventory includes an option that
translates to "livestock pen" — clearly copy-pasted from an unrelated template and not applicable to a
garment business. The clone should define its own clean location list (e.g. Warehouse / Store /
Office / Production) via the master-data settings, not hardcode mismatched options per module.

### 4.7 Kewajiban (Liabilities / Payables)

**Purpose:** track money the business owes — supplier debts and labor wages — with partial-payment
support.

- List view: search by code/name, filter by category and status (Unpaid/Partial — see status-filter
  note below). Four summary tiles: total records, total value, total paid, total remaining.
- Table columns: code, date, name (creditor), address, category, remaining balance, status (badge),
  due date, notes, actions (Edit / Pay [disabled once fully paid] / Delete [disabled once any payment
  has been made]).
- **Add/Edit liability**: date, due date, creditor name, address, category (Supplier debt / Labor
  wages — in the original this is a hardcoded 2-item list rather than master-data-driven; recommend
  making it configurable like every other category list, since a real business will have more than
  two liability categories eventually), quantity, unit price (value = quantity × price, computed
  live). On create: starts at zero paid, status "Unpaid", and **automatically posts a matching
  Cost-of-Goods-Sold entry** categorized by liability type (Supplier debt → "fabric purchase" COGS
  bucket, Labor wages → "production cost" COGS bucket, anything else → generic COGS) — **this is how
  liabilities feed the P&L report**, so the clone's COGS/P&L logic must read from this same source. On
  edit: preserves whatever has already been paid, recomputes remaining balance/status, and re-syncs
  the COGS entry.
- **Record a payment** ("Bayar"): opens a detail view (liability summary + full payment history) with
  a form: payment date, amount (defaults to the full remaining balance), payment method/cash account,
  notes. Validates amount ≤ remaining balance. Status transitions Unpaid → Partial → Paid as payments
  accumulate; payments are **only ever additive** through this flow (see next point for the exception).
- **Delete an individual past payment**: reverses that specific payment's effect — decrements the
  amount paid back down and recomputes remaining balance/status — this is a proper compensating
  transaction and should be kept exactly as-is.
- **Delete a liability**: blocked once any payment exists (must have zero paid) — also removes its
  linked COGS entry. Keep this safeguard.
- **Status-filter gap to fix**: the original's status filter only offers "All / Unpaid / Partial" —
  fully-paid liabilities have no dedicated filter option and are hidden from the default list view
  entirely (only reachable by searching a specific code/name). The clone should offer a real "Paid"
  filter option and let the user choose to include/exclude paid-off liabilities from the default view.

**Auto-liability creation:** buying stock or an asset "on credit" (§4.5/§4.6, funding source =
Payable) creates a Liability record through this same mechanism — there should be exactly **one**
liability-creation code path shared by all three entry points (manual entry, asset purchase, stock
purchase), not three separate implementations as in the original.

### 4.8 Laba Rugi (Profit & Loss report)

**Purpose:** monthly P&L statement.

- Pick a month, click "Tampilkan" (show) to render: a categorized Revenue (Omset) table with a total,
  a categorized Cost of Goods Sold (HPP) table with a total, a computed Gross Profit line
  (Revenue − COGS), a categorized Operating Expenses table with a total, and a final computed Net
  Profit line (Gross Profit − Operating Expenses), colored green if positive / red if negative.
- "Cetak PDF" generates a printable PDF version of the same report with owner/admin signature lines.
- **Underlying computation (must be re-derived, not copied):** in the original, this entire report is
  computed by spreadsheet formulas the script only reads pre-computed cells from — the actual
  aggregation formulas were not present in the provided source. The clone needs to build this report
  directly from the ledger tables: Revenue from Income (§4.2) + cash/credit sales of stock (§4.6);
  COGS from the auto-generated Liability-driven COGS entries (§4.7) plus any direct production costs;
  Operating Expenses from §4.3. **Before launch, validate the clone's computed P&L against the
  business's real historical numbers from the current spreadsheet** to make sure the re-derived
  aggregation logic matches what the owner already expects to see.

### 4.9 Neraca (Balance Sheet report)

**Purpose:** point-in-time balance sheet with a "does it balance" sanity check.

- On load (and via Refresh): shows total assets, total liabilities+equity, the discrepancy between
  them, and a colored "BALANCE" / "TIDAK BALANCE" status pill (balanced when the discrepancy is
  effectively zero). Two side-by-side breakdown tables: Assets (cash accounts + other assets, each
  with subtotals) and Liabilities & Equity (with subtotals for liabilities, subtotals for equity, and
  a grand total).
- "Cetak PDF"/print produces a formatted printable version with owner/admin signature lines
  (the original hardcodes the two names on the printed report rather than pulling them from Settings —
  the clone should pull live from Settings, per §6.10).
- **Underlying computation**, same caveat as §4.8: originally spreadsheet-formula-driven; needs to be
  rebuilt as a real aggregation over Cash (§4.4), Inventory value (§4.6), Fixed Assets value (§4.5),
  Liabilities (§4.7), and Capital/Retained Earnings (§4.5/§4.6/§4.10), then validated against the
  business's real current numbers.

### 4.10 Pengaturan (Settings)

**Purpose:** business profile and the master/config data that drives dropdowns across every other
module.

- **Business profile**: business name, address, phone, monthly revenue figure, daily target, monthly
  target, a free-text notes field, and a logo image (uploaded, stored, displayed in the sidebar/
  header).
- **Owner & Admin names**: used for print/signature purposes on the two reports (§4.8/§4.9) — the
  clone should make sure these are the values actually used at print time (the original has a
  disconnect here — see §4.9's note).
- **Master data / dropdown lists** — one source of truth feeding every other module's category
  selects: Order Status, Admin names, Order form types, Order types, Customer categories, Transaction
  types, Expense ("Biaya") categories, COGS ("HPP") categories, Operating-expense categories, Stock
  categories, Asset categories, Income categories. The original enforces small fixed maximum list
  lengths per category (ranging 3–15 items) purely as an artifact of using fixed spreadsheet cell
  ranges — **the clone should not carry over these arbitrary caps**; a normal `categories` table with
  a `type` column and no hard length limit is the correct replacement.

---

## 5. Data model (target schema, normalized)

This reframes the original's 18-tab spreadsheet (which has real inconsistencies — see the Known
Issues in §9) into a clean relational schema. Names are suggestions; keep or translate as preferred.

| Table | Key fields | Notes |
|---|---|---|
| `orders` (was `DATABASE`) | invoice_no (PK), order_date, customer_name, order_name, qty, total_invoice, status | Source of truth for orders; status drives the "in-progress invoice picker" in Expenses and the Dashboard's "recent orders" widget. Likely owned by a separate order-intake system — treat as read/synced here if so. |
| `incoming_payments` (was `REKAPINCOME`) | id, invoice_no (FK→orders), date, type, amount, account, reviewed (bool) | Feeds the Dashboard's "unreviewed income" worklist. |
| `income` (was `PEMASUKAN`) | id, date, category_id (FK), account_id (FK), description, amount, created_at | |
| `expenses` (was `OPERASIONAL`) | id, date, category_id (FK), account_id (FK), amount, description, invoice_no (FK→orders, nullable), customer_name, order_name, invoice_total | The last three are denormalized copies of `orders` fields at time of entry in the original; prefer just joining on `invoice_no` in the clone. |
| `cash_accounts` (replaces ad hoc "Setup" list) | id, name, is_active | Referenced by nearly every money-moving table. |
| `cash_transfers` (was `MUTASIKAS`) | id, date, from_account_id (FK), to_account_id (FK), amount, description, created_at | |
| `cash_reconciliations` (was `PENYESUAIANKAS`) | id, date, account_id (FK), system_balance, actual_balance, difference, status (enum: over/short/matched), description, created_at | `system_balance` must be computed server-side at save time, not client-cached (§4.4). |
| `fixed_assets` | id, code, name, category_id (FK), location_id (FK), created_at | Identity/master record. |
| `fixed_asset_transactions` | id, asset_id (FK), date, type (enum: opening/purchase/sale), qty, unit_price, total_value, funding_source (enum: cash/payable/capital), account_id (FK, nullable), liability_id (FK, nullable), capital_entry_id (FK, nullable), description | Ledger; current qty/value = sum of these rows per asset. |
| `fixed_asset_depreciation` *(new, split out from the original's conflated model — see §4.5)* | id, asset_id (FK), acquisition_value, useful_life_months, method, monthly_depreciation, book_value, as_of_date | |
| `inventory_items` | id, code, name, category_id (FK), location_id (FK), item_type (enum: raw_material/finished_good), created_at | Identity/master record. |
| `inventory_transactions` (was `STOK`) | id, item_id (FK), date, type (enum: opening/stock_in/stock_out), qty, unit_price, total_value, funding_source (enum: cash/payable/capital, nullable for stock_out), account_id (FK, nullable), exit_type (enum: production/sold/damaged, nullable), sale_method (enum: cash/credit, nullable), linked_transaction_id (self-FK, for production conversions), description | Ledger; current qty/value = sum per item. |
| `liabilities` (was `HUTANG`) | code (PK), date, creditor_name, creditor_address, category_id (FK), qty, unit_price, value, amount_paid, remaining, status (enum: unpaid/partial/paid), due_date, description, updated_at | |
| `liability_payments` (was `BAYAR_KEWAJIBAN`) | id, liability_code (FK), date, amount, account_id (FK), description, created_at | Deleting a payment must reverse the parent liability's `amount_paid`/`remaining`/`status` (§4.7). |
| `cogs_entries` (was `HPP_PRODUKSI`) | id, source (enum: liability/manual), source_ref (FK, nullable), date, category, amount, description, updated_at | Auto-synced 1:1 with liabilities; deleted when the source liability is deleted. |
| `capital_entries` (was `MODAL`) | id, date, code, source_name, description, amount, entry_type (enum: cash/asset/stock), asset_or_stock_ref (FK, nullable), created_at | |
| `receivables` (was `PIUTANG`) | id, date, source (e.g. inventory sale), amount, description, created_at | Created when finished goods are sold on credit (§4.6). |
| `equity_adjustments` (was `PENYESUAIANEKUITAS`) | id, date, account (e.g. retained earnings), amount (signed), description, created_at | Created for damaged/lost stock write-downs (§4.6). |
| `categories` | id, type (enum: expense/income/stock/asset/order_status/liability/…), name, is_active | Replaces the fixed-length column-range lists in the original Setup sheet; one flexible table for all dropdown master data. |
| `locations` | id, name, is_active | Replaces the per-module hardcoded location lists (§4.6's note) with one shared, editable list. |
| `business_settings` | singleton row: name, address, phone, monthly_revenue_target, daily_target, monthly_target, notes, logo_url, owner_name, admin_name | |
| `users` *(new — not in original, needed for §7)* | id, name, email/username, password_hash, role | |

Reports (`Laba Rugi`/P&L and `Neraca`/Balance Sheet, §4.8–§4.9) should be **computed views/queries**
over the above tables, not their own stored tables — unlike the original, which delegates the math to
spreadsheet formulas that live outside the visible source.

---

## 6. Cross-module workflows worth calling out explicitly

These are the multi-step business processes that cross table/module boundaries — a clone's backend
should implement each as one transactional operation, not left to the frontend to orchestrate in
separate calls:

1. **Buying stock or an asset on credit** → creates the stock/asset transaction **and** a liability
   **and** a COGS entry, atomically. (Today: 3 separate manual code paths per module; should be 1
   shared service.)
2. **Buying stock or an asset with capital** → creates the stock/asset transaction **and** a capital
   entry, atomically.
3. **Paying down a liability** → updates the liability's paid/remaining/status **and** appends an
   immutable payment record, atomically. **Deleting** a payment record must reverse both.
4. **Selling finished-goods stock** → decrements the stock item **and** posts to either Income (cash
   sale) or Receivables (credit sale), atomically.
5. **Converting raw material to finished goods (production)** → decrements the raw-material stock
   item **and** creates/increments a finished-goods stock item at an equivalent value, atomically —
   no revenue or expense should be recognized in this step.
6. **Marking stock as damaged/lost** → decrements the stock item **and** posts a negative equity
   adjustment, atomically.
7. **Creating a liability (any path)** → auto-generates/syncs a matching COGS entry categorized by
   liability category. **Editing or deleting** the liability must keep the COGS entry in sync
   (recalculate on edit, delete on delete).
8. **Cash reconciliation** → must read the account's *current, server-side-computed* balance at the
   moment of save (not a client-cached value) before computing the discrepancy.

---

## 7. Authentication & authorization (net-new — not present in the original)

The original has **zero** login/auth/role logic in the source provided; anyone with the deployed URL
sees the full app. This cannot be carried over as-is for a standalone clone. Minimum recommendation:

- A real login (even if just one Owner account plus one Admin account to start, matching the
  business's actual usage).
- At least two roles: **Owner** (full access) and **Admin** (day-to-day data entry) — decide together
  with the business whether Admin should be restricted from anything (e.g. deleting liabilities,
  editing Settings, viewing reports) since the original app treats "Owner" and "Admin" purely as
  display labels for print signatures, not as enforced permission levels.
- Session-based or token-based auth; audit fields (`created_by`/`updated_by`) added to every mutating
  table above, which the original doesn't have at all (no user attribution on any record today).

---

## 8. Open questions to confirm with the business owner before/while building

- Should the UI stay in Indonesian, or be translated (or bilingual)?
- Is the order-intake app (that originally populates `DATABASE`/orders) part of this clone, or a
  separate system this app should integrate with (via API/webhook/shared DB)?
- Should Admin and Owner have different permissions, or is a single shared role acceptable for now?
- Should "delete" operations be true hard deletes (as today) or soft-deletes/archives with an audit
  trail — recommended given several delete actions today are irreversibly destructive (§4.5, §4.6)?
- What are the actual P&L and Balance Sheet formulas currently encoded in the `REKAP_LR` and `NERACA`
  sheets? These weren't in the provided source and need to be pulled from the live spreadsheet (or
  reconstructed with the owner/bookkeeper) to make sure the clone's computed reports match what the
  business already trusts.
- Should the fixed-length category caps (e.g. max 3 admin names, max 15 order types) be preserved as
  business rules, or were they purely an artifact of the spreadsheet and safe to drop (recommended)?

---

## 9. Known issues in the original — fix, don't clone

Carried over from the source analysis; each of these should be corrected in the new system rather
than reproduced:

1. **Two incompatible data models share the "Aset" concept** (a purchase/sale ledger vs. a
   depreciation register) — split into two explicit features (§4.5, §5).
2. **Duplicate function definitions that silently override each other** in the original backend,
   including one case where the "winning" version reads misaligned columns for cash-reconciliation
   records, and one typo bug (`AHTG-001` instead of `HTG-001` for a liability code default) — the
   clone's single, deduplicated implementations avoid this class of bug entirely.
3. **Inconsistent column order for the same "Income" table depending on which flow wrote it**
   (manual entry vs. an inventory cash-sale) — silently swaps amount and description in some rows in
   the original. A single schema (§5's `income` table) fixes this by construction.
4. **Balance lookups via "scan the sheet for a text label" instead of a fixed reference** — replaced
   by real foreign keys and computed balances in §5.
5. **No pagination anywhere** — every list loads its entire history in one call. The clone's API
   should support paging/server-side filtering from the start (§3).
6. **Destructive deletes**: deleting an asset or stock item wipes its *entire* transaction history,
   not just its current balance. Recommend soft-delete or requiring zero balance/history first (§4.5,
   §4.6).
7. **Client-cached balance used for reconciliation math** instead of a fresh server read at save time
   — a race condition (§4.4, §6.8).
8. **Hardcoded print signature names** on the Balance Sheet PDF regardless of what's actually
   configured in Settings (§4.9).
9. **A mismatched "location" option list** for inventory (includes an option that doesn't fit a
   garment business at all) suggesting the original was adapted from an unrelated template without
   full cleanup (§4.6) — the clone should define its own clean, business-appropriate location list.
10. **No authentication at all** (§7) — must be designed fresh.
11. **Inconsistent UX** in a few places in the original frontend (one module uses plain browser
    `alert()`/`confirm()` while everywhere else uses styled toast/confirm dialogs) — the clone should
    apply one consistent UI pattern everywhere.

---

## 10. Note on how this analysis was produced

The live app URL could not be reached directly from the analysis environment (Google Apps Script
apps render dynamically and the sandbox used for this analysis has no direct network path to
script.google.com). Instead, this specification was built from the app's actual source code — the
Apps Script backend (`Code.gs`) and the single-page frontend (`owner.html`) — which were provided
directly and read in full. This is arguably a *more* reliable source than reverse-engineering the
rendered UI would have been, since it captures the real validation rules, data model, and edge-case
logic rather than only what's visible on screen. The one gap this leaves is the two reports' exact
spreadsheet formulas (§4.8, §8), which live in spreadsheet cells rather than in the script and weren't
part of the provided files — pull those from the live spreadsheet before finalizing the reports'
computation logic.