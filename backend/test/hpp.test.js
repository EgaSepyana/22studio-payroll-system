import './helpers/testEnv.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';

const { default: app } = await import('../app.js');
const { env } = await import('../config/env.js');
const models = await import('../google-sheet/models.js');
const { fabricSchema, threadSchema, calculationSchema } = await import('../controllers/hppController.js');
const { MAX_CALCULATION_DATA_LENGTH, CALCULATION_LIST_LIMIT } = await import('../services/hppService.js');
const { generateAgentKey } = await import('../utils/agentKeyUtils.js');
const { AGENT_SCOPES } = await import('../config/agentScopes.js');

// ---- schemas -----------------------------------------------------------------

test('sheet columns for the three HPP tabs', () => {
  assert.deepEqual(models.SHEET_SCHEMAS.HppFabrics, ['id', 'name', 'color', 'supplier', 'price', 'gsm', 'date', 'note']);
  assert.deepEqual(models.SHEET_SCHEMAS.HppThreads, ['id', 'brand', 'code', 'name', 'hex', 'price', 'yield', 'note']);
  assert.deepEqual(models.SHEET_SCHEMAS.HppCalculations, ['id', 'created_at', 'created_by', 'tab', 'name', 'qty', 'hpp', 'total', 'sale', 'data']);
  for (const repo of [models.HppFabricsRepo, models.HppThreadsRepo, models.HppCalculationsRepo]) {
    assert.equal(repo.idStrategy, 'uuid');
  }
});

test('fabric schema: name and a non-negative price are required, the rest defaults', () => {
  assert.deepEqual(fabricSchema.parse({ name: ' Cotton 24s ', price: '90000' }), {
    name: 'Cotton 24s',
    color: '',
    supplier: '',
    price: 90000,
    gsm: 0,
    date: '',
    note: '',
  });
  for (const body of [{ price: 1 }, { name: '', price: 1 }, { name: 'x' }, { name: 'x', price: -1 }, { name: 'x', price: 'abc' }, { name: 'x', price: 1, date: '13/11/2026' }, { name: 'x', price: 1, gsm: -5 }]) {
    assert.equal(fabricSchema.safeParse(body).success, false, JSON.stringify(body));
  }
});

test('thread schema: brand, code, price and a positive yield are required', () => {
  const ok = threadSchema.parse({ brand: 'Brand', code: 'C-01', price: 15000, yield: '100' });
  assert.equal(ok.hex, '#222222');
  assert.equal(ok.yield, 100);
  for (const body of [
    { code: 'c', price: 1, yield: 1 },
    { brand: 'b', price: 1, yield: 1 },
    { brand: 'b', code: 'c', yield: 1 },
    { brand: 'b', code: 'c', price: 1 },
    { brand: 'b', code: 'c', price: 1, yield: 0 },
    { brand: 'b', code: 'c', price: -1, yield: 1 },
    { brand: 'b', code: 'c', price: 1, yield: 1, hex: 'red' },
  ]) {
    assert.equal(threadSchema.safeParse(body).success, false, JSON.stringify(body));
  }
});

const calc = { tab: 'kaos', name: 'Kaos A', qty: 100, hpp: 21000.5, total: 2100050, sale: 30000, data: { version: 1, kaos: { qty: '100' } } };

test('calculation schema: known tab, positive integer qty, finite non-negative numbers, versioned data', () => {
  assert.equal(calculationSchema.parse(calc).tab, 'kaos');
  assert.equal(calculationSchema.parse({ ...calc, name: undefined }).name, '');
  for (const patch of [{ tab: 'database' }, { tab: 'x' }, { qty: 0 }, { qty: 1.5 }, { hpp: -1 }, { hpp: '5' }, { sale: null }, { data: {} }, { data: { version: 2 } }, { data: 'str' }, { data: undefined }]) {
    assert.equal(calculationSchema.safeParse({ ...calc, ...patch }).success, false, JSON.stringify(patch));
  }
});

// ---- over HTTP, repos faked ----------------------------------------------------

const REPOS = [models.HppFabricsRepo, models.HppThreadsRepo, models.HppCalculationsRepo, models.UsersRepo];
const METHODS = ['getAll', 'getById', 'insert', 'updateById', 'deleteById'];
const originals = REPOS.flatMap((repo) => METHODS.map((m) => [repo, m, repo[m]]));

const tables = new Map();
let uuid = 0;

