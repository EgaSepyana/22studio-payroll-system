import { Router } from 'express';
import * as notificationController from '../controllers/notificationController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
// Shared inbox — same roles that manage Cutting audits (see
// NOTIFICATION_RECIPIENT_ROLES), no per-user scoping.
router.use(requireRole('admin', 'owner'));

router.get('/', notificationController.list);
router.get('/unread-count', notificationController.unreadCount);
router.post('/:id/read', notificationController.markRead);
router.post('/read-all', notificationController.markAllRead);

export default router;
