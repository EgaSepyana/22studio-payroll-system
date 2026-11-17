// Server-side warning for a failed agent API-key attempt. The line carries the
// key prefix (an identifier, not a credential) and never any part of the
// secret; the query string is dropped from the path because it can hold a
// token. The client only ever sees the generic 401.

function clientIp(req) {
  const forwarded = String(req.headers?.['x-forwarded-for'] ?? '').split(',')[0].trim();
  const raw = forwarded || req.ip || req.socket?.remoteAddress || '';
  return raw.replace(/[^0-9a-fA-F:.]/g, '').slice(0, 45) || '-';
}

export function formatAgentAuthFailure(req, { reason, prefix }) {
  const path = String(req.originalUrl || req.url || '').split('?')[0] || '-';
  return `Agent auth failed: reason=${reason} prefix=${prefix || '-'} ip=${clientIp(req)} method=${req.method} path=${path}`;
}

export function logAgentAuthFailure(req, failure, log = (line) => console.warn(line)) {
  log(formatAgentAuthFailure(req, failure));
}
