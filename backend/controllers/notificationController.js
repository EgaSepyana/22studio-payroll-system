import { z } from 'zod';
import * as notificationService from '../services/notificationService.js';
import { ok } from '../utils/response.js';

const listSchema = z.object({
  unread_only: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export async function list(req, res, next) {
  try {
    const { unread_only } = listSchema.parse(req.query);
    ok(res, await notificationService.listNotifications({ unread_only }));
  } catch (err) {
    next(err);
  }
}

export async function unreadCount(req, res, next) {
  try {
    ok(res, { count: await notificationService.getUnreadCount() });
  } catch (err) {
    next(err);
  }
}

export async function markRead(req, res, next) {
  try {
    ok(res, await notificationService.markAsRead(req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function markAllRead(req, res, next) {
  try {
    ok(res, await notificationService.markAllAsRead());
  } catch (err) {
    next(err);
  }
}
