import './helpers/testEnv.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { captureWarnings } from './helpers/captureConsole.js';

const { createAuthMiddleware } = await import('../middleware/auth.js');
const { authenticateAgentKey, AgentAuthError } = await import('../services/agentAuthService.js');
const { generateAgentKey, parseAgentKey } = await import('../utils/agentKeyUtils.js');
const { formatAgentAuthFailure } = await import('../utils/agentAuthLog.js');

const SERVER_SECRET = 'test-agent-key-secret';

function agentRow(overrides = {}) {
  const { key, prefix, hash } = generateAgentKey(SERVER_SECRET);
  return {
    key,
    prefix,
    secret: parseAgentKey(key).secret,
    hash,
    row: { id: '10', username: 'agent-manager', password: '', role: 'agent', employee_id: '', scopes: 'orders:read', api_key_hash: hash, api_key_prefix: prefix, disabled: '', ...overrides },
  };
}

const memoryStore = (rows) => ({ findByPrefix: async (prefix) => rows.find((r) => r.api_key_prefix === prefix) || null });

async function reason(promise) {
  try {
    await promise;
  } catch (err) {
    assert.ok(err instanceof AgentAuthError, 'expected an AgentAuthError');
    return err;
  }
  assert.fail('expected a rejection');
}

// ---- reasons ---------------------------------------------------------------

test('authenticateAgentKey reports why it failed: unknown / wrong secret / disabled / malformed', async () => {
  const good = agentRow();
  const disabled = agentRow({ disabled: 'true' });
  const opts = (rows) => ({ store: memoryStore(rows), secret: SERVER_SECRET });

  const unknown = await reason(authenticateAgentKey(good.key, opts([])));
  assert.deepEqual([unknown.reason, unknown.prefix], ['unknown', good.prefix]);

  const forged = `agk_${good.prefix}_${crypto.randomBytes(32).toString('base64url')}`;
  const wrong = await reason(authenticateAgentKey(forged, opts([good.row])));
  assert.deepEqual([wrong.reason, wrong.prefix], ['wrong secret', good.prefix]);

  const off = await reason(authenticateAgentKey(disabled.key, opts([disabled.row])));
  assert.deepEqual([off.reason, off.prefix], ['disabled', disabled.prefix]);

  const bad = await reason(authenticateAgentKey('agk_garbage', opts([good.row])));
  assert.deepEqual([bad.reason, bad.prefix], ['malformed', null]);
});

test('a disabled account with the wrong secret reads as wrong secret; the client message never varies', async () => {
  const off = agentRow({ disabled: 'true' });
  const forged = `agk_${off.prefix}_${crypto.randomBytes(32).toString('base64url')}`;
  const err = await reason(authenticateAgentKey(forged, { store: memoryStore([off.row]), secret: SERVER_SECRET }));
  assert.equal(err.reason, 'wrong secret');
  assert.equal(err.status, 401);
  assert.equal(err.message, 'Invalid API key');
});

// ---- log line --------------------------------------------------------------

const baseReq = { method: 'GET', originalUrl: '/api/orders/5?token=QUERYTOKEN', headers: {}, ip: '10.1.2.3' };

test('the log line has reason, prefix, ip and path', () => {
  const line = formatAgentAuthFailure(baseReq, { reason: 'wrong secret', prefix: 'AbCd1234' });
  assert.equal(line, 'Agent auth failed: reason=wrong secret prefix=AbCd1234 ip=10.1.2.3 method=GET path=/api/orders/5');
});

test('the query string never reaches the log', () => {
  assert.equal(formatAgentAuthFailure(baseReq, { reason: 'unknown', prefix: 'AbCd1234' }).includes('QUERYTOKEN'), false);
});

