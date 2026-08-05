import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as shortLinkController from '../controllers/shortLinkController.js';

const router = Router();

// Unauthenticated by design — this is the whole point of a short link. Rate
// limited per IP the same way the other public router is, since it's an
// unauthenticated code lookup.
const shortLinkLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(shortLinkLimiter);

router.get('/:code', shortLinkController.redirect);

export default router;
