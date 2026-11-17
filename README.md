# 22Studio Payroll Management System

Piece Rate Payroll system for **22Studio Konveksi & Sablon** — employees log finished work, admins manage customers/articles/pricing and payroll. See [prd.md](prd.md) for the full product spec.

## Tech Stack

- **Frontend**: React (Vite) + TypeScript, Tailwind CSS, shadcn/ui, React Router, TanStack Query, React Hook Form + Zod, Axios
- **Backend**: Node.js + Express (REST API)
- **Database**: Google Sheets (via Google Sheets API), one tab per table — `Users`, `Employees`, `Customers`, `Articles`, `WorkLogs`, `Payroll`

## Project Structure

```
backend/       Express REST API + Google Sheets data layer
frontend/      React admin & employee web app
api/index.js   Vercel serverless entry point (wraps backend/app.js)
vercel.json    Vercel build/routing config
package.json   Root deps for the /api function only (mirrors backend's runtime deps)
prd.md         Product requirement document
```

## Prerequisites

- Node.js 18+
- A Google Cloud service account with the Google Sheets API enabled, sharing edit access to the target spreadsheet (already configured in `.env` / `service-account.json`)

## Setup

### 1. Backend

```bash
cd backend
npm install
npm run setup-sheets -- --yes   # one-time: creates sheet tabs, headers, and seeds an admin user (see the warning below)
npm run dev                     # starts the API on http://localhost:3000
npm test                        # backend tests (no Google Sheets access needed)
                                # frontend: `cd frontend && npm test` (Kalkulator HPP formulas)
```

> **`setup-sheets` writes to the spreadsheet in `GOOGLE_SHEETS_ID`.** It rewrites every header row, deletes a tab named `Sheet1`, and seeds `admin` / `admin_produksi` / `owner` accounts with default passwords. Only run it against a **dev copy** (Google Sheets → File → Make a copy). Without `--yes` it just prints the spreadsheet title and exits, so run it that way first and check the title. `backend/.env.example` lists every variable.

Seeded admin login: `admin` / `admin123` (change the password after first login).

Environment variables (`backend/.env`, copied from the project root `.env`):

```
GOOGLE_SHEETS_ID=...
GOOGLE_SERVICE_ACCOUNT_PATH=./service-account.json
JWT_SECRET=...
PORT=3000
AGENT_KEY_SECRET=...            # only if agent accounts are used, see "Agent Access"
AGENT_RATE_LIMIT_PER_MIN=60     # optional, per agent account
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev             # starts Vite on http://localhost:5173
```

The Vite dev server proxies `/api` to `http://localhost:3000`, so no extra frontend env config is needed in development.

## Creating Employee Accounts

Employee logins are created by an admin from **Karyawan → Tambah Karyawan** (this creates both the `Employees` record and the linked `Users` login in one step).

## Agent Access

AI agents (the seven `agent-*` accounts) call the API with an API key instead of a login. Each account has **scopes**; a route accepts an agent only if it declares the scope the account holds, and everything else is `403`. Human roles are unaffected. Spec: `docs/product/PRD-agent-access.md`.

### Setup (dev copy first)

1. Set `AGENT_KEY_SECRET` in `backend/.env` to a long random value (for example `openssl rand -base64 48`). It keys the hash of every API key: keep it in a password manager, use a **different** value in dev and production, and don't change it afterwards without rotating all keys.
2. Check the target, then create the accounts:

   ```bash
   cd backend
   npm run agents:create            # prints the spreadsheet title and exits; confirm it is the dev copy
   npm run agents:create -- --yes   # creates the 7 accounts and prints each key ONCE
   ```

   Store the keys immediately (they cannot be shown again). Re-running `agents:create` is safe: it only updates scopes and prints no keys for existing accounts.
3. Day-to-day commands (every write command needs `--yes` and prints the spreadsheet title first):

   ```bash
   npm run agents:list
   npm run agents:rotate-key -- --username=agent-owner --yes   # new key; the old one stops working
   npm run agents:rotate-key -- --all --yes                     # new key for every agent (e.g. AGENT_KEY_SECRET lost or leaked)
   npm run agents:disable -- --username=agent-owner --yes       # add --enable to turn it back on
   ```
4. Check access with the smoke script (read-only; it needs a running backend and one key per account):

   ```bash
   SMOKE_BASE_URL=http://localhost:3000 \
   SMOKE_KEY_AGENT_MANAGER=agk_... SMOKE_KEY_AGENT_OWNER=agk_... SMOKE_KEY_AGENT_PRODUKSI=agk_... \
   SMOKE_KEY_AGENT_ADMIN=agk_... SMOKE_KEY_AGENT_MARKETING=agk_... SMOKE_KEY_AGENT_DESIGNER=agk_... \
   SMOKE_KEY_AGENT_KEUANGAN=agk_... npm run agents:smoke
   ```

   It prints one allowed (expect `200`) and one denied (expect `403`) route per agent and exits non-zero if any row is off or a key is missing.

