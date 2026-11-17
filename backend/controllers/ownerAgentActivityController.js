import { z } from 'zod';
import * as auditLogService from '../services/auditLogService.js';
import { ok } from '../utils/response.js';

export const activityQuerySchema = z.object({
  agent: z.string().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export async function list(req, res, next) {
  try {
    ok(res, await auditLogService.listAgentActivity(activityQuerySchema.parse(req.query)));
  } catch (err) {
    next(err);
  }
}
