import { Router } from 'express';
import * as employeeController from '../controllers/employeeController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', employeeController.list);
router.get('/:id', employeeController.getOne);
router.post('/', employeeController.create);
router.put('/:id', employeeController.update);
router.delete('/:id', employeeController.remove);

export default router;