test('ip prefers the first X-Forwarded-For entry and is sanitised', () => {
  const forwarded = { ...baseReq, headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' } };
  assert.match(formatAgentAuthFailure(forwarded, { reason: 'unknown', prefix: 'p' }), /ip=203\.0\.113\.9 /);
  const hostile = { ...baseReq, headers: { 'x-forwarded-for': '1.2.3.4 reason=forged <script>' } };
  const line = formatAgentAuthFailure(hostile, { reason: 'unknown', prefix: 'p' });
  assert.equal(line.split('\n').length, 1);
  assert.equal(line.includes('<script>'), false);
  assert.equal(line.includes('reason=forged'), false);
});

test('a malformed key and a missing ip are logged with placeholders', () => {
  const line = formatAgentAuthFailure({ method: 'POST', originalUrl: '/api/x', headers: {} }, { reason: 'malformed', prefix: null });
  assert.equal(line, 'Agent auth failed: reason=malformed prefix=- ip=- method=POST path=/api/x');
});

// ---- through the middleware ------------------------------------------------

function middlewareFor(rows) {
  return createAuthMiddleware({
    agentStore: memoryStore(rows),
    agentKeySecret: SERVER_SECRET,
    agentAuditor: () => {},
    agentRateLimiter: (req, res, next) => next(),
  }).requireAuth;
}

function run(mw, { key, ...rest }) {
  return new Promise((resolve) => {
    const req = { method: 'GET', originalUrl: '/api/orders', baseUrl: '/api/orders', path: '/', headers: { authorization: `Bearer ${key}` }, query: {}, ip: '10.1.2.3', ...rest };
    mw(req, {}, (err) => resolve({ err, req }));
  });
}

test('failed key attempts log one warning each; the secret, hash and full key never appear', async () => {
  const good = agentRow();
  const disabled = agentRow({ disabled: 'true' });
  const unknownKey = agentRow();
  const wrongSecret = crypto.randomBytes(32).toString('base64url');
  const wrongKey = `agk_${good.prefix}_${wrongSecret}`;
  const mw = middlewareFor([good.row, disabled.row]);

  const attempts = [
    { key: unknownKey.key, secret: unknownKey.secret, reason: 'unknown', prefix: unknownKey.prefix },
    { key: wrongKey, secret: wrongSecret, reason: 'wrong secret', prefix: good.prefix },
    { key: disabled.key, secret: disabled.secret, reason: 'disabled', prefix: disabled.prefix },
  ];

  for (const attempt of attempts) {
    let result;
    const lines = await captureWarnings(async () => {
      result = await run(mw, { key: attempt.key, originalUrl: `/api/orders?token=${attempt.secret}` });
    });
    assert.equal(result.err.status, 401);
    assert.equal(lines.length, 1, attempt.reason);
    const [line] = lines;
    assert.ok(line.includes(`reason=${attempt.reason}`), line);
    assert.ok(line.includes(`prefix=${attempt.prefix}`), line);
    assert.ok(line.includes('ip=10.1.2.3'), line);
    assert.ok(line.includes('path=/api/orders'), line);
    assert.equal(line.includes(attempt.secret), false, 'secret leaked');
    assert.equal(line.includes(attempt.key), false, 'full key leaked');
    assert.equal(line.includes(good.hash), false, 'hash leaked');
    assert.equal(line.includes(disabled.hash), false, 'hash leaked');
    assert.equal(line.includes('Bearer'), false);
  }
});

test('a malformed key is logged without any part of it', async () => {
  const mw = middlewareFor([]);
  const garbage = 'agk_SUPERSECRETGARBAGE';
  let result;
  const lines = await captureWarnings(async () => {
    result = await run(mw, { key: garbage });
  });
  assert.equal(result.err.status, 401);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /reason=malformed prefix=- /);
  assert.equal(lines[0].includes('SUPERSECRETGARBAGE'), false);
});

test('a valid key, a missing header and a human JWT log nothing', async () => {
  const good = agentRow();
  const mw = middlewareFor([good.row]);
  const lines = await captureWarnings(async () => {
    assert.equal((await run(mw, { key: good.key })).err, undefined);
    assert.equal((await run(mw, { key: 'not-an-agent-key' })).err.status, 401);
    const noHeader = await new Promise((resolve) => mw({ method: 'GET', headers: {}, query: {} }, {}, (err) => resolve(err)));
    assert.equal(noHeader.status, 401);
  });
  assert.deepEqual(lines, []);
});
