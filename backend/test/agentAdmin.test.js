import './helpers/testEnv.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const admin = await import('../services/agentAdminService.js');
const { authenticateAgentKey } = await import('../services/agentAuthService.js');
const { generateAgentKey, parseAgentKey } = await import('../utils/agentKeyUtils.js');
const { AGENT_ACCOUNTS } = await import('../config/agentScopes.js');

const SECRET = 'test-agent-key-secret';

function memoryStore(initial = []) {
  const rows = initial.map((r, i) => ({ id: String(i + 1), ...r }));
  const calls = { insert: 0, updateById: 0 };
  return {
    rows,
    calls,
    getAll: async () => rows,
    insert: async (row) => {
      calls.insert += 1;
      const saved = { id: String(rows.length + 1), ...row };
      rows.push(saved);
      return saved;
    },
    updateById: async (id, patch) => {
      calls.updateById += 1;
      const row = rows.find((r) => r.id === id);
      Object.assign(row, patch);
      return row;
    },
  };
}

// Lets authenticateAgentKey look keys up in the in-memory rows.
const authStore = (store) => ({
  findByPrefix: async (prefix) => store.rows.find((r) => r.role === 'agent' && r.api_key_prefix === prefix) || null,
});
const authenticate = (store, key) => authenticateAgentKey(key, { store: authStore(store), secret: SECRET });
const rejects = (store, key) => assert.rejects(authenticate(store, key), { status: 401 });

const human = { username: 'admin', password: 'hash', role: 'admin', employee_id: '', scopes: '', api_key_hash: '', api_key_prefix: '', disabled: '' };
const create = (store, accounts = AGENT_ACCOUNTS, extra = {}) => admin.createAgents({ store, accounts, serverSecret: SECRET, ...extra });

// ---- create ------------------------------------------------------------------

test('create makes every account from the config, each with a working key', async () => {
  const store = memoryStore([human]);
  const results = await create(store);

  assert.equal(results.length, 7);
  assert.equal(store.rows.length, 8);
  for (const account of AGENT_ACCOUNTS) {
    const result = results.find((r) => r.username === account.username);
    assert.equal(result.status, 'created');
    const row = store.rows.find((r) => r.username === account.username);
    assert.equal(row.role, 'agent');
    assert.equal(row.password, '');
    assert.equal(row.disabled, '');
    assert.equal(row.scopes, account.scopes.join(','));
    assert.equal(row.api_key_prefix, parseAgentKey(result.key).prefix);

    const user = await authenticate(store, result.key);
    assert.equal(user.username, account.username);
    assert.deepEqual([...user.scopes].sort(), [...account.scopes].sort());
  }
});

test('the plaintext key is never stored', async () => {
  const store = memoryStore();
  const results = await create(store);
  const stored = JSON.stringify(store.rows);
  for (const { key } of results) assert.equal(stored.includes(parseAgentKey(key).secret), false);
});

test('create is idempotent: a second run writes nothing and prints no keys', async () => {
  const store = memoryStore();
  await create(store);
  const snapshot = JSON.stringify(store.rows);
  store.calls.insert = 0;
  store.calls.updateById = 0;

  const again = await create(store);
  assert.deepEqual(again.map((r) => r.status), Array(7).fill('unchanged'));
  assert.equal(again.some((r) => 'key' in r), false);
  assert.equal(store.calls.insert + store.calls.updateById, 0);
  assert.equal(JSON.stringify(store.rows), snapshot);
});

test('re-running updates the scopes of an existing account, keeping its key', async () => {
  const store = memoryStore();
  const [first] = await create(store, [{ username: 'agent-manager', scopes: ['orders:read'] }]);
  const before = { ...store.rows[0] };

  const [second] = await create(store, [{ username: 'agent-manager', scopes: ['orders:read', 'tasks:read'] }]);
  assert.equal(second.status, 'scopes updated');
  assert.equal('key' in second, false);
  assert.equal(store.rows[0].scopes, 'orders:read,tasks:read');
  assert.equal(store.rows[0].api_key_hash, before.api_key_hash);
  assert.equal(store.rows[0].api_key_prefix, before.api_key_prefix);
  assert.equal(store.rows.length, 1);
  assert.deepEqual([...(await authenticate(store, first.key)).scopes].sort(), ['orders:read', 'tasks:read']);

  const [third] = await create(store, [{ username: 'agent-manager', scopes: ['tasks:read'] }]);
  assert.equal(third.status, 'scopes updated');
  assert.equal(store.rows[0].scopes, 'tasks:read');
});

