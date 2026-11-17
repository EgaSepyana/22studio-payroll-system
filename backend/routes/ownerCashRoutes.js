import { Router } from 'express';
import * as ownerCashController from '../controllers/ownerCashController.js';
import { requireAuth, allow, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/accounts', allow({ roles: ['owner'], scope: 'finance:read' }), ownerCashController.listAccounts);
router.post('/accounts', requireRole('owner'), ownerCashController.createAccount);
router.put('/accounts/:id', requireRole('owner'), ownerCashController.updateAccount);
router.delete('/accounts/:id', requireRole('owner'), ownerCashController.removeAccount);
router.get('/accounts/balances', allow({ roles: ['owner'], scope: 'finance:read' }), ownerCashController.getBalances);

router.get('/transfers', allow({ roles: ['owner'], scope: 'finance:read' }), ownerCashController.listTransfers);
router.post('/transfers', allow({ roles: ['owner'], scope: 'cash:transfer' }), ownerCashController.createTransfer);
router.put('/transfers/:id', requireRole('owner'), ownerCashController.updateTransfer);
router.delete('/transfers/:id', requireRole('owner'), ownerCashController.removeTransfer);

router.get('/reconciliations', allow({ roles: ['owner'], scope: 'finance:read' }), ownerCashController.listReconciliations);
router.get('/reconciliations/preview-balance', allow({ roles: ['owner'], scope: 'finance:read' }), ownerCashController.previewSystemBalance);
router.post('/reconciliations', allow({ roles: ['owner'], scope: 'cash:reconcile' }), ownerCashController.createReconciliation);
router.delete('/reconciliations/:id', requireRole('owner'), ownerCashController.removeReconciliation);

export default router;
