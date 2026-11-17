import { Router } from 'express';
import * as orderController from '../controllers/orderController.js';
import { requireAuth, allow, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.post('/', allow({ roles: ['admin', 'admin_produksi', 'owner'], scope: 'orders:write' }), orderController.create);
router.get('/', allow({ roles: ['admin', 'admin_produksi', 'owner', 'employee'], scope: 'orders:read' }), orderController.list);
router.get('/:id', allow({ roles: ['admin', 'admin_produksi', 'owner', 'employee'], scope: 'orders:read' }), orderController.detail);
router.get('/:id/invoice-pdf', allow({ roles: ['admin', 'admin_produksi', 'owner'], scope: 'invoice:read' }), orderController.invoicePdf);
router.get('/:id/invoice-excel', allow({ roles: ['admin', 'admin_produksi', 'owner'], scope: 'invoice:read' }), orderController.invoiceExcel);
router.patch('/:id/status', allow({ roles: ['admin', 'admin_produksi', 'owner'], scope: 'orders:status' }), orderController.updateStatus);
router.patch('/:id/publish-consent', allow({ roles: ['admin', 'owner'], scope: 'orders:publish-flag' }), orderController.updatePublishConsent);
router.put('/:id', allow({ roles: ['admin', 'admin_produksi', 'owner'], scope: 'orders:write' }), orderController.update);
router.delete('/:id', requireRole('admin', 'admin_produksi', 'owner'), orderController.remove);

router.post('/:id/items', allow({ roles: ['admin', 'admin_produksi', 'owner'], scope: 'orders:items' }), orderController.addItem);
router.post('/:id/items/template', allow({ roles: ['admin', 'admin_produksi', 'owner'], scope: 'orders:items' }), orderController.addItemTemplate);
router.put('/:id/items/:itemId', allow({ roles: ['admin', 'admin_produksi', 'owner'], scope: 'orders:items' }), orderController.updateItem);
router.delete('/:id/items/:itemId', requireRole('admin', 'admin_produksi', 'owner'), orderController.removeItem);

router.post('/:id/items/:itemId/sizes', allow({ roles: ['admin', 'admin_produksi', 'owner'], scope: 'orders:items' }), orderController.addSize);
router.put('/:id/items/:itemId/sizes/:sizeId', allow({ roles: ['admin', 'admin_produksi', 'owner'], scope: 'orders:items' }), orderController.updateSize);
router.delete('/:id/items/:itemId/sizes/:sizeId', requireRole('admin', 'admin_produksi', 'owner'), orderController.removeSize);

router.get('/:id/dp/preview-pelunasan', allow({ roles: ['admin', 'admin_produksi', 'owner'], scope: 'invoice:read' }), orderController.previewPelunasan);
router.post('/:id/dp', allow({ roles: ['admin', 'admin_produksi', 'owner'], scope: 'dp:create' }), orderController.addDP);
router.put('/:id/dp/:dpId', requireRole('admin', 'admin_produksi', 'owner'), orderController.updateDP);
router.delete('/:id/dp/:dpId', requireRole('admin', 'admin_produksi', 'owner'), orderController.removeDP);

router.post('/:id/follow-up', allow({ roles: ['admin', 'admin_produksi', 'owner'], scope: 'followup:draft' }), orderController.followUp);
router.get('/:id/timeline', allow({ roles: ['admin', 'admin_produksi', 'owner', 'employee'], scope: 'orders:read' }), orderController.timeline);
router.get('/:id/tracking-link', allow({ roles: ['admin', 'admin_produksi', 'owner'], scope: 'tracking-link:read' }), orderController.trackingLink);

export default router;