function fakeRepo(repo) {
  tables.set(repo, []);
  const rows = () => tables.get(repo);
  repo.getAll = async () => rows();
  repo.getById = async (id) => rows().find((r) => r.id === id) || null;
  repo.insert = async (data) => {
    const row = { ...Object.fromEntries(repo.columns.map((c) => [c, String(data[c] ?? '')])), id: `id-${++uuid}` };
    rows().push(row);
    return row;
  };
  repo.updateById = async (id, patch) => {
    const row = rows().find((r) => r.id === id);
    if (!row) return null;
    for (const [k, v] of Object.entries(patch)) row[k] = String(v ?? '');
    return row;
  };
  repo.deleteById = async (id) => {
    const i = rows().findIndex((r) => r.id === id);
    if (i === -1) return false;
    rows().splice(i, 1);
    return true;
  };
}

let server;
let base;
let agentKey;

test.before(async () => {
  for (const repo of [models.HppFabricsRepo, models.HppThreadsRepo, models.HppCalculationsRepo]) fakeRepo(repo);
  const { key, prefix, hash } = generateAgentKey(env.agentKeySecret);
  agentKey = key;
  models.UsersRepo.getAll = async () => [
    { id: '50', username: 'agent-all', password: '', role: 'agent', employee_id: '', scopes: AGENT_SCOPES.join(','), api_key_hash: hash, api_key_prefix: prefix, disabled: '' },
  ];
  server = app.listen(0);
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  for (const [repo, method, fn] of originals) repo[method] = fn;
  server.close();
});

const token = (role) => jwt.sign({ id: '1', username: `${role}-user`, role }, env.jwtSecret);

