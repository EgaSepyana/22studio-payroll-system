import { Router } from 'express';
import * as customerController from '../controllers/customerController.js';
import { requireAuth, allow, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', allow({ scope: 'customers:read' }), customerController.list);
router.post('/', allow({ roles: ['admin', 'owner'], scope: 'customers:write' }), customerController.create);
router.put('/:id', allow({ roles: ['admin', 'owner'], scope: 'customers:write' }), customerController.update);
router.put('/:id/categories', allow({ roles: ['admin', 'owner'], scope: 'customers:write' }), customerController.setCategories);
router.delete('/:id', requireRole('admin', 'owner'), customerController.remove);

export default router;
