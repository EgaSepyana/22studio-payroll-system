import * as React from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, MoreHorizontal, ArrowUp, ArrowDown, Eye } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ProgressBar } from '@/components/ProgressBar'
import { OrderTaskStatusBadge } from '@/components/OrderTaskStatusBadge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import * as orderApi from '@/services/orderApi'
import * as taskApi from '@/services/taskApi'
import * as workLogApi from '@/services/workLogApi'
import { getErrorMessage } from '@/services/api'
import { formatCurrency, formatDate, workStatusLabel } from '@/utils/format'
import type { Divisi, Task, TaskStatus } from '@/types'

const DIVISIONS: Divisi[] = ['Jahit', 'Sablon', 'Cutting', 'Finishing']

type TaskSortField = 'divisi' | 'description' | 'progress' | 'assigned_to_name' | 'status'
type SortDirection = 'asc' | 'desc'

const TASK_SORT_FIELD_OPTIONS: { value: TaskSortField; label: string }[] = [
  { value: 'divisi', label: 'Divisi' },
  { value: 'description', label: 'Deskripsi' },
  { value: 'progress', label: 'Progress' },
  { value: 'assigned_to_name', label: 'Karyawan' },
  { value: 'status', label: 'Status' },
]

const TASK_STATUS_ORDER: Record<TaskStatus, number> = { open: 0, in_progress: 1, completed: 2 }

function compareTaskRows(a: Task, b: Task, field: TaskSortField): number {
  switch (field) {
    case 'divisi':
      return (a.divisi || '').localeCompare(b.divisi || '')
    case 'description':
      return (a.description || '').localeCompare(b.description || '')
    case 'progress':
      return a.progress - b.progress
    case 'assigned_to_name':
      return (a.assigned_to_name || '').localeCompare(b.assigned_to_name || '')
    case 'status':
      return TASK_STATUS_ORDER[a.status] - TASK_STATUS_ORDER[b.status]
  }
}

const createTaskSchema = z.object({
  divisi: z.array(z.enum(['Jahit', 'Sablon', 'Cutting', 'Finishing'])).min(1, 'Pilih minimal satu divisi'),
  description: z.string().optional(),
  target_qty: z.coerce.number().positive('Target qty harus lebih dari 0'),
})
const editTaskSchema = z.object({
  divisi: z.enum(['Jahit', 'Sablon', 'Cutting', 'Finishing']),
  description: z.string().optional(),
  target_qty: z.coerce.number().positive('Target qty harus lebih dari 0'),
})
type CreateTaskFormInput = z.input<typeof createTaskSchema>
type CreateTaskFormValues = z.output<typeof createTaskSchema>
type EditTaskFormInput = z.input<typeof editTaskSchema>
type EditTaskFormValues = z.output<typeof editTaskSchema>

