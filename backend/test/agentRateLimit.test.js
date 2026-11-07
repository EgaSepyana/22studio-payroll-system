import './helpers/testEnv.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';

const { agentRateLimitKey, createAgentRateLimiter } = await import('../middleware/agentRateLimit.js');
const { errorHandler } = await import('../middleware/errorHandler.js');

test('the limiter is keyed by agent user id, not by IP', () => {
  assert.equal(agentRateLimitKey({ user: { id: '7' }, ip: '1.1.1.1' }), agentRateLimitKey({ user: { id: '7' }, ip: '2.2.2.2' }));
  assert.notEqual(agentRateLimitKey({ user: { id: '7' }, ip: '1.1.1.1' }), agentRateLimitKey({ user: { id: '8' }, ip: '1.1.1.1' }));
  assert.equal(agentRateLimitKey({ user: { id: 7 } }), '7');
});

async function withApp(limiter, fn) {
  const app = express();
  app.use((req, res, next) => {
    const id = req.headers['x-agent-id'];
    if (id) req.user = { id, role: 'agent' };
    next();
  });
  app.use((req, res, next) => limiter(req, res, next));
  app.get('/ping', (req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, 'listening');
  try {
    await fn((id) => fetch(`http://127.0.0.1:${server.address().port}/ping`, { headers: { 'x-agent-id': id } }));
  } finally {
    server.close();
  }
}

test('requests over the limit get 429; other agents are unaffected', async () => {
  await withApp(createAgentRateLimiter({ limit: 3 }), async (call) => {
    for (let i = 0; i < 3; i++) assert.equal((await call('A')).status, 200, `request ${i + 1}`);
    const limited = await call('A');
    assert.equal(limited.status, 429);
    assert.deepEqual(await limited.json(), { success: false, message: 'Too many requests' });
    assert.ok(limited.headers.get('retry-after'));

    assert.equal((await call('B')).status, 200);
    assert.equal((await call('A')).status, 429);
  });
});

test('the default limit is 60 requests per minute', async () => {
  await withApp(createAgentRateLimiter(), async (call) => {
    const first = await call('A');
    assert.equal(first.status, 200);
    assert.match(first.headers.get('ratelimit') ?? first.headers.get('ratelimit-policy') ?? '', /60/);
  });
});
