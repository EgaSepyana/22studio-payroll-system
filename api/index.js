// Vercel serverless entry point. Locally the app runs via backend/server.js
// (a normal long-lived `node` process with app.listen). On Vercel there is no
// long-lived server — every request invokes this function fresh, so we just
// hand the same Express app straight to Vercel's Node runtime, which calls it
// as a plain (req, res) request handler.
import app from '../backend/app.js';

export default app;
