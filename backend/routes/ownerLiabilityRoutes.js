import { Router } from 'express';
import * as ownerLiabilityController from '../controllers/ownerLiabilityController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole('owner'));

router.get('/', ownerLiabilityController.list);
router.post('/', ownerLiabilityController.create);
router.get('/:id', ownerLiabilityController.getDetail);
router.put('/:id', ownerLiabilityController.update);
router.delete('/:id', ownerLiabilityController.remove);

router.post('/:id/payments', ownerLiabilityController.createPayment);
router.delete('/:id/payments/:paymentId', ownerLiabilityController.removePayment);

export default router;
