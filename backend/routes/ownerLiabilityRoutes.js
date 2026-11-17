import { Router } from 'express';
import * as ownerLiabilityController from '../controllers/ownerLiabilityController.js';
import { requireAuth, allow, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', allow({ roles: ['owner'], scope: 'finance:read' }), ownerLiabilityController.list);
router.post('/', requireRole('owner'), ownerLiabilityController.create);
router.get('/:id', allow({ roles: ['owner'], scope: 'finance:read' }), ownerLiabilityController.getDetail);
router.put('/:id', requireRole('owner'), ownerLiabilityController.update);
router.delete('/:id', requireRole('owner'), ownerLiabilityController.remove);

router.post('/:id/payments', allow({ roles: ['owner'], scope: 'liabilities:pay' }), ownerLiabilityController.createPayment);
router.delete('/:id/payments/:paymentId', requireRole('owner'), ownerLiabilityController.removePayment);

export default router;
