# PRD — Agent Access (backend)

| | |
|---|---|
| **Status** | approved |
| **Plan** | `docs/plans/agent-access-plan.md` |
| **Context** | `~/Documents/Freelance/22studio-agents/docs/agent-matrix.md` (agent roster, approval matrix, decisions G1/G4/G5/G8) |

## 1. Goal

Let 7 AI agents (Hermes profiles `st-*`) use this backend **safely**:
- Each agent has its own account, authenticated with an **API key**.
- Each account can reach **only** the routes its **scopes** allow. Everything else is denied by default.
- Every write made by an agent is **audited**.
- Customer designs carry an explicit **publish consent** flag.
- Agents that must not see customer PII get **filtered** order endpoints.

Human users (admin, admin_produksi, owner, employee) must see **zero behaviour change**.

**Out of scope here:** the MCP server, the approval gate (MCP side), Hermes profiles, Telegram, Drive. Those consume this API later.

## 2. Accounts & authentication

- New role **`agent`**. Agent accounts have no password and cannot use `/api/auth/login`, `/api/auth/change-password`, `/api/profile`, or `/api/notifications*`.
- `Users` sheet: **append** columns `scopes` (comma-separated), `api_key_hash`, `api_key_prefix`, `disabled` (`"true"`/empty).
- **Key format:** `agk_<prefix>_<secret>`. `prefix` = 8 random chars (stored, used for lookup). `secret` = 32+ random bytes, base64url.
- **Storage:** `api_key_hash = HMAC-SHA256(secret, AGENT_KEY_SECRET)`, compared timing-safe. The plaintext key is printed once and never stored.
- **Request:** `Authorization: Bearer agk_...`. `requireAuth` recognises the `agk_` prefix and authenticates the agent. Otherwise the existing JWT flow is unchanged.
- **On success:** `req.user = { id, username, role: 'agent', scopes: Set<string> }`. A disabled account or wrong key → `401`.
- New env: **`AGENT_KEY_SECRET`** (required when any agent account exists; documented in `.env.example`).

### Accounts (from agent-matrix §3.1)

| Username | Scopes |
|---|---|
| `agent-manager` | `orders:read`, `tasks:read`, `dashboard:read` |
| `agent-owner` | `orders:read`, `finance:read`, `reports:read` |
| `agent-produksi` | `orders:read`, `orders:status`, `tasks:read`, `tasks:write`, `tasks:progress`, `lembar-po:read`, `lembar-po:write`, `surat-jalan:read`, `surat-jalan:write`, `worklogs:read` |
| `agent-admin` | `orders:read`, `orders:write`, `orders:items`, `orders:publish-flag`, `customers:read`, `customers:write`, `dp:create`, `invoice:read`, `followup:draft`, `tracking-link:read`, `articles:read` |
| `agent-marketing` | `articles:read`, `orders:public-summary`, `cms:read`, `cms:write`, `uploads:cms-image` |
| `agent-designer` | `orders:read-design`, `articles:read`, `uploads:design` |
| `agent-keuangan` | `finance:read`, `reports:read`, `payroll:read`, `worklogs:read`, `cashadvances:read`, `expenses:create`, `income:create`, `payroll:pay`, `cashadvances:decide`, `cash:transfer`, `cash:reconcile`, `liabilities:pay`, `assets:trade`, `inventory:stock` |

**Forbidden for every agent** (no scope exists for them; the guard must reject even if someone edits the sheet): every `DELETE` route, `/api/settings/*`, `/api/owner/settings/*`, cash account create/update (`POST/PUT /api/owner/cash/accounts*`), `/api/employees*`, `/api/attendance*`, `/api/auth/*` writes, `/api/public/orders/design/approve`, and owner register endpoints not listed below.

## 3. Scope → route map (the contract)

Only these routes accept agents, and only with the listed scope. Human role guards on these routes stay exactly as they are today.

