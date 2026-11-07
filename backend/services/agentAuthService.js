import { UsersRepo } from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';
import { parseAgentKey, verifyAgentSecret } from '../utils/agentKeyUtils.js';
import { parseScopes, isAccountDisabled } from '../utils/agentFields.js';

// Default agent lookup. Uses the repo's cached read, so disabling an account
// or rotating its key can take up to the cache TTL (30s) to reach other
// serverless instances.
export const usersAgentStore = {
  async findByPrefix(prefix) {
    const users = await UsersRepo.getAll();
    return users.find((u) => u.role === 'agent' && u.api_key_prefix === prefix) || null;
  },
};

// Returns the req.user for a valid key, otherwise throws the same 401 for
// every failure so a caller can't tell a wrong secret from an unknown prefix.
export async function authenticateAgentKey(token, { store = usersAgentStore, secret }) {
  const invalid = () => new ApiError(401, 'Invalid API key');

  const parsed = parseAgentKey(token);
  if (!parsed) throw invalid();
  if (!secret) {
    console.error('AGENT_KEY_SECRET is not set: rejecting agent API key');
    throw invalid();
  }

  const row = await store.findByPrefix(parsed.prefix);
  const secretMatches = verifyAgentSecret(parsed.secret, secret, row?.api_key_hash);
  if (!row || !secretMatches || row.role !== 'agent' || isAccountDisabled(row)) throw invalid();

  return { id: row.id, username: row.username, role: 'agent', scopes: new Set(parseScopes(row.scopes)) };
}
