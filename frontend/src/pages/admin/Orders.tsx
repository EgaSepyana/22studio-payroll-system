import * as React from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, Eye, X, ArrowUp, ArrowDown, ChevronDown, Search, MapPin } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ProgressBar } from '@/components/ProgressBar'
import { OrderTaskStatusBadge } from '@/components/OrderTaskStatusBadge'
import { useFilterStore } from '@/stores/filterStore'
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import * as orderApi from '@/services/orderApi'
import * as customerApi from '@/services/customerApi'
import { getErrorMessage } from '@/services/api'
import type { Order, OrderJenisCategory, OrderStatus } from '@/types'

const ALL = 'all'
const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'Belum Di Proses', label: 'Belum Di Proses' },
  { value: 'Desain Fix', label: 'Desain Fix' },
  { value: 'On Progress', label: 'On Progress' },
  { value: 'Done', label: 'Done' },
  { value: 'Dikirim', label: 'Dikirim' },
  { value: 'Di Ambil Costumer', label: 'Di Ambil Costumer' },
]
const ALL_ORDER_STATUSES = ORDER_STATUS_OPTIONS.map((opt) => opt.value)
const DEFAULT_STATUS_FILTER = ALL_ORDER_STATUSES.filter((s) => s !== 'Done')

const ORDER_JENIS_CATEGORIES: OrderJenisCategory[] = [
  'ATRIBUT SEKOLAH',
  'CMT (cutting-finishing)',
  'JAKET',
  'JAS ALMAMATER',
  'JERSEY',
  'KAOS',
  'KAOS POLOS',
  'KAOS SATUAN',
  'KAOS WISATA',
  'KEMEJA',
  'MAKLON BORDIR',
  'MAKLON JAHIT',
  'MAKLON SABLON',
  'PENDAPATAN LAINNYA',
  'SERAGAM SEKOLAH',
]

type OrderSortField = 'order_name' | 'customer_name' | 'deadline'

const ORDER_SORT_FIELD_OPTIONS: { value: OrderSortField; label: string }[] = [
  { value: 'order_name', label: 'Nama Order' },
  { value: 'customer_name', label: 'Customer' },
  { value: 'deadline', label: 'Deadline' },
]

function compareOrders(a: Order, b: Order, field: OrderSortField): number {
  if (field === 'deadline') {
    if (!a.deadline && !b.deadline) return 0
    if (!a.deadline) return 1
    if (!b.deadline) return -1
    return a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : 0
  }
  return (a[field] || '').localeCompare(b[field] || '')
}

const orderSchema = z.object({
  customer_id: z.string().min(1, 'Customer wajib dipilih'),
  order_name: z.string().min(1, 'Nama order wajib diisi'),
  notes: z.string().optional(),
})
type OrderFormInput = z.input<typeof orderSchema>
type OrderFormValues = z.output<typeof orderSchema>