| Scope | Routes |
|---|---|
| `dashboard:read` | `GET /api/dashboard/admin` |
| `orders:read` | `GET /api/orders`, `GET /api/orders/:id`, `GET /api/orders/:id/timeline` |
| `orders:write` | `POST /api/orders`, `PUT /api/orders/:id` |
| `orders:items` | `POST /api/orders/:id/items`, `POST /api/orders/:id/items/template`, `PUT /api/orders/:id/items/:itemId`, `POST /api/orders/:id/items/:itemId/sizes`, `PUT /api/orders/:id/items/:itemId/sizes/:sizeId` |
| `orders:status` | `PATCH /api/orders/:id/status` **(new)** |
| `orders:publish-flag` | `PATCH /api/orders/:id/publish-consent` **(new)** |
| `orders:public-summary` | `GET /api/agent/orders/public-summary` **(new)** |
| `orders:read-design` | `GET /api/agent/orders/:id/design-brief` **(new)** |
| `invoice:read` | `GET /api/orders/:id/invoice-pdf`, `GET /api/orders/:id/invoice-excel`, `GET /api/orders/:id/dp/preview-pelunasan` |
| `dp:create` | `POST /api/orders/:id/dp` |
| `followup:draft` | `POST /api/orders/:id/follow-up` |
| `tracking-link:read` | `GET /api/orders/:id/tracking-link` |
| `customers:read` | `GET /api/customers` |
| `customers:write` | `POST /api/customers`, `PUT /api/customers/:id`, `PUT /api/customers/:id/categories` |
| `articles:read` | `GET /api/articles`, `GET /api/article-categories` |
| `tasks:read` | `GET /api/tasks`, `GET /api/tasks/:id`, `GET /api/tasks/:id/progress-photos` |
| `tasks:write` | `POST /api/tasks`, `PUT /api/tasks/:id` |
| `tasks:progress` | `POST /api/tasks/:id/progress` |
| `lembar-po:read` | `GET /api/lembar-po`, `GET /api/lembar-po/by-order/:orderId`, `GET /api/lembar-po/order-ids`, `GET /api/lembar-po/:id`, `GET /api/lembar-po/:id/pdf` |
| `lembar-po:write` | `POST /api/lembar-po`, `PUT /api/lembar-po/:id` |
| `surat-jalan:read` | `GET /api/surat-jalan`, `GET /api/surat-jalan/:id`, `GET /api/surat-jalan/:id/pdf` |
| `surat-jalan:write` | `POST /api/surat-jalan`, `PUT /api/surat-jalan/:id`, `POST /api/surat-jalan/:id/items`, `PUT /api/surat-jalan/:id/items/:itemId` |
| `worklogs:read` | `GET /api/worklogs`, `GET /api/worklogs/export`, `GET /api/worklogs/:id` |
| `finance:read` | `GET /api/owner/dashboard`, `GET /api/owner/income`, `GET /api/owner/expenses`, `GET /api/owner/expenses/order-picker`, `GET /api/owner/expenses/order-profitability/:orderId`, `GET /api/owner/cash/accounts`, `GET /api/owner/cash/accounts/balances`, `GET /api/owner/cash/transfers`, `GET /api/owner/cash/reconciliations`, `GET /api/owner/cash/reconciliations/preview-balance`, `GET /api/owner/assets`, `GET /api/owner/assets/:id`, `GET /api/owner/liabilities`, `GET /api/owner/liabilities/:id`, `GET /api/owner/inventory`, `GET /api/owner/inventory/:id`, `GET /api/cash-accounts` |
| `reports:read` | `GET /api/owner/reports/profit-loss`, `GET /api/owner/reports/balance-sheet`, `GET /api/reports`, `GET /api/reports/export` |
| `payroll:read` | `GET /api/payroll`, `GET /api/payroll/range`, `GET /api/payroll/export`, `GET /api/payroll/:id` |
| `payroll:pay` | `PATCH /api/payroll/:id/pay`, `PATCH /api/payroll/range/pay` |
| `cashadvances:read` | `GET /api/cashadvances`, `GET /api/cashadvances/:id` |
| `cashadvances:decide` | `PATCH /api/cashadvances/:id/approve`, `PATCH /api/cashadvances/:id/reject` |
| `expenses:create` | `POST /api/owner/expenses` |
| `income:create` | `POST /api/owner/income` |
| `cash:transfer` | `POST /api/owner/cash/transfers` |
| `cash:reconcile` | `POST /api/owner/cash/reconciliations` |
| `liabilities:pay` | `POST /api/owner/liabilities/:id/payments` |
| `assets:trade` | `POST /api/owner/assets/buy`, `POST /api/owner/assets/sell` |
| `inventory:stock` | `POST /api/owner/inventory/stock-in`, `POST /api/owner/inventory/stock-out` |
| `cms:read` | `GET /api/cms/general`, `GET /api/cms/founders-promise`, `GET /api/cms/contact-info`, `GET /api/cms/:section` |
| `cms:write` | `PUT /api/cms/general`, `PUT /api/cms/founders-promise`, `PUT /api/cms/contact-info`, `POST /api/cms/:section`, `PUT /api/cms/:section/reorder`, `PUT /api/cms/:section/:id` |
| `uploads:cms-image` | `POST /api/uploads/cms-image` |
| `uploads:design` | `POST /api/uploads/design` |
| *(any agent)* | `GET /api/agent/me` **(new)**: own username + scopes |

