import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { ProgressBar } from '@/components/ProgressBar'
import { OrderTaskStatusBadge } from '@/components/OrderTaskStatusBadge'
import * as taskApi from '@/services/taskApi'
import { formatDate } from '@/utils/format'
import type { Task } from '@/types'

const URGENT_THRESHOLD_DAYS = 3

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const deadline = new Date(dateStr)
  deadline.setHours(0, 0, 0, 0)
  return Math.round((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function DeadlineBadge({ deadline }: { deadline: string }) {
  const days = daysUntil(deadline)
  const urgent = days < URGENT_THRESHOLD_DAYS
  return (
    <Badge variant="secondary" className={urgent ? 'bg-destructive text-white' : 'bg-muted text-muted-foreground'}>
      Deadline: {formatDate(deadline)}
    </Badge>
  )
}

function TaskCard({ task }: { task: Task }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">{task.order_name}</p>
            {task.customer_name && <p className="text-muted-foreground text-xs">{task.customer_name}</p>}
            <p className="text-muted-foreground text-xs">{task.description || 'Tanpa deskripsi'}</p>
          </div>
          <OrderTaskStatusBadge status={task.status} />
        </div>
        {task.deadline && (
          <div>
            <DeadlineBadge deadline={task.deadline} />
          </div>
        )}
        <div>
          <div className="text-muted-foreground mb-1 flex justify-between text-xs">
            <span>Progress</span>
            <span>{task.completed_qty}/{task.target_qty}</span>
          </div>
          <ProgressBar value={task.progress} status={task.status} />
        </div>
      </CardContent>
    </Card>
  )
}

export default function Tasks() {
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks-available'],
    queryFn: taskApi.listAvailableTasks,
  })

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-semibold">Tugas</h1>
        <p className="text-muted-foreground text-sm">
          Daftar tugas untuk divisimu. Input pekerjaan pada task ini lewat halaman Input Pekerjaan.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : tasks?.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">Belum ada tugas untuk divisimu.</p>
        ) : (
          tasks?.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>
    </div>
  )
}
