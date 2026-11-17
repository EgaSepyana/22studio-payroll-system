import { Router } from 'express';
import * as ownerAgentActivityController from '../controllers/ownerAgentActivityController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

// Owner only, humans only: agents have no scope for this, so they get 403.
const router = Router();
router.use(requireAuth);

router.get('/', requireRole('owner'), ownerAgentActivityController.list);

export default router;
