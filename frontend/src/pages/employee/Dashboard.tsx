import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Wallet, CalendarDays, ClipboardList, Layers, Clock, Timer, ListTodo, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/StatCard'
import { ProgressBar } from '@/components/ProgressBar'
import { useAuth } from '@/hooks/useAuth'
import * as dashboardApi from '@/services/dashboardApi'
import * as taskApi from '@/services/taskApi'
import { formatCurrency, formatDate } from '@/utils/format'

const RECENT_TASKS_LIMIT = 5

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isFinishing = user?.divisi === 'Finishing'
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'employee'],
    queryFn: dashboardApi.getEmployeeDashboard,
  })

  // Same query Tasks.tsx/InputPekerjaan.tsx already use (divisi-scoped
  // server-side) — sharing the cache key means this section costs nothing
  // extra once any of those pages has been visited this session.
  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks-available'],
    queryFn: taskApi.listAvailableTasks,
  })
  const recentTasks = React.useMemo(() => {
    if (!tasks) return []
    // Already sorted by deadline (soonest first) server-side — see
    // taskService.listAvailableTasks — just take the first few.
    return tasks.slice(0, RECENT_TASKS_LIMIT)
  }, [tasks])

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-heading text-xl font-semibold">Halo, {user?.name}</h1>
        <p className="text-muted-foreground text-sm">
          {isFinishing ? 'Berikut ringkasan absensimu.' : 'Berikut ringkasan pekerjaanmu.'}
        </p>
      </div>

      {isFinishing && (
        <Button asChild size="lg" className="h-14 w-full text-base">
          <Link to="/app/absensi">
            <Clock className="size-5" />
            Absen Sekarang
          </Link>
        </Button>
      )}

      {isLoading || !data ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : isFinishing ? (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Pendapatan Hari Ini" value={formatCurrency(data.income_today)} icon={Wallet} accent="success" />
          <StatCard label="Pendapatan Bulan Ini" value={formatCurrency(data.income_this_month)} icon={CalendarDays} />
          <StatCard label="Jam Kerja Hari Ini" value={`${data.hours_today ?? 0} jam`} icon={Clock} />
          <StatCard label="Jam Kerja Bulan Ini" value={`${data.hours_this_month ?? 0} jam`} icon={Timer} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Pendapatan Hari Ini" value={formatCurrency(data.income_today)} icon={Wallet} accent="success" />
          <StatCard label="Pendapatan Bulan Ini" value={formatCurrency(data.income_this_month)} icon={CalendarDays} />
          <StatCard label="Jumlah Pekerjaan" value={data.work_count_this_month} icon={ClipboardList} />
          <StatCard label="Total Quantity" value={data.total_quantity_this_month} icon={Layers} />
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold">Tugas Terbaru</h2>
          <Link to="/app/tasks" className="text-primary flex items-center text-xs font-medium hover:underline">
            Lihat semua <ChevronRight className="size-3.5" />
          </Link>
        </div>

        {tasksLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : recentTasks.length === 0 ? (
          <Card className="shadow-none">
            <CardContent className="text-muted-foreground flex flex-col items-center gap-2 py-6 text-center text-sm">
              <ListTodo className="size-6" />
              Belum ada tugas untuk divisimu.
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {recentTasks.map((task) => {
              const clickable = !isFinishing
              return (
                <Card
                  key={task.id}
                  className={clickable ? 'shadow-sm cursor-pointer transition-colors hover:bg-muted/40' : 'shadow-sm'}
                  onClick={clickable ? () => navigate(`/app/input?task_id=${task.id}`) : undefined}
                >
                  <CardContent className="flex flex-col gap-2 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{task.order_name}</p>
                        {task.customer_name && (
                          <p className="text-muted-foreground text-xs">{task.customer_name}</p>
                        )}
                      </div>
                      {task.deadline && (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground shrink-0">
                          {formatDate(task.deadline)}
                        </Badge>
                      )}
                    </div>
                    <ProgressBar value={task.progress} status={task.status} />
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <Card className="shadow-sm">
        <CardContent className="text-muted-foreground text-sm">
          {isFinishing
            ? 'Tips: jangan lupa check-out setelah selesai bekerja agar jam kerjamu tercatat dengan akurat.'
            : 'Tips: catat pekerjaanmu segera setelah selesai agar perhitungan gaji selalu akurat dan up to date.'}
        </CardContent>
      </Card>
    </div>
  )
}
