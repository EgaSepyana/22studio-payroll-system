import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Bell, Scissors, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import * as notificationApi from '@/services/notificationApi'
import { timeAgo } from '@/utils/format'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import type { AppNotification } from '@/types'

// Matches backend NOTIFICATION_RECIPIENT_ROLES — admin_produksi is
// deliberately excluded (see that constant's comment: it can't reach
// /admin/worklogs, the click-through target, so a notification it can't act
// on would be a dead end).
const RECIPIENT_ROLES = new Set(['admin', 'owner'])

// Vercel serverless functions can't hold a WebSocket/SSE connection open, so
// "realtime" here is plain polling — see the "Peningkatan Notifikasi" doc
// (docs/notification-improvements.md) for the managed-realtime-service path
// to take if this ever needs to be genuinely push-based.
const POLL_INTERVAL_MS = 12_000

function iconForType(type: AppNotification['type']) {
  switch (type) {
    case 'cutting_audit':
      return Scissors
  }
}

// Where clicking a notification of this type should go — one place so the
// bell's list and the toast pop-up both navigate identically.
function targetForNotification(n: AppNotification): string | null {
  switch (n.type) {
    case 'cutting_audit':
      return `/admin/worklogs?openWorklogId=${n.related_id}`
    default:
      return null
  }
}

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: AppNotification
  onOpen: (n: AppNotification) => void
}) {
  const Icon = iconForType(notification.type)
  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={cn(
        'flex w-full items-start gap-3 rounded-md p-2.5 text-left transition-colors hover:bg-muted',
        !notification.is_read && 'bg-primary/5'
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
          notification.is_read ? 'bg-muted text-muted-foreground' : 'bg-primary/15 text-primary'
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className={cn('text-sm leading-tight', !notification.is_read && 'font-semibold')}>
            {notification.title}
          </span>
          {!notification.is_read && <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />}
        </span>
        <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">{notification.message}</span>
        <span className="text-muted-foreground/70 mt-1 block text-[11px]">{timeAgo(notification.created_at)}</span>
      </span>
    </button>
  )
}

export function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  // Tracks which notification ids have already triggered a toast, so a
  // background refetch that returns the same unread rows doesn't re-toast
  // them — only a genuinely new id (not seen since this tab loaded) does.
  const seenIds = React.useRef<Set<string> | null>(null)

  const enabled = !!user && RECIPIENT_ROLES.has(user.role)

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationApi.listNotifications(),
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    enabled,
  })

  React.useEffect(() => {
    if (!notifications) return
    if (seenIds.current === null) {
      // First load: seed from what's already there instead of toasting a
      // backlog of everything unread from before this tab was even open.
      seenIds.current = new Set(notifications.map((n) => n.id))
      return
    }
    const fresh = notifications.filter((n) => !n.is_read && !seenIds.current!.has(n.id))
    for (const n of fresh) {
      seenIds.current.add(n.id)
      const Icon = iconForType(n.type)
      toast.custom(
        (t) => (
          <button
            type="button"
            onClick={() => {
              toast.dismiss(t)
              handleOpen(n)
            }}
            className="border-border bg-popover text-popover-foreground flex w-full items-start gap-3 rounded-lg border p-3.5 text-left shadow-lg"
          >
            <span className="bg-primary/15 text-primary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold leading-tight">{n.title}</span>
              <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">{n.message}</span>
            </span>
          </button>
        ),
        { position: 'top-right', duration: 8000 }
      )
    }
    for (const n of notifications) seenIds.current.add(n.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications])

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationApi.markAsRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  function handleOpen(n: AppNotification) {
    if (!n.is_read) markReadMutation.mutate(n.id)
    setOpen(false)
    const target = targetForNotification(n)
    if (target) navigate(target)
  }

  const unreadCount = notifications?.filter((n) => !n.is_read).length ?? 0

  if (!enabled) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
          <span className="sr-only">Notifikasi</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <p className="text-sm font-semibold">Notifikasi</p>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              disabled={markAllReadMutation.isPending}
              onClick={() => markAllReadMutation.mutate()}
            >
              <CheckCheck className="size-3.5" /> Tandai semua dibaca
            </Button>
          )}
        </div>
        <div className="flex max-h-96 flex-col gap-0.5 overflow-y-auto p-1.5">
          {!notifications || notifications.length === 0 ? (
            <p className="text-muted-foreground px-2 py-8 text-center text-sm">Belum ada notifikasi.</p>
          ) : (
            notifications.map((n) => <NotificationRow key={n.id} notification={n} onOpen={handleOpen} />)
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
