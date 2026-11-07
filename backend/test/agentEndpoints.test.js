import './helpers/testEnv.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';
import { order, items, sizes, lembarPO } from './helpers/orderFixtures.js';

const { default: app } = await import('../app.js');
const { env } = await import('../config/env.js');
const models = await import('../google-sheet/models.js');
const { statusSchema, publishConsentSchema } = await import('../controllers/orderController.js');
const { publicSummaryQuerySchema } = await import('../controllers/agentController.js');
const { generateAgentKey } = await import('../utils/agentKeyUtils.js');

// ---- zod schemas ----------------------------------------------------------

test('status schema accepts exactly the 4 PRD statuses', () => {
  for (const status of ['Desain Fix', 'On Progress', 'Done', 'Di Ambil Costumer']) {
    assert.equal(statusSchema.parse({ status }).status, status);
  }
  for (const status of ['Belum Di Proses', 'Dikirim', 'done', '', 5, null, undefined]) {
    assert.equal(statusSchema.safeParse({ status }).success, false, String(status));
  }
});

test('status schema rejects missing and extra fields', () => {
  assert.equal(statusSchema.safeParse({}).success, false);
  assert.equal(statusSchema.safeParse({ status: 'Done', resi: 'X' }).success, false);
});

test('publish-consent schema: boolean flag, optional note, nothing else', () => {
  assert.deepEqual(publishConsentSchema.parse({ boleh_publikasi: true }), { boleh_publikasi: true });
  assert.deepEqual(publishConsentSchema.parse({ boleh_publikasi: false, catatan_publikasi: 'ok' }), {
    boleh_publikasi: false,
    catatan_publikasi: 'ok',
  });
  for (const body of [{}, { boleh_publikasi: 'true' }, { boleh_publikasi: 1 }, { boleh_publikasi: true, catatan_publikasi: 5 }, { boleh_publikasi: true, extra: 1 }, { boleh_publikasi: true, catatan_publikasi: 'x'.repeat(1001) }]) {
    assert.equal(publishConsentSchema.safeParse(body).success, false, JSON.stringify(body));
  }
});

test('public-summary query schema validates status, dates and category', () => {
  assert.deepEqual(publicSummaryQuerySchema.parse({}), {});
  assert.deepEqual(publicSummaryQuerySchema.parse({ status: 'Done', from: '2026-01-01', to: '2026-12-31', jenis_category: 'KAOS' }), {
    status: 'Done',
    from: '2026-01-01',
    to: '2026-12-31',
    jenis_category: 'KAOS',
  });
  for (const query of [{ status: 'nope' }, { from: '01-01-2026' }, { to: '2026-1-1' }, { jenis_category: 'MOBIL' }]) {
    assert.equal(publicSummaryQuerySchema.safeParse(query).success, false, JSON.stringify(query));
  }
});

// ---- end to end over HTTP (repos faked, Google Sheets never touched) -------

const PATCHED = [
  [models.UsersRepo, 'getAll'],
  [models.OrdersRepo, 'getAll'],
  [models.OrdersRepo, 'getById'],
  [models.OrdersRepo, 'updateById'],
  [models.OrderItemsRepo, 'getAll'],
  [models.OrderItemSizesRepo, 'getAll'],
  [models.LembarPORepo, 'getAll'],
  [models.OrderTimelineRepo, 'insert'],
  [models.AuditLogRepo, 'insert'],
];
const originals = PATCHED.map(([repo, name]) => repo[name]);

let orders;
let timeline;
let audit;
let failAudit = false;
let users;
const agents = {};

function addAgent(username, scopes, extra = {}) {
  const { key, prefix, hash } = generateAgentKey(env.agentKeySecret);
  users.push({ id: String(users.length + 100), username, password: '', role: 'agent', employee_id: '', scopes: scopes.join(','), api_key_hash: hash, api_key_prefix: prefix, disabled: '', ...extra });
  agents[username] = key;
}

let server;
let base;

