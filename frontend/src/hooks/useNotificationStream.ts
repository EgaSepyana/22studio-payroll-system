import * as React from 'react'
import type { AppNotification } from '@/types'

// Backend holds each SSE connection open for only a few seconds (Vercel's
// serverless function timeout — see backend env.sseHoldMs) and then ends it
// cleanly. That's by design, not a bug: EventSource treats a clean
// server-close exactly like a network drop and reconnects on its own using
// its built-in retry/backoff (the `retry:` field the stream sends sets the
// delay) — so "one long real connection" here is really "many short ones,
// stitched together by the browser", invisible to everything below.
//
// `since` (the last queue position received) is threaded through each
// reconnect via the URL's `since` param so a new connection resumes from
// exactly where the last one left off instead of either replaying history
// or missing whatever arrived in the gap between connections.
export function useNotificationStream({
  enabled,
  onNotification,
}: {
  enabled: boolean
  onNotification: (notification: AppNotification) => void
}) {
  const [connected, setConnected] = React.useState(false)
  const onNotificationRef = React.useRef(onNotification)
  onNotificationRef.current = onNotification

  React.useEffect(() => {
    if (!enabled) return

    const token = localStorage.getItem('token')
    if (!token) return

    let source: EventSource | null = null
    let cancelled = false
    let sinceSeq = 0

    function connect() {
      if (cancelled) return
      // EventSource can't send an Authorization header (see backend
      // requireAuthQueryOrHeader), so the token travels as a query param
      // instead, same tradeoff every browser-native SSE client has to make.
      const url = `/api/notifications/stream?token=${encodeURIComponent(token!)}&since=${sinceSeq}`
      source = new EventSource(url)

      source.onopen = () => setConnected(true)

      source.onmessage = (event) => {
        sinceSeq = Number(event.lastEventId) || sinceSeq
        try {
          const notification = JSON.parse(event.data) as AppNotification
          onNotificationRef.current(notification)
        } catch {
          // Malformed payload — ignore this one event rather than tearing
          // down the whole connection over it.
        }
      }

      // Covers both a real network error and the server's own planned
      // close (see this hook's top comment) — EventSource fires the same
      // 'error' event for either and already schedules its own retry, so
      // this only needs to update the UI's connected indicator, not
      // manually reconnect.
      source.onerror = () => {
        setConnected(false)
      }
    }

    connect()

    return () => {
      cancelled = true
      source?.close()
      setConnected(false)
    }
  }, [enabled])

  return { connected }
}
