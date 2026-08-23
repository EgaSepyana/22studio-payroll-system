import { Router } from 'express';
import * as articleController from '../controllers/articleController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', articleController.list);
router.post('/', requireRole('admin', 'owner'), articleController.create);
router.put('/:id', requireRole('admin', 'owner'), articleController.update);
router.delete('/:id', requireRole('admin', 'owner'), articleController.remove);

export default router;
