import { Router } from 'express';
import * as cmsController from '../controllers/cmsController.js';
import { requireAuth, allow, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/general', allow({ roles: ['admin', 'owner'], scope: 'cms:read' }), cmsController.getGeneral);
router.put('/general', allow({ roles: ['admin', 'owner'], scope: 'cms:write' }), cmsController.updateGeneral);
router.get('/founders-promise', allow({ roles: ['admin', 'owner'], scope: 'cms:read' }), cmsController.getFoundersPromise);
router.put('/founders-promise', allow({ roles: ['admin', 'owner'], scope: 'cms:write' }), cmsController.updateFoundersPromise);
router.get('/contact-info', allow({ roles: ['admin', 'owner'], scope: 'cms:read' }), cmsController.getContactInfo);
router.put('/contact-info', allow({ roles: ['admin', 'owner'], scope: 'cms:write' }), cmsController.updateContactInfo);

// Generic per-section CRUD + reorder — :section is validated against the
// known section keys inside cmsService.getRepo (throws 404 otherwise).
router.get('/:section', allow({ roles: ['admin', 'owner'], scope: 'cms:read' }), cmsController.list);
router.post('/:section', allow({ roles: ['admin', 'owner'], scope: 'cms:write' }), cmsController.create);
router.put('/:section/reorder', allow({ roles: ['admin', 'owner'], scope: 'cms:write' }), cmsController.reorder);
router.put('/:section/:id', allow({ roles: ['admin', 'owner'], scope: 'cms:write' }), cmsController.update);
router.delete('/:section/:id', requireRole('admin', 'owner'), cmsController.remove);

export default router;
