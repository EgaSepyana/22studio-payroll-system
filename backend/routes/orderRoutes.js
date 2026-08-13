import { Router } from 'express';
import * as orderController from '../controllers/orderController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.post('/', requireRole('admin', 'admin_produksi'), orderController.create);
router.get('/', requireRole('admin', 'admin_produksi', 'employee'), orderController.list);
router.get('/:id', requireRole('admin', 'admin_produksi', 'employee'), orderController.detail);
router.get('/:id/invoice-pdf', requireRole('admin', 'admin_produksi'), orderController.invoicePdf);
router.get('/:id/invoice-excel', requireRole('admin', 'admin_produksi'), orderController.invoiceExcel);
router.put('/:id', requireRole('admin', 'admin_produksi'), orderController.update);
router.delete('/:id', requireRole('admin', 'admin_produksi'), orderController.remove);

router.post('/:id/items', requireRole('admin', 'admin_produksi'), orderController.addItem);
router.post('/:id/items/template', requireRole('admin', 'admin_produksi'), orderController.addItemTemplate);
router.put('/:id/items/:itemId', requireRole('admin', 'admin_produksi'), orderController.updateItem);
router.delete('/:id/items/:itemId', requireRole('admin', 'admin_produksi'), orderController.removeItem);

router.post('/:id/items/:itemId/sizes', requireRole('admin', 'admin_produksi'), orderController.addSize);
router.put('/:id/items/:itemId/sizes/:sizeId', requireRole('admin', 'admin_produksi'), orderController.updateSize);
router.delete('/:id/items/:itemId/sizes/:sizeId', requireRole('admin', 'admin_produksi'), orderController.removeSize);

router.post('/:id/dp', requireRole('admin', 'admin_produksi'), orderController.addDP);
router.put('/:id/dp/:dpId', requireRole('admin', 'admin_produksi'), orderController.updateDP);
router.delete('/:id/dp/:dpId', requireRole('admin', 'admin_produksi'), orderController.removeDP);

router.post('/:id/follow-up', requireRole('admin', 'admin_produksi'), orderController.followUp);
router.get('/:id/timeline', requireRole('admin', 'admin_produksi', 'employee'), orderController.timeline);
router.get('/:id/tracking-link', requireRole('admin', 'admin_produksi'), orderController.trackingLink);

export default router;
