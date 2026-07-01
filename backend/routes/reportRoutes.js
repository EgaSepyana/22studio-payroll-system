import { Router } from 'express';
import * as reportController from '../controllers/reportController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', reportController.generate);
router.get('/export', reportController.exportReport);

export default router;
