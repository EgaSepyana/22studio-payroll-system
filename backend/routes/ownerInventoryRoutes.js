import { Router } from 'express';
import * as ownerInventoryController from '../controllers/ownerInventoryController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole('owner'));

router.get('/', ownerInventoryController.list);
router.post('/', ownerInventoryController.register);
router.post('/stock-in', ownerInventoryController.stockIn);
router.post('/stock-out', ownerInventoryController.stockOut);
router.get('/:id', ownerInventoryController.getDetail);
router.put('/:id', ownerInventoryController.update);
router.delete('/:id', ownerInventoryController.remove);

export default router;
