import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as publicOrderController from '../controllers/publicOrderController.js';

const router = Router();

// This is the only unauthenticated router in the backend — noWa + invoiceId
// is a semi-guessable key space (invoice numbers are sequential per day), so
// every route here is rate-limited per IP on top of the exact-match lookup.
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(publicLimiter);

router.get('/order-timeline', publicOrderController.timeline);
router.post('/orders/design/approve', publicOrderController.approveDesign);

export default router;