test.before(async () => {
  orders = [{ ...order }];
  timeline = [];
  audit = [];
  users = [];
  addAgent('agent-produksi', ['orders:status']);
  addAgent('agent-marketing', ['orders:public-summary']);
  addAgent('agent-designer', ['orders:read-design']);
  addAgent('agent-nothing', []);
  addAgent('agent-off', ['orders:status'], { disabled: 'true' });

  models.UsersRepo.getAll = async () => users;
  models.OrdersRepo.getAll = async () => orders;
  models.OrdersRepo.getById = async (id) => orders.find((o) => String(o.id) === String(id)) || null;
  models.OrdersRepo.updateById = async (id, patch) => {
    const row = orders.find((o) => String(o.id) === String(id));
    Object.assign(row, patch);
    return { ...row };
  };
  models.OrderItemsRepo.getAll = async () => items;
  models.OrderItemSizesRepo.getAll = async () => sizes;
  models.LembarPORepo.getAll = async () => [lembarPO];
  models.OrderTimelineRepo.insert = async (entry) => {
    timeline.push(entry);
    return { id: String(timeline.length), ...entry };
  };

  models.AuditLogRepo.insert = async (entry) => {
    if (failAudit) throw new Error('sheets down');
    audit.push(entry);
    return { id: String(audit.length), ...entry };
  };

  server = app.listen(0);
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  PATCHED.forEach(([repo, name], i) => {
    repo[name] = originals[i];
  });
  server.close();
});

function call(method, path, { key, token, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (key) headers.authorization = `Bearer ${key}`;
  if (token) headers.authorization = `Bearer ${token}`;
  return fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

const adminToken = () => jwt.sign({ id: '1', username: 'admin', role: 'admin' }, env.jwtSecret);

test('GET /api/agent/me returns the agent\'s username and scopes', async () => {
  const res = await call('GET', '/api/agent/me', { key: agents['agent-produksi'] });
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).data, { username: 'agent-produksi', scopes: ['orders:status'] });
});

test('GET /api/agent/me works for an agent with no scopes, not for humans or anonymous', async () => {
  assert.equal((await call('GET', '/api/agent/me', { key: agents['agent-nothing'] })).status, 200);
  assert.equal((await call('GET', '/api/agent/me', { token: adminToken() })).status, 403);
  assert.equal((await call('GET', '/api/agent/me')).status, 401);
  assert.equal((await call('GET', '/api/agent/me', { key: agents['agent-off'] })).status, 401);
});

test('an agent cannot reach routes outside its scopes', async () => {
  assert.equal((await call('GET', '/api/orders', { key: agents['agent-produksi'] })).status, 403);
  assert.equal((await call('GET', '/api/orders', { key: agents['agent-nothing'] })).status, 403);
  assert.equal((await call('DELETE', '/api/orders/1', { key: agents['agent-produksi'] })).status, 403);
  assert.equal((await call('GET', '/api/profile', { key: agents['agent-produksi'] })).status, 403);
  assert.equal((await call('PATCH', '/api/orders/1/publish-consent', { key: agents['agent-produksi'], body: { boleh_publikasi: true } })).status, 403);
});

test('PATCH /api/orders/:id/status updates the order and writes a timeline entry with the actor', async () => {
  const res = await call('PATCH', '/api/orders/1/status', { key: agents['agent-produksi'], body: { status: 'Done' } });
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).data, { id: '1', status: 'Done' });
  assert.equal(orders[0].status, 'Done');
  assert.equal(timeline.length, 1);
  assert.equal(timeline[0].order_id, '1');
  assert.equal(timeline[0].stage, 'Done');
  assert.equal(timeline[0].actor, 'agent-produksi');
});

