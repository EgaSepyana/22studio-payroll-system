import { Router } from 'express';
import * as settingsController from '../controllers/settingsController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/bank-account', settingsController.getBankAccount);
router.put('/bank-account', settingsController.updateBankAccount);

router.get('/wa-templates', settingsController.listWATemplates);
router.put('/wa-templates/:templateKey', settingsController.updateWATemplate);

export default router;
