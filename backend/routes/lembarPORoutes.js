import { Router } from 'express';
import * as lembarPOController from '../controllers/lembarPOController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.post('/', requireRole('admin', 'admin_produksi'), lembarPOController.create);
router.get('/', requireRole('admin', 'admin_produksi'), lembarPOController.list);
// Employee read-only lookup by order_id — must come before '/:id' so it
// doesn't get swallowed by that param route.
router.get('/by-order/:orderId', requireRole('admin', 'admin_produksi', 'employee'), lembarPOController.detailByOrder);
router.get('/:id', requireRole('admin', 'admin_produksi'), lembarPOController.detail);
router.get('/:id/pdf', requireRole('admin', 'admin_produksi'), lembarPOController.pdf);
router.put('/:id', requireRole('admin', 'admin_produksi'), lembarPOController.update);
router.delete('/:id', requireRole('admin', 'admin_produksi'), lembarPOController.remove);

export default router;
