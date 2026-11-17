import { recordAgentRequest } from '../services/auditLogService.js';
import { buildAuditSummary } from '../utils/auditSummary.js';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Only an agent's writes are audited: never reads, never human requests.
export function shouldAudit(user, method) {
  return user?.role === 'agent' && WRITE_METHODS.has(String(method).toUpperCase());
}

// Returns `audit(req, res, user)`, called by requireAuth once an agent is
// authenticated. The entry is written after the response finishes, so
// denied writes (403/429) are recorded with their status, and a failed
// write is logged but never affects the request.
export function createAgentAuditor({ record = recordAgentRequest } = {}) {
  return function audit(req, res, user) {
    if (!shouldAudit(user, req.method)) return;
    res.once('finish', () => {
      Promise.resolve()
        .then(() =>
          record({
            user,
            method: req.method.toUpperCase(),
            path: String(req.originalUrl || req.url).split('?')[0],
            statusCode: res.statusCode,
            summary: buildAuditSummary(req.body),
          })
        )
        .catch((err) => console.error('Audit log write failed:', err.message));
    });
  };
}
