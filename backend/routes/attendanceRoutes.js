import { Router } from 'express';
import * as attendanceController from '../controllers/attendanceController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.post('/check-in', requireRole('employee'), attendanceController.checkIn);
router.patch('/check-out', requireRole('employee'), attendanceController.checkOut);
router.get('/today', requireRole('employee'), attendanceController.today);
router.get('/mine', requireRole('employee'), attendanceController.mine);

router.get('/', requireRole('admin', 'owner'), attendanceController.list);
router.post('/', requireRole('admin', 'owner'), attendanceController.create);
router.put('/:id', requireRole('admin', 'owner'), attendanceController.update);
router.delete('/:id', requireRole('admin', 'owner'), attendanceController.remove);

export default router;