// Divisi is multi-select on create: submitting with N divisions selected
// fans out into N separate tasks (same description/target_qty), one per
// division — a quick way to spin up the same work item across several
// production divisions at once. Submitted sequentially (not Promise.all) so
// each task's id is assigned only after the previous insert has actually
// landed — firing them all in parallel risked two near-simultaneous inserts
// computing the same "next id" before either write was visible.
function CreateTaskDialog({
  orderId,
  open,
  onOpenChange,
}: {
  orderId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()

  const form = useForm<CreateTaskFormInput, unknown, CreateTaskFormValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      divisi: [],
      description: '',
      target_qty: undefined,
    },
  })

  React.useEffect(() => {
    if (open) {
      form.reset({ divisi: [], description: '', target_qty: undefined })
    }
  }, [open, form])

  const mutation = useMutation({
    mutationFn: async (values: CreateTaskFormValues) => {
      const created = []
      for (const divisi of values.divisi) {
        created.push(
          await taskApi.createTask({
            order_id: orderId!,
            divisi,
            description: values.description,
            target_qty: values.target_qty,
          })
        )
      }
      return created
    },
    onSuccess: (created) => {
      toast.success(created.length > 1 ? `${created.length} task berhasil ditambahkan` : 'Task berhasil ditambahkan')
      queryClient.invalidateQueries({ queryKey: ['order-detail', orderId] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Task</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="flex flex-col gap-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <FormField
              control={form.control}
              name="divisi"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Divisi</FormLabel>
                  <div className="flex flex-col gap-2">
                    {DIVISIONS.map((d) => {
                      const checked = field.value?.includes(d) ?? false
                      return (
                        <label key={d} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const current = field.value || []
                              field.onChange(v ? [...current, d] : current.filter((x) => x !== d))
                            }}
                          />
                          {d}
                        </label>
                      )
                    })}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Pilih lebih dari satu divisi untuk membuat task yang sama di setiap divisi sekaligus.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deskripsi (opsional)</FormLabel>
                  <FormControl><Textarea placeholder="Contoh: Jahit badan & lengan" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="target_qty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Quantity</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} {...field} value={(field.value ?? '') as string | number} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function EditTaskDialog({
  orderId,
  task,
  open,
  onOpenChange,
}: {
  orderId: string | null
  task: Task
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()

  const form = useForm<EditTaskFormInput, unknown, EditTaskFormValues>({
    resolver: zodResolver(editTaskSchema),
    defaultValues: {
      divisi: task.divisi || 'Jahit',
      description: task.description || '',
      target_qty: task.target_qty,
    },
  })

  React.useEffect(() => {
    if (open) {
      form.reset({
        divisi: task.divisi || 'Jahit',
        description: task.description || '',
        target_qty: task.target_qty,
      })
    }
  }, [open, task, form])

  const mutation = useMutation({
    mutationFn: (values: EditTaskFormValues) => taskApi.updateTask(task.id, values),
    onSuccess: () => {
      toast.success('Task berhasil diperbarui')
      queryClient.invalidateQueries({ queryKey: ['order-detail', orderId] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="flex flex-col gap-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <FormField
              control={form.control}
              name="divisi"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Divisi</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {DIVISIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deskripsi (opsional)</FormLabel>
                  <FormControl><Textarea placeholder="Contoh: Jahit badan & lengan" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="target_qty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Quantity</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} {...field} value={(field.value ?? '') as string | number} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function TaskWorkLogDialog({ task, onOpenChange }: { task: Task | null; onOpenChange: (open: boolean) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['worklogs', { task_id: task?.id }],
    queryFn: () => workLogApi.listAllWorkLogs({ task_id: task!.id }),
    enabled: !!task,
  })

  const total = data?.reduce((sum, log) => sum + log.total, 0) || 0

  return (
    <Dialog open={!!task} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detail Pekerjaan — {task?.description || task?.divisi}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Karyawan</TableHead>
                  <TableHead>Artikel</TableHead>
                  <TableHead className="w-20">Qty</TableHead>
                  <TableHead className="w-28">Harga</TableHead>
                  <TableHead className="w-28">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground text-center">
                      Belum ada pekerjaan tercatat untuk task ini.
                    </TableCell>
                  </TableRow>
                )}
                {data?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(log.work_date)}</TableCell>
                    <TableCell>{log.employee_name || '-'}</TableCell>
                    <TableCell>{log.article_name || '-'}</TableCell>
                    <TableCell>{log.quantity}</TableCell>
                    <TableCell>{formatCurrency(log.price)}</TableCell>
                    <TableCell>{formatCurrency(log.total)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{workStatusLabel(log.status)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {data && data.length > 0 && (
          <div className="flex justify-end gap-2 text-sm font-semibold">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [createFormOpen, setCreateFormOpen] = React.useState(false)
  const [editingTask, setEditingTask] = React.useState<Task | null>(null)
  const [deletingTask, setDeletingTask] = React.useState<Task | null>(null)
  const [viewingTask, setViewingTask] = React.useState<Task | null>(null)
  const [sortField, setSortField] = React.useState<TaskSortField>('status')
  const [sortDir, setSortDir] = React.useState<SortDirection>('asc')

  const { data, isLoading } = useQuery({
    queryKey: ['order-detail', id],
    queryFn: () => orderApi.getOrderDetail(id!),
    enabled: !!id,
  })

  const sortedTasks = React.useMemo(() => {
    if (!data) return []
    const sorted = [...data.tasks].sort((a, b) => compareTaskRows(a, b, sortField))
    return sortDir === 'asc' ? sorted : sorted.reverse()
  }, [data, sortField, sortDir])

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => taskApi.deleteTask(taskId),
    onSuccess: () => {
      toast.success('Task dihapus')
      setDeletingTask(null)
      queryClient.invalidateQueries({ queryKey: ['order-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  return (
    <div>
      <Button variant="ghost" className="mb-3" onClick={() => navigate('/admin/orders')}>
        <ArrowLeft className="size-4" /> Kembali
      </Button>

      <PageHeader
        title={data.order_name}
        description={data.customer_name || undefined}
        breadcrumbs={[
          { label: 'Dashboard', to: '/admin' },
          { label: 'Task', to: '/admin/orders' },
          { label: data.order_name },
        ]}
      />

      <Card className="mb-4 shadow-sm">
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground text-xs">Status</p>
            <OrderTaskStatusBadge status={data.status} />
          </div>
          <div className="col-span-3">
            <p className="text-muted-foreground text-xs">
              Progress Task ({data.completed_task_count}/{data.task_count})
            </p>
            <ProgressBar value={data.progress} status={data.status} className="mt-1.5" />
          </div>
        </CardContent>
      </Card>
      {data.notes && <p className="text-muted-foreground mb-4 text-sm">{data.notes}</p>}

      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-sm font-semibold">Task</h3>
            <Button
              size="sm"
              disabled={data.status === 'Done'}
              onClick={() => setCreateFormOpen(true)}
            >
              <Plus className="size-4" /> Tambah Task
            </Button>
          </div>

          {data.tasks.length > 0 && (
            <div className="flex items-center gap-2">
              <Select value={sortField} onValueChange={(v) => setSortField(v as TaskSortField)}>
                <SelectTrigger className="h-9 w-48 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_SORT_FIELD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>Urutkan: {opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
              >
                {sortDir === 'asc' ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
              </Button>
            </div>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Divisi</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Karyawan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.tasks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground text-center">
                      Belum ada task.
                    </TableCell>
                  </TableRow>
                )}
                {sortedTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell><Badge variant="outline">{task.divisi}</Badge></TableCell>
                    <TableCell className="max-w-40 truncate">{task.description || '-'}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {task.completed_qty}/{task.target_qty}
                    </TableCell>
                    <TableCell><ProgressBar value={task.progress} status={task.status} className="w-20" /></TableCell>
                    <TableCell className="text-xs">{task.assigned_to_name || '-'}</TableCell>
                    <TableCell><OrderTaskStatusBadge status={task.status} /></TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewingTask(task)}>
                            <Eye className="size-4" /> Detail Pekerjaan
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditingTask(task)}>
                            <Pencil className="size-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={task.completed_qty > 0}
                            onClick={() => setDeletingTask(task)}
                          >
                            <Trash2 className="size-4" /> Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CreateTaskDialog
        orderId={id ?? null}
        open={createFormOpen}
        onOpenChange={setCreateFormOpen}
      />

      {editingTask && (
        <EditTaskDialog
          orderId={id ?? null}
          task={editingTask}
          open={!!editingTask}
          onOpenChange={(open) => !open && setEditingTask(null)}
        />
      )}

      <TaskWorkLogDialog task={viewingTask} onOpenChange={(open) => !open && setViewingTask(null)} />

      <AlertDialog open={!!deletingTask} onOpenChange={(open) => !open && setDeletingTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Task?</AlertDialogTitle>
            <AlertDialogDescription>
              Task "{deletingTask?.description || deletingTask?.divisi}" akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deletingTask && deleteTaskMutation.mutate(deletingTask.id)}
            >
              {deleteTaskMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
