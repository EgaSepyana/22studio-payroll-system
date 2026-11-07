import './helpers/testEnv.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installMountPathRecorder, collectRouteGuards } from './helpers/routeWalker.js';
import {
  ANY_AGENT_SCOPE,
  ROUTE_SCOPES,
  NEW_ENDPOINTS,
  AGENT_SCOPES,
  AGENT_ACCOUNTS,
  FORBIDDEN_ROUTE_RULES,
  scopeForRoute,
  hasScope,
  isForbiddenRoute,
} from '../config/agentScopes.js';

installMountPathRecorder();
const { default: app } = await import('../app.js');
const registered = new Set(collectRouteGuards(app).map((r) => r.key));
const mapped = Object.entries(ROUTE_SCOPES).flatMap(([scope, routes]) => routes.map((route) => ({ scope, route })));

const split = (route) => {
  const i = route.indexOf(' ');
  return [route.slice(0, i), route.slice(i + 1)];
};

test('there are exactly the 7 agent accounts from the PRD', () => {
  assert.deepEqual(AGENT_ACCOUNTS.map((a) => a.username).sort(), [
    'agent-admin',
    'agent-designer',
    'agent-keuangan',
    'agent-manager',
    'agent-marketing',
    'agent-owner',
    'agent-produksi',
  ]);
});

test('every account scope exists in the catalog, without duplicates', () => {
  for (const { username, scopes } of AGENT_ACCOUNTS) {
    assert.equal(new Set(scopes).size, scopes.length, `${username} has duplicate scopes`);
    for (const scope of scopes) assert.ok(AGENT_SCOPES.includes(scope), `${username}: unknown scope ${scope}`);
  }
});

test('every catalog scope maps to at least one route', () => {
  for (const scope of AGENT_SCOPES) assert.ok(ROUTE_SCOPES[scope].length > 0, `${scope} has no routes`);
});

test('no route is listed under two scopes', () => {
  const routes = mapped.map((m) => m.route);
  assert.equal(new Set(routes).size, routes.length);
});

test('no mapped route is a DELETE or a forbidden route', () => {
  for (const { scope, route } of mapped) {
    const [method, path] = split(route);
    assert.notEqual(method, 'DELETE', `${route} (${scope}) is a DELETE`);
    assert.equal(isForbiddenRoute(method, path), false, `${route} (${scope}) is forbidden`);
  }
});

test('every mapped route exists in the app router (new endpoints excepted)', () => {
  for (const { route } of mapped) {
    if (NEW_ENDPOINTS.includes(route)) continue;
    assert.ok(registered.has(route), `${route} is not registered`);
  }
});

test('new endpoints are all in the route map', () => {
  const routes = new Set(mapped.map((m) => m.route));
  for (const route of NEW_ENDPOINTS) assert.ok(routes.has(route), `${route} missing from the map`);
});

test('scopeForRoute resolves mapped routes and is case/slash tolerant', () => {
  assert.equal(scopeForRoute('GET', '/api/orders/:id'), 'orders:read');
  assert.equal(scopeForRoute('get', '/api/orders/:id/'), 'orders:read');
  assert.equal(scopeForRoute('PATCH', '/api/payroll/range/pay'), 'payroll:pay');
  assert.equal(scopeForRoute('GET', '/api/agent/me'), ANY_AGENT_SCOPE);
});

test('scopeForRoute is null for unmapped routes', () => {
  assert.equal(scopeForRoute('GET', '/api/payroll/mine'), null);
  assert.equal(scopeForRoute('DELETE', '/api/orders/:id'), null);
  assert.equal(scopeForRoute('POST', '/api/does-not-exist'), null);
  assert.equal(scopeForRoute('GET', '/api/orders/:id/dp'), null);
});

test('forbidden rules win even if a route were added to the map', () => {
  for (const rule of FORBIDDEN_ROUTE_RULES) {
    const sample = rule.prefix === '/' ? '/api/orders/:id' : `${rule.prefix}/anything`;
    const method = rule.methods ? rule.methods[0] : 'GET';
    assert.equal(isForbiddenRoute(method, sample), true, `${method} ${sample}`);
  }
  assert.equal(isForbiddenRoute('GET', '/api/owner/cash/accounts'), false);
  assert.equal(isForbiddenRoute('POST', '/api/owner/cash/accounts'), true);
  assert.equal(isForbiddenRoute('PUT', '/api/owner/cash/accounts/:id'), true);
  assert.equal(isForbiddenRoute('GET', '/api/employeesx'), false);
});

test('every registered DELETE and forbidden route resolves to no scope', () => {
  for (const key of registered) {
    const [method, path] = split(key);
    if (isForbiddenRoute(method, path)) assert.equal(scopeForRoute(method, path), null, key);
  }
});

test('forbidden rules cover real registered routes', () => {
  const forbiddenRegistered = [...registered].filter((k) => isForbiddenRoute(...split(k)));
  assert.ok(forbiddenRegistered.some((k) => k.startsWith('POST /api/employees')));
  assert.ok(forbiddenRegistered.some((k) => k.startsWith('DELETE ')));
  assert.ok(forbiddenRegistered.some((k) => k.startsWith('POST /api/public/orders/design/approve')));
});

test('hasScope: agent with the scope passes, without it fails', () => {
  const agent = { role: 'agent', scopes: new Set(['orders:read']) };
  assert.equal(hasScope(agent, 'orders:read'), true);
  assert.equal(hasScope(agent, 'orders:write'), false);
  assert.equal(hasScope({ role: 'agent', scopes: ['orders:read'] }, 'orders:read'), true);
});

test('hasScope: no scopes, missing user, humans and unknown scopes all fail', () => {
  assert.equal(hasScope({ role: 'agent', scopes: new Set() }, 'orders:read'), false);
  assert.equal(hasScope({ role: 'agent' }, 'orders:read'), false);
  assert.equal(hasScope(undefined, 'orders:read'), false);
  assert.equal(hasScope({ role: 'owner', scopes: new Set(['orders:read']) }, 'orders:read'), false);
  assert.equal(hasScope({ role: 'agent', scopes: new Set(['made:up']) }, 'made:up'), false);
});

test('hasScope: any agent passes the ANY_AGENT scope, humans do not', () => {
  assert.equal(hasScope({ role: 'agent', scopes: new Set() }, ANY_AGENT_SCOPE), true);
  assert.equal(hasScope({ role: 'admin' }, ANY_AGENT_SCOPE), false);
});
