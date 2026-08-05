import crypto from 'node:crypto';
import { ShortLinkRepo } from '../google-sheet/models.js';
import { env } from '../config/env.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const CODE_LENGTH = 7;

function generateCode() {
  let code = '';
  const bytes = crypto.randomBytes(CODE_LENGTH);
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

// Reuses an existing short link for the same original_url instead of minting
// a duplicate every time — the tracking link is regenerated on every "Lacak
// Order" click, so without this the sheet would fill up with one row per
// click for the same order.
export async function createShortLink(originalUrl) {
  const existing = await ShortLinkRepo.getAll();
  const match = existing.find((row) => row.original_url === originalUrl);
  if (match) return `${env.publicBackendUrl}/s/${match.code}`;

  let code = generateCode();
  while (existing.some((row) => row.code === code)) {
    code = generateCode();
  }

  await ShortLinkRepo.insert({
    code,
    original_url: originalUrl,
    created_at: new Date().toISOString(),
  });

  return `${env.publicBackendUrl}/s/${code}`;
}

export async function resolveShortLink(code) {
  const rows = await ShortLinkRepo.getAll();
  const match = rows.find((row) => row.code === code);
  return match?.original_url || null;
}
