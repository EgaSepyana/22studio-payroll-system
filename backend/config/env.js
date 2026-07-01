import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  port: process.env.PORT || 3000,
  jwtSecret: required('JWT_SECRET'),
  googleSheetsId: required('GOOGLE_SHEETS_ID'),
  // On serverless platforms (Vercel) there's no writable/persistent filesystem to
  // ship a service-account.json to, and it shouldn't be committed to git anyway —
  // so the full JSON can instead be provided as a single env var. Local dev keeps
  // using the file path.
  googleServiceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || null,
  googleServiceAccountPath: path.resolve(
    __dirname,
    '..',
    process.env.GOOGLE_SERVICE_ACCOUNT_PATH || './service-account.json'
  ),
};
