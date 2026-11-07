import { Router } from 'express';
import * as ownerCashController from '../controllers/ownerCashController.js';
import { requireAuth, allow } from '../middleware/auth.js';

// Deliberately separate from ownerCashRoutes.js (owner-only) — this exposes
// just the active-accounts list, read-only, to the non-owner roles that need
// to tag a cash account on a payment (Order Pembayaran, Payroll mark-as-paid)
// without granting access to cash-account management or balances.
const router = Router();
router.use(requireAuth);

router.get('/', allow({ roles: ['admin', 'admin_produksi', 'owner'], scope: 'finance:read' }), ownerCashController.listActiveAccountsForTagging);

export default router;
