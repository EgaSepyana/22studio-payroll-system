import { Router } from 'express';
import * as payrollController from '../controllers/payrollController.js';
import { requireAuth, allow, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/mine', requireRole('employee'), payrollController.myHistory);
router.get('/export', allow({ roles: ['admin', 'owner'], scope: 'payroll:read' }), payrollController.exportPaid);
router.get('/range', allow({ roles: ['admin', 'owner'], scope: 'payroll:read' }), payrollController.listRange);
router.patch('/range/pay', allow({ roles: ['admin', 'owner'], scope: 'payroll:pay' }), payrollController.markRangePaid);
router.get('/', allow({ roles: ['admin', 'owner'], scope: 'payroll:read' }), payrollController.list);
router.get('/:id', allow({ roles: ['admin', 'owner'], scope: 'payroll:read' }), payrollController.detail);
router.patch('/:id/pay', allow({ roles: ['admin', 'owner'], scope: 'payroll:pay' }), payrollController.markPaid);

export default router;
