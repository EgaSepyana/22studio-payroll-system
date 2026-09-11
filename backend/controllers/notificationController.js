import { z } from 'zod';
import * as notificationService from '../services/notificationService.js';
import { ok } from '../utils/response.js';
import { env } from '../config/env.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

const POLL_INTERVAL_MS = 1000;
// Sent on every idle poll tick as an SSE comment (a line starting with ':'
// — no `data:`, so EventSource's onmessage never fires for it). Its only
// purpose is keeping intermediate proxies/load balancers from deciding the
// connection is dead and closing it out from under us before our own
// planned close.
const KEEP_ALIVE_COMMENT = ': keep-alive\n\n';

// One SSE connection, held open for env.sseHoldMs (see that constant's
// comment — Vercel's function timeout, not a design choice) and then
// cleanly ended. The browser's native EventSource reconnects on a clean
// server-closed stream exactly like it does on a network error — it's
// designed for exactly this "server pages out a long-lived connection into
// many short ones" pattern (the `retry:` field/default backoff exists
// specifically for it), so nothing extra is needed at the client to make
// "closed -> reconnect" happen.
//
// `since` is the last queue seq (see notificationService) the client has
// already received; omitted/0 means a brand-new connection, which starts
// from the current tip rather than replaying the whole retained queue.
export async function stream(req, res, next) {
  try {
    const sinceParam = req.query.since ? Number(req.query.since) : 0;
    let cursor = sinceParam > 0 ? sinceParam : await notificationService.getQueueTipSeq();

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Proxies (nginx etc.) sometimes buffer responses by default, which
      // would hold every event until the connection closes — defeating the
      // entire point of a stream. This is the conventional header to
      // disable that.
      'X-Accel-Buffering': 'no',
    });
    res.write(`retry: 2000\n\n`);

    const deadline = Date.now() + env.sseHoldMs;
    let closed = false;
    req.on('close', () => {
      closed = true;
    });

    while (!closed && Date.now() < deadline) {
      const { items, latestSeq } = await notificationService.readQueueSince(cursor);
      cursor = latestSeq;
      for (const notification of items) {
        res.write(`id: ${cursor}\n`);
        res.write(`data: ${JSON.stringify(notification)}\n\n`);
      }
      if (items.length === 0) res.write(KEEP_ALIVE_COMMENT);
      if (closed) break;
      await sleep(POLL_INTERVAL_MS);
    }

    if (!closed) res.end();
  } catch (err) {
    // Headers are very likely already flushed by the time anything here
    // could throw (the writeHead above happens immediately) — falling
    // through to the JSON error handler would try to send a second set of
    // headers and crash the request, so this ends the stream directly
    // instead of calling next(err).
    if (!res.headersSent) return next(err);
    res.end();
  }
}