**Surat Jalan note:** these routes use `requireDivisi` for employees. An agent with the scope must pass without a divisi; human behaviour stays unchanged.

## 4. New endpoints

| Endpoint | Who | Behaviour |
|---|---|---|
| `PATCH /api/orders/:id/status` | admin, admin_produksi, owner, scope `orders:status` | Body `{ status }`. Only the 4 order statuses (Desain Fix, On Progress, Done, Di Ambil Costumer). Updates the status field only. Writes an `OrderTimeline` entry with the actor. |
| `PATCH /api/orders/:id/publish-consent` | admin, owner, scope `orders:publish-flag` | Body `{ boleh_publikasi: boolean, catatan_publikasi?: string }` |
| `GET /api/agent/orders/public-summary` | scope `orders:public-summary` | Query: `status`, `from`, `to`, `jenis_category`. Returns order-level data **without customer name, phone, address, invoice no, broker, or prices**: id, order_name (see note), jenis_category, status, created_at, items (nama_item, warna, total qty), `boleh_publikasi`, and `desain_fix_url` **only if** `boleh_publikasi` is true |
| `GET /api/agent/orders/:id/design-brief` | scope `orders:read-design` | Items, colours, sizes + qty, notes, `desain_fix_url`, Lembar PO design-related fields. No customer contact data, no prices |
| `GET /api/agent/me` | any agent | `{ username, scopes }` |

Note: `order_name` may contain a customer or brand name. The public-summary response must **not** include it unless `boleh_publikasi` is true. Otherwise it returns a generated label, for example `"Kaos · 50 pcs"`.

## 5. Schema changes (append-only)

| Sheet | Append | Default for existing rows |
|---|---|---|
| `Users` | `scopes`, `api_key_hash`, `api_key_prefix`, `disabled` | empty = no scopes, no key, enabled |
| `Orders` | `boleh_publikasi`, `catatan_publikasi` | empty = `false` |
| `AuditLog` **(new sheet)** | `id`, `created_at`, `user_id`, `username`, `role`, `method`, `path`, `status_code`, `summary` | — |

## 6. Audit (G4)

- A middleware records every **non-GET** request made by an agent after the response finishes: method, route path with ids, status code, and a short **redacted** body summary. The summary drops password, key and token fields, truncates long strings, and caps at about 500 chars.
- Writing the audit entry is fire-and-forget. A failed write is logged and never fails the request.
- New `OrderTimeline` entries created by agent actions set `actor` to the agent username.

## 7. Abuse limits

- Per-agent rate limit (express-rate-limit, keyed by user id): **60 requests/min** default. Over the limit → `429`.
- Body size limits stay as they are.

## 8. CLI (backend)

| Command | Does |
|---|---|
| `npm run agents:create -- --yes` | Creates every missing account from the scope config. **Updates scopes** of existing ones. Prints the key **only for newly created** accounts |
| `npm run agents:list` | Username, scopes, disabled, key prefix |
| `npm run agents:rotate-key -- --username=<u> --yes` | New key printed once; the old one stops working |
| `npm run agents:disable -- --username=<u> [--enable] --yes` | Toggle `disabled` |

All write commands print the target spreadsheet's **title** and refuse to run without `--yes`.

## 9. Frontend (minimal)

- Order detail (admin/owner): a **"Boleh dipublikasikan"** toggle plus a note field, saved via the publish-consent endpoint.
- Owner: a read-only **"Aktivitas Agent"** page listing `AuditLog` entries (newest first, filter by agent), via `GET /api/owner/agent-activity` (owner only, humans only).

## 10. Acceptance

- Route-access test: for **every** registered route, an agent with no scopes gets `403`. An agent with exactly the scope from §3 passes the guard. Routes not in §3 reject agents with any scopes.
- Human role guards are identical before and after (snapshot test of route → roles).
- Key auth: valid key → agent; wrong secret, unknown prefix, or disabled → `401`; an agent JWT login attempt → rejected.
- Public-summary and design-brief responses contain none of the forbidden fields (unit test on the mappers).
- Audit entries are written for agent writes and never for agent reads or human requests.
- Manual check on a **dev copy** of the spreadsheet: `agents:create` → curl with each key → allowed and denied routes behave as in §3.
