# Notification System — Future Improvements

## Current implementation (as of this writing)

The notification feature (cutting-audit reminders for admin/owner) is built
entirely on **HTTP polling**, not a real push transport:

- Backend: `Notifications` sheet + `notificationService.js` +
  `GET /api/notifications`, `GET /api/notifications/unread-count`,
  `POST /api/notifications/:id/read`, `POST /api/notifications/read-all`.
- Frontend: `NotificationBell.tsx` polls `GET /api/notifications` every
  **12 seconds** via React Query's `refetchInterval` (plus
  `refetchOnWindowFocus`), diffs the result against previously-seen ids, and
  shows a `sonner` toast (top-right) for anything genuinely new.

This works identically in local dev and once deployed, requires no extra
infrastructure, and is "good enough" for this use case — a cutting-audit
reminder doesn't need sub-second latency. The tradeoff: up to ~12s delay
before a new notification appears, and the browser tab must be open (no
notification arrives while the app isn't loaded, and nothing is delivered
if the tab is closed — there is no push-when-closed capability at all
today).

## Why not WebSocket or SSE

This backend deploys to **Vercel serverless functions**
(`vercel.json` routes `/api/*` to `/api/index`). Serverless functions:

- Cannot hold a WebSocket connection open — there's no persistent process
  to attach a socket to between requests.
- Cannot hold a genuine Server-Sent-Events stream open either, for the same
  reason — each invocation runs, responds, and terminates; a function
  timeout (10–60s depending on plan) would kill the stream regardless.

Both would work fine in local dev (`node server.js` is a normal long-running
process), but would silently stop working the moment this app is deployed to
Vercel in its current form. Building on top of either without addressing
this first would ship something that passes every local test and then does
nothing in production.

## Recommended path: a managed realtime service

To get genuine push-based delivery (sub-second latency, works while the tab
is backgrounded, no polling overhead) without standing up and operating a
separate always-on WebSocket server, integrate a managed realtime service:

- **Pusher** (Channels) or **Ably** — the backend publishes an event
  (`cutting_audit.created`) to a channel when `notificationService` inserts
  a row; the browser subscribes directly to that channel over the vendor's
  own persistent connection (they, not this backend, hold the long-lived
  socket). Straightforward to bolt on: keep the existing `Notifications`
  sheet as the source of truth / audit log, and add a `.trigger(...)` call
  right where `notifyCuttingAuditNeeded` already inserts a row.
- **Supabase Realtime** — if this project ever migrates off Google Sheets
  onto Postgres, Supabase's realtime layer can push row-insert events on the
  `notifications` table directly, with no separate publish step needed.

Either approach removes the polling interval and the "must have the tab
open and focused within the last ~12s" caveat, at the cost of a new external
account/dependency to manage (API keys, a per-message/connection pricing
tier to watch, and one more service that can be down).

## Smaller, incremental improvements (no new infra needed)

Worth doing regardless of whether/when a realtime service gets added:

- **Push notifications when the tab is closed**: would need the Web Push
  API + a service worker + VAPID keys — independent of the realtime
  transport question above, and works even with plain polling as the
  in-tab mechanism.
- **More notification types**: `NOTIFICATION_TYPES`/`AppNotification.type`
  are already designed as an open enum specifically so new kinds (e.g.
  "kasbon needs approval", "order deadline approaching") can be added later
  without a schema change — just extend the type union, add a case to
  `notifyXyz(...)` in `notificationService.js`, and a case to
  `iconForType`/`targetForNotification` in `NotificationBell.tsx`.
- **Notification pruning**: `Notifications` currently grows forever (no
  delete/archive path). Once volume matters, add a cutoff (e.g. auto-delete
  read notifications older than N days) so the sheet doesn't grow unbounded.

 i want a improve on notification feature, i want a notification is pushed to redis queue and the SSE is listen the queue until the sse connection is closed, and if the sse is close open new sse connection again.