function OrderFormDialog({
  order,
  open,
  onOpenChange,
}: {
  order?: Order
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isEdit = !!order
  const queryClient = useQueryClient()
  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: customerApi.listCustomers })

  const form = useForm<OrderFormInput, unknown, OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customer_id: order?.customer_id || '',
      order_name: order?.order_name || '',
      notes: order?.notes || '',
    },
  })

  React.useEffect(() => {
    if (open) {
      form.reset({
        customer_id: order?.customer_id || '',
        order_name: order?.order_name || '',
        notes: order?.notes || '',
      })
    }
  }, [open, order, form])

  const mutation = useMutation({
    mutationFn: (values: OrderFormValues) =>
      isEdit
        ? orderApi.updateOrder(order.id, { order_name: values.order_name, notes: values.notes })
        : orderApi.createOrder(values),
    onSuccess: () => {
      toast.success(isEdit ? 'Order berhasil diperbarui' : 'Order berhasil ditambahkan')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Order' : 'Tambah Order'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Customer tidak dapat diubah setelah order dibuat.' : 'Buat order baru untuk customer. Artikel dan quantity ditambahkan per task.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="flex flex-col gap-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <FormField
              control={form.control}
              name="customer_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={isEdit}>
                    <FormControl>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Pilih customer" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {customers?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="order_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Order</FormLabel>
                  <FormControl><Input placeholder="Contoh: PO Januari - Kaos Polo" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catatan (opsional)</FormLabel>
                  <FormControl><Textarea placeholder="Catatan tambahan..." {...field} /></FormControl>
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

export default function Orders() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { customerFilter, statusFilter, jenisCategoryFilter, search, sortField, sortDir } = useFilterStore(
    (state) => state.order
  )
  const setOrderFilter = useFilterStore((state) => state.setOrder)
  const resetOrderFilter = useFilterStore((state) => state.resetOrder)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingOrder, setEditingOrder] = React.useState<Order | undefined>(undefined)
  const [deletingOrder, setDeletingOrder] = React.useState<Order | null>(null)
  const [trackingLinkPendingId, setTrackingLinkPendingId] = React.useState<string | null>(null)

  async function handleOpenTrackingLink(order: Order) {
    setTrackingLinkPendingId(order.id)
    try {
      const { url } = await orderApi.getTrackingLink(order.id)
      window.open(url, '_blank')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setTrackingLinkPendingId(null)
    }
  }

  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: customerApi.listCustomers })

  const filters = {
    customer_id: customerFilter === ALL ? undefined : customerFilter,
  }

  const { data, isLoading } = useQuery({
    queryKey: ['orders', filters],
    queryFn: () => orderApi.listOrders(filters),
  })

  function toggleStatus(status: OrderStatus, checked: boolean) {
    setOrderFilter({
      statusFilter: checked ? [...statusFilter, status] : statusFilter.filter((s) => s !== status),
    })
  }

  const sortedData = React.useMemo(() => {
    if (!data) return []
    const query = search.trim().toLowerCase()
    const filtered = data.filter((o) => {
      if (!statusFilter.includes(o.status)) return false
      if (jenisCategoryFilter !== ALL && o.jenis_category !== jenisCategoryFilter) return false
      if (query) {
        const haystack = `${o.order_name} ${o.customer_name || ''}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
    const sorted = [...filtered].sort((a, b) => compareOrders(a, b, sortField))
    return sortDir === 'asc' ? sorted : sorted.reverse()
  }, [data, statusFilter, jenisCategoryFilter, search, sortField, sortDir])

  const deleteMutation = useMutation({
    mutationFn: (id: string) => orderApi.deleteOrder(id),
    onSuccess: () => {
      toast.success('Order dihapus')
      setDeletingOrder(null)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const hasFilters =
    customerFilter !== ALL ||
    jenisCategoryFilter !== ALL ||
    search.trim() !== '' ||
    statusFilter.length !== DEFAULT_STATUS_FILTER.length ||
    !DEFAULT_STATUS_FILTER.every((s) => statusFilter.includes(s))

  return (
    <div>
      <PageHeader
        title="Order & Task"
        description="Kelola order customer dan pembagian task per divisi"
        breadcrumbs={[{ label: 'Dashboard', to: '/admin' }, { label: 'Task' }]}
        action={
          <Button
            onClick={() => {
              setEditingOrder(undefined)
              setFormOpen(true)
            }}
          >
            <Plus className="size-4" /> Tambah Order
          </Button>
        }
      />

      <Card className="mb-4 shadow-sm">
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Cari</label>
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                placeholder="Nama order atau customer..."
                value={search}
                onChange={(e) => setOrderFilter({ search: e.target.value })}
                className="w-56 pl-8"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Customer</label>
            <Select value={customerFilter} onValueChange={(v) => setOrderFilter({ customerFilter: v })}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua Customer</SelectItem>
                {customers?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Jenis Category</label>
            <Select value={jenisCategoryFilter} onValueChange={(v) => setOrderFilter({ jenisCategoryFilter: v })}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua Kategori</SelectItem>
                {ORDER_JENIS_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Status</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-48 justify-between font-normal">
                  {statusFilter.length === 0
                    ? 'Tidak ada status'
                    : statusFilter.length === ALL_ORDER_STATUSES.length
                      ? 'Semua Status'
                      : `${statusFilter.length} status dipilih`}
                  <ChevronDown className="size-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {ORDER_STATUS_OPTIONS.map((opt) => (
                  <DropdownMenuCheckboxItem
                    key={opt.value}
                    checked={statusFilter.includes(opt.value)}
                    onCheckedChange={(checked) => toggleStatus(opt.value, checked)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {opt.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Urutkan</label>
            <div className="flex items-center gap-2">
              <Select value={sortField} onValueChange={(v) => setOrderFilter({ sortField: v as OrderSortField })}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORDER_SORT_FIELD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setOrderFilter({ sortDir: sortDir === 'asc' ? 'desc' : 'asc' })}
                title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
              >
                {sortDir === 'asc' ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
              </Button>
            </div>
          </div>
          {hasFilters && (
            <Button variant="ghost" onClick={resetOrderFilter}>
              <X className="size-4" /> Reset
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="px-0">
          {isLoading ? (
            <div className="space-y-3 px-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Progress Task</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground text-center">
                      Belum ada order.
                    </TableCell>
                  </TableRow>
                )}
                {sortedData.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.order_name}</TableCell>
                    <TableCell>{order.customer_name}</TableCell>
                    <TableCell className="w-36">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={order.progress} status={order.status} />
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {order.completed_task_count}/{order.task_count}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell><OrderTaskStatusBadge status={order.status} /></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/orders/${order.id}`)}>
                        <Eye className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={trackingLinkPendingId === order.id}
                        onClick={() => handleOpenTrackingLink(order)}
                        title="Lacak Order"
                      >
                        {trackingLinkPendingId === order.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <MapPin className="size-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={order.status === 'Done'}
                        onClick={() => {
                          setEditingOrder(order)
                          setFormOpen(true)
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={order.task_count > 0}
                        onClick={() => setDeletingOrder(order)}
                      >
                        <Trash2 className="text-destructive size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <OrderFormDialog order={editingOrder} open={formOpen} onOpenChange={setFormOpen} />

      <AlertDialog open={!!deletingOrder} onOpenChange={(open) => !open && setDeletingOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Order?</AlertDialogTitle>
            <AlertDialogDescription>
              Order "{deletingOrder?.order_name}" akan dihapus permanen. Hanya order tanpa task yang dapat dihapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deletingOrder && deleteMutation.mutate(deletingOrder.id)}
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
