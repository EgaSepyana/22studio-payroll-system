# Notification System — Architecture Notes & Future Improvements

## Current implementation (as of this writing)

The notification feature (cutting-audit reminders for admin/owner) is
**Redis-queue-backed SSE, with polling as a slow safety net**:

- Backend:
  - `Notifications` sheet (`notificationService.js`) stays the source of
    truth — `GET /api/notifications`, `GET /api/notifications/unread-count`,
    `POST /api/notifications/:id/read`, `POST /api/notifications/read-all`.
  - Every notification insert also `RPUSH`es a JSON payload (with a
    monotonic `seq`, via `INCR`) onto a Redis list (`config/redis.js`,
    `ioredis`), capped to the most recent 100 entries via `LTRIM`. This is a
    short-lived relay for the stream below to drain, not a second source of
    truth — a client that missed everything in the list still gets the full
    picture from `GET /notifications`, it just won't have gotten the
    realtime push for those specific ones.
  - `GET /api/notifications/stream` — an SSE endpoint. Auth arrives as a
    `?token=` query param (`requireAuthQueryOrHeader` in `middleware/auth.js`)
    since `EventSource` cannot set an `Authorization` header. It polls the
    Redis list every 1s for entries past the client's `?since=<seq>` cursor,
    writes them as SSE `data:` events (with `id: <seq>`), sends
    `: keep-alive` comments on idle ticks, and cleanly ends the response
    after `env.sseHoldMs` (default 8000ms).
- Frontend:
  - `useNotificationStream.ts` opens a real `EventSource` to that endpoint.
    When the server closes the connection (its planned close, not a real
    failure), `EventSource` treats it exactly like a network error and
    reconnects on its own — its native `retry:`-driven backoff is what makes
    "many short connections stitched together" behave like one continuous
    stream, no manual reconnect logic needed. Each reconnect carries the
    last-seen `seq` forward via `?since=`, so nothing is replayed twice and
    nothing pushed during the gap between two connections is missed (as
    long as it's still within the retained 100-entry window).
  - `NotificationBell.tsx` still also polls `GET /api/notifications` every
    60s via React Query — a slow safety net, not the primary delivery path
    anymore. It covers two things SSE alone doesn't: Redis being
    unreachable (the stream then just idles on keep-alives, forever, with
    nothing surfacing without the poll), and a read/unread change made in
    another tab.

### Why not a plain persistent WebSocket/SSE connection

This backend deploys to **Vercel serverless functions**
(`vercel.json` routes `/api/*` to `/api/index`). A serverless function
cannot hold *any* connection open indefinitely — WebSocket or SSE — because
there's no persistent process backing it between requests; the platform
kills the invocation once its timeout is hit (Hobby plan: hard-capped at
10s regardless of any per-route config; Pro: up to 300s; Enterprise: up to
900s). Redis doesn't change this — it solves cross-instance fan-out (many
separate function invocations all seeing the same event), not "how long can
one invocation stay alive".

**`env.sseHoldMs` currently defaults to 8000ms specifically because this
project is believed to be on the Vercel Hobby plan** (hard 10s cap). If it's
ever moved to Pro or higher, bump `NOTIFICATION_SSE_HOLD_MS` well past 8000
(e.g. 25000–30000) to cut down on reconnect/function-invocation frequency —
no code change needed, just the env var.

## Recommended path if this ever needs to go further: a managed realtime service

The Redis+SSE design above gets close to real push semantics (typically
sub-2-second latency, since the poll loop ticks every 1s) without a new paid
service, but it's still fundamentally "reconnect every few seconds" under
the hood, and it stops updating the moment the tab isn't open — there's no
push-when-closed capability. If either of those ever becomes a real problem:

- **Pusher** (Channels) or **Ably** — the backend publishes an event
  (`cutting_audit.created`) to a channel from the same place
  `pushToQueue`/`notifyCuttingAuditNeeded` already writes; the browser
  subscribes directly to that channel over the vendor's own persistent
  connection (they, not this backend, hold the long-lived socket). True
  push, no reconnect cycling, at the cost of a new external
  account/dependency (API keys, a pricing tier to watch).
- **Supabase Realtime** — if this project ever migrates off Google Sheets
  onto Postgres, Supabase's realtime layer can push row-insert events on the
  `notifications` table directly, no separate publish step needed.

## Smaller, incremental improvements (no new infra needed)

- **Push notifications when the tab is closed**: would need the Web Push
  API + a service worker + VAPID keys — independent of the transport
  question above.
- **More notification types**: `NOTIFICATION_TYPES`/`AppNotification.type`
  are already designed as an open enum specifically so new kinds (e.g.
  "kasbon needs approval", "order deadline approaching") can be added later
  without a schema change — extend the type union, add a case to
  `notifyXyz(...)` in `notificationService.js` (remembering to call
  `pushToQueue` there too), and a case to `iconForType`/
  `targetForNotification` in `NotificationBell.tsx`.
- **Notification pruning**: `Notifications` currently grows forever (no
  delete/archive path). Once volume matters, add a cutoff (e.g. auto-delete
  read notifications older than N days) so the sheet doesn't grow unbounded.
- **REDIS_QUEUE_DB note**: Upstash Redis only supports database 0 — a real
  `SELECT` is rejected. `REDIS_QUEUE_DB` is used as a logical key-namespace
  prefix instead (`config/redis.js`'s `queueKey()`), not passed to the
  client as an actual `db` option. Worth remembering if this ever moves to
  a different Redis provider that *does* support multiple real databases —
  at that point `queueKey()` could be swapped for a real `db` connection
  option instead of a prefix, transparently to every caller.
