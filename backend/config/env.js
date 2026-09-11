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
  // Signs the opaque token used in the public order-tracking link
  // (/lacak-order/status?t=...) — see utils/trackingTokenUtils.js.
  publicTrackingSecret: required('PUBLIC_TRACKING_SECRET'),
  publicTrackingBaseUrl: process.env.PUBLIC_TRACKING_BASE_URL || 'https://22studio.vercel.app',
  // Where this backend itself is publicly reachable — short links
  // (/s/:code) redirect through here, so they need the backend's own
  // deployed origin, not the separate tracking-page frontend above.
  publicBackendUrl: process.env.PUBLIC_BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`,
  // Notification queue (Upstash Redis) — see config/redis.js and
  // notificationStreamService.js. Both optional: if unset, notifications
  // still write to the Notifications sheet as before, they just don't get
  // pushed onto the realtime queue (the SSE endpoint then has nothing to
  // stream and the frontend's polling fallback covers it).
  redisUrl: process.env.REDIS_URL || null,
  redisQueueDb: process.env.REDIS_QUEUE_DB ? Number(process.env.REDIS_QUEUE_DB) : 0,
  // How long GET /notifications/stream holds one SSE connection open before
  // ending it (the browser's native EventSource then reconnects on its
  // own, and a fresh serverless invocation picks up from there — see
  // notificationController.stream). Vercel Hobby hard-caps function
  // duration at 10s regardless of any per-route config, so this defaults
  // safely under that; bump it via env once/if the project is on a plan
  // that allows longer (Pro: up to 300s) — see notification-improvements.md.
  sseHoldMs: process.env.NOTIFICATION_SSE_HOLD_MS ? Number(process.env.NOTIFICATION_SSE_HOLD_MS) : 8000,
};
