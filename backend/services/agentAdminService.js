import { generateAgentKey } from '../utils/agentKeyUtils.js';
import { parseScopes, isAccountDisabled } from '../utils/agentFields.js';

// Operations behind the agents:* CLI. `store` is { getAll(), insert(row),
// updateById(id, patch) } (UsersRepo in production, in-memory in tests), so
// nothing here talks to Google Sheets directly. Keys are returned to the
// caller once and never stored in plaintext.

const isAgent = (user) => user.role === 'agent';

function findAgent(users, username) {
  return users.find((u) => isAgent(u) && u.username === username) || null;
}

function sameScopes(a, b) {
  return a.length === b.length && a.every((s) => b.includes(s));
}

function newKey(serverSecret, takenPrefixes, generateKey) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const key = generateKey(serverSecret);
    if (!takenPrefixes.has(key.prefix)) {
      takenPrefixes.add(key.prefix);
      return key;
    }
  }
  throw new Error('Could not generate a unique key prefix');
}

// A key that was already issued but whose row could not be saved (or a later
// row failed) must not be lost: the error carries the results so far.
async function collect(items, step) {
  const results = [];
  try {
    for (const item of items) results.push(await step(item));
  } catch (err) {
    err.partialResults = results;
    throw err;
  }
  return results;
}

function takenPrefixesOf(users) {
  return new Set(users.map((u) => u.api_key_prefix).filter(Boolean));
}

// Creates every missing account; re-running updates scopes of existing ones
// and returns a key only for accounts it just created.
export async function createAgents({ store, accounts, serverSecret, generateKey = generateAgentKey }) {
  const users = await store.getAll();
  for (const { username } of accounts) {
    if (users.some((u) => u.username === username && !isAgent(u))) {
      throw new Error(`Username "${username}" is already used by a non-agent account`);
    }
  }
  const taken = takenPrefixesOf(users);

  return collect(accounts, async ({ username, scopes }) => {
    const existing = findAgent(users, username);
    if (!existing) {
      const key = newKey(serverSecret, taken, generateKey);
      await store.insert({
        username,
        password: '',
        role: 'agent',
        employee_id: '',
        scopes: scopes.join(','),
        api_key_hash: key.hash,
        api_key_prefix: key.prefix,
        disabled: '',
      });
      return { username, status: 'created', key: key.key };
    }
    const hasKey = Boolean(existing.api_key_hash);
    if (!sameScopes(parseScopes(existing.scopes), scopes)) {
      await store.updateById(existing.id, { scopes: scopes.join(',') });
      return { username, status: 'scopes updated', hasKey };
    }
    return { username, status: 'unchanged', hasKey };
  });
}

export async function listAgents({ store }) {
  const users = await store.getAll();
  return users.filter(isAgent).map((u) => ({
    username: u.username,
    scopes: parseScopes(u.scopes),
    disabled: isAccountDisabled(u),
    prefix: u.api_key_prefix || '',
  }));
}

// New key for one account (`username`) or for every agent account (`all`).
// The old key stops working as soon as the row is saved.
export async function rotateKeys({ store, username, all, serverSecret, generateKey = generateAgentKey }) {
  if (Boolean(username) === Boolean(all)) throw new Error('Pass either a username or --all');
  const users = await store.getAll();
  const agents = all ? users.filter(isAgent) : [findAgent(users, username)].filter(Boolean);
  if (!all && agents.length === 0) throw new Error(`No agent account named "${username}"`);
  const taken = takenPrefixesOf(users);

  return collect(agents, async (agent) => {
    const key = newKey(serverSecret, taken, generateKey);
    await store.updateById(agent.id, { api_key_hash: key.hash, api_key_prefix: key.prefix });
    return { username: agent.username, key: key.key };
  });
}

export async function setDisabled({ store, username, disabled }) {
  const agent = findAgent(await store.getAll(), username);
  if (!agent) throw new Error(`No agent account named "${username}"`);
  await store.updateById(agent.id, { disabled: disabled ? 'true' : '' });
  return { username, disabled };
}
