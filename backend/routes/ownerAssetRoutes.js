import { Router } from 'express';
import * as ownerAssetController from '../controllers/ownerAssetController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole('owner'));

router.get('/', ownerAssetController.list);
router.post('/', ownerAssetController.register);
router.post('/buy', ownerAssetController.buy);
router.post('/sell', ownerAssetController.sell);
router.get('/:id', ownerAssetController.getDetail);
router.delete('/:id', ownerAssetController.remove);

export default router;