async function call(method, path, { auth = token('admin'), body } = {}) {
  const res = await fetch(`${base}/api/hpp${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(auth ? { authorization: `Bearer ${auth}` } : {}) },
    body: body === undefined || method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

const table = (repo) => tables.get(repo);

test('only admin and owner may use the HPP routes; agents and anonymous may not', async () => {
  const routes = [
    ['GET', '/fabrics'], ['POST', '/fabrics'], ['PUT', '/fabrics/x'], ['DELETE', '/fabrics/x'],
    ['GET', '/threads'], ['POST', '/threads'], ['PUT', '/threads/x'], ['DELETE', '/threads/x'],
    ['GET', '/calculations'], ['POST', '/calculations'], ['GET', '/calculations/x'], ['DELETE', '/calculations/x'],
  ];
  for (const [method, path] of routes) {
    for (const role of ['admin_produksi', 'employee']) {
      assert.equal((await call(method, path, { auth: token(role), body: {} })).status, 403, `${method} ${path} as ${role}`);
    }
    assert.equal((await call(method, path, { auth: agentKey, body: {} })).status, 403, `${method} ${path} as agent`);
    assert.equal((await call(method, path, { auth: null, body: {} })).status, 401, `${method} ${path} anonymous`);
  }
  for (const role of ['admin', 'owner']) assert.equal((await call('GET', '/fabrics', { auth: token(role) })).status, 200, role);
});

test('fabrics: create, list sorted by name, update, delete, 404s', async () => {
  const b = await call('POST', '/fabrics', { body: { name: 'Bambu', price: 80000, color: 'Putih', gsm: 160, date: '2026-11-01', note: 'x' } });
  assert.equal(b.status, 201);
  assert.deepEqual(b.json.data, { id: b.json.data.id, name: 'Bambu', color: 'Putih', supplier: '', price: 80000, gsm: 160, date: '2026-11-01', note: 'x' });
  const a = await call('POST', '/fabrics', { body: { name: 'Antik', price: '90000' } });
  assert.equal(a.json.data.price, 90000);

  const list = await call('GET', '/fabrics');
  assert.deepEqual(list.json.data.map((f) => f.name), ['Antik', 'Bambu']);

  const upd = await call('PUT', `/fabrics/${a.json.data.id}`, { body: { name: 'Antik 24s', price: 95000 } });
  assert.equal(upd.status, 200);
  assert.equal(upd.json.data.name, 'Antik 24s');
  assert.equal(upd.json.data.price, 95000);

  assert.equal((await call('PUT', '/fabrics/nope', { body: { name: 'x', price: 1 } })).status, 404);
  assert.equal((await call('POST', '/fabrics', { body: { name: 'x', price: -5 } })).status, 400);
  assert.equal((await call('POST', '/fabrics', { body: { price: 5 } })).status, 400);

  assert.equal((await call('DELETE', `/fabrics/${b.json.data.id}`)).status, 200);
  assert.equal((await call('DELETE', `/fabrics/${b.json.data.id}`)).status, 404);
  assert.equal(table(models.HppFabricsRepo).length, 1);
});

test('threads: create, unique brand + code (case-insensitive), update, delete', async () => {
  const t = await call('POST', '/threads', { body: { brand: 'Coats', code: 'C-01', name: 'Hitam', hex: '#111111', price: 15000, yield: 100 } });
  assert.equal(t.status, 201);
  assert.equal(t.json.data.yield, 100);

  const dup = await call('POST', '/threads', { body: { brand: ' coats ', code: 'c-01', price: 1, yield: 1 } });
  assert.equal(dup.status, 400);
  assert.match(dup.json.message, /sudah ada/);

  const other = await call('POST', '/threads', { body: { brand: 'Coats', code: 'C-02', price: 1, yield: 1 } });
  assert.equal(other.status, 201);

  // renaming onto an existing pair is refused; keeping its own pair is fine
  assert.equal((await call('PUT', `/threads/${other.json.data.id}`, { body: { brand: 'Coats', code: 'C-01', price: 1, yield: 1 } })).status, 400);
  const keep = await call('PUT', `/threads/${t.json.data.id}`, { body: { brand: 'Coats', code: 'C-01', name: 'Hitam Pekat', price: 16000, yield: 120 } });
  assert.equal(keep.status, 200);
  assert.equal(keep.json.data.name, 'Hitam Pekat');
  assert.equal((await call('PUT', '/threads/nope', { body: { brand: 'a', code: 'b', price: 1, yield: 1 } })).status, 404);
  assert.equal((await call('POST', '/threads', { body: { brand: 'a', code: 'b', price: 1, yield: 0 } })).status, 400);

  assert.deepEqual((await call('GET', '/threads')).json.data.map((x) => x.code), ['C-01', 'C-02']);
  assert.equal((await call('DELETE', `/threads/${other.json.data.id}`)).status, 200);
  assert.equal((await call('DELETE', `/threads/${other.json.data.id}`)).status, 404);
});

test('calculations: save, list (newest first, no data), load with data, delete', async () => {
  const first = await call('POST', '/calculations', { auth: token('admin'), body: calc });
  assert.equal(first.status, 201);
  assert.equal(first.json.data.created_by, 'admin-user');
  assert.equal('data' in first.json.data, false);

  await new Promise((r) => setTimeout(r, 5));
  const second = await call('POST', '/calculations', { auth: token('owner'), body: { ...calc, tab: 'sablon', name: 'Sablon B', hpp: 5000 } });
  assert.equal(second.status, 201);

  const list = (await call('GET', '/calculations')).json.data;
  assert.deepEqual(list.map((c) => c.name), ['Sablon B', 'Kaos A']);
  assert.ok(list.every((c) => !('data' in c)));
  assert.equal(list[1].hpp, 21000.5);
  assert.equal(list[1].qty, 100);

  const loaded = (await call('GET', `/calculations/${first.json.data.id}`)).json.data;
  assert.deepEqual(loaded.data, calc.data);
  assert.equal(loaded.tab, 'kaos');

  assert.equal((await call('GET', '/calculations/nope')).status, 404);
  assert.equal((await call('DELETE', `/calculations/${first.json.data.id}`)).status, 200);
  assert.equal((await call('DELETE', `/calculations/${first.json.data.id}`)).status, 404);
});

test('calculations: invalid body is 400; oversized data is 400 and nothing is stored', async () => {
  const before = table(models.HppCalculationsRepo).length;
  assert.equal((await call('POST', '/calculations', { body: { ...calc, qty: 0 } })).status, 400);
  assert.equal((await call('POST', '/calculations', { body: { ...calc, tab: 'database' } })).status, 400);
  const huge = { version: 1, blob: 'x'.repeat(MAX_CALCULATION_DATA_LENGTH) };
  const res = await call('POST', '/calculations', { body: { ...calc, data: huge } });
  assert.equal(res.status, 400);
  assert.match(res.json.message, /terlalu besar/);
  assert.equal(table(models.HppCalculationsRepo).length, before);
});

test('calculations: the history list is capped and a damaged data cell loads as null', async () => {
  const rows = table(models.HppCalculationsRepo);
  rows.length = 0;
  for (let i = 0; i < CALCULATION_LIST_LIMIT + 5; i++) {
    rows.push({ id: `c${i}`, created_at: new Date(2026, 0, 1, 0, i).toISOString(), created_by: 'a', tab: 'kaos', name: `n${i}`, qty: '1', hpp: '1', total: '1', sale: '1', data: '{"version":1}' });
  }
  const list = (await call('GET', '/calculations')).json.data;
  assert.equal(list.length, CALCULATION_LIST_LIMIT);
  assert.equal(list[0].name, `n${CALCULATION_LIST_LIMIT + 4}`);

  rows[0].data = '{not json';
  assert.equal((await call('GET', '/calculations/c0')).json.data.data, null);
});
