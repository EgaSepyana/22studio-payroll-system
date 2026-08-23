import { Router } from 'express';
import * as ownerIncomeController from '../controllers/ownerIncomeController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole('owner'));

router.get('/', ownerIncomeController.list);
router.post('/', ownerIncomeController.create);
router.delete('/:id', ownerIncomeController.remove);

export default router;
