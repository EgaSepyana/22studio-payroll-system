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

// Every failure is the same 401 for the caller, so a wrong secret can't be
// told from an unknown prefix. `reason` and `prefix` are for the server log
// only (see utils/agentAuthLog.js); `prefix` is null when the key is malformed.
export class AgentAuthError extends ApiError {
  constructor(reason, prefix = null) {
    super(401, 'Invalid API key');
    this.reason = reason;
    this.prefix = prefix;
  }
}

// Returns the req.user for a valid key, otherwise throws an AgentAuthError.
export async function authenticateAgentKey(token, { store = usersAgentStore, secret }) {
  const parsed = parseAgentKey(token);
  if (!parsed) throw new AgentAuthError('malformed');
  const { prefix } = parsed;
  if (!secret) {
    console.error('AGENT_KEY_SECRET is not set: rejecting agent API key');
    throw new AgentAuthError('not configured', prefix);
  }

  const row = await store.findByPrefix(prefix);
  const secretMatches = verifyAgentSecret(parsed.secret, secret, row?.api_key_hash);
  if (!row || row.role !== 'agent') throw new AgentAuthError('unknown', prefix);
  if (!secretMatches) throw new AgentAuthError('wrong secret', prefix);
  if (isAccountDisabled(row)) throw new AgentAuthError('disabled', prefix);

  return { id: row.id, username: row.username, role: 'agent', scopes: new Set(parseScopes(row.scopes)) };
}
