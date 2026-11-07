import { Router } from 'express';
import * as cashAdvanceController from '../controllers/cashAdvanceController.js';
import { requireAuth, allow, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.post('/', requireRole('employee'), cashAdvanceController.create);
router.get('/', allow({ roles: ['admin', 'owner'], scope: 'cashadvances:read' }), cashAdvanceController.listAll);
router.get('/mine', requireRole('employee'), cashAdvanceController.listMine);
router.get('/:id', allow({ roles: ['admin', 'owner'], scope: 'cashadvances:read' }), cashAdvanceController.detail);
router.patch('/:id/approve', allow({ roles: ['admin', 'owner'], scope: 'cashadvances:decide' }), cashAdvanceController.approve);
router.patch('/:id/reject', allow({ roles: ['admin', 'owner'], scope: 'cashadvances:decide' }), cashAdvanceController.reject);

export default router;
