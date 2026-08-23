import { Router } from 'express';
import * as ownerCashController from '../controllers/ownerCashController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole('owner'));

router.get('/accounts', ownerCashController.listAccounts);
router.post('/accounts', ownerCashController.createAccount);
router.put('/accounts/:id', ownerCashController.updateAccount);
router.delete('/accounts/:id', ownerCashController.removeAccount);
router.get('/accounts/balances', ownerCashController.getBalances);

router.get('/transfers', ownerCashController.listTransfers);
router.post('/transfers', ownerCashController.createTransfer);
router.put('/transfers/:id', ownerCashController.updateTransfer);
router.delete('/transfers/:id', ownerCashController.removeTransfer);

router.get('/reconciliations', ownerCashController.listReconciliations);
router.get('/reconciliations/preview-balance', ownerCashController.previewSystemBalance);
router.post('/reconciliations', ownerCashController.createReconciliation);
router.delete('/reconciliations/:id', ownerCashController.removeReconciliation);

export default router;
