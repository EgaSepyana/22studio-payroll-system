import { z } from 'zod';
import * as agentOrderService from '../services/agentOrderService.js';
import { ORDER_STATUSES, ORDER_JENIS_CATEGORIES } from '../google-sheet/models.js';
import { ok } from '../utils/response.js';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const publicSummaryQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  jenis_category: z.enum(ORDER_JENIS_CATEGORIES).optional(),
});

export function me(req, res) {
  ok(res, { username: req.user.username, scopes: [...req.user.scopes].sort() });
}

export async function publicSummary(req, res, next) {
  try {
    ok(res, await agentOrderService.getPublicSummary(publicSummaryQuerySchema.parse(req.query)));
  } catch (err) {
    next(err);
  }
}

export async function designBrief(req, res, next) {
  try {
    ok(res, await agentOrderService.getDesignBrief(req.params.id));
  } catch (err) {
    next(err);
  }
}
