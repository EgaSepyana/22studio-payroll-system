import crypto from 'node:crypto';

// Agent API key: agk_<prefix>_<secret>. The prefix (8 alphanumerics) is
// stored and used to find the account; the secret (32 random bytes,
// base64url) is only ever stored as HMAC-SHA256(secret, AGENT_KEY_SECRET).
export const AGENT_KEY_PREFIX = 'agk_';

const PREFIX_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const PREFIX_LENGTH = 8;
const SECRET_BYTES = 32;
const KEY_PATTERN = /^agk_([A-Za-z0-9]{8})_([A-Za-z0-9_-]{43,})$/;

export function isAgentKey(token) {
  return typeof token === 'string' && token.startsWith(AGENT_KEY_PREFIX);
}

// Returns { prefix, secret }, or null when the token is not a well-formed key.
export function parseAgentKey(token) {
  if (typeof token !== 'string') return null;
  const match = KEY_PATTERN.exec(token);
  return match ? { prefix: match[1], secret: match[2] } : null;
}

export function hashAgentSecret(secret, serverSecret) {
  return crypto.createHmac('sha256', serverSecret).update(secret).digest('hex');
}

function safeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// `storedHash` may be empty/undefined (unknown prefix, account without a
// key); the hash is still computed so those cases cost the same.
export function verifyAgentSecret(secret, serverSecret, storedHash) {
  return safeEqual(hashAgentSecret(secret, serverSecret), String(storedHash ?? ''));
}

export function generateAgentKey(serverSecret) {
  let prefix = '';
  for (let i = 0; i < PREFIX_LENGTH; i++) prefix += PREFIX_ALPHABET[crypto.randomInt(PREFIX_ALPHABET.length)];
  const secret = crypto.randomBytes(SECRET_BYTES).toString('base64url');
  return {
    key: `${AGENT_KEY_PREFIX}${prefix}_${secret}`,
    prefix,
    hash: hashAgentSecret(secret, serverSecret),
  };
}
