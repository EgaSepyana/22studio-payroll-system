import { Router } from 'express';
import * as lembarPOController from '../controllers/lembarPOController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.post('/', requireRole('admin', 'admin_produksi', 'owner'), lembarPOController.create);
router.get('/', requireRole('admin', 'admin_produksi', 'owner'), lembarPOController.list);
// Employee read-only routes — must come before '/:id' so they don't get
// swallowed by that param route.
router.get('/by-order/:orderId', requireRole('admin', 'admin_produksi', 'owner', 'employee'), lembarPOController.detailByOrder);
router.get('/order-ids', requireRole('admin', 'admin_produksi', 'owner', 'employee'), lembarPOController.orderIdsWithLembarPO);
router.get('/:id', requireRole('admin', 'admin_produksi', 'owner'), lembarPOController.detail);
router.get('/:id/pdf', requireRole('admin', 'admin_produksi', 'owner'), lembarPOController.pdf);
router.put('/:id', requireRole('admin', 'admin_produksi', 'owner'), lembarPOController.update);
router.delete('/:id', requireRole('admin', 'admin_produksi', 'owner'), lembarPOController.remove);

export default router;
