import { Router } from 'express';
import * as hppController from '../controllers/hppController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

// Kalkulator HPP: admin + owner only. No agent scope exists for it, so agent
// accounts get 403 on every route.
const router = Router();
router.use(requireAuth);

const staff = requireRole('admin', 'owner');

router.get('/fabrics', staff, hppController.listFabrics);
router.post('/fabrics', staff, hppController.createFabric);
router.put('/fabrics/:id', staff, hppController.updateFabric);
router.delete('/fabrics/:id', staff, hppController.removeFabric);

router.get('/threads', staff, hppController.listThreads);
router.post('/threads', staff, hppController.createThread);
router.put('/threads/:id', staff, hppController.updateThread);
router.delete('/threads/:id', staff, hppController.removeThread);

router.get('/calculations', staff, hppController.listCalculations);
router.post('/calculations', staff, hppController.createCalculation);
router.get('/calculations/:id', staff, hppController.getCalculation);
router.delete('/calculations/:id', staff, hppController.removeCalculation);

export default router;
