import { Router } from 'express';
import * as workLogController from '../controllers/workLogController.js';
import { requireAuth, allow, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.post('/', requireRole('employee', 'admin', 'owner'), workLogController.create);
router.get('/', allow({ roles: ['admin', 'owner'], scope: 'worklogs:read' }), workLogController.listAll);
router.get('/export', allow({ roles: ['admin', 'owner'], scope: 'worklogs:read' }), workLogController.exportWorkLogs);
router.get('/mine', requireRole('employee'), workLogController.listMine);
router.get('/:id', allow({ roles: ['admin', 'owner'], scope: 'worklogs:read' }), workLogController.detail);
router.put('/:id', requireRole('employee', 'admin', 'owner'), workLogController.update);
router.delete('/:id', requireRole('admin', 'owner'), workLogController.remove);

export default router;
