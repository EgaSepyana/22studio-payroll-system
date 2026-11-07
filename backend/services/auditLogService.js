import { AuditLogRepo } from '../google-sheet/models.js';

export async function recordAgentRequest({ user, method, path, statusCode, summary }) {
  await AuditLogRepo.insert({
    created_at: new Date().toISOString(),
    user_id: user.id,
    username: user.username,
    role: user.role,
    method,
    path,
    status_code: statusCode,
    summary,
  });
}

// Newest first. `agents` lists every agent username present in the log (not
// only the filtered ones) so the owner page can offer them as filter options.
export async function listAgentActivity({ agent, limit = 200 } = {}) {
  const all = await AuditLogRepo.getAll({ fresh: true });
  const agents = [...new Set(all.map((e) => e.username).filter(Boolean))].sort();
  const entries = all
    .filter((e) => !agent || e.username === agent)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
    .slice(0, limit)
    .map(({ id, created_at, username, method, path, status_code, summary }) => ({
      id,
      created_at,
      username,
      method,
      path,
      status_code: Number(status_code) || 0,
      summary,
    }));
  return { entries, agents };
}
