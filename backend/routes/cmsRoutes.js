import { Router } from 'express';
import * as cmsController from '../controllers/cmsController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole('admin', 'owner'));

router.get('/general', cmsController.getGeneral);
router.put('/general', cmsController.updateGeneral);
router.get('/founders-promise', cmsController.getFoundersPromise);
router.put('/founders-promise', cmsController.updateFoundersPromise);
router.get('/contact-info', cmsController.getContactInfo);
router.put('/contact-info', cmsController.updateContactInfo);

// Generic per-section CRUD + reorder — :section is validated against the
// known section keys inside cmsService.getRepo (throws 404 otherwise).
router.get('/:section', cmsController.list);
router.post('/:section', cmsController.create);
router.put('/:section/reorder', cmsController.reorder);
router.put('/:section/:id', cmsController.update);
router.delete('/:section/:id', cmsController.remove);

export default router;
