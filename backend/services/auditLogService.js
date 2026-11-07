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
