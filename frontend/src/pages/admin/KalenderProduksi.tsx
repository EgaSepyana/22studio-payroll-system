import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useCalendarApp, DayFlowCalendar, createMonthView, createEventsPlugin, createAllDayEvent, ViewType } from '@dayflow/react'
import type { Event as CalendarEvent } from '@dayflow/core'
import '@dayflow/core/dist/styles.components.css'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import * as orderApi from '@/services/orderApi'

const CALENDARS = [
  {
    id: 'start',
    name: 'Order Dibuat',
    colors: {
      lineColor: '#2563eb',
      eventColor: '#dbeafe',
      eventSelectedColor: '#bfdbfe',
      textColor: '#1e3a8a',
    },
  },
  {
    id: 'deadline',
    name: 'Deadline',
    colors: {
      lineColor: '#dc2626',
      eventColor: '#fee2e2',
      eventSelectedColor: '#fecaca',
      textColor: '#7f1d1d',
    },
  },
]

export default function KalenderProduksi() {
  const navigate = useNavigate()
  const {
    data: orders,
    isLoading,
    dataUpdatedAt,
  } = useQuery({ queryKey: ['order-list', {}], queryFn: () => orderApi.listOrders() })

  const events = React.useMemo(() => {
    if (!orders) return []
    const result: CalendarEvent[] = []
    for (const order of orders) {
      if (order.created_at) {
        result.push(
          createAllDayEvent(`start-${order.id}`, `Mulai: ${order.order_name}`, new Date(order.created_at), {
            calendarId: 'start',
            meta: { orderId: order.id },
          })
        )
      }
      if (order.deadline) {
        result.push(
          createAllDayEvent(`deadline-${order.id}`, `Deadline: ${order.order_name}`, new Date(order.deadline), {
            calendarId: 'deadline',
            meta: { orderId: order.id },
          })
        )
      }
    }
    return result
  }, [orders])

  // useCalendarApp only builds the calendar instance on its first call and
  // otherwise ignores config changes — the first render happens while
  // `orders` is still loading (events = []), so without forcing a rebuild
  // via `version` once real data arrives, the calendar would keep showing
  // that stale empty state until the component fully remounts (e.g.
  // navigating away and back).
  const calendar = useCalendarApp(
    {
      views: [createMonthView()],
      plugins: [createEventsPlugin()],
      calendars: CALENDARS,
      events,
      defaultView: ViewType.MONTH,
      initialDate: new Date(),
      readOnly: true,
      callbacks: {
        onEventClick: (event) => {
          const orderId = event.meta?.orderId
          if (orderId) navigate(`/admin/order/${orderId}`)
        },
      },
    },
    dataUpdatedAt
  )

  return (
    <div>
      <PageHeader
        title="Kalender Produksi"
        description="Lihat jadwal mulai dan deadline order dalam tampilan kalender"
        breadcrumbs={[{ label: 'Dashboard', to: '/admin' }, { label: 'Kalender Produksi' }]}
      />

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <Skeleton className="h-[600px] w-full" />
          ) : (
            <div className="h-[720px]">
              <DayFlowCalendar calendar={calendar} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
