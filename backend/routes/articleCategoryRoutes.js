import { Router } from 'express';
import * as articleCategoryController from '../controllers/articleCategoryController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', articleCategoryController.list);
router.post('/', requireRole('admin', 'owner'), articleCategoryController.create);
router.put('/:id', requireRole('admin', 'owner'), articleCategoryController.update);
router.put('/:id/customers', requireRole('admin', 'owner'), articleCategoryController.setCustomers);
router.delete('/:id', requireRole('admin', 'owner'), articleCategoryController.remove);

export default router;
