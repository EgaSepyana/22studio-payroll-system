import crypto from 'node:crypto';
import { env } from '../config/env.js';

// Opaque token for the public order-tracking link: base64url(payload) + "."
// + HMAC-SHA256(payload, secret). The payload carries invoiceId+noWa so the
// external tracking page can call the existing noWa/invoiceId-based public
// API directly — the HMAC just proves the token wasn't forged/tampered with
// (only someone who already knows a valid invoiceId+noWa pair can mint one,
// via the authenticated admin endpoint that signs it).
function base64url(input) {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function sign(payload) {
  return crypto.createHmac('sha256', env.publicTrackingSecret).update(payload).digest('hex');
}

export function createTrackingToken(invoiceId, noWa) {
  const payload = base64url(JSON.stringify({ i: invoiceId, w: noWa }));
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

// Returns { invoiceId, noWa } if the token is well-formed and its signature
// matches, otherwise null. Never throws — callers treat null as "invalid".
export function verifyTrackingToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const sigBuf = Buffer.from(signature, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded.i || !decoded.w) return null;
    return { invoiceId: decoded.i, noWa: decoded.w };
  } catch {
    return null;
  }
}
