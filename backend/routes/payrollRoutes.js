import { Router } from 'express';
import * as payrollController from '../controllers/payrollController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/mine', requireRole('employee'), payrollController.myHistory);
router.get('/export', requireRole('admin', 'owner'), payrollController.exportPaid);
router.get('/range', requireRole('admin', 'owner'), payrollController.listRange);
router.patch('/range/pay', requireRole('admin', 'owner'), payrollController.markRangePaid);
router.get('/', requireRole('admin', 'owner'), payrollController.list);
router.get('/:id', requireRole('admin', 'owner'), payrollController.detail);
router.patch('/:id/pay', requireRole('admin', 'owner'), payrollController.markPaid);

export default router;
