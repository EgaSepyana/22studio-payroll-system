import { Router } from 'express';
import * as payrollController from '../controllers/payrollController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/mine', requireRole('employee'), payrollController.myHistory);
router.get('/export', requireRole('admin'), payrollController.exportPaid);
router.get('/', requireRole('admin'), payrollController.list);
router.get('/:id', requireRole('admin'), payrollController.detail);
router.patch('/:id/pay', requireRole('admin'), payrollController.markPaid);

export default router;
