import * as React from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, Eye, X, Upload } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import { OrderTaskStatusBadge } from '@/components/OrderTaskStatusBadge'
import * as orderApi from '@/services/orderApi'
import * as customerApi from '@/services/customerApi'
import * as uploadApi from '@/services/uploadApi'
import { getErrorMessage } from '@/services/api'
import { formatCurrency, formatDate } from '@/utils/format'
import type { Order, OrderFrom, OrderJenisCategory, OrderStatus } from '@/types'

const ALL = 'all'
const NONE = '__none__'
const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'Desain Fix', label: 'Desain Fix' },
  { value: 'On Progress', label: 'On Progress' },
  { value: 'Done', label: 'Done' },
  { value: 'Di Ambil Costumer', label: 'Di Ambil Costumer' },
]

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
const ORDER_FROM_OPTIONS: OrderFrom[] = ['SHOPEE', 'TIKTOK', 'WHATSAPP', 'WORKSHOP']

const schema = z.object({
  customer_id: z.string().min(1, 'Customer wajib dipilih'),
  order_name: z.string().min(1, 'Nama order wajib diisi'),
  notes: z.string().optional(),
  deadline: z.string().optional(),
  jenis_category: z.string().optional(),
  order_from: z.string().optional(),
  broker: z.string().optional(),
  desain_fix_url: z.string().optional(),
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

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
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: customerApi.listCustomers })
  const [uploading, setUploading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      customer_id: order?.customer_id || '',
      order_name: order?.order_name || '',
      notes: order?.notes || '',
      deadline: order?.deadline || '',
      jenis_category: order?.jenis_category || '',
      order_from: order?.order_from || '',
      broker: order?.broker || '',
      desain_fix_url: order?.desain_fix_url || '',
    },
  })

  React.useEffect(() => {
    if (open) {
      form.reset({
        customer_id: order?.customer_id || '',
        order_name: order?.order_name || '',
        notes: order?.notes || '',
        deadline: order?.deadline || '',
        jenis_category: order?.jenis_category || '',
        order_from: order?.order_from || '',
        broker: order?.broker || '',
        desain_fix_url: order?.desain_fix_url || '',
      })
    }
  }, [open, order, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      // Empty-string optionals must not be sent — the backend enum schemas
      // reject '' (only a real category/order_from value or omission).
      const payload = {
        ...values,
        jenis_category: values.jenis_category || undefined,
        order_from: values.order_from || undefined,
        desain_fix_url: values.desain_fix_url || undefined,
      } as orderApi.OrderInput
      return isEdit ? orderApi.updateOrder(order.id, payload) : orderApi.createOrder(payload)
    },
    onSuccess: (result) => {
      toast.success(isEdit ? 'Order berhasil diperbarui' : 'Order berhasil ditambahkan')
      queryClient.invalidateQueries({ queryKey: ['order-list'] })
      onOpenChange(false)
      if (!isEdit) navigate(`/admin/order/${result.id}`)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Order' : 'Tambah Order'}</DialogTitle>
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
              name="deadline"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deadline</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="jenis_category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jenis Category (opsional)</FormLabel>
                  <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? '' : v)}>
                    <FormControl>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Pilih jenis category" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>Tidak ada</SelectItem>
                      {ORDER_JENIS_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="order_from"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Order From (opsional)</FormLabel>
                  <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? '' : v)}>
                    <FormControl>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Pilih asal order" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>Tidak ada</SelectItem>
                      {ORDER_FROM_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="broker"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Broker (opsional)</FormLabel>
                  <FormControl><Input placeholder="Nama broker" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="desain_fix_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gambar Desain Fix (opsional)</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-3">
                      {field.value && (
                        <img
                          src={field.value}
                          alt="Desain Fix"
                          className="border-border h-16 w-16 shrink-0 rounded-md border object-cover"
                        />
                      )}
                      <div className="flex flex-col gap-1">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            e.target.value = ''
                            if (!file) return
                            setUploading(true)
                            try {
                              const url = await uploadApi.uploadDesignImage(file)
                              field.onChange(url)
                            } catch (err) {
                              toast.error(getErrorMessage(err))
                            } finally {
                              setUploading(false)
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploading}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                          {field.value ? 'Ganti Gambar' : 'Upload Gambar'}
                        </Button>
                        {field.value && (
                          <button
                            type="button"
                            className="text-destructive w-fit text-xs hover:underline"
                            onClick={() => field.onChange('')}
                          >
                            Hapus gambar
                          </button>
                        )}
                      </div>
                    </div>
                  </FormControl>
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

export default function OrderPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [customerFilter, setCustomerFilter] = React.useState(ALL)
  const [statusFilter, setStatusFilter] = React.useState(ALL)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<Order | undefined>(undefined)
  const [deletingItem, setDeletingItem] = React.useState<Order | null>(null)

  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: customerApi.listCustomers })

  const filters = {
    customer_id: customerFilter === ALL ? undefined : customerFilter,
    status: statusFilter === ALL ? undefined : (statusFilter as OrderStatus),
  }

  const { data, isLoading } = useQuery({
    queryKey: ['order-list', filters],
    queryFn: () => orderApi.listOrders(filters),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => orderApi.deleteOrder(id),
    onSuccess: () => {
      toast.success('Order dihapus')
      setDeletingItem(null)
      queryClient.invalidateQueries({ queryKey: ['order-list'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const hasFilters = customerFilter !== ALL || statusFilter !== ALL

  return (
    <div>
      <PageHeader
        title="Order"
        description="Kelola order customer, rincian item, status, dan deadline"
        breadcrumbs={[{ label: 'Dashboard', to: '/admin' }, { label: 'Order' }]}
        action={
          <Button
            onClick={() => {
              setEditingItem(undefined)
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
            <label className="text-muted-foreground text-xs font-medium">Customer</label>
            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua Customer</SelectItem>
                {customers?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua Status</SelectItem>
                {ORDER_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasFilters && (
            <Button variant="ghost" onClick={() => { setCustomerFilter(ALL); setStatusFilter(ALL) }}>
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
                  <TableHead>Jenis Category</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Total Rincian</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground text-center">
                      Belum ada order.
                    </TableCell>
                  </TableRow>
                )}
                {data?.map((order) => (
                  <TableRow key={order.id} className="cursor-pointer" onClick={() => navigate(`/admin/order/${order.id}`)}>
                    <TableCell className="font-medium">{order.order_name}</TableCell>
                    <TableCell>{order.customer_name}</TableCell>
                    <TableCell className="max-w-40 truncate">{order.jenis_category || '-'}</TableCell>
                    <TableCell>{order.deadline ? formatDate(order.deadline) : '-'}</TableCell>
                    <TableCell>{formatCurrency(order.items_total)}</TableCell>
                    <TableCell><OrderTaskStatusBadge status={order.status} /></TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/order/${order.id}`)} title="Lihat">
                        <Eye className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingItem(order)
                          setFormOpen(true)
                        }}
                        title="Edit"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={order.task_count > 0}
                        onClick={() => setDeletingItem(order)}
                        title="Hapus"
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

      <OrderFormDialog order={editingItem} open={formOpen} onOpenChange={setFormOpen} />

      <AlertDialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Order?</AlertDialogTitle>
            <AlertDialogDescription>
              Order "{deletingItem?.order_name}" akan dihapus permanen. Hanya order tanpa task yang dapat dihapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deletingItem && deleteMutation.mutate(deletingItem.id)}
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
