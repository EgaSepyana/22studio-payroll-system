import { Router } from 'express';
import * as ownerInventoryController from '../controllers/ownerInventoryController.js';
import { requireAuth, allow, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', allow({ roles: ['owner'], scope: 'finance:read' }), ownerInventoryController.list);
router.post('/', requireRole('owner'), ownerInventoryController.register);
router.post('/stock-in', allow({ roles: ['owner'], scope: 'inventory:stock' }), ownerInventoryController.stockIn);
router.post('/stock-out', allow({ roles: ['owner'], scope: 'inventory:stock' }), ownerInventoryController.stockOut);
router.get('/:id', allow({ roles: ['owner'], scope: 'finance:read' }), ownerInventoryController.getDetail);
router.put('/:id', requireRole('owner'), ownerInventoryController.update);
router.delete('/:id', requireRole('owner'), ownerInventoryController.remove);

export default router;
