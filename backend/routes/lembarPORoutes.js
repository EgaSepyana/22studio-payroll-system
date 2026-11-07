import { Router } from 'express';
import * as lembarPOController from '../controllers/lembarPOController.js';
import { requireAuth, allow, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.post('/', allow({ roles: ['admin', 'admin_produksi', 'owner'], scope: 'lembar-po:write' }), lembarPOController.create);
router.get('/', allow({ roles: ['admin', 'admin_produksi', 'owner'], scope: 'lembar-po:read' }), lembarPOController.list);
// Employee read-only routes — must come before '/:id' so they don't get
// swallowed by that param route.
router.get('/by-order/:orderId', allow({ roles: ['admin', 'admin_produksi', 'owner', 'employee'], scope: 'lembar-po:read' }), lembarPOController.detailByOrder);
router.get('/order-ids', allow({ roles: ['admin', 'admin_produksi', 'owner', 'employee'], scope: 'lembar-po:read' }), lembarPOController.orderIdsWithLembarPO);
router.get('/:id', allow({ roles: ['admin', 'admin_produksi', 'owner'], scope: 'lembar-po:read' }), lembarPOController.detail);
router.get('/:id/pdf', allow({ roles: ['admin', 'admin_produksi', 'owner'], scope: 'lembar-po:read' }), lembarPOController.pdf);
router.put('/:id', allow({ roles: ['admin', 'admin_produksi', 'owner'], scope: 'lembar-po:write' }), lembarPOController.update);
router.delete('/:id', requireRole('admin', 'admin_produksi', 'owner'), lembarPOController.remove);

export default router;
