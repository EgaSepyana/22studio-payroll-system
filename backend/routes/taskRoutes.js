import { Router } from 'express';
import * as taskController from '../controllers/taskController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.post('/', requireRole('admin'), taskController.create);
router.get('/available', requireRole('employee'), taskController.listAvailable);
router.get('/mine', requireRole('employee'), taskController.listMine);
router.get('/', requireRole('admin', 'employee'), taskController.list);
router.get('/:id', requireRole('admin', 'employee'), taskController.detail);
router.put('/:id', requireRole('admin'), taskController.update);
router.delete('/:id', requireRole('admin'), taskController.remove);

export default router;
