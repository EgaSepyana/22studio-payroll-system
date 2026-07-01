import { Router } from 'express';
import * as workLogController from '../controllers/workLogController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.post('/', requireRole('employee', 'admin'), workLogController.create);
router.get('/', requireRole('admin'), workLogController.listAll);
router.get('/mine', requireRole('employee'), workLogController.listMine);
router.put('/:id', requireRole('employee'), workLogController.update);

export default router;
