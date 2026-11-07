import { Router } from 'express';
import * as ownerIncomeController from '../controllers/ownerIncomeController.js';
import { requireAuth, allow, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', allow({ roles: ['owner'], scope: 'finance:read' }), ownerIncomeController.list);
router.post('/', allow({ roles: ['owner'], scope: 'income:create' }), ownerIncomeController.create);
router.delete('/:id', requireRole('owner'), ownerIncomeController.remove);

export default router;
