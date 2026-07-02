import { Router } from 'express';
import * as cashAdvanceController from '../controllers/cashAdvanceController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.post('/', requireRole('employee'), cashAdvanceController.create);
router.get('/', requireRole('admin'), cashAdvanceController.listAll);
router.get('/mine', requireRole('employee'), cashAdvanceController.listMine);
router.get('/:id', requireRole('admin'), cashAdvanceController.detail);
router.patch('/:id/approve', requireRole('admin'), cashAdvanceController.approve);
router.patch('/:id/reject', requireRole('admin'), cashAdvanceController.reject);

export default router;
