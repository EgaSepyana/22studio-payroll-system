# Plan: Agent Access (backend)

**Status:** active · **PRD:** `docs/product/PRD-agent-access.md`

Run one task per session:

```text
Do task T<n> in docs/plans/agent-access-plan.md. Follow AGENTS.md.
```

Tasks marked 🧑 need the human: a dev copy of the spreadsheet, running a write-script, or checking the UI.

---

- [x] **T0 — Test harness & safety rails**
  - Backend `npm test` → `node --test` (no new deps). Add one smoke test.
  - `.env.example` at `backend/` listing every variable from `config/env.js` plus `AGENT_KEY_SECRET` (no values).
  - Shared helper for write-scripts: print the spreadsheet title from `GOOGLE_SHEETS_ID`, exit unless `--yes`. Apply it to `setup-sheets`.
  - Snapshot of current human route guards: a script/test that walks the Express router stack and records `METHOD path → roles`, committed as `backend/test/fixtures/route-roles.json`. T4 must not change it.
  - **Test:** `npm test` green; `npm run setup-sheets` without `--yes` exits without writing.

- [x] **T1 — Schema (append-only)** 🧑
  - Append columns per PRD §5 (`Users`, `Orders`) and add the `AuditLog` sheet + repo.
  - Services treat empty `boleh_publikasi` as `false` and empty `scopes` as none.
  - **Test:** unit test asserting existing column order of `Users` and `Orders` is unchanged and new columns are last. Human runs `npm run setup-sheets -- --yes` on the **dev copy** and confirms headers.

- [x] **T2 — Scope catalog**
  - `backend/config/agentScopes.js`: list of all scopes, the scope → route map from PRD §3 as data, the 7 accounts with their scopes, and the forbidden-route rules.
  - Pure helpers: `hasScope(user, scope)`, `scopeForRoute(method, path)`.
  - **Test:** every account scope exists in the catalog; no route in the map is a `DELETE` or a forbidden route; every route in the map exists in the app's router (use the T0 route walker).

- [x] **T3 — Agent API-key authentication**
  - Key generation + HMAC hashing (PRD §2). `requireAuth` accepts `agk_` keys and keeps JWT unchanged; `requireAuthQueryOrHeader` rejects agents.
  - Agent lookup through an injectable store (default: `UsersRepo`), so tests use an in-memory store.
  - Agents rejected on `/api/auth/*`, `/api/profile`, `/api/notifications*`.
  - **Test:** unit tests: valid key, wrong secret, unknown prefix, disabled, malformed header, timing-safe compare used; JWT path regression.

- [x] **T4 — Default-deny scope guard on all routes**
  - One guard helper so each route declares human roles **and** optional agent scope, e.g. `allow({ roles: ['admin','owner'], scope: 'orders:write' })`. Agents pass only with the declared scope. Routes without a scope reject agents.
  - Router-level guards (`router.use(requireRole(...))` in owner/cms/settings/employees/reports routes) must keep humans identical and still deny agents unless the specific route declares a scope.
  - Surat Jalan: agents with the scope bypass `requireDivisi`.
  - **Test:** route-access matrix test over **every** route (PRD §10). The human snapshot from T0 is unchanged.

- [x] **T5 — New endpoints**
  - `PATCH /api/orders/:id/status`, `PATCH /api/orders/:id/publish-consent`, `GET /api/agent/orders/public-summary`, `GET /api/agent/orders/:id/design-brief`, `GET /api/agent/me` (PRD §4).
  - PII filtering as **pure mapper functions**.
  - The status change writes an `OrderTimeline` entry with `actor`.
  - **Test:** mapper unit tests (no forbidden keys, `desain_fix_url` / `order_name` only with consent); zod validation tests; endpoints present in the route-access test with correct scopes.

