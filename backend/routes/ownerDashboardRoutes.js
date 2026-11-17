import { Router } from 'express';
import * as ownerDashboardController from '../controllers/ownerDashboardController.js';
import { requireAuth, allow } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', allow({ roles: ['owner'], scope: 'finance:read' }), ownerDashboardController.getDashboard);

export default router;
