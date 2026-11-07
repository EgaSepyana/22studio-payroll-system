import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { ApiError } from '../utils/response.js';

// Counts per agent account, not per IP: every request through the MCP server
// would otherwise share one address. Counters live in this process's memory,
// so on serverless the limit applies per instance.
export function agentRateLimitKey(req) {
  return String(req.user.id);
}

export function createAgentRateLimiter({ limit = env.agentRateLimitPerMin, windowMs = 60 * 1000 } = {}) {
  return rateLimit({
    windowMs,
    limit,
    keyGenerator: agentRateLimitKey,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res, next) => next(new ApiError(429, 'Too many requests')),
  });
}
