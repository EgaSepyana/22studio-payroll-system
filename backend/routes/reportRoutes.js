import { Router } from 'express';
import * as reportController from '../controllers/reportController.js';
import { requireAuth, allow } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', allow({ roles: ['admin', 'owner'], scope: 'reports:read' }), reportController.generate);
router.get('/export', allow({ roles: ['admin', 'owner'], scope: 'reports:read' }), reportController.exportReport);

export default router;
