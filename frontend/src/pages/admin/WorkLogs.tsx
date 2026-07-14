import * as React from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { X, Plus, Loader2, FileSpreadsheet, FileDown, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { WorkStatusBadge } from '@/components/WorkStatusBadge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { getErrorMessage } from '@/services/api'
import { todayISO, WORK_STATUS_OPTIONS } from '@/utils/format'

import * as workLogApi from '@/services/workLogApi'
import * as employeeApi from '@/services/employeeApi'
import * as customerApi from '@/services/customerApi'
import * as articleApi from '@/services/articleApi'
import * as taskApi from '@/services/taskApi'
import { formatCurrency, formatDate } from '@/utils/format'
import type { Divisi, WorkLog } from '@/types'

const ALL = 'all'
const DIVISIONS: Divisi[] = ['Jahit', 'Sablon', 'Cutting', 'Finishing']

const createSchema = z.object({
  employee_id: z.string().min(1, 'Karyawan wajib dipilih'),
  work_date: z.string().min(1, 'Tanggal wajib diisi'),
  task_id: z.string().min(1, 'Task wajib dipilih'),
  article_id: z.string().min(1, 'Artikel wajib dipilih'),
  quantity: z.coerce.number().positive('Quantity harus lebih dari 0'),
  notes: z.string().optional(),
  status: z.enum(['on_progress', 'selesai', 'belum_selesai']),
})
const editSchema = createSchema.extend({ task_id: z.string(), article_id: z.string() })
type FormInput = z.input<typeof createSchema>
type FormValues = z.output<typeof createSchema>

export default function WorkLogs() {
  const queryClient = useQueryClient()
  const [dateFrom, setDateFrom] = React.useState('')
  const [dateTo, setDateTo] = React.useState('')
  const [employeeId, setEmployeeId] = React.useState(ALL)
  const [customerId, setCustomerId] = React.useState(ALL)
  const [articleId, setArticleId] = React.useState(ALL)
  const [divisiFilter, setDivisiFilter] = React.useState(ALL)
  const [isFormOpen, setIsFormOpen] = React.useState(false)
  const [editingLog, setEditingLog] = React.useState<WorkLog | undefined>(undefined)
  const [deletingLog, setDeletingLog] = React.useState<WorkLog | null>(null)
  const [exportingFormat, setExportingFormat] = React.useState<'excel' | 'pdf' | null>(null)

  const { data: employees } = useQuery({ queryKey: ['employees'], queryFn: employeeApi.listEmployees })
  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: customerApi.listCustomers })
  const { data: articles } = useQuery({ queryKey: ['articles'], queryFn: () => articleApi.listArticles() })

  const filters = {
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    employee_id: employeeId === ALL ? undefined : employeeId,
    customer_id: customerId === ALL ? undefined : customerId,
    article_id: articleId === ALL ? undefined : articleId,
    divisi: divisiFilter === ALL ? undefined : (divisiFilter as Divisi),
  }

  const { data, isLoading } = useQuery({
    queryKey: ['worklogs', filters],
    queryFn: () => workLogApi.listAllWorkLogs(filters),
  })

  const hasFilters =
    dateFrom || dateTo || employeeId !== ALL || customerId !== ALL || articleId !== ALL || divisiFilter !== ALL

  function resetFilters() {
    setDateFrom('')
    setDateTo('')
    setEmployeeId(ALL)
    setCustomerId(ALL)
    setArticleId(ALL)
    setDivisiFilter(ALL)
  }

  const isEdit = !!editingLog

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
    defaultValues: {
      employee_id: '',
      work_date: todayISO(),
      task_id: '',
      article_id: '',
      quantity: undefined,
      notes: '',
      status: 'selesai',
    },
  })

  React.useEffect(() => {
    if (isFormOpen) {
      form.reset({
        employee_id: editingLog?.employee_id || '',
        work_date: editingLog?.work_date || todayISO(),
        task_id: editingLog?.task_id || '',
        article_id: editingLog?.article_id || '',
        quantity: editingLog?.quantity,
        notes: editingLog?.notes || '',
        status: editingLog?.status || 'selesai',
      })
    }
  }, [isFormOpen, editingLog, form])

  const formEmployeeId = form.watch('employee_id')
  const formEmployeeDivisi = employees?.find((e) => e.id === formEmployeeId)?.divisi
  const formTaskId = form.watch('task_id')

  // Work logs are task-scoped now — any employee can log against any
  // not-yet-completed task in their own division (no exclusive assignment).
  const { data: divisiTasks } = useQuery({
    queryKey: ['tasks', { divisi: formEmployeeDivisi }],
    queryFn: () => taskApi.listTasks({ divisi: formEmployeeDivisi as Divisi }),
    enabled: !isEdit && !!formEmployeeDivisi,
  })
  const employeeTasks = React.useMemo(
    () => divisiTasks?.filter((t) => t.status !== 'completed') || [],
    [divisiTasks]
  )
  const selectedFormTask = employeeTasks.find((t) => t.id === formTaskId)
  const availableFormArticles = React.useMemo(
    () => articles?.filter((a) => a.customer_id === selectedFormTask?.customer_id) || [],
    [articles, selectedFormTask]
  )

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) =>
      isEdit ? workLogApi.updateWorkLog(editingLog.id, values) : workLogApi.createWorkLog(values),
    onSuccess: () => {
      toast.success(isEdit ? 'Pekerjaan berhasil diperbarui' : 'Pekerjaan berhasil ditambahkan')
      setIsFormOpen(false)
      queryClient.invalidateQueries({ queryKey: ['worklogs'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workLogApi.deleteWorkLog(id),
    onSuccess: () => {
      toast.success('Pekerjaan dihapus')
      setDeletingLog(null)
      queryClient.invalidateQueries({ queryKey: ['worklogs'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  async function handleExport(format: 'excel' | 'pdf') {
    setExportingFormat(format)
    try {
      await workLogApi.exportWorkLogs(filters, format)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setExportingFormat(null)
    }
  }

  const totalQty = data?.reduce((s, l) => s + l.quantity, 0) || 0
  const totalAmount = data?.reduce((s, l) => s + l.total, 0) || 0

  return (
    <div>
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <PageHeader
          title="Data Pekerjaan"
          description="Seluruh pekerjaan yang diinput karyawan"
          breadcrumbs={[{ label: 'Dashboard', to: '/admin' }, { label: 'Data Pekerjaan' }]}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!!exportingFormat} onClick={() => handleExport('excel')}>
            {exportingFormat === 'excel' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="size-4" />
            )}
            Excel
          </Button>
          <Button variant="outline" disabled={!!exportingFormat} onClick={() => handleExport('pdf')}>
            {exportingFormat === 'pdf' ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
            PDF
          </Button>
          <Button
            onClick={() => {
              setEditingLog(undefined)
              setIsFormOpen(true)
            }}
          >
            <Plus className="mr-2 size-4" />
            Tambah Pekerjaan
          </Button>
        </div>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Pekerjaan' : 'Tambah Pekerjaan'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4">
              <FormField control={form.control} name="employee_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Karyawan</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v)
                      form.setValue('task_id', '')
                    }}
                    disabled={isEdit}
                  >
                    <FormControl><SelectTrigger><SelectValue placeholder="Pilih karyawan" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {employees?.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="work_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tanggal</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              {!isEdit && (
                <FormField control={form.control} name="task_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v)
                        form.setValue('article_id', '')
                      }}
                      disabled={!formEmployeeId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={!formEmployeeId ? 'Pilih karyawan dahulu' : 'Pilih task'} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {employeeTasks?.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.order_name} — {t.description || t.divisi}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formEmployeeId && employeeTasks.length === 0 && (
                      <p className="text-muted-foreground text-xs">
                        Belum ada task untuk divisi karyawan ini.
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )} />
              )}
              {!isEdit && (
                <FormField control={form.control} name="article_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Artikel</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={!selectedFormTask}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={!selectedFormTask ? 'Pilih task dahulu' : 'Pilih artikel'} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableFormArticles.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.article_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedFormTask && availableFormArticles.length === 0 && (
                      <p className="text-muted-foreground text-xs">
                        Belum ada artikel untuk customer pada task ini.
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )} />
              )}
              <FormField control={form.control} name="quantity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl><Input type="number" min={1} {...field} value={(field.value ?? '') as string | number} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status Pekerjaan</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {WORK_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Keterangan</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="pt-2 flex justify-end">
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Simpan
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingLog} onOpenChange={(open) => !open && setDeletingLog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pekerjaan?</AlertDialogTitle>
            <AlertDialogDescription>
              Data pekerjaan {deletingLog?.employee_name} — {deletingLog?.article_name} akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deletingLog && deleteMutation.mutate(deletingLog.id)}
            >
              {deleteMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="mb-4 shadow-sm">
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Dari Tanggal</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Sampai Tanggal</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Karyawan</label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua Karyawan</SelectItem>
                {employees?.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Customer</label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua Customer</SelectItem>
                {customers?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Artikel</label>
            <Select value={articleId} onValueChange={setArticleId}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua Artikel</SelectItem>
                {articles?.map((a) => <SelectItem key={a.id} value={a.id}>{a.article_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Divisi</label>
            <Select value={divisiFilter} onValueChange={setDivisiFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua Divisi</SelectItem>
                {DIVISIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {hasFilters && (
            <Button variant="ghost" onClick={resetFilters}>
              <X className="size-4" /> Reset
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="px-0">
          {isLoading ? (
            <div className="space-y-3 px-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Karyawan</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Artikel</TableHead>
                  <TableHead>Harga</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-muted-foreground text-center">
                      Tidak ada data pekerjaan.
                    </TableCell>
                  </TableRow>
                )}
                {data?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{formatDate(log.work_date)}</TableCell>
                    <TableCell className="font-medium">{log.employee_name}</TableCell>
                    <TableCell>{log.customer_name}</TableCell>
                    <TableCell>{log.article_name}</TableCell>
                    <TableCell>{formatCurrency(log.price)}</TableCell>
                    <TableCell>{log.quantity}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(log.total)}</TableCell>
                    <TableCell className="text-muted-foreground max-w-40 truncate">
                      {log.notes || '-'}
                    </TableCell>
                    <TableCell>
                      <WorkStatusBadge status={log.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {!log.payroll_id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingLog(log)
                                setIsFormOpen(true)
                              }}
                            >
                              <Pencil className="size-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" onClick={() => setDeletingLog(log)}>
                              <Trash2 className="size-4" /> Hapus
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {data && data.length > 0 && (
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={5}>Total</TableCell>
                    <TableCell>{totalQty}</TableCell>
                    <TableCell>{formatCurrency(totalAmount)}</TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
