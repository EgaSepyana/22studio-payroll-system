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
// an *employee* token can do, never what admin can do.
export function requireDivisi(...divisions) {
  return (req, res, next) => {
    if (req.user?.role === 'admin') return next();
    if (!req.user || !divisions.includes(req.user.divisi)) {
      return next(new ApiError(403, 'Forbidden'));
    }
    next();
  };
}
