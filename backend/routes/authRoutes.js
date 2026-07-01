import { Router } from 'express';
import {
  loginHandler,
  logoutHandler,
  changePasswordHandler,
  meHandler,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/login', loginHandler);
router.post('/logout', logoutHandler);
router.put('/change-password', requireAuth, changePasswordHandler);
router.get('/me', requireAuth, meHandler);

export default router;
