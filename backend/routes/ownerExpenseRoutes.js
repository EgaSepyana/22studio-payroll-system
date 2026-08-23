import { Router } from 'express';
import * as ownerExpenseController from '../controllers/ownerExpenseController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole('owner'));

router.get('/', ownerExpenseController.list);
router.get('/order-picker', ownerExpenseController.listOrderPicker);
router.get('/order-profitability/:orderId', ownerExpenseController.getOrderProfitability);
router.post('/', ownerExpenseController.create);
router.delete('/:id', ownerExpenseController.remove);

export default router;
