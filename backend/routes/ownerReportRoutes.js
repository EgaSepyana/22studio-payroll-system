import { Router } from 'express';
import * as ownerReportController from '../controllers/ownerReportController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole('owner'));

router.get('/profit-loss', ownerReportController.getProfitLoss);
router.get('/balance-sheet', ownerReportController.getBalanceSheet);

export default router;
