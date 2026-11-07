import './helpers/testEnv.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installMountPathRecorder, collectRouteGuards } from './helpers/routeWalker.js';
import { AGENT_SCOPES, ANY_AGENT_SCOPE, scopeForRoute, ROUTE_SCOPES } from '../config/agentScopes.js';

installMountPathRecorder();
const { default: app } = await import('../app.js');
const { allow, requireRole, requireDivisi } = await import('../middleware/auth.js');

const routes = collectRouteGuards(app);

const PUBLIC_ROUTES = [
  'GET /api/health',
  'GET /api/public/cms/content',
  'GET /api/public/order-timeline',
  'GET /s/:code',
  'POST /api/auth/login',
  'POST /api/auth/logout',
  'POST /api/public/orders/design/approve',
];

function agent(scopes) {
  return { id: '99', username: 'agent-test', role: 'agent', scopes: new Set(scopes) };
}

// Runs the route's guards (allow/requireRole/requireHuman/requireDivisi) in
// order, as Express would, for an already-authenticated user. Returns the
// first error's status, or null if every guard let the request through.
function deniedStatus(route, user) {
  const req = { user };
  for (const guard of route.chain) {
    let error = null;
    guard(req, {}, (err) => {
      error = err ?? null;
    });
    if (error) return error.status;
  }
  return null;
}

const protectedRoutes = routes.filter((r) => !PUBLIC_ROUTES.includes(r.key));

test('the public routes are exactly the expected ones', () => {
  const noAuth = routes.filter((r) => r.auth === 'none').map((r) => r.key);
  assert.deepEqual(noAuth.sort(), [...PUBLIC_ROUTES].sort());
});

test('every non-public route declares at least one route guard', () => {
  for (const route of protectedRoutes) assert.ok(route.chain.length > 0, `${route.key} has no guard`);
});

test('agent with no scopes gets 403 on every non-public route except the any-agent ones', () => {
  for (const route of protectedRoutes) {
    if (scopeForRoute(route.method, route.path) === ANY_AGENT_SCOPE) continue;
    assert.equal(deniedStatus(route, agent([])), 403, route.key);
  }
});

test('agent-only routes (new endpoints) reject every human role', () => {
  const agentOnly = ['GET /api/agent/me', 'GET /api/agent/orders/public-summary', 'GET /api/agent/orders/:id/design-brief'];
  for (const key of agentOnly) {
    const route = routes.find((r) => r.key === key);
    assert.ok(route, `${key} is not registered`);
    for (const role of ['admin', 'admin_produksi', 'owner', 'employee']) {
      assert.equal(deniedStatus(route, { id: '1', role }), 403, `${key} as ${role}`);
    }
  }
});

test('the new endpoints exist with the scopes from the PRD', () => {
  const expected = {
    'PATCH /api/orders/:id/status': 'orders:status',
    'PATCH /api/orders/:id/publish-consent': 'orders:publish-flag',
    'GET /api/agent/orders/public-summary': 'orders:public-summary',
    'GET /api/agent/orders/:id/design-brief': 'orders:read-design',
    'GET /api/agent/me': ANY_AGENT_SCOPE,
  };
  for (const [key, scope] of Object.entries(expected)) {
    const route = routes.find((r) => r.key === key);
    assert.ok(route, `${key} is not registered`);
    assert.equal(route.chain.map((g) => g.scope).find(Boolean), scope, key);
  }
});

test('humans keep their roles on the new order endpoints', () => {
  const status = routes.find((r) => r.key === 'PATCH /api/orders/:id/status');
  const consent = routes.find((r) => r.key === 'PATCH /api/orders/:id/publish-consent');
  for (const role of ['admin', 'admin_produksi', 'owner']) assert.equal(deniedStatus(status, { id: '1', role }), null, role);
  assert.equal(deniedStatus(status, { id: '1', role: 'employee' }), 403);
  for (const role of ['admin', 'owner']) assert.equal(deniedStatus(consent, { id: '1', role }), null, role);
  for (const role of ['admin_produksi', 'employee']) assert.equal(deniedStatus(consent, { id: '1', role }), 403, role);
});

test('agent with every scope is still denied on routes outside the scope map', () => {
  const all = agent(AGENT_SCOPES);
  for (const route of protectedRoutes) {
    if (scopeForRoute(route.method, route.path) !== null) continue;
    assert.equal(deniedStatus(route, all), 403, route.key);
  }
});

test('agent with exactly the mapped scope passes the guards', () => {
  let checked = 0;
  for (const route of protectedRoutes) {
    const scope = scopeForRoute(route.method, route.path);
    if (scope === null) continue;
    const needed = scope === ANY_AGENT_SCOPE ? [] : [scope];
    assert.equal(deniedStatus(route, agent(needed)), null, `${route.key} needs ${scope}`);
    checked += 1;
  }
  assert.ok(checked > 0);
});

