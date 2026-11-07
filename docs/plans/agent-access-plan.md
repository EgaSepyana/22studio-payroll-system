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

- [ ] **T5 — New endpoints**
  - `PATCH /api/orders/:id/status`, `PATCH /api/orders/:id/publish-consent`, `GET /api/agent/orders/public-summary`, `GET /api/agent/orders/:id/design-brief`, `GET /api/agent/me` (PRD §4).
  - PII filtering as **pure mapper functions**.
  - The status change writes an `OrderTimeline` entry with `actor`.
  - **Test:** mapper unit tests (no forbidden keys, `desain_fix_url` / `order_name` only with consent); zod validation tests; endpoints present in the route-access test with correct scopes.

- [ ] **T6 — Audit log + rate limit**
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
- `POST /api/tasks/:id/progress` (`tasks:progress`): `taskController.addProgress` takes `employee_id` from the body only for admin/admin_produksi/owner; for an agent it falls back to `req.user.employee_id` (empty) and throws. Decide before T7/T9 whether agents may pass `employee_id`.
- After T5, drop `NEW_ENDPOINTS` from `config/agentScopes.js` and make the "every mapped route exists" test cover all routes.

## Log
| Date | Task | Note |
|---|---|---|
| 2026-11-07 | T0 | Done. `npm test` green (9); `npm run setup-sheets` without `--yes` printed the title and made no changes. |
| 2026-11-07 | T1 | Done. `npm test` green (18). `setup-sheets --yes` run on "22Studio Payroll DB Development"; headers verified, existing rows untouched. |
| 2026-11-07 | T2 | Done. `npm test` green (33). `scopeForRoute` takes route patterns (`/api/orders/:id`), not request URLs. |
| 2026-11-07 | T3 | Done. `npm test` green (56). Agent lookup uses `UsersRepo.getAll()` (30s cache), so disable/rotate can lag up to 30s per instance. |
| 2026-11-07 | T4 | Done. `npm test` green (70). Human snapshot unchanged. `allow({ roles, scope })` in `middleware/auth.js`; router-level `requireRole` removed from owner*/cms/reports/cash-accounts routers (per-route guards instead). |