test('status endpoint: same status is a no-op, invalid body is 400, unknown order is 404', async () => {
  const before = timeline.length;
  assert.equal((await call('PATCH', '/api/orders/1/status', { key: agents['agent-produksi'], body: { status: 'Done' } })).status, 200);
  assert.equal(timeline.length, before);

  assert.equal((await call('PATCH', '/api/orders/1/status', { key: agents['agent-produksi'], body: { status: 'Dikirim' } })).status, 400);
  assert.equal((await call('PATCH', '/api/orders/1/status', { key: agents['agent-produksi'], body: {} })).status, 400);
  assert.equal((await call('PATCH', '/api/orders/999/status', { key: agents['agent-produksi'], body: { status: 'On Progress' } })).status, 404);
  assert.equal(timeline.length, before);
});

test('status endpoint: an order already picked up is final', async () => {
  orders.push({ ...order, id: '2', status: 'Di Ambil Costumer' });
  const res = await call('PATCH', '/api/orders/2/status', { key: agents['agent-produksi'], body: { status: 'Done' } });
  assert.equal(res.status, 400);
  assert.equal(orders[1].status, 'Di Ambil Costumer');
  orders.pop();
});

test('a human admin can use the status endpoint; the actor is their username', async () => {
  const res = await call('PATCH', '/api/orders/1/status', { token: adminToken(), body: { status: 'On Progress' } });
  assert.equal(res.status, 200);
  assert.equal(timeline.at(-1).actor, 'admin');
});

test('PATCH /api/orders/:id/publish-consent stores the flag and note', async () => {
  const { key } = { key: (addAgent('agent-admin', ['orders:publish-flag']), agents['agent-admin']) };
  const res = await call('PATCH', '/api/orders/1/publish-consent', { key, body: { boleh_publikasi: true, catatan_publikasi: 'WA 12/7' } });
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).data, { id: '1', boleh_publikasi: true, catatan_publikasi: 'WA 12/7' });
  assert.equal(orders[0].boleh_publikasi, 'true');

  const off = await call('PATCH', '/api/orders/1/publish-consent', { key, body: { boleh_publikasi: false } });
  assert.deepEqual((await off.json()).data, { id: '1', boleh_publikasi: false, catatan_publikasi: 'WA 12/7' });
  assert.equal(orders[0].boleh_publikasi, 'false');

  assert.equal((await call('PATCH', '/api/orders/1/publish-consent', { key, body: { boleh_publikasi: 'yes' } })).status, 400);
  assert.equal((await call('PATCH', '/api/orders/999/publish-consent', { key, body: { boleh_publikasi: true } })).status, 404);
});

test('GET /api/agent/orders/public-summary hides customer data until consent', async () => {
  const key = agents['agent-marketing'];
  orders[0].boleh_publikasi = '';
  let res = await call('GET', '/api/agent/orders/public-summary', { key });
  assert.equal(res.status, 200);
  let text = await res.text();
  for (const secret of ['SECRET', '99999', '77777', 'design-1.png']) assert.equal(text.includes(secret), false, secret);
  assert.match(text, /Kaos Wisata · 60 pcs/);

  orders[0].boleh_publikasi = 'true';
  res = await call('GET', '/api/agent/orders/public-summary', { key });
  text = await res.text();
  assert.match(text, /SECRET Brand Polo Hijau/);
  assert.match(text, /design-1\.png/);
  for (const secret of ['SECRET_CUSTOMER_ID', 'INV-SECRET', 'SECRET_BROKER', '99999']) assert.equal(text.includes(secret), false, secret);
});

test('public-summary applies filters and validates the query', async () => {
  const key = agents['agent-marketing'];
  const none = await (await call('GET', '/api/agent/orders/public-summary?status=Dikirim', { key })).json();
  assert.deepEqual(none.data, []);
  assert.equal((await call('GET', '/api/agent/orders/public-summary?from=yesterday', { key })).status, 400);
  assert.equal((await call('GET', '/api/agent/orders/public-summary', { key: agents['agent-designer'] })).status, 403);
});

