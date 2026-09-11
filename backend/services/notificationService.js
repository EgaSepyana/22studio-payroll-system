import { NotificationsRepo } from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';
import { getRedis, queueKey } from '../config/redis.js';

// One list per queue, capped so it can never grow unbounded — this is a
// short-lived relay for the SSE endpoint to drain, not a second source of
// truth. The Notifications sheet (NotificationsRepo) stays that; a client
// that missed everything in this list (e.g. it was offline longer than the
// list's depth) still gets the full picture from GET /notifications, it
// just won't have gotten the realtime push for those.
const QUEUE_KEY = queueKey('notifications:queue');
const QUEUE_SEQ_KEY = queueKey('notifications:queue:seq');
const QUEUE_MAX_LENGTH = 100;

function clean(record) {
  const { _rowNumber, ...rest } = record;
  return { ...rest, is_read: rest.is_read === 'true' };
}

// Best-effort: a Redis outage must never break notification creation — the
// sheet write above is what actually matters, this is purely the realtime
// nice-to-have on top of it. Every call site swallows its own errors rather
// than letting one bubble into the caller's request.
async function pushToQueue(notification) {
  const redis = getRedis();
  if (!redis) return; // Redis not configured — sheet-only, polling covers it.
  try {
    // seq (not the notification's own sheet id) is what SSE clients track
    // as their cursor — a plain Redis list has no built-in per-entry id the
    // way a Stream would, so this is that: a simple, always-increasing
    // counter shared by every entry ever pushed, safe to use for "give me
    // everything after N" even after old entries have aged out via LTRIM.
    const seq = await redis.incr(QUEUE_SEQ_KEY);
    const entry = JSON.stringify({ seq, notification });
    await redis.multi().rpush(QUEUE_KEY, entry).ltrim(QUEUE_KEY, -QUEUE_MAX_LENGTH, -1).exec();
  } catch (err) {
    console.error('Failed to push notification to Redis queue:', err.message);
  }
}

// Used by the SSE endpoint: everything queued after `sinceSeq` (exclusive).
// Returns [] (not an error) whenever Redis is unavailable or unconfigured —
// the SSE handler treats an empty result as "nothing new yet", identical to
// a real quiet period, so the stream just keeps polling rather than
// surfacing a connection-level error to the browser for what's meant to be
// a purely best-effort channel.
export async function readQueueSince(sinceSeq) {
  const redis = getRedis();
  if (!redis) return { items: [], latestSeq: sinceSeq };
  try {
    const raw = await redis.lrange(QUEUE_KEY, 0, -1);
    const parsed = raw.map((r) => JSON.parse(r));
    const items = parsed.filter((e) => e.seq > sinceSeq);
    const latestSeq = parsed.length > 0 ? parsed[parsed.length - 1].seq : sinceSeq;
    return { items: items.map((e) => e.notification), latestSeq };
  } catch (err) {
    console.error('Failed to read notification queue:', err.message);
    return { items: [], latestSeq: sinceSeq };
  }
}

// The SSE endpoint's very first call for a newly-opened connection with no
// cursor yet — it must NOT replay the whole queue (a client just opening
// its first tab would get flooded with everything already in the last-100
// buffer). Only the current tip, so only genuinely new items after this
// point ever get streamed to it.
export async function getQueueTipSeq() {
  const redis = getRedis();
  if (!redis) return 0;
  try {
    const value = await redis.get(QUEUE_SEQ_KEY);
    return value ? Number(value) : 0;
  } catch (err) {
    console.error('Failed to read notification queue tip:', err.message);
    return 0;
  }
}

// Cutting employees submitting their own work is the one trigger today (see
// workLogService.createWorkLog) — kept as a small typed helper rather than a
// generic "createNotification(type, ...)" so each notification kind's exact
// shape (what goes in title/message/related_id) is defined once, in one
// place, instead of being assembled ad hoc at each call site.
export async function notifyCuttingAuditNeeded({ workLogId, employeeName, orderName }) {
  const notification = await NotificationsRepo.insert({
    type: 'cutting_audit',
    title: 'Audit Cutting Diperlukan',
    message: `${employeeName} mengirim laporan pekerjaan Cutting untuk "${orderName}" — perlu audit.`,
    related_id: workLogId,
    is_read: 'false',
    created_at: new Date().toISOString(),
  });
  await pushToQueue(clean(notification));
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
