import { Router } from 'express';
import * as notificationController from '../controllers/notificationController.js';
import { requireAuth, requireAuthQueryOrHeader, requireRole } from '../middleware/auth.js';

const router = Router();
// Shared inbox — same roles that manage Cutting audits (see
// NOTIFICATION_RECIPIENT_ROLES), no per-user scoping.
const requireRecipient = requireRole('admin', 'owner');

// EventSource can't send an Authorization header, so /stream alone uses the
// query-param-or-header variant instead of this router's usual
// requireAuth — see that middleware's comment. Every other route below
// keeps the normal header-only auth.
router.get('/stream', requireAuthQueryOrHeader, requireRecipient, notificationController.stream);

router.use(requireAuth);
router.use(requireRecipient);

router.get('/', notificationController.list);
router.get('/unread-count', notificationController.unreadCount);
router.post('/:id/read', notificationController.markRead);
router.post('/read-all', notificationController.markAllRead);

export default router;