test('GET /api/agent/orders/:id/design-brief returns the brief without PII or prices', async () => {
  const key = agents['agent-designer'];
  const res = await call('GET', '/api/agent/orders/1/design-brief', { key });
  assert.equal(res.status, 200);
  const text = await res.text();
  for (const secret of ['SECRET', '99999', '88888', '77777', '66666']) assert.equal(text.includes(secret), false, secret);
  const { data } = JSON.parse(text);
  assert.equal(data.items[0].sizes.length, 2);
  assert.equal(data.lembar_po.bahan_tipe, 'Lacoste');
  assert.equal(data.desain_fix_url, 'https://res.example.com/design-1.png');

  assert.equal((await call('GET', '/api/agent/orders/999/design-brief', { key })).status, 404);
  assert.equal((await call('GET', '/api/agent/orders/1/design-brief', { key: agents['agent-marketing'] })).status, 403);
});

// ---- audit log & rate limit (T6) -------------------------------------------

const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

test('an agent write is audited with user, method, path, status and a redacted summary', async () => {
  audit.length = 0;
  const res = await call('PATCH', '/api/orders/1/status', { key: agents['agent-produksi'], body: { status: 'Done' } });
  assert.equal(res.status, 200);
  await settle();
  assert.equal(audit.length, 1);
  const entry = audit[0];
  assert.equal(entry.username, 'agent-produksi');
  assert.equal(entry.role, 'agent');
  assert.equal(entry.method, 'PATCH');
  assert.equal(entry.path, '/api/orders/1/status');
  assert.equal(entry.status_code, 200);
  assert.equal(entry.summary, '{"status":"Done"}');
  assert.ok(entry.user_id);
  assert.ok(!Number.isNaN(Date.parse(entry.created_at)));
});

test('denied and invalid agent writes are audited with their status code', async () => {
  audit.length = 0;
  await call('DELETE', '/api/orders/1', { key: agents['agent-produksi'] });
  await call('PATCH', '/api/orders/1/publish-consent', { key: agents['agent-produksi'], body: { boleh_publikasi: true, password: 'x' } });
  await call('PATCH', '/api/orders/1/status', { key: agents['agent-produksi'], body: { status: 'Dikirim' } });
  await settle();
  assert.deepEqual(audit.map((a) => [a.method, a.path, a.status_code]), [
    ['DELETE', '/api/orders/1', 403],
    ['PATCH', '/api/orders/1/publish-consent', 403],
    ['PATCH', '/api/orders/1/status', 400],
  ]);
  assert.equal(JSON.stringify(audit).includes('"x"'), false);
});

test('agent reads and human writes are never audited', async () => {
  audit.length = 0;
  await call('GET', '/api/agent/me', { key: agents['agent-produksi'] });
  await call('GET', '/api/orders', { key: agents['agent-produksi'] });
  await call('GET', '/api/agent/orders/public-summary', { key: agents['agent-marketing'] });
  await call('PATCH', '/api/orders/1/status', { token: adminToken(), body: { status: 'Done' } });
  await settle();
  assert.equal(audit.length, 0);
});

test('a failing audit write never fails the request', async () => {
  failAudit = true;
  const originalError = console.error;
  console.error = () => {};
  try {
    const res = await call('PATCH', '/api/orders/1/status', { key: agents['agent-produksi'], body: { status: 'On Progress' } });
    assert.equal(res.status, 200);
    await settle();
  } finally {
    console.error = originalError;
    failAudit = false;
  }
});

test('an agent over 60 requests a minute gets 429; other agents and humans are unaffected', async () => {
  addAgent('agent-flood', []);
  let limitedAt = null;
  for (let i = 1; i <= 62; i++) {
    const res = await call('GET', '/api/agent/me', { key: agents['agent-flood'] });
    if (res.status === 429 && limitedAt === null) limitedAt = i;
    else if (limitedAt === null) assert.equal(res.status, 200);
  }
  assert.equal(limitedAt, 61);
  assert.equal((await call('GET', '/api/agent/me', { key: agents['agent-nothing'] })).status, 200);
  assert.equal((await call('PATCH', '/api/orders/1/status', { token: adminToken(), body: { status: 'Done' } })).status, 200);
});
