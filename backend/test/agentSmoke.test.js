import './helpers/testEnv.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const lib = await import('../scripts/agentSmokeLib.js');
const { AGENT_ACCOUNTS, scopeForRoute, ANY_AGENT_SCOPE } = await import('../config/agentScopes.js');
const { collectRouteGuards, installMountPathRecorder } = await import('./helpers/routeWalker.js');
installMountPathRecorder();
const { default: app } = await import('../app.js');

const { SMOKE_PLAN, SMOKE_CHECKS, keyEnvName, runSmoke, renderTable, summarize } = lib;
const registered = new Set(collectRouteGuards(app).map((r) => r.key));
const scopesOf = Object.fromEntries(AGENT_ACCOUNTS.map((a) => [a.username, a.scopes]));

test('every agent account has an allowed and a denied smoke route', () => {
  assert.deepEqual(Object.keys(SMOKE_PLAN).sort(), AGENT_ACCOUNTS.map((a) => a.username).sort());
  assert.equal(SMOKE_CHECKS.length, 14);
});

test('the smoke routes are real GET routes without path params', () => {
  for (const { allowed, denied } of Object.values(SMOKE_PLAN)) {
    for (const path of [allowed, denied]) {
      assert.ok(registered.has(`GET ${path}`), `GET ${path} is not registered`);
      assert.equal(path.includes(':'), false, path);
    }
  }
});

test('allowed routes need a scope the agent has; denied routes need one it lacks', () => {
  for (const [username, { allowed, denied }] of Object.entries(SMOKE_PLAN)) {
    const allowedScope = scopeForRoute('GET', allowed);
    assert.ok(allowedScope, `${username}: ${allowed} has no scope`);
    assert.ok(allowedScope === ANY_AGENT_SCOPE || scopesOf[username].includes(allowedScope), `${username} lacks ${allowedScope}`);

    const deniedScope = scopeForRoute('GET', denied);
    assert.ok(deniedScope && deniedScope !== ANY_AGENT_SCOPE, `${username}: ${denied} must need a scope`);
    assert.equal(scopesOf[username].includes(deniedScope), false, `${username} has ${deniedScope}`);
  }
});

test('key env names', () => {
  assert.equal(keyEnvName('agent-manager'), 'SMOKE_KEY_AGENT_MANAGER');
  assert.equal(keyEnvName('agent-keuangan'), 'SMOKE_KEY_AGENT_KEUANGAN');
});

const allKeys = Object.fromEntries(AGENT_ACCOUNTS.map((a) => [keyEnvName(a.username), `agk_${a.username}`]));

// Pretends to be the backend: answers by the catalog, from the key it receives.
function fakeBackend(overrides = {}) {
  const seen = [];
  const fetchImpl = async (url, { headers }) => {
    const key = headers.authorization.replace('Bearer ', '');
    const username = key.replace('agk_', '');
    const path = new URL(url).pathname;
    seen.push({ username, path, key });
    if (overrides[`${username} ${path}`] === 'throw') throw new Error('ECONNREFUSED');
    const status = overrides[`${username} ${path}`];
    if (status) return { status };
    const scope = scopeForRoute('GET', path);
    const allowed = scope === ANY_AGENT_SCOPE || scopesOf[username].includes(scope);
    return { status: allowed ? 200 : 403 };
  };
  return { fetchImpl, seen };
}

test('all rows are OK when the backend behaves', async () => {
  const { fetchImpl, seen } = fakeBackend();
  const rows = await runSmoke({ baseUrl: 'http://x', env: allKeys, fetchImpl });
  assert.equal(rows.length, 14);
  assert.deepEqual(rows.map((r) => r.result), Array(14).fill('OK'));
  assert.equal(summarize(rows).ok, true);
  assert.equal(seen.length, 14);
  assert.ok(seen.every((s) => s.key === `agk_${s.username}`));
});

test('a wrong status is a FAIL', async () => {
  const { fetchImpl } = fakeBackend({ 'agent-marketing /api/orders': 200 });
  const rows = await runSmoke({ baseUrl: 'http://x', env: allKeys, fetchImpl });
  const bad = rows.filter((r) => r.result === 'FAIL');
  assert.deepEqual(bad.map((r) => [r.agent, r.kind, r.actual]), [['agent-marketing', 'denied', 200]]);
  assert.equal(summarize(rows).ok, false);
  assert.match(summarize(rows).line, /1 of 14/);
});

test('a missing key fails its rows without making a request', async () => {
  const env = { ...allKeys };
  delete env.SMOKE_KEY_AGENT_ADMIN;
  const { fetchImpl, seen } = fakeBackend();
  const rows = await runSmoke({ baseUrl: 'http://x', env, fetchImpl });
  const missing = rows.filter((r) => r.agent === 'agent-admin');
  assert.deepEqual(missing.map((r) => r.result), ['FAIL', 'FAIL']);
  assert.match(missing[0].note, /SMOKE_KEY_AGENT_ADMIN/);
  assert.equal(seen.some((s) => s.username === 'agent-admin'), false);
  assert.equal(summarize(rows).ok, false);
});

test('a network error is a FAIL, not a crash', async () => {
  const { fetchImpl } = fakeBackend({ 'agent-owner /api/tasks': 'throw' });
  const rows = await runSmoke({ baseUrl: 'http://x', env: allKeys, fetchImpl });
  const bad = rows.find((r) => r.actual === 'error');
  assert.equal(bad.result, 'FAIL');
  assert.equal(bad.note, 'request failed');
});

test('keys never appear in the rows or the table', async () => {
  const { fetchImpl } = fakeBackend();
  const rows = await runSmoke({ baseUrl: 'http://x', env: allKeys, fetchImpl });
  const output = JSON.stringify(rows) + renderTable(rows);
  assert.equal(output.includes('agk_'), false);
});

test('the table has a header, a rule and one line per row, aligned', async () => {
  const { fetchImpl } = fakeBackend();
  const rows = await runSmoke({ baseUrl: 'http://x', env: allKeys, fetchImpl });
  const lines = renderTable(rows).split('\n');
  assert.equal(lines.length, 16);
  assert.match(lines[0], /^AGENT\s+CHECK\s+ROUTE\s+EXPECT\s+GOT\s+RESULT$/);
  assert.match(lines[1], /^-+\s+-+/);
  const routeColumn = lines[0].indexOf('ROUTE');
  assert.ok(lines.slice(2).every((l) => l.slice(routeColumn).startsWith('GET ')));
  assert.match(lines.find((l) => l.startsWith('agent-manager') && l.includes('denied')), /403\s+403\s+OK$/);
});
