# AGENTS.md

Rules for AI agents in this repo. Durable — milestone scope lives in `docs/plans/` (plan marked `Status: active`). Product spec of the existing system: `prd.md`.

## Workflow
- Do only the task you're given. Don't write plans or proposals — read what you need, code, test.
- **Done =** the task's **Test** target passes **and** `npm test` (backend) passes; if `frontend/` changed, `npm run build` and `npm run lint` there pass too. Never claim done without running them; say exactly what you couldn't run.
- Then tick the task in the plan. Report in ≤10 lines: files changed, test results, proposed commit message (Conventional Commits).
- Ask first only for: new dependency, new top-level folder, breaking an existing API response or sheet column, anything touching secrets/deploy.
- Out-of-scope ideas → one line under the plan's *Follow-ups*. Don't build them.

## Git — AI never writes
Read-only git only (`status`, `diff`, `log`, `show`). Never `add`, `commit`, `push`, `merge`, `rebase`, `reset`, `stash`, `tag`, `checkout`/`switch`, create/delete branches, `restore`, `clean`, or open PRs. The human commits.

## Spreadsheet safety (critical)
- `.env` may point at the **production** spreadsheet. Never run `npm run setup-sheets` or any script that writes to Sheets unless the human confirmed `GOOGLE_SHEETS_ID` is a dev copy. Write-scripts must print the spreadsheet title and require `--yes`.
- Tests never touch Google Sheets: use in-memory fakes / injected stores.

## Stack (locked)
Backend: Node 18+ ESM · Express 5 · zod · Google Sheets via `SheetRepository` · Cloudinary · optional Redis (ioredis) · `node:test`.
Frontend: React + Vite + TypeScript · Tailwind + shadcn/ui · React Router · TanStack Query · React Hook Form + zod · Axios · oxlint.
Deploy: one Vercel project (`api/index.js` wraps `backend/app.js`).
- A new backend dependency goes into **both** `backend/package.json` and root `package.json` (the Vercel function), same version.

## Layout & commands
`backend/` (`routes` → `controllers` → `services` → `google-sheet` repos) · `frontend/` · `api/` (Vercel entry) · `docs/` · `prd.md`

Backend: `npm run dev` · `npm start` · `npm test` · `npm run setup-sheets` (dev copy only)
Frontend: `npm run dev` · `npm run build` · `npm run lint`

## Architecture rules
1. **Sheet columns are read by index.** New columns are only **appended** to the end of a `SHEET_SCHEMAS` entry — never inserted, reordered, renamed or removed. Existing rows have empty values for new columns; services must treat empty as the documented default.
2. **Layers:** routes declare auth + validation; controllers parse with zod and call services; services hold business rules and use `*Repo`; nothing outside `google-sheet/` talks to the Sheets API.
3. **Auth is explicit on every route.** Every non-public route has `requireAuth` plus a role guard. Agent accounts (role `agent`) are **default-deny**: an agent reaches a route only if that route declares the scope it needs.
4. **Errors** via `ApiError(status, message)`; never leak stack traces or raw Sheets errors to clients.
5. **IDs:** keep each repo's existing id strategy (uuid where already used).
6. **Secrets** only in `.env` / Vercel env; `.env.example` lists every variable (no values). Never commit `.env` or `service-account.json`.
7. Keep Indonesian domain terms as they are (Divisi, Lembar PO, Surat Jalan, DP, pelunasan, kasbon).

## Code
- ESM, async/await, named exports for new modules. No dead or commented-out code.
- Validate all external input with zod (body, query, params, env).
- New pure logic gets unit tests; bug fixes get a regression test. Never delete, skip or weaken a test to make it pass.
