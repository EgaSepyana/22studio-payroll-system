import { Router } from 'express';
import * as profileController from '../controllers/profileController.js';
import { requireAuth, requireHuman } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireHuman);

router.get('/', profileController.getMe);
router.put('/', profileController.updateMe);

export default router;
