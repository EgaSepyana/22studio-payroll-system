import { Router } from 'express';
import * as ownerAssetController from '../controllers/ownerAssetController.js';
import { requireAuth, allow, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', allow({ roles: ['owner'], scope: 'finance:read' }), ownerAssetController.list);
router.post('/', requireRole('owner'), ownerAssetController.register);
router.post('/buy', allow({ roles: ['owner'], scope: 'assets:trade' }), ownerAssetController.buy);
router.post('/sell', allow({ roles: ['owner'], scope: 'assets:trade' }), ownerAssetController.sell);
router.get('/:id', allow({ roles: ['owner'], scope: 'finance:read' }), ownerAssetController.getDetail);
router.delete('/:id', requireRole('owner'), ownerAssetController.remove);

export default router;
