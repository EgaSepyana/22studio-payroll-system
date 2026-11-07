import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/response.js';
import { isAgentKey } from '../utils/agentKeyUtils.js';
import { authenticateAgentKey, usersAgentStore } from '../services/agentAuthService.js';
import { isForbiddenRoute, hasScope } from '../config/agentScopes.js';

function bearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

// Agent accounts never authenticate with a JWT: they have no password and
// login() refuses them, so an agent-role JWT can only be forged or stale.
function verifyHumanJwt(token) {
  const payload = jwt.verify(token, env.jwtSecret);
  if (payload.role === 'agent') throw new Error('agent role in JWT');
  return payload;
}

// `agentStore` and `agentKeySecret` are injectable so tests don't need
// Google Sheets. The default exports below use the real ones.
export function createAuthMiddleware({ agentStore, agentKeySecret } = {}) {
  function requireAuth(req, res, next) {
    const token = bearerToken(req);
    if (!token) return next(new ApiError(401, 'Not authenticated'));

    if (isAgentKey(token)) {
      authenticateAgentKey(token, { store: agentStore, secret: agentKeySecret })
        .then((user) => {
          // Agents never get past auth on the areas the catalog forbids
          // (/api/auth, /api/profile, /api/notifications, ...).
          if (isForbiddenRoute(req.method, `${req.baseUrl || ''}${req.path || ''}`)) {
            return next(new ApiError(403, 'Forbidden'));
          }
          req.user = user;
          next();
        })
        .catch(next);
      return;
    }

    try {
      req.user = verifyHumanJwt(token);
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
  // existing route can be authenticated. Agent keys are refused here.
  function requireAuthQueryOrHeader(req, res, next) {
    const token = bearerToken(req) || req.query.token || null;
    if (!token) return next(new ApiError(401, 'Not authenticated'));
    if (isAgentKey(token)) return next(new ApiError(403, 'Forbidden'));

    try {
      req.user = verifyHumanJwt(token);
      next();
    } catch {
      next(new ApiError(401, 'Invalid or expired token'));
    }
  }

  return { requireAuth, requireAuthQueryOrHeader };
}

export const { requireAuth, requireAuthQueryOrHeader } = createAuthMiddleware({
  agentStore: usersAgentStore,
  agentKeySecret: env.agentKeySecret,
});

// The one route guard. `roles` are the human roles allowed (omit for any
// authenticated human); `scope` is the agent scope that also lets an agent
// through. Agents are default-deny: with no `scope` declared, or without that
// scope on their account, they get 403. 'agent' is never a valid role here.
// The function is named `routeGuard` and exposes `.roles` / `.scope` so the
// route-guard snapshot and route-access tests can find and read it.
export function allow({ roles, scope } = {}) {
  if (roles?.includes('agent')) throw new Error("allow(): 'agent' is not a role, declare a scope instead");
  const routeGuard = (req, res, next) => {
    const user = req.user;
    if (user?.role === 'agent') {
      if (!scope || !hasScope(user, scope)) return next(new ApiError(403, 'Forbidden'));
      req.agentScopeVerified = true;
      return next();
    }
    if (!user || (roles && !roles.includes(user.role))) return next(new ApiError(403, 'Forbidden'));
    next();
  };
  if (roles) routeGuard.roles = roles;
  if (scope) routeGuard.scope = scope;
  return routeGuard;
}

export function requireRole(...roles) {
  return allow({ roles });
}

// Any authenticated human, never an agent.
export const requireHuman = allow();

// Gates a route to specific employee divisions (e.g. only Finishing may
// create Surat Jalan). Admin always bypasses — this only ever narrows what
// an *employee* token can do, never what admin can do. admin_produksi and
// owner are both standalone accounts with no divisi (like admin), so they
// bypass too — otherwise they'd fail this check on every Surat Jalan route
// despite having full Produksi access everywhere else.
const DIVISI_BYPASS_ROLES = new Set(['admin', 'admin_produksi', 'owner']);

export function requireDivisi(...divisions) {
  const routeGuard = (req, res, next) => {
    if (DIVISI_BYPASS_ROLES.has(req.user?.role)) return next();
    // An agent has no divisi: it passes only after allow() verified its scope.
    if (req.user?.role === 'agent') {
      return req.agentScopeVerified ? next() : next(new ApiError(403, 'Forbidden'));
    }
    if (!req.user || !divisions.includes(req.user.divisi)) {
      return next(new ApiError(403, 'Forbidden'));
    }
    next();
  };
  routeGuard.divisions = divisions;
  return routeGuard;
}