The owner can review what agents changed under **Aktivitas Agent** in the Keuangan menu. The "Publikasi Desain" box on an order's detail page records whether the customer allowed the design to be published.

### Rolling out to production

Do **not** run `setup-sheets` against production. Prepare the production spreadsheet by hand instead:

1. `Users` tab: add headers in `F1:I1`: `scopes`, `api_key_hash`, `api_key_prefix`, `disabled`.
2. `Orders` tab: add headers in `M1:N1`: `boleh_publikasi`, `catatan_publikasi`.
3. Add a new tab named `AuditLog` with headers in `A1:I1`: `id`, `created_at`, `user_id`, `username`, `role`, `method`, `path`, `status_code`, `summary`.
4. Kalkulator HPP needs three more tabs, each with its headers in row 1 (`A1`…): `HppFabrics`: `id`, `name`, `color`, `supplier`, `price`, `gsm`, `date`, `note` · `HppThreads`: `id`, `brand`, `code`, `name`, `hex`, `price`, `yield`, `note` · `HppCalculations`: `id`, `created_at`, `created_by`, `tab`, `name`, `qty`, `hpp`, `total`, `sale`, `data`. Without them the menu shows errors, nothing else breaks.
5. Set `AGENT_KEY_SECRET` (and optionally `AGENT_RATE_LIMIT_PER_MIN`) in the Vercel project, then deploy.
6. Create the production accounts deliberately, checking that the printed title is the production spreadsheet:

   ```bash
   GOOGLE_SHEETS_ID=<production id> AGENT_KEY_SECRET=<production secret> npm run agents:create
   GOOGLE_SHEETS_ID=<production id> AGENT_KEY_SECRET=<production secret> npm run agents:create -- --yes
   ```

## Building for Production

```bash
cd frontend && npm run build   # outputs static assets to frontend/dist
cd backend && npm start        # run the API with plain Node (no reload)
```

Serve `frontend/dist` behind a static host / reverse proxy that forwards `/api` to the backend.

## Deploying to Vercel

The whole app (frontend + API) deploys as a **single Vercel project**: the React app is served as a static site, and the Express API runs as one serverless function at `/api/*` (see `api/index.js` and `vercel.json`).

### 1. Prepare credentials

Vercel's filesystem is ephemeral, so `service-account.json` can't be shipped as a file (and shouldn't be committed to git). Instead, the whole file content is passed as one environment variable — `backend/config/env.js` and `backend/google-sheet/sheetClient.js` already support this.

```bash
cat service-account.json | pbcopy   # macOS — or just open the file and copy its full contents
```

### 2. Set environment variables in the Vercel project

| Variable | Value |
|---|---|
| `GOOGLE_SHEETS_ID` | Same as local `.env` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The **entire contents** of `service-account.json`, pasted as one value |
| `JWT_SECRET` | Same as local `.env` (or a new, strong secret for production) |
| `AGENT_KEY_SECRET` | Required if agent accounts are used: the production value from "Agent Access" (different from dev) |
| `AGENT_RATE_LIMIT_PER_MIN` | Optional, requests per minute per agent account (default 60) |

(`GOOGLE_SERVICE_ACCOUNT_PATH` and `PORT` are not needed on Vercel.)

### 3. Deploy

Using the Vercel CLI (works even without a git repo):

```bash
npm i -g vercel
vercel            # first run: link/create the project, deploy a preview
vercel --prod     # promote to production
```

Or connect the repo to Vercel via the dashboard (Import Project) for git-based deploys — either way, make sure the project's **Root Directory** stays the repository root (not `frontend/`), since `vercel.json` at the root drives both the frontend build and the API function.

### Notes

- The Google Sheets read-cache and per-sheet write-lock in `backend/google-sheet/SheetRepository.js` live in memory per function instance. On serverless this resets between cold starts and isn't shared across concurrent invocations — fine at this app's scale, but worth knowing if usage grows heavily concurrent.
- Run `npm run setup-sheets -- --yes` from `backend/` once (locally, against the same spreadsheet) before the first deploy only if the sheet tabs don't exist yet, and only on a spreadsheet that is safe to overwrite (see the warning under Setup). For an existing production spreadsheet, add new columns/tabs by hand as described under "Rolling out to production".
- The agent rate limit counts requests in each function instance's memory, so on Vercel the limit applies per instance.