test('agent with every scope except the mapped one is denied', () => {
  for (const route of protectedRoutes) {
    const scope = scopeForRoute(route.method, route.path);
    if (scope === null || scope === ANY_AGENT_SCOPE) continue;
    const others = AGENT_SCOPES.filter((s) => s !== scope);
    assert.equal(deniedStatus(route, agent(others)), 403, `${route.key} without ${scope}`);
  }
});

test('the scope declared on each route matches the scope map', () => {
  for (const route of protectedRoutes) {
    const declared = route.chain.map((g) => g.scope).find(Boolean) ?? null;
    assert.equal(declared, scopeForRoute(route.method, route.path), route.key);
  }
});

test('every mapped route is covered by this matrix', () => {
  const registered = new Set(routes.map((r) => r.key));
  for (const key of Object.values(ROUTE_SCOPES).flat()) assert.ok(registered.has(key), key);
});

test('an agent with a scope for another route cannot use human-only routes', () => {
  for (const key of ['GET /api/employees', 'POST /api/attendance', 'GET /api/settings/bank-account', 'PUT /api/profile', 'GET /api/auth/me', 'DELETE /api/orders/:id', 'POST /api/owner/cash/accounts']) {
    const route = routes.find((r) => r.key === key);
    assert.ok(route, key);
    assert.equal(deniedStatus(route, agent(AGENT_SCOPES)), 403, key);
  }
});

// ---- guard unit behaviour -------------------------------------------------

function pass(guard, user) {
  let error = null;
  guard({ user }, {}, (err) => {
    error = err ?? null;
  });
  return error;
}

test('allow(): humans follow roles only, exactly like requireRole', () => {
  const guard = allow({ roles: ['admin', 'owner'], scope: 'orders:write' });
  assert.equal(pass(guard, { role: 'admin' }), null);
  assert.equal(pass(guard, { role: 'owner' }), null);
  assert.equal(pass(guard, { role: 'employee' })?.status, 403);
  assert.equal(pass(guard, undefined)?.status, 403);
  assert.equal(pass(allow({ scope: 'x' }), { role: 'employee' }), null);
  assert.equal(pass(requireRole('admin'), { role: 'owner' })?.status, 403);
});

test('allow(): agents need the declared scope; no scope declared means deny', () => {
  const guard = allow({ roles: ['admin'], scope: 'orders:write' });
  assert.equal(pass(guard, agent(['orders:write'])), null);
  assert.equal(pass(guard, agent(['orders:read']))?.status, 403);
  assert.equal(pass(requireRole('admin'), agent(AGENT_SCOPES))?.status, 403);
  assert.equal(pass(allow(), agent(AGENT_SCOPES))?.status, 403);
});

test("allow(): 'agent' is rejected as a role", () => {
  assert.throws(() => allow({ roles: ['admin', 'agent'] }));
});

test('requireDivisi: agents pass only after allow() verified their scope', () => {
  const divisi = requireDivisi('Finishing');
  assert.equal(pass(divisi, agent(['surat-jalan:read']))?.status, 403);

  const req = { user: agent(['surat-jalan:read']) };
  let error = null;
  allow({ roles: ['employee'], scope: 'surat-jalan:read' })(req, {}, (e) => (error = e ?? null));
  assert.equal(error, null);
  divisi(req, {}, (e) => (error = e ?? null));
  assert.equal(error, null);
});

test('requireDivisi: human behaviour unchanged', () => {
  const divisi = requireDivisi('Finishing');
  assert.equal(pass(divisi, { role: 'admin' }), null);
  assert.equal(pass(divisi, { role: 'owner' }), null);
  assert.equal(pass(divisi, { role: 'employee', divisi: 'Finishing' }), null);
  assert.equal(pass(divisi, { role: 'employee', divisi: 'Cutting' })?.status, 403);
});

test('task progress is humans-only: the scope is gone and every agent gets 403', () => {
  assert.equal(AGENT_SCOPES.includes('tasks:progress'), false);
  assert.equal(scopeForRoute('POST', '/api/tasks/:id/progress'), null);
  const route = routes.find((r) => r.key === 'POST /api/tasks/:id/progress');
  assert.ok(route);
  assert.equal(deniedStatus(route, agent(AGENT_SCOPES)), 403);
  assert.equal(deniedStatus(route, agent(['tasks:read', 'tasks:write'])), 403);
  for (const role of ['admin', 'admin_produksi', 'owner', 'employee']) {
    assert.equal(deniedStatus(route, { id: '1', role }), null, role);
  }
});