test('scope order alone is not a change', async () => {
  const store = memoryStore();
  await create(store, [{ username: 'a', scopes: ['orders:read', 'tasks:read'] }]);
  const [again] = await create(store, [{ username: 'a', scopes: ['tasks:read', 'orders:read'] }]);
  assert.equal(again.status, 'unchanged');
});

test('a key is printed only for accounts created in this run', async () => {
  const store = memoryStore();
  await create(store, AGENT_ACCOUNTS.slice(0, 3));
  const results = await create(store, AGENT_ACCOUNTS);
  assert.equal(results.filter((r) => r.key).length, 4);
  assert.deepEqual(results.slice(0, 3).map((r) => 'key' in r), [false, false, false]);
  assert.equal(store.rows.length, 7);
});

test('an existing account that has no key is reported, not given one', async () => {
  const store = memoryStore([{ ...human, username: 'agent-manager', role: 'agent', scopes: 'orders:read,tasks:read,dashboard:read' }]);
  const [result] = await create(store, [AGENT_ACCOUNTS[0]]);
  assert.equal(result.status, 'unchanged');
  assert.equal(result.hasKey, false);
  assert.equal('key' in result, false);
});

test('create refuses when a human account already has the username, and writes nothing', async () => {
  const store = memoryStore([{ ...human, username: 'agent-owner' }]);
  await assert.rejects(create(store), /non-agent account/);
  assert.equal(store.calls.insert, 0);
});

test('create never reuses a key prefix that is already taken', async () => {
  const taken = generateAgentKey(SECRET);
  const fresh = generateAgentKey(SECRET);
  const queue = [taken, fresh];
  const store = memoryStore([{ ...human, username: 'other', role: 'agent', api_key_prefix: taken.prefix }]);
  const [result] = await create(store, [AGENT_ACCOUNTS[0]], { generateKey: () => queue.shift() });
  assert.equal(parseAgentKey(result.key).prefix, fresh.prefix);
  assert.equal(queue.length, 0);
});

test('if an insert fails midway, the keys already issued are not lost', async () => {
  const store = memoryStore();
  const original = store.insert;
  store.insert = async (row) => {
    if (store.rows.length === 2) throw new Error('sheets down');
    return original(row);
  };
  const err = await create(store).catch((e) => e);
  assert.match(err.message, /sheets down/);
  assert.equal(err.partialResults.length, 2);
  for (const { key } of err.partialResults) assert.ok((await authenticate(store, key)).username);
});

// ---- list --------------------------------------------------------------------

test('list shows username, scopes, disabled and prefix of agents only, never a hash', async () => {
  const store = memoryStore([human]);
  const created = await create(store, [AGENT_ACCOUNTS[0]]);
  await admin.setDisabled({ store, username: 'agent-manager', disabled: true });

  const agents = await admin.listAgents({ store });
  assert.deepEqual(agents, [
    {
      username: 'agent-manager',
      scopes: ['orders:read', 'tasks:read', 'dashboard:read'],
      disabled: true,
      prefix: parseAgentKey(created[0].key).prefix,
    },
  ]);
  assert.equal(JSON.stringify(agents).includes(store.rows[1].api_key_hash), false);
});

// ---- rotate-key --------------------------------------------------------------

test('rotate-key issues a new key and the old one stops working', async () => {
  const store = memoryStore();
  const [created] = await create(store, [AGENT_ACCOUNTS[0]]);
  await authenticate(store, created.key);

  const [rotated] = await admin.rotateKeys({ store, username: 'agent-manager', serverSecret: SECRET });
  assert.notEqual(rotated.key, created.key);
  await rejects(store, created.key);
  assert.equal((await authenticate(store, rotated.key)).username, 'agent-manager');
  assert.equal(store.rows.length, 1);
  assert.equal(store.rows[0].scopes, 'orders:read,tasks:read,dashboard:read');
});

test('rotating keeps a disabled account disabled', async () => {
  const store = memoryStore();
  await create(store, [AGENT_ACCOUNTS[0]]);
  await admin.setDisabled({ store, username: 'agent-manager', disabled: true });
  const [rotated] = await admin.rotateKeys({ store, username: 'agent-manager', serverSecret: SECRET });
  await assert.rejects(authenticate(store, rotated.key), { reason: 'disabled' });
});

