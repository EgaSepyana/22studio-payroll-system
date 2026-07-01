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
npm run setup-sheets   # one-time: creates sheet tabs, headers, and seeds an admin user
npm run dev            # starts the API on http://localhost:3000
```

Seeded admin login: `admin` / `admin123` (change the password after first login).

Environment variables (`backend/.env`, copied from the project root `.env`):

```
GOOGLE_SHEETS_ID=...
GOOGLE_SERVICE_ACCOUNT_PATH=./service-account.json
JWT_SECRET=...
PORT=3000
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
- Run `npm run setup-sheets` from `backend/` once (locally, against the same spreadsheet) before the first deploy if the sheet tabs don't exist yet — it only needs to run once, not on every deploy.
