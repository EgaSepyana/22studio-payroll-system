import { NotificationsRepo } from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';

function clean(record) {
  const { _rowNumber, ...rest } = record;
  return { ...rest, is_read: rest.is_read === 'true' };
}

// Cutting employees submitting their own work is the one trigger today (see
// workLogService.createWorkLog) — kept as a small typed helper rather than a
// generic "createNotification(type, ...)" so each notification kind's exact
// shape (what goes in title/message/related_id) is defined once, in one
// place, instead of being assembled ad hoc at each call site.
export async function notifyCuttingAuditNeeded({ workLogId, employeeName, orderName }) {
  await NotificationsRepo.insert({
    type: 'cutting_audit',
    title: 'Audit Cutting Diperlukan',
    message: `${employeeName} mengirim laporan pekerjaan Cutting untuk "${orderName}" — perlu audit.`,
    related_id: workLogId,
    is_read: 'false',
    created_at: new Date().toISOString(),
  });
}

// Shared inbox (see NOTIFICATION_RECIPIENT_ROLES) — every caller gets the
// same rows regardless of which of the 3 roles they are, so this takes no
// user/role argument at all.
export async function listNotifications({ unread_only } = {}) {
  let rows = await NotificationsRepo.getAll();
  if (unread_only) rows = rows.filter((r) => r.is_read !== 'true');
  rows = rows.map(clean).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return rows;
}

export async function getUnreadCount() {
  const rows = await NotificationsRepo.getAll();
  return rows.filter((r) => r.is_read !== 'true').length;
}

export async function markAsRead(id) {
  const updated = await NotificationsRepo.updateById(id, { is_read: 'true' });
  if (!updated) throw new ApiError(404, 'Notifikasi tidak ditemukan');
  return clean(updated);
}

// Shared read state: read-all marks every currently-unread row read in one
// batch, for whichever of the 3 roles clicked it — not scoped per-user.
export async function markAllAsRead() {
  const rows = await NotificationsRepo.getAll();
  const unread = rows.filter((r) => r.is_read !== 'true');
  await Promise.all(unread.map((r) => NotificationsRepo.updateById(r.id, { is_read: 'true' })));
  return { updated: unread.length };
}
