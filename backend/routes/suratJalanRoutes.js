import { Router } from 'express';
import * as suratJalanController from '../controllers/suratJalanController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole('admin'));

router.post('/', suratJalanController.create);
router.get('/', suratJalanController.list);
router.get('/:id', suratJalanController.detail);
router.get('/:id/pdf', suratJalanController.pdf);
router.put('/:id', suratJalanController.update);
router.delete('/:id', suratJalanController.remove);

router.post('/:id/items', suratJalanController.addItem);
router.put('/:id/items/:itemId', suratJalanController.updateItem);
router.delete('/:id/items/:itemId', suratJalanController.removeItem);

export default router;
