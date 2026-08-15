import * as React from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { RowActionsMenu, type RowAction } from '@/components/RowActionsMenu'
import { MobileCardList, MobileCard, MobileCardRow } from '@/components/MobileCardList'
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
import * as employeeApi from '@/services/employeeApi'
import { getErrorMessage } from '@/services/api'
import type { Divisi, Employee } from '@/types'

const DIVISIONS: Divisi[] = ['Jahit', 'Sablon', 'Cutting', 'Finishing']

const createSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi'),
  phone: z.string().min(1, 'Nomor HP wajib diisi'),
  username: z.string().min(3, 'Username minimal 3 karakter'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  status: z.enum(['active', 'inactive']),
  divisi: z.enum(['Jahit', 'Sablon', 'Cutting', 'Finishing']),
  hourly_rate: z.coerce.number().nonnegative().optional(),
  upah_lembur_per_jam: z.coerce.number().nonnegative().optional(),
})

const editSchema = createSchema.extend({
  password: z.union([z.literal(''), z.string().min(6, 'Password minimal 6 karakter')]),
})

type FormInput = z.input<typeof createSchema>
type FormValues = z.output<typeof createSchema>

function EmployeeFormDialog({
  employee,
  open,
  onOpenChange,
}: {
  employee?: Employee
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isEdit = !!employee
  const queryClient = useQueryClient()

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
    defaultValues: {
      name: employee?.name || '',
      phone: employee?.phone || '',
      username: employee?.username || '',
      password: '',
      status: employee?.status || 'active',
      divisi: employee?.divisi || 'Jahit',
      hourly_rate: employee?.hourly_rate ?? undefined,
      upah_lembur_per_jam: employee?.upah_lembur_per_jam ?? undefined,
    },
  })

  const divisi = form.watch('divisi')

  React.useEffect(() => {
    if (open) {
      form.reset({
        name: employee?.name || '',
        phone: employee?.phone || '',
        username: employee?.username || '',
        password: '',
        status: employee?.status || 'active',
        divisi: employee?.divisi || 'Jahit',
        hourly_rate: employee?.hourly_rate ?? undefined,
      upah_lembur_per_jam: employee?.upah_lembur_per_jam ?? undefined,
      })
    }
  }, [open, employee, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (isEdit) {
        const payload = { ...values, password: values.password || undefined }
        return employeeApi.updateEmployee(employee.id, payload)
      }
      return employeeApi.createEmployee(values)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Karyawan berhasil diperbarui' : 'Karyawan berhasil ditambahkan')
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Karyawan' : 'Tambah Karyawan'}</DialogTitle>
          <DialogDescription>Lengkapi data karyawan di bawah ini.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama</FormLabel>
                  <FormControl>
                    <Input placeholder="Nama karyawan" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nomor HP</FormLabel>
                  <FormControl>
                    <Input placeholder="08xxxxxxxxxx" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{isEdit ? 'Password Baru (opsional)' : 'Password'}</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Aktif</SelectItem>
                        <SelectItem value="inactive">Nonaktif</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="divisi"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Divisi</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DIVISIONS.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {divisi === 'Finishing' && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="hourly_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Upah per Jam (Rp)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          placeholder="0"
                          {...field}
                          value={(field.value ?? '') as string | number}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="upah_lembur_per_jam"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Upah Lembur per Jam (Rp)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          placeholder="0"
                          {...field}
                          value={(field.value ?? '') as string | number}
                        />
                      </FormControl>
                      <p className="text-muted-foreground text-xs">Berlaku untuk jam kerja di atas 8 jam/hari.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
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

export default function Employees() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Employee | undefined>(undefined)
  const [deletingEmployee, setDeletingEmployee] = React.useState<Employee | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: employeeApi.listEmployees,
  })

  const deleteMutation = useMutation({
    mutationFn: employeeApi.deleteEmployee,
    onSuccess: () => {
      toast.success('Karyawan dihapus')
      setDeletingEmployee(null)
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const rowsWithActions = React.useMemo(
    () =>
      (data || []).map((employee) => ({
        employee,
        actions: [
          {
            label: 'Edit',
            icon: Pencil,
            onClick: () => {
              setEditing(employee)
              setDialogOpen(true)
            },
          },
          { label: 'Hapus', icon: Trash2, variant: 'destructive', onClick: () => setDeletingEmployee(employee) },
        ] satisfies RowAction[],
      })),
    [data]
  )

  return (
    <div>
      <PageHeader
        title="Karyawan"
        description="Kelola data karyawan 22Studio"
        breadcrumbs={[{ label: 'Dashboard', to: '/admin' }, { label: 'Karyawan' }]}
        action={
          <Button
            onClick={() => {
              setEditing(undefined)
              setDialogOpen(true)
            }}
          >
            <Plus className="size-4" /> Tambah Karyawan
          </Button>
        }
      />

      <Card className="shadow-sm">
        <CardContent className="px-0">
          {isLoading ? (
            <div className="space-y-3 px-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <>
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Nomor HP</TableHead>
                    <TableHead>Divisi</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground text-center">
                        Belum ada data karyawan.
                      </TableCell>
                    </TableRow>
                  )}
                  {rowsWithActions.map(({ employee, actions }) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">{employee.name}</TableCell>
                      <TableCell>{employee.username}</TableCell>
                      <TableCell>{employee.phone}</TableCell>
                      <TableCell>
                        {employee.divisi ? <Badge variant="outline">{employee.divisi}</Badge> : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={employee.status === 'active' ? 'default' : 'secondary'}>
                          {employee.status === 'active' ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <RowActionsMenu actions={actions} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {data?.length === 0 && (
                <p className="text-muted-foreground px-4 py-6 text-center text-sm md:hidden">
                  Belum ada data karyawan.
                </p>
              )}
              <MobileCardList className="p-4">
                {rowsWithActions.map(({ employee, actions }) => (
                  <MobileCard key={employee.id}>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{employee.name}</p>
                        <p className="text-muted-foreground text-xs">{employee.username}</p>
                      </div>
                      <RowActionsMenu actions={actions} />
                    </div>
                    <MobileCardRow label="Nomor HP">{employee.phone}</MobileCardRow>
                    <MobileCardRow label="Divisi">
                      {employee.divisi ? <Badge variant="outline">{employee.divisi}</Badge> : '-'}
                    </MobileCardRow>
                    <MobileCardRow label="Status">
                      <Badge variant={employee.status === 'active' ? 'default' : 'secondary'}>
                        {employee.status === 'active' ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </MobileCardRow>
                  </MobileCard>
                ))}
              </MobileCardList>
            </>
          )}
        </CardContent>
      </Card>

      <EmployeeFormDialog employee={editing} open={dialogOpen} onOpenChange={setDialogOpen} />

      <AlertDialog open={!!deletingEmployee} onOpenChange={(open) => !open && setDeletingEmployee(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Karyawan?</AlertDialogTitle>
            <AlertDialogDescription>
              Data karyawan "{deletingEmployee?.name}" beserta akun loginnya akan dihapus permanen. Tindakan ini
              tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deletingEmployee && deleteMutation.mutate(deletingEmployee.id)}
            >
              {deleteMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
