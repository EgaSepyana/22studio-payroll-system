import { Router } from 'express';
import * as ownerDashboardController from '../controllers/ownerDashboardController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole('owner'));

router.get('/', ownerDashboardController.getDashboard);

export default router;
