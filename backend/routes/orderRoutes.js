import { Router } from 'express';
import * as orderController from '../controllers/orderController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.post('/', requireRole('admin'), orderController.create);
router.get('/', requireRole('admin', 'employee'), orderController.list);
router.get('/:id', requireRole('admin', 'employee'), orderController.detail);
router.get('/:id/invoice-pdf', requireRole('admin'), orderController.invoicePdf);
router.put('/:id', requireRole('admin'), orderController.update);
router.delete('/:id', requireRole('admin'), orderController.remove);

router.post('/:id/items', requireRole('admin'), orderController.addItem);
router.post('/:id/items/template', requireRole('admin'), orderController.addItemTemplate);
router.put('/:id/items/:itemId', requireRole('admin'), orderController.updateItem);
router.delete('/:id/items/:itemId', requireRole('admin'), orderController.removeItem);

router.post('/:id/items/:itemId/sizes', requireRole('admin'), orderController.addSize);
router.put('/:id/items/:itemId/sizes/:sizeId', requireRole('admin'), orderController.updateSize);
router.delete('/:id/items/:itemId/sizes/:sizeId', requireRole('admin'), orderController.removeSize);

export default router;
