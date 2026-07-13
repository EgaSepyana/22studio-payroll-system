import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ProgressBar } from '@/components/ProgressBar'
import { OrderTaskStatusBadge } from '@/components/OrderTaskStatusBadge'
import * as taskApi from '@/services/taskApi'
import type { Task } from '@/types'

function TaskCard({ task }: { task: Task }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">{task.order_name}</p>
            <p className="text-muted-foreground text-xs">{task.description || 'Tanpa deskripsi'}</p>
          </div>
          <OrderTaskStatusBadge status={task.status} />
        </div>
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
