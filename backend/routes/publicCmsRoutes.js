import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as publicCmsController from '../controllers/publicCmsController.js';

const router = Router();

// Unauthenticated by design — this is what the external landing page fetches
// on every page load. Looser limit than the order-tracking public router
// since this is ordinary public page-load traffic on non-sensitive data, not
// a semi-guessable lookup key; the limit exists purely as scrape/DoS
// mitigation, not access control.
const cmsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(cmsLimiter);

router.get('/content', publicCmsController.getContent);

export default router;
