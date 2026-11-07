import './helpers/testEnv.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const { env } = await import('../config/env.js');
const { createAuthMiddleware } = await import('../middleware/auth.js');
const { generateAgentKey, parseAgentKey, hashAgentSecret, verifyAgentSecret, isAgentKey } = await import(
  '../utils/agentKeyUtils.js'
);
const { authenticateAgentKey } = await import('../services/agentAuthService.js');
const { UsersRepo } = await import('../google-sheet/models.js');
const authService = await import('../services/authService.js');

const SERVER_SECRET = 'test-agent-key-secret';

function agentRow(overrides = {}) {
  const { key, prefix, hash } = generateAgentKey(SERVER_SECRET);
  return {
    key,
    row: {
      id: '10',
      username: 'agent-manager',
      password: '',
      role: 'agent',
      employee_id: '',
      scopes: 'orders:read, tasks:read',
      api_key_hash: hash,
      api_key_prefix: prefix,
      disabled: '',
      ...overrides,
    },
  };
}

function memoryStore(rows) {
  return { findByPrefix: async (prefix) => rows.find((r) => r.api_key_prefix === prefix) || null };
}

async function rejection(promise) {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  assert.fail('expected a rejection');
}

// ---- key format & hashing ------------------------------------------------

test('generated key has the agk_<prefix>_<secret> format and parses back', () => {
  const { key, prefix, hash } = generateAgentKey(SERVER_SECRET);
  assert.match(key, /^agk_[A-Za-z0-9]{8}_[A-Za-z0-9_-]{43,}$/);
  const parsed = parseAgentKey(key);
  assert.equal(parsed.prefix, prefix);
  assert.equal(hash, hashAgentSecret(parsed.secret, SERVER_SECRET));
  assert.ok(isAgentKey(key));
});

test('keys are random; the hash depends on the server secret', () => {
  const a = generateAgentKey(SERVER_SECRET);
  const b = generateAgentKey(SERVER_SECRET);
  assert.notEqual(a.key, b.key);
  const { secret } = parseAgentKey(a.key);
  assert.notEqual(hashAgentSecret(secret, SERVER_SECRET), hashAgentSecret(secret, 'another-server-secret'));
});

test('parseAgentKey rejects malformed keys', () => {
  for (const bad of ['', 'agk_', 'agk_abc_def', 'agk_short_x', 'agk_12345678_tooshort', 'xxx_12345678_' + 'a'.repeat(43), 'agk_1234567!_' + 'a'.repeat(43), null, undefined, 42]) {
    assert.equal(parseAgentKey(bad), null, String(bad));
  }
});

// ---- authenticateAgentKey ------------------------------------------------

test('valid key authenticates and yields the agent user', async () => {
  const { key, row } = agentRow();
  const user = await authenticateAgentKey(key, { store: memoryStore([row]), secret: SERVER_SECRET });
  assert.deepEqual(user, {
    id: '10',
    username: 'agent-manager',
    role: 'agent',
    scopes: new Set(['orders:read', 'tasks:read']),
  });
});

test('empty scopes column means an agent with no scopes', async () => {
  const { key, row } = agentRow({ scopes: '' });
  const user = await authenticateAgentKey(key, { store: memoryStore([row]), secret: SERVER_SECRET });
  assert.equal(user.scopes.size, 0);
});

test('wrong secret is rejected with 401', async () => {
  const { key, row } = agentRow();
  const forged = `${key.slice(0, 13)}${crypto.randomBytes(32).toString('base64url')}`;
  const err = await rejection(authenticateAgentKey(forged, { store: memoryStore([row]), secret: SERVER_SECRET }));
  assert.equal(err.status, 401);
});

test('key hashed with a different server secret is rejected', async () => {
  const { key, row } = agentRow();
  const err = await rejection(authenticateAgentKey(key, { store: memoryStore([row]), secret: 'rotated-server-secret' }));
  assert.equal(err.status, 401);
});

test('unknown prefix is rejected with 401', async () => {
  const { key } = agentRow();
  const err = await rejection(authenticateAgentKey(key, { store: memoryStore([]), secret: SERVER_SECRET }));
  assert.equal(err.status, 401);
});

