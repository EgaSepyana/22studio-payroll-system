import { Router } from 'express';
import * as workLogController from '../controllers/workLogController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.post('/', requireRole('employee', 'admin', 'owner'), workLogController.create);
router.get('/', requireRole('admin', 'owner'), workLogController.listAll);
router.get('/export', requireRole('admin', 'owner'), workLogController.exportWorkLogs);
router.get('/mine', requireRole('employee'), workLogController.listMine);
router.put('/:id', requireRole('employee', 'admin', 'owner'), workLogController.update);
router.delete('/:id', requireRole('admin', 'owner'), workLogController.remove);

export default router;
