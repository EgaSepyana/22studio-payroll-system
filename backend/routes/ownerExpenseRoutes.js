import { Router } from 'express';
import * as ownerExpenseController from '../controllers/ownerExpenseController.js';
import { requireAuth, allow, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', allow({ roles: ['owner'], scope: 'finance:read' }), ownerExpenseController.list);
router.get('/order-picker', allow({ roles: ['owner'], scope: 'finance:read' }), ownerExpenseController.listOrderPicker);
router.get('/order-profitability/:orderId', allow({ roles: ['owner'], scope: 'finance:read' }), ownerExpenseController.getOrderProfitability);
router.post('/', allow({ roles: ['owner'], scope: 'expenses:create' }), ownerExpenseController.create);
router.delete('/:id', requireRole('owner'), ownerExpenseController.remove);

export default router;
