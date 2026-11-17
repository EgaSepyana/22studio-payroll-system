import './helpers/testEnv.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

const { shouldAudit, createAgentAuditor } = await import('../middleware/agentAudit.js');

const agent = { id: '10', username: 'agent-produksi', role: 'agent', scopes: new Set() };

function fakeRes(statusCode = 200) {
  const res = new EventEmitter();
  res.statusCode = statusCode;
  return res;
}

function setup({ record } = {}) {
  const calls = [];
  const audit = createAgentAuditor({
    record:
      record ??
      (async (entry) => {
        calls.push(entry);
      }),
  });
  return { calls, audit };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test('shouldAudit: only agent writes', () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'post']) assert.equal(shouldAudit(agent, method), true, method);
  for (const method of ['GET', 'HEAD', 'OPTIONS']) assert.equal(shouldAudit(agent, method), false, method);
  for (const role of ['admin', 'admin_produksi', 'owner', 'employee']) {
    assert.equal(shouldAudit({ role }, 'POST'), false, role);
  }
  assert.equal(shouldAudit(undefined, 'POST'), false);
});

test('an agent write is recorded after the response finishes, not before', async () => {
  const { calls, audit } = setup();
  const res = fakeRes(200);
  audit({ method: 'PATCH', originalUrl: '/api/orders/12/status', body: { status: 'Done' } }, res, agent);
  await settle();
  assert.equal(calls.length, 0);

  res.emit('finish');
  await settle();
  assert.deepEqual(calls, [
    { user: agent, method: 'PATCH', path: '/api/orders/12/status', statusCode: 200, summary: '{"status":"Done"}' },
  ]);
});

test('the recorded status is the final one, including denials', async () => {
  const { calls, audit } = setup();
  const res = fakeRes(403);
  audit({ method: 'DELETE', originalUrl: '/api/orders/12', body: undefined }, res, agent);
  res.emit('finish');
  await settle();
  assert.equal(calls[0].statusCode, 403);
  assert.equal(calls[0].method, 'DELETE');
  assert.equal(calls[0].summary, '');
});

test('the path keeps ids but drops the query string', async () => {
  const { calls, audit } = setup();
  const res = fakeRes();
  audit({ method: 'POST', originalUrl: '/api/orders/3/items?token=secret&x=1', body: {} }, res, agent);
  res.emit('finish');
  await settle();
  assert.equal(calls[0].path, '/api/orders/3/items');
});

test('the body is redacted in the recorded summary', async () => {
  const { calls, audit } = setup();
  const res = fakeRes();
  audit({ method: 'POST', originalUrl: '/api/x', body: { name: 'n', password: 'hunter2', token: 't' } }, res, agent);
  res.emit('finish');
  await settle();
  assert.equal(calls[0].summary, '{"name":"n"}');
});

test('agent reads and human requests write nothing', async () => {
  const { calls, audit } = setup();
  const get = fakeRes();
  audit({ method: 'GET', originalUrl: '/api/orders', body: undefined }, get, agent);
  get.emit('finish');
  const human = fakeRes();
  audit({ method: 'PATCH', originalUrl: '/api/orders/1/status', body: { status: 'Done' } }, human, { id: '1', role: 'admin' });
  human.emit('finish');
  await settle();
  assert.equal(calls.length, 0);
  assert.equal(get.listenerCount('finish'), 0);
  assert.equal(human.listenerCount('finish'), 0);
});

test('a failing write is logged and never throws', async () => {
  const errors = [];
  const original = console.error;
  console.error = (...args) => errors.push(args.join(' '));
  try {
    for (const record of [async () => Promise.reject(new Error('sheets down')), () => {
      throw new Error('sync boom');
    }]) {
      const { audit } = setup({ record });
      const res = fakeRes();
      audit({ method: 'POST', originalUrl: '/api/x', body: {} }, res, agent);
      assert.doesNotThrow(() => res.emit('finish'));
      await settle();
    }
  } finally {
    console.error = original;
  }
  assert.equal(errors.length, 2);
  assert.match(errors[0], /sheets down/);
  assert.match(errors[1], /sync boom/);
});