test('rotate-key for an unknown or non-agent username fails and changes nothing', async () => {
  const store = memoryStore([human]);
  await create(store, [AGENT_ACCOUNTS[0]]);
  const snapshot = JSON.stringify(store.rows);
  await assert.rejects(admin.rotateKeys({ store, username: 'nobody', serverSecret: SECRET }), /No agent account/);
  await assert.rejects(admin.rotateKeys({ store, username: 'admin', serverSecret: SECRET }), /No agent account/);
  assert.equal(JSON.stringify(store.rows), snapshot);
});

test('rotate-key needs exactly one of username or all', async () => {
  const store = memoryStore();
  await assert.rejects(admin.rotateKeys({ store, serverSecret: SECRET }), /either/);
  await assert.rejects(admin.rotateKeys({ store, username: 'a', all: true, serverSecret: SECRET }), /either/);
});

test('rotate-key --all rotates every agent account once and leaves humans alone', async () => {
  const store = memoryStore([human]);
  const created = await create(store);
  store.rows.push({ id: '99', ...human, username: 'agent-extra', role: 'agent', scopes: 'orders:read', api_key_hash: generateAgentKey(SECRET).hash, api_key_prefix: 'ExtraKey' });
  const oldKeys = created.map((r) => r.key);

  const rotated = await admin.rotateKeys({ store, all: true, serverSecret: SECRET });
  assert.equal(rotated.length, 8);
  assert.deepEqual(rotated.map((r) => r.username).sort(), [...AGENT_ACCOUNTS.map((a) => a.username), 'agent-extra'].sort());
  assert.equal(new Set(rotated.map((r) => r.key)).size, 8);

  for (const key of oldKeys) await rejects(store, key);
  for (const { username, key } of rotated) assert.equal((await authenticate(store, key)).username, username);

  const admin1 = store.rows.find((r) => r.username === 'admin');
  assert.equal(admin1.api_key_hash, '');
  assert.equal(admin1.api_key_prefix, '');
});

test('rotate-key --all with no agent accounts is empty, not an error', async () => {
  const store = memoryStore([human]);
  assert.deepEqual(await admin.rotateKeys({ store, all: true, serverSecret: SECRET }), []);
});

test('rotate-key --all keeps keys already issued if a later update fails', async () => {
  const store = memoryStore();
  await create(store);
  const original = store.updateById;
  let updates = 0;
  store.updateById = async (id, patch) => {
    updates += 1;
    if (updates === 3) throw new Error('quota exceeded');
    return original(id, patch);
  };
  const err = await admin.rotateKeys({ store, all: true, serverSecret: SECRET }).catch((e) => e);
  assert.match(err.message, /quota exceeded/);
  assert.equal(err.partialResults.length, 2);
  for (const { username, key } of err.partialResults) assert.equal((await authenticate(store, key)).username, username);
});

// ---- disable -----------------------------------------------------------------

test('disable blocks the key; --enable restores it; both are idempotent', async () => {
  const store = memoryStore();
  const [created] = await create(store, [AGENT_ACCOUNTS[0]]);

  await admin.setDisabled({ store, username: 'agent-manager', disabled: true });
  await admin.setDisabled({ store, username: 'agent-manager', disabled: true });
  assert.equal(store.rows[0].disabled, 'true');
  await assert.rejects(authenticate(store, created.key), { reason: 'disabled' });

  await admin.setDisabled({ store, username: 'agent-manager', disabled: false });
  await admin.setDisabled({ store, username: 'agent-manager', disabled: false });
  assert.equal(store.rows[0].disabled, '');
  assert.equal((await authenticate(store, created.key)).username, 'agent-manager');
});

test('disable does not touch other fields and refuses unknown or non-agent usernames', async () => {
  const store = memoryStore([human]);
  await create(store, [AGENT_ACCOUNTS[0]]);
  const before = { ...store.rows[1] };
  await admin.setDisabled({ store, username: 'agent-manager', disabled: true });
  assert.deepEqual({ ...store.rows[1], disabled: before.disabled }, before);

  await assert.rejects(admin.setDisabled({ store, username: 'nobody', disabled: true }), /No agent account/);
  await assert.rejects(admin.setDisabled({ store, username: 'admin', disabled: true }), /No agent account/);
  assert.equal(store.rows[0].disabled, '');
});
