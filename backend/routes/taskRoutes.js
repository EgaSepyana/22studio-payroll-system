import { Router } from 'express';
import * as taskController from '../controllers/taskController.js';
import { requireAuth, allow, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.post('/', allow({ roles: ['admin', 'admin_produksi', 'owner'], scope: 'tasks:write' }), taskController.create);
router.get('/available', requireRole('employee'), taskController.listAvailable);
router.get('/mine', requireRole('employee'), taskController.listMine);
router.get('/', allow({ roles: ['admin', 'admin_produksi', 'owner', 'employee'], scope: 'tasks:read' }), taskController.list);
router.get('/:id', allow({ roles: ['admin', 'admin_produksi', 'owner', 'employee'], scope: 'tasks:read' }), taskController.detail);
router.get('/:id/progress-photos', allow({ roles: ['admin', 'admin_produksi', 'owner'], scope: 'tasks:read' }), taskController.progressPhotos);
router.put('/:id', allow({ roles: ['admin', 'admin_produksi', 'owner'], scope: 'tasks:write' }), taskController.update);
router.delete('/:id', requireRole('admin', 'admin_produksi', 'owner'), taskController.remove);
router.post('/:id/progress', allow({ roles: ['admin', 'admin_produksi', 'owner', 'employee'], scope: 'tasks:progress' }), taskController.addProgress);

export default router;