test('disabled account is rejected with 401', async () => {
  const { key, row } = agentRow({ disabled: 'true' });
  const err = await rejection(authenticateAgentKey(key, { store: memoryStore([row]), secret: SERVER_SECRET }));
  assert.equal(err.status, 401);
});

test('a non-agent row, or a row without a key hash, is rejected', async () => {
  for (const overrides of [{ role: 'admin' }, { api_key_hash: '' }]) {
    const { key, row } = agentRow(overrides);
    const err = await rejection(authenticateAgentKey(key, { store: memoryStore([row]), secret: SERVER_SECRET }));
    assert.equal(err.status, 401);
  }
});

test('malformed key and missing AGENT_KEY_SECRET are rejected with 401', async () => {
  const { key, row } = agentRow();
  const store = memoryStore([row]);
  assert.equal((await rejection(authenticateAgentKey('agk_garbage', { store, secret: SERVER_SECRET }))).status, 401);
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal((await rejection(authenticateAgentKey(key, { store, secret: null }))).status, 401);
  } finally {
    console.error = originalError;
  }
});

test('every failure gives the same message', async () => {
  const { key, row } = agentRow();
  const disabled = agentRow({ disabled: 'true' });
  const messages = new Set();
  for (const [token, store] of [
    [key, memoryStore([])],
    [disabled.key, memoryStore([disabled.row])],
    ['agk_garbage', memoryStore([row])],
  ]) {
    messages.add((await rejection(authenticateAgentKey(token, { store, secret: SERVER_SECRET }))).message);
  }
  assert.equal(messages.size, 1);
});

test('the hash comparison uses crypto.timingSafeEqual', () => {
  const calls = [];
  const original = crypto.timingSafeEqual;
  crypto.timingSafeEqual = (a, b) => {
    calls.push([a.length, b.length]);
    return original(a, b);
  };
  try {
    const { key, row } = agentRow();
    const { secret } = parseAgentKey(key);
    assert.equal(verifyAgentSecret(secret, SERVER_SECRET, row.api_key_hash), true);
    assert.equal(verifyAgentSecret(secret, SERVER_SECRET, 'short'), false);
    assert.equal(verifyAgentSecret(secret, SERVER_SECRET, undefined), false);
  } finally {
    crypto.timingSafeEqual = original;
  }
  assert.equal(calls.length, 3);
});

// ---- middleware ----------------------------------------------------------

function run(middleware, req) {
  return new Promise((resolve) => {
    const request = { headers: {}, query: {}, method: 'GET', baseUrl: '/api/orders', path: '/1', ...req };
    middleware(request, {}, (err) => resolve({ err, req: request }));
  });
}

// Audit and rate limiting have their own tests (agentAudit/agentRateLimit);
// these tests only exercise key authentication.
function setup(rows = []) {
  return createAuthMiddleware({
    agentStore: memoryStore(rows),
    agentKeySecret: SERVER_SECRET,
    agentAuditor: () => {},
    agentRateLimiter: (req, res, next) => next(),
  });
}

test('requireAuth: valid agent key sets req.user', async () => {
  const { key, row } = agentRow();
  const { requireAuth } = setup([row]);
  const { err, req } = await run(requireAuth, { headers: { authorization: `Bearer ${key}` } });
  assert.equal(err, undefined);
  assert.equal(req.user.role, 'agent');
  assert.equal(req.user.username, 'agent-manager');
});

test('requireAuth: bad agent key, missing or malformed header give 401', async () => {
  const { key, row } = agentRow();
  const { requireAuth } = setup([row]);
  for (const authorization of [undefined, '', `Basic ${key}`, key, 'Bearer ', 'Bearer agk_garbage', `Bearer ${key}x`]) {
    const { err, req } = await run(requireAuth, { headers: authorization === undefined ? {} : { authorization } });
    assert.equal(err?.status, 401, String(authorization));
    assert.equal(req.user, undefined);
  }
});

