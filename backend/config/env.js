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
  // Cloudinary — used for design image uploads. Google Drive was tried first
  // but service accounts have no storage quota of their own on regular
  // Drive (only Shared Drives / domain-wide delegation work, both Workspace
  // (paid) only), so this project uses Cloudinary's free tier instead.
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || null,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || null,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || null,
};
