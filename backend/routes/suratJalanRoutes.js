import { Router } from 'express';
import * as suratJalanController from '../controllers/suratJalanController.js';
import { requireAuth, allow, requireRole, requireDivisi } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Finishing employees can create/view Surat Jalan and manage their items —
// admin and admin_produksi keep full access (requireDivisi bypasses both)
// plus are the only ones who can edit/delete the header itself (reassigning
// the customer or removing a document altogether stays an admin-level
// correction, not something a Finishing employee can do).
// Agents holding the route's scope skip requireDivisi (they have no divisi).
const employeeAllowed = (scope) => [
  allow({ roles: ['admin', 'admin_produksi', 'owner', 'employee'], scope }),
  requireDivisi('Finishing'),
];

router.post('/', ...employeeAllowed('surat-jalan:write'), suratJalanController.create);
router.get('/', ...employeeAllowed('surat-jalan:read'), suratJalanController.list);
router.get('/:id', ...employeeAllowed('surat-jalan:read'), suratJalanController.detail);
router.get('/:id/pdf', ...employeeAllowed('surat-jalan:read'), suratJalanController.pdf);
router.put('/:id', allow({ roles: ['admin', 'admin_produksi', 'owner'], scope: 'surat-jalan:write' }), suratJalanController.update);
router.delete('/:id', requireRole('admin', 'admin_produksi', 'owner'), suratJalanController.remove);

router.post('/:id/items', ...employeeAllowed('surat-jalan:write'), suratJalanController.addItem);
router.put('/:id/items/:itemId', ...employeeAllowed('surat-jalan:write'), suratJalanController.updateItem);
router.delete('/:id/items/:itemId', ...employeeAllowed(), suratJalanController.removeItem);

export default router;
