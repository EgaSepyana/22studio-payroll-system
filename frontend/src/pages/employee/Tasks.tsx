import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { PlusCircle, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ProgressBar } from '@/components/ProgressBar'
import { OrderTaskStatusBadge } from '@/components/OrderTaskStatusBadge'
import { useAuth } from '@/hooks/useAuth'
import * as taskApi from '@/services/taskApi'
import { getErrorMessage } from '@/services/api'
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

function TaskCard({ task, canUpdateProgress, onUpdateProgress }: {
  task: Task
  canUpdateProgress: boolean
  onUpdateProgress: (task: Task) => void
}) {
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
        {canUpdateProgress && task.status !== 'completed' && (
          <Button size="sm" variant="outline" onClick={() => onUpdateProgress(task)}>
            <PlusCircle className="size-4" /> Update Progress
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function UpdateProgressDialog({ task, onOpenChange }: { task: Task | null; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const [quantity, setQuantity] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (task) setQuantity('')
  }, [task])

  const mutation = useMutation({
    mutationFn: (qty: number) => taskApi.addTaskProgress(task!.id, qty),
    onSuccess: () => {
      toast.success('Progress berhasil diperbarui')
      queryClient.invalidateQueries({ queryKey: ['tasks-available'] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const qty = Number(quantity)
    if (!(qty > 0)) return setError('Quantity harus lebih dari 0')
    if (task && qty > task.remaining_qty) return setError(`Quantity melebihi sisa target (sisa ${task.remaining_qty})`)
    setError(null)
    mutation.mutate(qty)
  }

  return (
    <Dialog open={!!task} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Update Progress</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <div>
            <p className="text-sm font-medium">{task?.order_name}</p>
            <p className="text-muted-foreground text-xs">
              {task?.description || 'Tanpa deskripsi'} — sisa {task?.remaining_qty}
            </p>
          </div>
          <Input
            type="number"
            min={1}
            max={task?.remaining_qty}
            placeholder="Quantity"
            className="h-12 text-base"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            autoFocus
          />
          {error && <p className="text-destructive text-xs">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function Tasks() {
  const { user } = useAuth()
  const isFinishing = user?.divisi === 'Finishing'
  const [progressTask, setProgressTask] = React.useState<Task | null>(null)

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks-available'],
    queryFn: taskApi.listAvailableTasks,
  })

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-semibold">Tugas</h1>
        <p className="text-muted-foreground text-sm">
          {isFinishing
            ? 'Daftar tugas untuk divisimu. Update progress langsung pada task ini.'
            : 'Daftar tugas untuk divisimu. Input pekerjaan pada task ini lewat halaman Input Pekerjaan.'}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : tasks?.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">Belum ada tugas untuk divisimu.</p>
        ) : (
          tasks?.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              canUpdateProgress={isFinishing}
              onUpdateProgress={setProgressTask}
            />
          ))
        )}
      </div>

      <UpdateProgressDialog task={progressTask} onOpenChange={(open) => !open && setProgressTask(null)} />
    </div>
  )
}
