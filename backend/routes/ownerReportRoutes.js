import { Router } from 'express';
import * as ownerReportController from '../controllers/ownerReportController.js';
import { requireAuth, allow } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/profit-loss', allow({ roles: ['owner'], scope: 'reports:read' }), ownerReportController.getProfitLoss);
router.get('/balance-sheet', allow({ roles: ['owner'], scope: 'reports:read' }), ownerReportController.getBalanceSheet);

export default router;
