import { AGENT_ACCOUNTS } from '../config/agentScopes.js';

// One read-only (GET) route an agent may call and one it may not, per account.
// scopeForRoute() backs both columns in test/agentSmoke.test.js, so a change
// to the scope catalog that makes a row wrong fails the tests.
export const SMOKE_PLAN = {
  'agent-manager': { allowed: '/api/orders', denied: '/api/owner/cash/accounts' },
  'agent-owner': { allowed: '/api/owner/cash/accounts', denied: '/api/tasks' },
  'agent-produksi': { allowed: '/api/tasks', denied: '/api/owner/cash/accounts' },
  'agent-admin': { allowed: '/api/customers', denied: '/api/owner/cash/accounts' },
  'agent-marketing': { allowed: '/api/agent/orders/public-summary', denied: '/api/orders' },
  'agent-designer': { allowed: '/api/articles', denied: '/api/orders' },
  'agent-keuangan': { allowed: '/api/owner/cash/accounts', denied: '/api/orders' },
};

export function keyEnvName(username) {
  return `SMOKE_KEY_${username.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
}

function buildChecks() {
  return AGENT_ACCOUNTS.flatMap(({ username }) => {
    const plan = SMOKE_PLAN[username];
    return [
      { username, kind: 'allowed', path: plan.allowed, expected: 200 },
      { username, kind: 'denied', path: plan.denied, expected: 403 },
    ];
  });
}

export const SMOKE_CHECKS = buildChecks();

// Returns one row per check. A missing key is a failure (the check could not
// be made), never a silent pass. Keys are used for the request only and are
// not part of any row.
export async function runSmoke({ baseUrl, env, fetchImpl = fetch, timeoutMs = 15000 }) {
  const rows = [];
  for (const check of SMOKE_CHECKS) {
    const key = env[keyEnvName(check.username)];
    const row = { agent: check.username, kind: check.kind, route: `GET ${check.path}`, expected: check.expected };
    if (!key) {
      rows.push({ ...row, actual: '-', result: 'FAIL', note: `no key: set ${keyEnvName(check.username)}` });
      continue;
    }
    try {
      const res = await fetchImpl(`${baseUrl}${check.path}`, {
        headers: { authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(timeoutMs),
      });
      rows.push({ ...row, actual: res.status, result: res.status === check.expected ? 'OK' : 'FAIL', note: '' });
    } catch (err) {
      rows.push({ ...row, actual: 'error', result: 'FAIL', note: err.name === 'TimeoutError' ? 'timeout' : 'request failed' });
    }
  }
  return rows;
}

export function renderTable(rows) {
  const header = ['AGENT', 'CHECK', 'ROUTE', 'EXPECT', 'GOT', 'RESULT'];
  const lines = rows.map((r) => [r.agent, r.kind, r.route, String(r.expected), String(r.actual), r.note ? `${r.result} (${r.note})` : r.result]);
  const widths = header.map((h, i) => Math.max(h.length, ...lines.map((l) => l[i].length)));
  const fmt = (cells) => cells.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd();
  return [fmt(header), fmt(widths.map((w) => '-'.repeat(w))), ...lines.map(fmt)].join('\n');
}

export function summarize(rows) {
  const failed = rows.filter((r) => r.result !== 'OK').length;
  return { failed, ok: failed === 0, line: failed === 0 ? `All ${rows.length} checks as expected.` : `${failed} of ${rows.length} checks FAILED.` };
}
