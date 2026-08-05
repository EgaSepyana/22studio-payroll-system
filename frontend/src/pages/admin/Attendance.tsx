import * as React from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, X } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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
  DialogDescription,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import * as attendanceApi from '@/services/attendanceApi'
import { useFilterStore } from '@/stores/filterStore'
import * as employeeApi from '@/services/employeeApi'
import { getErrorMessage } from '@/services/api'
import { formatDate, formatTime, todayISO } from '@/utils/format'
import type { Attendance } from '@/types'

const ALL = 'all'

function toDatetimeLocal(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function fromDatetimeLocal(value?: string) {
  if (!value) return ''
  return new Date(value).toISOString()
}

const schema = z.object({
  employee_id: z.string().min(1, 'Karyawan wajib dipilih'),
  date: z.string().min(1, 'Tanggal wajib diisi'),
  check_in: z.string().optional(),
  check_out: z.string().optional(),
  notes: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

function AttendanceFormDialog({
  record,
  open,
  onOpenChange,
}: {
  record?: Attendance
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isEdit = !!record
  const queryClient = useQueryClient()
  const { data: employees } = useQuery({ queryKey: ['employees'], queryFn: employeeApi.listEmployees })
  const finishingEmployees = React.useMemo(
    () => employees?.filter((e) => e.divisi === 'Finishing') || [],
    [employees]
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      employee_id: record?.employee_id || '',
      date: record?.date || todayISO(),
      check_in: toDatetimeLocal(record?.check_in),
      check_out: toDatetimeLocal(record?.check_out),
      notes: record?.notes || '',
    },
  })

  React.useEffect(() => {
    if (open) {
      form.reset({
        employee_id: record?.employee_id || '',
        date: record?.date || todayISO(),
        check_in: toDatetimeLocal(record?.check_in),
        check_out: toDatetimeLocal(record?.check_out),
        notes: record?.notes || '',
      })
    }
  }, [open, record, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        employee_id: values.employee_id,
        date: values.date,
        check_in: fromDatetimeLocal(values.check_in),
        check_out: fromDatetimeLocal(values.check_out),
        notes: values.notes,
      }
      return isEdit ? attendanceApi.updateAttendance(record.id, payload) : attendanceApi.createAttendance(payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Absensi diperbarui' : 'Absensi ditambahkan')
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Absensi' : 'Tambah Absensi'}</DialogTitle>
          <DialogDescription>Koreksi manual untuk karyawan divisi Finishing.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <FormField
              control={form.control}
              name="employee_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Karyawan</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={isEdit}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih karyawan" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {finishingEmployees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tanggal</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="check_in"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Check-in</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="check_out"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Check-out</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catatan (opsional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Catatan koreksi..." {...field} />
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

export default function AttendancePage() {
  const queryClient = useQueryClient()
  const { employeeId } = useFilterStore((state) => state.attendance)
  const setAttendanceFilter = useFilterStore((state) => state.setAttendance)
  const [dateFrom, setDateFrom] = React.useState('')
  const [dateTo, setDateTo] = React.useState('')
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Attendance | undefined>(undefined)

  const { data: employees } = useQuery({ queryKey: ['employees'], queryFn: employeeApi.listEmployees })
  const finishingEmployees = React.useMemo(
    () => employees?.filter((e) => e.divisi === 'Finishing') || [],
    [employees]
  )

  const filters = {
    employee_id: employeeId === ALL ? undefined : employeeId,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    divisi: 'Finishing' as const,
  }

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', filters],
    queryFn: () => attendanceApi.listAttendance(filters),
  })

  const deleteMutation = useMutation({
    mutationFn: attendanceApi.deleteAttendance,
    onSuccess: () => {
      toast.success('Absensi dihapus')
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const hasFilters = employeeId !== ALL || dateFrom || dateTo

  function resetFilters() {
    setAttendanceFilter({ employeeId: ALL })
    setDateFrom('')
    setDateTo('')
  }

  return (
    <div>
      <PageHeader
        title="Absensi"
        description="Absensi harian karyawan divisi Finishing"
        breadcrumbs={[{ label: 'Dashboard', to: '/admin' }, { label: 'Absensi' }]}
        action={
          <Button
            onClick={() => {
              setEditing(undefined)
              setDialogOpen(true)
            }}
          >
            <Plus className="size-4" /> Tambah Absensi
          </Button>
        }
      />

      <Card className="mb-4 shadow-sm">
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Karyawan</label>
            <Select value={employeeId} onValueChange={(v) => setAttendanceFilter({ employeeId: v })}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua Karyawan</SelectItem>
                {finishingEmployees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Dari Tanggal</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Sampai Tanggal</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
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
                  <TableHead>Karyawan</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead>Jam Kerja</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground text-center">
                      Belum ada data absensi.
                    </TableCell>
                  </TableRow>
                )}
                {data?.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.employee_name}</TableCell>
                    <TableCell>{formatDate(row.date)}</TableCell>
                    <TableCell>{row.check_in ? formatTime(row.check_in) : '-'}</TableCell>
                    <TableCell>{row.check_out ? formatTime(row.check_out) : '-'}</TableCell>
                    <TableCell>{row.hours ?? '-'}</TableCell>
                    <TableCell>
                      {row.payroll_id ? (
                        <Badge variant="secondary">Sudah Dibayar</Badge>
                      ) : row.check_out ? (
                        <Badge className="bg-success text-success-foreground">Selesai</Badge>
                      ) : (
                        <Badge variant="outline">Berlangsung</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!row.payroll_id && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditing(row)
                              setDialogOpen(true)
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="text-destructive size-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Hapus Absensi?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Data absensi {row.employee_name} pada {formatDate(row.date)} akan dihapus
                                  permanen.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-white hover:bg-destructive/90"
                                  onClick={() => deleteMutation.mutate(row.id)}
                                >
                                  Hapus
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AttendanceFormDialog record={editing} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
