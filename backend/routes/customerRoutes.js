import { Router } from 'express';
import * as customerController from '../controllers/customerController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', customerController.list);
router.post('/', requireRole('admin'), customerController.create);
router.put('/:id', requireRole('admin'), customerController.update);
router.put('/:id/categories', requireRole('admin'), customerController.setCategories);
router.delete('/:id', requireRole('admin'), customerController.remove);

export default router;
