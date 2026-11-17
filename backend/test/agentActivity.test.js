import './helpers/testEnv.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';

const { default: app } = await import('../app.js');
const { env } = await import('../config/env.js');
const models = await import('../google-sheet/models.js');
const { activityQuerySchema } = await import('../controllers/ownerAgentActivityController.js');
const { generateAgentKey } = await import('../utils/agentKeyUtils.js');
const { AGENT_SCOPES } = await import('../config/agentScopes.js');

const row = (id, created_at, username, extra = {}) => ({
  id,
  created_at,
  user_id: '9',
  username,
  role: 'agent',
  method: 'PATCH',
  path: '/api/orders/1/status',
  status_code: '200',
  summary: '{"status":"Desain Fix"}',
  ...extra,
});

const LOG = [
  row('a', '2026-11-01T10:00:00.000Z', 'agent-produksi'),
  row('c', '2026-11-03T10:00:00.000Z', 'agent-admin', { status_code: '403', method: 'DELETE', path: '/api/orders/1' }),
  row('b', '2026-11-02T10:00:00.000Z', 'agent-produksi'),
];

const originals = [models.AuditLogRepo.getAll, models.UsersRepo.getAll];
let server;
let base;
let agentKey;

test.before(async () => {
  const { key, prefix, hash } = generateAgentKey(env.agentKeySecret);
  agentKey = key;
  models.AuditLogRepo.getAll = async () => LOG;
  models.UsersRepo.getAll = async () => [
    { id: '50', username: 'agent-all', password: '', role: 'agent', employee_id: '', scopes: AGENT_SCOPES.join(','), api_key_hash: hash, api_key_prefix: prefix, disabled: '' },
  ];
  server = app.listen(0);
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  [models.AuditLogRepo.getAll, models.UsersRepo.getAll] = originals;
  server.close();
});

const token = (role) => jwt.sign({ id: '1', username: role, role }, env.jwtSecret);
const get = (path, auth) => fetch(`${base}${path}`, { headers: auth ? { authorization: `Bearer ${auth}` } : {} });

test('query schema: optional agent and a bounded limit', () => {
  assert.deepEqual(activityQuerySchema.parse({}), {});
  assert.deepEqual(activityQuerySchema.parse({ agent: 'agent-admin', limit: '50' }), { agent: 'agent-admin', limit: 50 });
  for (const q of [{ agent: '' }, { limit: '0' }, { limit: '501' }, { limit: 'x' }, { limit: '1.5' }]) {
    assert.equal(activityQuerySchema.safeParse(q).success, false, JSON.stringify(q));
  }
});

test('the owner gets entries newest first plus the agent names', async () => {
  const res = await get('/api/owner/agent-activity', token('owner'));
  assert.equal(res.status, 200);
  const { data } = await res.json();
  assert.deepEqual(data.entries.map((e) => e.id), ['c', 'b', 'a']);
  assert.deepEqual(data.agents, ['agent-admin', 'agent-produksi']);
  assert.deepEqual(Object.keys(data.entries[0]).sort(), ['created_at', 'id', 'method', 'path', 'status_code', 'summary', 'username']);
  assert.equal(data.entries[0].status_code, 403);
});

test('filtering by agent keeps the full agent list; limit caps the rows', async () => {
  const filtered = (await (await get('/api/owner/agent-activity?agent=agent-produksi', token('owner'))).json()).data;
  assert.deepEqual(filtered.entries.map((e) => e.id), ['b', 'a']);
  assert.deepEqual(filtered.agents, ['agent-admin', 'agent-produksi']);

  const limited = (await (await get('/api/owner/agent-activity?limit=1', token('owner'))).json()).data;
  assert.deepEqual(limited.entries.map((e) => e.id), ['c']);

  assert.deepEqual((await (await get('/api/owner/agent-activity?agent=nobody', token('owner'))).json()).data.entries, []);
  assert.equal((await get('/api/owner/agent-activity?limit=9999', token('owner'))).status, 400);
});

test('only the owner may read it: other humans, agents and anonymous are refused', async () => {
  for (const role of ['admin', 'admin_produksi', 'employee']) {
    assert.equal((await get('/api/owner/agent-activity', token(role))).status, 403, role);
  }
  assert.equal((await get('/api/owner/agent-activity', agentKey)).status, 403);
  assert.equal((await get('/api/owner/agent-activity')).status, 401);
});
