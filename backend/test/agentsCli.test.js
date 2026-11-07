import './helpers/testEnv.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { parseAgentsArgs, runAgentsCli } = await import('../scripts/agentsCli.js');
const { AGENT_ACCOUNTS } = await import('../config/agentScopes.js');

const SECRET = 'test-agent-key-secret';

function memoryStore() {
  const rows = [];
  const calls = { insert: 0, updateById: 0 };
  return {
    rows,
    calls,
    getAll: async () => rows,
    insert: async (row) => {
      calls.insert += 1;
      rows.push({ id: String(rows.length + 1), ...row });
    },
    updateById: async (id, patch) => {
      calls.updateById += 1;
      Object.assign(rows.find((r) => r.id === id), patch);
    },
  };
}

async function run(argv, { store = memoryStore(), confirmed = true, serverSecret = SECRET } = {}) {
  const out = [];
  const err = [];
  let confirmCalls = 0;
  const code = await runAgentsCli({
    argv,
    store,
    accounts: AGENT_ACCOUNTS,
    serverSecret,
    confirm: async () => {
      confirmCalls += 1;
      return confirmed;
    },
    log: (line) => out.push(line),
    error: (line) => err.push(line),
  });
  return { code, out: out.join('\n'), err: err.join('\n'), store, confirmCalls };
}

const keysIn = (text) => text.match(/agk_[A-Za-z0-9]{8}_[A-Za-z0-9_-]{43,}/g) ?? [];

// ---- argument parsing ----------------------------------------------------------

test('parseAgentsArgs accepts the documented forms', () => {
  assert.deepEqual(parseAgentsArgs(['create', '--yes']), { command: 'create', yes: true });
  assert.deepEqual(parseAgentsArgs(['list']), { command: 'list' });
  assert.deepEqual(parseAgentsArgs(['rotate-key', '--username=agent-owner', '--yes']), { command: 'rotate-key', username: 'agent-owner', yes: true });
  assert.deepEqual(parseAgentsArgs(['rotate-key', '--username', 'agent-owner']), { command: 'rotate-key', username: 'agent-owner' });
  assert.deepEqual(parseAgentsArgs(['rotate-key', '--all', '--yes']), { command: 'rotate-key', all: true, yes: true });
  assert.deepEqual(parseAgentsArgs(['disable', '--username=a', '--enable', '--yes']), { command: 'disable', username: 'a', enable: true, yes: true });
});

test('parseAgentsArgs rejects bad input', () => {
  for (const argv of [
    [],
    ['nope'],
    ['create', '--username=a'],
    ['create', 'extra'],
    ['list', '--yes'],
    ['rotate-key', '--yes'],
    ['rotate-key', '--username=a', '--all'],
    ['rotate-key', '--enable', '--username=a'],
    ['disable', '--yes'],
    ['disable', '--all', '--username=a'],
    ['create', '--bogus'],
  ]) {
    assert.throws(() => parseAgentsArgs(argv), Error, JSON.stringify(argv));
  }
});

// ---- running -------------------------------------------------------------------

test('create without confirmation (no --yes) writes nothing and exits 1', async () => {
  const r = await run(['create'], { confirmed: false });
  assert.equal(r.code, 1);
  assert.equal(r.confirmCalls, 1);
  assert.equal(r.store.calls.insert, 0);
  assert.equal(keysIn(r.out).length, 0);
});

test('create prints all 7 keys once; a second run prints none', async () => {
  const store = memoryStore();
  const first = await run(['create', '--yes'], { store });
  assert.equal(first.code, 0);
  assert.equal(keysIn(first.out).length, 7);
  for (const { username } of AGENT_ACCOUNTS) assert.ok(first.out.includes(`${username}: created`));
  for (const row of store.rows) assert.equal(first.out.includes(row.api_key_hash), false);

  const second = await run(['create', '--yes'], { store });
  assert.equal(second.code, 0);
  assert.equal(keysIn(second.out).length, 0);
  assert.equal((second.out.match(/unchanged/g) ?? []).length, 7);
  assert.equal(store.rows.length, 7);
});

