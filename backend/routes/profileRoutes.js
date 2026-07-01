import { Router } from 'express';
import * as profileController from '../controllers/profileController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', profileController.getMe);
router.put('/', profileController.updateMe);

export default router;
