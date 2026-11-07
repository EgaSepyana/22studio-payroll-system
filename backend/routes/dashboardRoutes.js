import { Router } from 'express';
import * as dashboardController from '../controllers/dashboardController.js';
import { requireAuth, allow, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/admin', allow({ roles: ['admin', 'owner'], scope: 'dashboard:read' }), dashboardController.admin);
router.get('/employee', requireRole('employee'), dashboardController.employee);

export default router;