test('requireAuth: agents are rejected on /api/auth, /api/profile and /api/notifications', async () => {
  const { key, row } = agentRow();
  const { requireAuth } = setup([row]);
  const headers = { authorization: `Bearer ${key}` };
  for (const [baseUrl, path] of [['/api/auth', '/me'], ['/api/auth', '/change-password'], ['/api/profile', '/'], ['/api/notifications', '/'], ['/api/notifications', '/unread-count']]) {
    const { err, req } = await run(requireAuth, { headers, baseUrl, path });
    assert.equal(err?.status, 403, `${baseUrl}${path}`);
    assert.equal(req.user, undefined);
  }
});

test('requireAuth: human JWT still works unchanged', async () => {
  const payload = { id: '1', username: 'admin', role: 'admin', employee_id: null, divisi: null };
  const token = jwt.sign(payload, env.jwtSecret, { expiresIn: '1h' });
  const { requireAuth } = setup();
  const { err, req } = await run(requireAuth, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(err, undefined);
  assert.equal(req.user.username, 'admin');
  assert.equal(req.user.role, 'admin');
});

test('requireAuth: human JWT is still allowed on /api/auth, /api/profile and /api/notifications', async () => {
  const token = jwt.sign({ id: '1', username: 'admin', role: 'admin' }, env.jwtSecret);
  const { requireAuth } = setup();
  for (const [baseUrl, path] of [['/api/auth', '/me'], ['/api/profile', '/'], ['/api/notifications', '/']]) {
    const { err } = await run(requireAuth, { headers: { authorization: `Bearer ${token}` }, baseUrl, path });
    assert.equal(err, undefined, `${baseUrl}${path}`);
  }
});

test('requireAuth: invalid, expired and wrongly-signed JWTs give 401', async () => {
  const { requireAuth } = setup();
  const expired = jwt.sign({ id: '1', role: 'admin' }, env.jwtSecret, { expiresIn: -10 });
  const wrongSecret = jwt.sign({ id: '1', role: 'admin' }, 'not-the-secret');
  for (const token of ['garbage', expired, wrongSecret]) {
    const { err } = await run(requireAuth, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(err?.status, 401);
  }
});

test('requireAuth: a JWT claiming the agent role is rejected', async () => {
  const token = jwt.sign({ id: '10', username: 'agent-manager', role: 'agent' }, env.jwtSecret);
  const { requireAuth } = setup();
  const { err, req } = await run(requireAuth, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(err?.status, 401);
  assert.equal(req.user, undefined);
});

test('requireAuthQueryOrHeader: rejects agent keys from header and query', async () => {
  const { key, row } = agentRow();
  const { requireAuthQueryOrHeader } = setup([row]);
  const viaHeader = await run(requireAuthQueryOrHeader, { headers: { authorization: `Bearer ${key}` }, baseUrl: '/api/notifications', path: '/stream' });
  const viaQuery = await run(requireAuthQueryOrHeader, { query: { token: key }, baseUrl: '/api/notifications', path: '/stream' });
  assert.equal(viaHeader.err?.status, 403);
  assert.equal(viaQuery.err?.status, 403);
  assert.equal(viaHeader.req.user, undefined);
  assert.equal(viaQuery.req.user, undefined);
});

test('requireAuthQueryOrHeader: human JWT via header or query still works', async () => {
  const token = jwt.sign({ id: '1', username: 'admin', role: 'admin' }, env.jwtSecret);
  const { requireAuthQueryOrHeader } = setup();
  const viaHeader = await run(requireAuthQueryOrHeader, { headers: { authorization: `Bearer ${token}` } });
  const viaQuery = await run(requireAuthQueryOrHeader, { query: { token } });
  assert.equal(viaHeader.err, undefined);
  assert.equal(viaQuery.err, undefined);
  assert.equal(viaQuery.req.user.username, 'admin');
  assert.equal((await run(requireAuthQueryOrHeader, {})).err?.status, 401);
});

// ---- login ---------------------------------------------------------------

test('login refuses agent accounts, even with a password set', async () => {
  const original = UsersRepo.getAll;
  const hash = await (await import('bcryptjs')).default.hash('secret-pw', 4);
  UsersRepo.getAll = async () => [{ id: '10', username: 'agent-manager', password: hash, role: 'agent', employee_id: '' }];
  try {
    const err = await rejection(authService.login('agent-manager', 'secret-pw'));
    assert.equal(err.status, 401);
  } finally {
    UsersRepo.getAll = original;
  }
});
