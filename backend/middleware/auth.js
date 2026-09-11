import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/response.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new ApiError(401, 'Not authenticated'));

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = payload;
    next();
  } catch {
    next(new ApiError(401, 'Invalid or expired token'));
  }
}

// EventSource (used by the notification SSE stream) cannot set custom
// request headers, so it has no way to send the usual Authorization
// header — the token has to travel as a query param instead for that one
// route. Never used anywhere else: every other endpoint stays
// header-only via requireAuth above, so this doesn't widen how any
// existing route can be authenticated.
export function requireAuthQueryOrHeader(req, res, next) {
  const header = req.headers.authorization || '';
  const token = (header.startsWith('Bearer ') ? header.slice(7) : null) || req.query.token || null;
  if (!token) return next(new ApiError(401, 'Not authenticated'));

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = payload;
    next();
  } catch {
    next(new ApiError(401, 'Invalid or expired token'));
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ApiError(403, 'Forbidden'));
    }
    next();
  };
}

// Gates a route to specific employee divisions (e.g. only Finishing may
// create Surat Jalan). Admin always bypasses — this only ever narrows what
// an *employee* token can do, never what admin can do. admin_produksi and
// owner are both standalone accounts with no divisi (like admin), so they
// bypass too — otherwise they'd fail this check on every Surat Jalan route
// despite having full Produksi access everywhere else.
const DIVISI_BYPASS_ROLES = new Set(['admin', 'admin_produksi', 'owner']);

export function requireDivisi(...divisions) {
  return (req, res, next) => {
    if (DIVISI_BYPASS_ROLES.has(req.user?.role)) return next();
    if (!req.user || !divisions.includes(req.user.divisi)) {
      return next(new ApiError(403, 'Forbidden'));
    }
    next();
  };
}
