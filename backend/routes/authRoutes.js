import { Router } from 'express';
import {
  loginHandler,
  logoutHandler,
  changePasswordHandler,
  meHandler,
} from '../controllers/authController.js';
import { requireAuth, requireHuman } from '../middleware/auth.js';

const router = Router();

router.post('/login', loginHandler);
router.post('/logout', logoutHandler);
router.put('/change-password', requireAuth, requireHuman, changePasswordHandler);
router.get('/me', requireAuth, requireHuman, meHandler);

export default router;
