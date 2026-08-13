import { Router } from 'express';
import * as taskController from '../controllers/taskController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.post('/', requireRole('admin', 'admin_produksi'), taskController.create);
router.get('/available', requireRole('employee'), taskController.listAvailable);
router.get('/mine', requireRole('employee'), taskController.listMine);
router.get('/', requireRole('admin', 'admin_produksi', 'employee'), taskController.list);
router.get('/:id', requireRole('admin', 'admin_produksi', 'employee'), taskController.detail);
router.put('/:id', requireRole('admin', 'admin_produksi'), taskController.update);
router.delete('/:id', requireRole('admin', 'admin_produksi'), taskController.remove);
router.post('/:id/progress', requireRole('admin', 'admin_produksi', 'employee'), taskController.addProgress);

export default router;
