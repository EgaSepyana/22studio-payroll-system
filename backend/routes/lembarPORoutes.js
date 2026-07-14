import { Router } from 'express';
import * as lembarPOController from '../controllers/lembarPOController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole('admin'));

router.post('/', lembarPOController.create);
router.get('/', lembarPOController.list);
router.get('/:id', lembarPOController.detail);
router.get('/:id/pdf', lembarPOController.pdf);
router.put('/:id', lembarPOController.update);
router.delete('/:id', lembarPOController.remove);

export default router;
