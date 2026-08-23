import { Router } from 'express';
import * as orderController from '../controllers/orderController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.post('/', requireRole('admin', 'admin_produksi', 'owner'), orderController.create);
router.get('/', requireRole('admin', 'admin_produksi', 'owner', 'employee'), orderController.list);
router.get('/:id', requireRole('admin', 'admin_produksi', 'owner', 'employee'), orderController.detail);
router.get('/:id/invoice-pdf', requireRole('admin', 'admin_produksi', 'owner'), orderController.invoicePdf);
router.get('/:id/invoice-excel', requireRole('admin', 'admin_produksi', 'owner'), orderController.invoiceExcel);
router.put('/:id', requireRole('admin', 'admin_produksi', 'owner'), orderController.update);
router.delete('/:id', requireRole('admin', 'admin_produksi', 'owner'), orderController.remove);

router.post('/:id/items', requireRole('admin', 'admin_produksi', 'owner'), orderController.addItem);
router.post('/:id/items/template', requireRole('admin', 'admin_produksi', 'owner'), orderController.addItemTemplate);
router.put('/:id/items/:itemId', requireRole('admin', 'admin_produksi', 'owner'), orderController.updateItem);
router.delete('/:id/items/:itemId', requireRole('admin', 'admin_produksi', 'owner'), orderController.removeItem);

router.post('/:id/items/:itemId/sizes', requireRole('admin', 'admin_produksi', 'owner'), orderController.addSize);
router.put('/:id/items/:itemId/sizes/:sizeId', requireRole('admin', 'admin_produksi', 'owner'), orderController.updateSize);
router.delete('/:id/items/:itemId/sizes/:sizeId', requireRole('admin', 'admin_produksi', 'owner'), orderController.removeSize);

router.post('/:id/dp', requireRole('admin', 'admin_produksi', 'owner'), orderController.addDP);
router.put('/:id/dp/:dpId', requireRole('admin', 'admin_produksi', 'owner'), orderController.updateDP);
router.delete('/:id/dp/:dpId', requireRole('admin', 'admin_produksi', 'owner'), orderController.removeDP);

router.post('/:id/follow-up', requireRole('admin', 'admin_produksi', 'owner'), orderController.followUp);
router.get('/:id/timeline', requireRole('admin', 'admin_produksi', 'owner', 'employee'), orderController.timeline);
router.get('/:id/tracking-link', requireRole('admin', 'admin_produksi', 'owner'), orderController.trackingLink);

export default router;
