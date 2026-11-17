import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSmoke, renderTable, summarize } from './agentSmokeLib.js';

// Read-only check of a running backend: for each agent account, one allowed
// and one denied GET route. Keys come from the environment (or backend/.env):
//   SMOKE_KEY_AGENT_MANAGER=agk_...   (one per account, see agentSmokeLib.js)
//   SMOKE_BASE_URL=http://localhost:3000
// Usage: npm run agents:smoke
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env'), quiet: true });

const baseUrl = (process.env.SMOKE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
console.log(`Target: ${baseUrl}\n`);

const rows = await runSmoke({ baseUrl, env: process.env });
console.log(renderTable(rows));

const { ok, line } = summarize(rows);
console.log(`\n${line}`);
process.exitCode = ok ? 0 : 1;