test('rotate-key prints the new key once; --all prints one per agent account', async () => {
  const store = memoryStore();
  const created = await run(['create', '--yes'], { store });

  const one = await run(['rotate-key', '--username=agent-owner', '--yes'], { store });
  assert.equal(one.code, 0);
  assert.equal(keysIn(one.out).length, 1);
  assert.ok(one.out.includes('agent-owner'));
  assert.equal(keysIn(created.out).some((k) => one.out.includes(k)), false);

  const all = await run(['rotate-key', '--all', '--yes'], { store });
  assert.equal(all.code, 0);
  assert.equal(new Set(keysIn(all.out)).size, 7);
});

test('rotate-key for an unknown account fails with exit 1 and prints no key', async () => {
  const r = await run(['rotate-key', '--username=nobody', '--yes']);
  assert.equal(r.code, 1);
  assert.match(r.err, /No agent account/);
  assert.equal(keysIn(r.out + r.err).length, 0);
});

test('disable and --enable toggle the account and print no keys', async () => {
  const store = memoryStore();
  await run(['create', '--yes'], { store });
  const off = await run(['disable', '--username=agent-owner', '--yes'], { store });
  assert.equal(off.code, 0);
  assert.match(off.out, /agent-owner: disabled/);
  assert.equal(store.rows.find((r) => r.username === 'agent-owner').disabled, 'true');
  const on = await run(['disable', '--username=agent-owner', '--enable', '--yes'], { store });
  assert.match(on.out, /agent-owner: enabled/);
  assert.equal(keysIn(off.out + on.out).length, 0);
});

test('every write command needs the confirmation; list does not ask', async () => {
  const store = memoryStore();
  await run(['create', '--yes'], { store });
  const snapshot = JSON.stringify(store.rows);
  for (const argv of [['create'], ['rotate-key', '--all'], ['rotate-key', '--username=agent-owner'], ['disable', '--username=agent-owner']]) {
    const r = await run(argv, { store, confirmed: false });
    assert.equal(r.code, 1, argv.join(' '));
    assert.equal(r.confirmCalls, 1, argv.join(' '));
  }
  assert.equal(JSON.stringify(store.rows), snapshot);

  const listed = await run(['list'], { store, confirmed: false });
  assert.equal(listed.code, 0);
  assert.equal(listed.confirmCalls, 0);
});

test('list prints prefix, state and scopes, never a key or hash', async () => {
  const store = memoryStore();
  const created = await run(['create', '--yes'], { store });
  await run(['disable', '--username=agent-owner', '--yes'], { store });
  const r = await run(['list'], { store });
  assert.equal(r.code, 0);
  assert.equal(r.out.split('\n').length, 7);
  assert.match(r.out, /agent-owner {2}prefix=[A-Za-z0-9]{8} {2}DISABLED {2}scopes=orders:read,finance:read,reports:read/);
  assert.match(r.out, /agent-manager {2}prefix=[A-Za-z0-9]{8} {2}enabled/);
  assert.equal(keysIn(r.out).length, 0);
  for (const row of store.rows) assert.equal(r.out.includes(row.api_key_hash), false);
  assert.ok(created.code === 0);
});

test('list on an empty sheet says so', async () => {
  assert.match((await run(['list'])).out, /No agent accounts/);
});

test('without AGENT_KEY_SECRET, create and rotate-key fail before asking to confirm', async () => {
  for (const argv of [['create', '--yes'], ['rotate-key', '--all', '--yes']]) {
    const r = await run(argv, { serverSecret: null });
    assert.equal(r.code, 1);
    assert.match(r.err, /AGENT_KEY_SECRET/);
    assert.equal(r.confirmCalls, 0);
    assert.equal(r.store.calls.insert + r.store.calls.updateById, 0);
  }
});

test('bad arguments print usage, exit 1 and touch nothing', async () => {
  const r = await run(['rotate-key', '--yes']);
  assert.equal(r.code, 1);
  assert.match(r.err, /Usage:/);
  assert.equal(r.confirmCalls, 0);
});

test('keys already issued before a failure are still printed', async () => {
  const store = memoryStore();
  const original = store.insert;
  store.insert = async (row) => {
    if (store.rows.length === 3) throw new Error('sheets down');
    return original(row);
  };
  const r = await run(['create', '--yes'], { store });
  assert.equal(r.code, 1);
  assert.match(r.err, /sheets down/);
  assert.equal(keysIn(r.out).length, 3);
});