- [x] **T5b — Status rules & task progress fix**
  - `PATCH /api/orders/:id/status` must follow the human rules: go through `transitionOrderStatus` / `MANUAL_TRANSITIONS` only (`Belum Di Proses → Desain Fix`, `Done → Dikirim` with resi + shipping method, `Dikirim → Di Ambil Costumer`). `STATUS_API_TARGETS` = those three targets; `On Progress` / `Done` are rejected (they stay automatic via `recalculateOrderStatus`). Body accepts `note`, `resi`, `shipping_method`.
  - Remove scope `tasks:progress` (catalog, `agent-produksi`, route map). `POST /api/tasks/:id/progress` stays humans-only.
  - Add `orders:status` to `agent-admin` (for `Desain Fix` from the human's instruction).
  - Remove the resolved `tasks:progress` item from Follow-ups.
  - **Test:** unit/route tests: every allowed transition passes, every other transition → 400, `Dikirim` without resi → 400, same status = no-op; route-access test updated (`tasks:progress` gone, agent gets 403 on task progress); T0 human snapshot unchanged.

- [x] **T6 — Audit log + rate limit**
  - Audit middleware per PRD §6 (agent non-GET only, after finish, redacted summary, fire-and-forget).
  - Per-agent rate limiter (60/min, 429).
  - **Test:** unit tests for summary builder / redaction and for "write only for agent non-GET"; limiter keyed by user id.

- [ ] **T7 — Agent CLI** 🧑
  - `agents:create`, `agents:list`, `agents:rotate-key` (also `--all`: new key for every agent account in one run, for when `AGENT_KEY_SECRET` is lost or leaked), `agents:disable` per PRD §8 (npm scripts in `backend/package.json`), using the T0 confirmation helper and the T2 account config.
  - **Test:** unit tests against an in-memory store: idempotent create, scope update on re-run, key printed only for new accounts, rotate invalidates the old key, `--all` rotates every agent account and prints all new keys once. Human runs `npm run agents:create -- --yes` on the **dev copy** and stores the 7 keys safely.

- [ ] **T8 — Frontend: publish consent + agent activity** 🧑
  - Order detail toggle + note (admin/owner) → publish-consent endpoint.
  - Owner page "Aktivitas Agent" (`GET /api/owner/agent-activity`, owner only) with agent filter.
  - **Test:** `npm run build` + `npm run lint` in `frontend/`. Human checks both screens against the dev copy.

- [ ] **T9 — End-to-end check & docs** 🧑
  - Script `backend/scripts/agent-smoke.js`: reads keys from env, hits one allowed and one denied route per agent, prints a table.
  - Update `prd.md` (Data Model: Users, Orders, AuditLog; Agent Access section) and `README.md` (agent setup, `AGENT_KEY_SECRET` in Vercel env).
  - Set this plan to `Status: done`.
  - **Test:** human runs the smoke script against the dev copy: all rows as expected; `npm test` green.

---

## Follow-ups
- Shared rate limit across Vercel instances (Redis store via `rate-limit-redis`, new dependency): only if per-instance limiting proves insufficient. The MCP server will also throttle agents on its side.

## Log
| Date | Task | Note |
|---|---|---|
| 2026-11-07 | T0 | Done. `npm test` green (9); `npm run setup-sheets` without `--yes` printed the title and made no changes. |
| 2026-11-07 | T1 | Done. `npm test` green (18). `setup-sheets --yes` run on "22Studio Payroll DB Development"; headers verified, existing rows untouched. |
| 2026-11-07 | T2 | Done. `npm test` green (33). `scopeForRoute` takes route patterns (`/api/orders/:id`), not request URLs. |
| 2026-11-07 | T3 | Done. `npm test` green (56). Agent lookup uses `UsersRepo.getAll()` (30s cache), so disable/rotate can lag up to 30s per instance. |
| 2026-11-07 | T4 | Done. `npm test` green (70). Human snapshot unchanged. `allow({ roles, scope })` in `middleware/auth.js`; router-level `requireRole` removed from owner*/cms/reports/cash-accounts routers (per-route guards instead). |
| 2026-11-07 | T5 | Done. `npm test` green (99). `NEW_ENDPOINTS` removed from the scope catalog. `route-roles.json` regenerated: 5 routes added, no existing entry changed. Status endpoint: any of the 4 statuses (no transition map), no-op if unchanged, `Di Ambil Costumer` is final. |
| 2026-11-07 | T6 | Done. `npm test` green (122). Audit + limiter run inside `requireAuth`'s agent branch. Limiter counters are per process (per serverless instance). New optional env `AGENT_RATE_LIMIT_PER_MIN` (default 60). Test env now points the service account at a missing file so tests can't reach Sheets. |
| 2026-11-07 | T5b | Done. `npm test` green (145). Status endpoint now goes through `transitionOrderStatus` (targets Desain Fix / Dikirim / Di Ambil Costumer). `tasks:progress` removed; `agent-admin` gained `orders:status`. Also: failed agent-key attempts log a server warning (reason, key prefix, ip, method, path; never the secret). PRD-agent-access.md §2–§4 still shows the old scope and status list. |
| 2026-11-07 | T7 | Code + tests done, `npm test` green (178). Not ticked: human still has to run `npm run agents:create -- --yes` on the dev copy and store the 7 keys (not run by the agent, since it prints the keys). `agents:create` without `--yes` and `agents:list` verified against "22Studio Payroll DB Development". |
