import { Router } from 'express';
import * as customerController from '../controllers/customerController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', customerController.list);
router.post('/', requireRole('admin', 'owner'), customerController.create);
router.put('/:id', requireRole('admin', 'owner'), customerController.update);
router.put('/:id/categories', requireRole('admin', 'owner'), customerController.setCategories);
router.delete('/:id', requireRole('admin', 'owner'), customerController.remove);

export default router;
