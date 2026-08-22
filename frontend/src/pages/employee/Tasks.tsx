import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PlusCircle, Loader2, ArrowUp, ArrowDown, FileText, Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ProgressBar } from '@/components/ProgressBar'
import { OrderTaskStatusBadge } from '@/components/OrderTaskStatusBadge'
import { LembarPOPreviewDialog } from '@/components/LembarPOPreviewDialog'
import { useAuth } from '@/hooks/useAuth'
import * as taskApi from '@/services/taskApi'
import * as lembarPOApi from '@/services/lembarPOApi'
import { getErrorMessage } from '@/services/api'
import { formatDate } from '@/utils/format'
import type { Task, TaskStatus } from '@/types'

const URGENT_THRESHOLD_DAYS = 3
const ALL_CUSTOMERS = 'all'

type SortField = 'deadline' | 'status' | 'progress' | 'order_name'
type SortDirection = 'asc' | 'desc'

const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'deadline', label: 'Deadline' },
  { value: 'status', label: 'Status' },
  { value: 'progress', label: 'Progress' },
  { value: 'order_name', label: 'Nama Order' },
]

const STATUS_ORDER: Record<TaskStatus, number> = { open: 0, in_progress: 1, completed: 2 }

function compareTasks(a: Task, b: Task, field: SortField): number {
  switch (field) {
    case 'deadline':
      if (!a.deadline && !b.deadline) return 0
      if (!a.deadline) return 1
      if (!b.deadline) return -1
      return a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : 0
    case 'status':
      return STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    case 'progress':
      return a.progress - b.progress
    case 'order_name':
      return (a.order_name || '').localeCompare(b.order_name || '')
  }
}

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

function TaskCard({ task, canUpdateProgress, onUpdateProgress, hasLembarPO, onViewLembarPO, onOpenInInput }: {
  task: Task
  canUpdateProgress: boolean
  onUpdateProgress: (task: Task) => void
  hasLembarPO: boolean
  onViewLembarPO: (task: Task) => void
  onOpenInInput: ((task: Task) => void) | null
}) {
  const clickable = !!onOpenInInput
  return (
    <Card
      className={clickable ? 'shadow-sm cursor-pointer transition-colors hover:bg-muted/40' : 'shadow-sm'}
      onClick={clickable ? () => onOpenInInput(task) : undefined}
    >
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
        {(hasLembarPO || (canUpdateProgress && task.status !== 'completed')) && (
          <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
            {hasLembarPO && (
              <Button size="sm" variant="outline" onClick={() => onViewLembarPO(task)}>
                <FileText className="size-4" /> Lihat PO
              </Button>
            )}
            {canUpdateProgress && task.status !== 'completed' && (
              <Button size="sm" variant="outline" onClick={() => onUpdateProgress(task)}>
                <PlusCircle className="size-4" /> Update Progress
              </Button>
            )}
          </div>
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
  const navigate = useNavigate()
  const isFinishing = user?.divisi === 'Finishing'
  const [progressTask, setProgressTask] = React.useState<Task | null>(null)
  const [lembarPOTask, setLembarPOTask] = React.useState<Task | null>(null)
  const [sortField, setSortField] = React.useState<SortField>('deadline')
  const [sortDir, setSortDir] = React.useState<SortDirection>('asc')
  const [search, setSearch] = React.useState('')
  const [customerFilter, setCustomerFilter] = React.useState(ALL_CUSTOMERS)

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks-available'],
    queryFn: taskApi.listAvailableTasks,
  })

  // One request for the whole page — which order_ids have a Lembar PO —
  // instead of one lookup per card, so buttons don't pop in individually.
  const { data: orderIdsWithLembarPO } = useQuery({
    queryKey: ['lembar-po-order-ids'],
    queryFn: lembarPOApi.listOrderIdsWithLembarPO,
  })

  // Customer options come from the task list itself (already divisi-scoped
  // server-side) — no extra request needed just to populate this filter.
  const customerOptions = React.useMemo(() => {
    const seen = new Map<string, string>()
    for (const t of tasks || []) {
      if (t.customer_id && t.customer_name && !seen.has(t.customer_id)) {
        seen.set(t.customer_id, t.customer_name)
      }
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [tasks])

  const filteredTasks = React.useMemo(() => {
    if (!tasks) return []
    const query = search.trim().toLowerCase()
    return tasks.filter((t) => {
      if (customerFilter !== ALL_CUSTOMERS && t.customer_id !== customerFilter) return false
      if (query) {
        const haystack = `${t.order_name || ''} ${t.description || ''}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }, [tasks, search, customerFilter])

  const sortedTasks = React.useMemo(() => {
    const sorted = [...filteredTasks].sort((a, b) => compareTasks(a, b, sortField))
    return sortDir === 'asc' ? sorted : sorted.reverse()
  }, [filteredTasks, sortField, sortDir])

  // Finishing works entirely in-place (Update Progress dialog, no work log)
  // — Input Pekerjaan doesn't apply to them, so their cards stay non-clickable.
  const openInInput = isFinishing
    ? null
    : (task: Task) => navigate(`/app/input?task_id=${task.id}`)

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

      {tasks && tasks.length > 0 && (
        <>
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              placeholder="Cari nama order atau deskripsi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pl-9 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger className="h-10 flex-1 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CUSTOMERS}>Semua Customer</SelectItem>
                {customerOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
              <SelectTrigger className="h-10 flex-1 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SORT_FIELD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>Urutkan: {opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortDir === 'asc' ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
            </Button>
          </div>
        </>
      )}

      <div className="flex flex-col gap-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : tasks?.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">Belum ada tugas untuk divisimu.</p>
        ) : sortedTasks.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">Tidak ada tugas yang cocok dengan pencarian.</p>
        ) : (
          sortedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              canUpdateProgress={isFinishing}
              onUpdateProgress={setProgressTask}
              hasLembarPO={!!orderIdsWithLembarPO?.has(task.order_id)}
              onViewLembarPO={setLembarPOTask}
              onOpenInInput={openInInput}
            />
          ))
        )}
      </div>

      <UpdateProgressDialog task={progressTask} onOpenChange={(open) => !open && setProgressTask(null)} />
      <LembarPOPreviewDialog
        orderId={lembarPOTask?.order_id ?? null}
        open={!!lembarPOTask}
        onOpenChange={(open) => !open && setLembarPOTask(null)}
      />
    </div>
  )
}
