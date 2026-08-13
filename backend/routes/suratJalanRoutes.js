import { Router } from 'express';
import * as suratJalanController from '../controllers/suratJalanController.js';
import { requireAuth, requireRole, requireDivisi } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Finishing employees can create/view Surat Jalan and manage their items —
// admin and admin_produksi keep full access (requireDivisi bypasses both)
// plus are the only ones who can edit/delete the header itself (reassigning
// the customer or removing a document altogether stays an admin-level
// correction, not something a Finishing employee can do).
const employeeAllowed = [requireRole('admin', 'admin_produksi', 'employee'), requireDivisi('Finishing')];

router.post('/', ...employeeAllowed, suratJalanController.create);
router.get('/', ...employeeAllowed, suratJalanController.list);
router.get('/:id', ...employeeAllowed, suratJalanController.detail);
router.get('/:id/pdf', ...employeeAllowed, suratJalanController.pdf);
router.put('/:id', requireRole('admin', 'admin_produksi'), suratJalanController.update);
router.delete('/:id', requireRole('admin', 'admin_produksi'), suratJalanController.remove);

router.post('/:id/items', ...employeeAllowed, suratJalanController.addItem);
router.put('/:id/items/:itemId', ...employeeAllowed, suratJalanController.updateItem);
router.delete('/:id/items/:itemId', ...employeeAllowed, suratJalanController.removeItem);

export default router;
