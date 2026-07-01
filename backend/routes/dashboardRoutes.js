import { Router } from 'express';
import * as dashboardController from '../controllers/dashboardController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/admin', requireRole('admin'), dashboardController.admin);
router.get('/employee', requireRole('employee'), dashboardController.employee);

export default router;
