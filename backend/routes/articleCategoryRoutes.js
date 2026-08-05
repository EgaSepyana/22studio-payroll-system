import { Router } from 'express';
import * as articleCategoryController from '../controllers/articleCategoryController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', articleCategoryController.list);
router.post('/', requireRole('admin'), articleCategoryController.create);
router.put('/:id', requireRole('admin'), articleCategoryController.update);
router.put('/:id/customers', requireRole('admin'), articleCategoryController.setCustomers);
router.delete('/:id', requireRole('admin'), articleCategoryController.remove);

export default router;
