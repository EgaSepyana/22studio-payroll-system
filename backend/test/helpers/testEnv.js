// Import this before anything that loads config/env.js. dotenv never
// overrides variables that are already set (even to ''), so these shield the
// tests from the developer's real backend/.env (production sheet, Redis, ...).
Object.assign(process.env, {
  JWT_SECRET: 'test-jwt-secret',
  GOOGLE_SHEETS_ID: 'test-spreadsheet-id',
  PUBLIC_TRACKING_SECRET: 'test-tracking-secret',
  AGENT_KEY_SECRET: 'test-agent-key-secret',
  GOOGLE_SERVICE_ACCOUNT_JSON: '',
  REDIS_URL: '',
  CLOUDINARY_CLOUD_NAME: '',
  CLOUDINARY_API_KEY: '',
  CLOUDINARY_API_SECRET: '',
});
