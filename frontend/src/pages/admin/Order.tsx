import * as React from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, Eye, X, Upload, ArrowUp, ArrowDown, MessageCircle, ChevronDown, Search, SquareArrowOutUpRight } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import { Checkbox } from '@/components/ui/checkbox'
import { OrderTaskStatusBadge } from '@/components/OrderTaskStatusBadge'
import { useFilterStore } from '@/stores/filterStore'
import * as orderApi from '@/services/orderApi'
import * as customerApi from '@/services/customerApi'
import * as taskApi from '@/services/taskApi'
import * as uploadApi from '@/services/uploadApi'
import * as settingsApi from '@/services/settingsApi'
import { getErrorMessage } from '@/services/api'
import { formatCurrency, formatDate } from '@/utils/format'
import type { Divisi, Order, OrderFrom, OrderJenisCategory, OrderStatus, WATemplateKey } from '@/types'

// Ad-hoc placeholders each template needs filled in fresh at send-time,
// rather than derived from stored order/customer data — mirrors
// ADHOC_FIELD_KEYS in the backend's waFollowUpService.js.
const TEMPLATE_ADHOC_FIELDS: Partial<Record<WATemplateKey, { key: string; label: string }[]>> = {
  invoice: [{ key: 'CATATAN', label: 'Catatan' }],
  picked_up: [
    { key: 'DISTRIBUSI', label: 'Distribusi (mis. "diambil langsung" / "dikirim via JNE")' },
    { key: 'DITERIMA', label: 'Diterima oleh' },
  ],
}

const ALL = 'all'
const NONE = '__none__'

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
const ORDER_FROM_OPTIONS: OrderFrom[] = ['SHOPEE', 'TIKTOK', 'WHATSAPP', 'WORKSHOP']
const DIVISIONS: Divisi[] = ['Jahit', 'Sablon', 'Cutting', 'Finishing']

const schema = z.object({
  customer_id: z.string().min(1, 'Customer wajib dipilih'),
  order_name: z.string().min(1, 'Nama order wajib diisi'),
  notes: z.string().optional(),
  deadline: z.string().optional(),
  jenis_category: z.string().optional(),
  order_from: z.string().optional(),
  broker: z.string().optional(),
  desain_fix_url: z.string().optional(),
  // Task sub-form: optional, only meaningful on create (see mutationFn) —
  // same "one divisi checked = one task" fan-out CreateTaskDialog uses in
  // TaskDetail.tsx, just filled in up front instead of as a separate step.
  task_divisi: z.array(z.enum(['Jahit', 'Sablon', 'Cutting', 'Finishing'])).optional(),
  task_description: z.string().optional(),
  task_target_qty: z.coerce.number().positive('Target qty harus lebih dari 0').optional(),
}).refine((v) => !v.task_divisi?.length || v.task_target_qty !== undefined, {
  message: 'Target qty wajib diisi jika divisi task dipilih',
  path: ['task_target_qty'],
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
      task_divisi: [],
      task_description: '',
      task_target_qty: undefined,
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
        task_divisi: [],
        task_description: '',
        task_target_qty: undefined,
      })
    }
  }, [open, order, form])

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      // Empty-string optionals must not be sent — the backend enum schemas
      // reject '' (only a real category/order_from value or omission).
      const { task_divisi, task_description, task_target_qty, ...orderValues } = values
      const payload = {
        ...orderValues,
        jenis_category: orderValues.jenis_category || undefined,
        order_from: orderValues.order_from || undefined,
        desain_fix_url: orderValues.desain_fix_url || undefined,
      } as orderApi.OrderInput
      const result = isEdit ? await orderApi.updateOrder(order.id, payload) : await orderApi.createOrder(payload)

      // Task sub-form only applies on create — there's no atomic
      // order+tasks endpoint, so this fans out the same way
      // CreateTaskDialog does, just immediately after the order exists
      // instead of as a separate later step.
      let tasksCreated = 0
      if (!isEdit && task_divisi && task_divisi.length > 0) {
        for (const divisi of task_divisi) {
          await taskApi.createTask({
            order_id: result.id,
            divisi,
            description: task_description,
            target_qty: task_target_qty!,
          })
          tasksCreated += 1
        }
      }
      return { result, tasksCreated }
    },
    onSuccess: ({ result, tasksCreated }) => {
      toast.success(
        isEdit
          ? 'Order berhasil diperbarui'
          : tasksCreated > 0
            ? `Order ditambahkan beserta ${tasksCreated} task`
            : 'Order berhasil ditambahkan'
      )
      queryClient.invalidateQueries({ queryKey: ['order-list'] })
      onOpenChange(false)
      if (!isEdit) navigate(`/admin/order/${result.id}`)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
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
            {!isEdit && (
              <div className="flex flex-col gap-4 rounded-md border p-3">
                <p className="text-sm font-medium">Task Produksi (opsional)</p>
                <FormField
                  control={form.control}
                  name="task_divisi"
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
                        Pilih divisi untuk otomatis membuat task begitu order tersimpan. Pilih lebih dari satu untuk
                        membuat task yang sama di setiap divisi sekaligus.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="task_description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deskripsi Task (opsional)</FormLabel>
                      <FormControl><Textarea placeholder="Contoh: Jahit badan & lengan" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="task_target_qty"
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
              </div>
            )}
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
            <DialogFooter className="sticky bottom-0">
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

function FollowUpWADialog({ order, onOpenChange }: { order: Order | null; onOpenChange: (open: boolean) => void }) {
  const [templateKey, setTemplateKey] = React.useState<string>('')
  const [fields, setFields] = React.useState<Record<string, string>>({})
  const [message, setMessage] = React.useState('')

  const { data: templates } = useQuery({ queryKey: ['wa-templates'], queryFn: settingsApi.listWATemplates })

  React.useEffect(() => {
    if (order) {
      setTemplateKey('')
      setFields({})
      setMessage('')
    }
  }, [order])

  const adhocFields = templateKey ? TEMPLATE_ADHOC_FIELDS[templateKey as WATemplateKey] || [] : []

  const resolveQuery = useQuery({
    queryKey: ['follow-up-message', order?.id, templateKey, fields],
    queryFn: () => orderApi.resolveFollowUpMessage(order!.id, templateKey, fields),
    enabled: !!order && !!templateKey,
  })

  React.useEffect(() => {
    if (resolveQuery.data) setMessage(resolveQuery.data.message)
  }, [resolveQuery.data])

  const phone = resolveQuery.data?.phone || ''

  function handleOpenWhatsApp() {
    if (!phone) return
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank')
  }

  return (
    <Dialog open={!!order} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Follow Up WhatsApp — {order?.order_name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Template</label>
            <Select value={templateKey} onValueChange={setTemplateKey}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Pilih template" /></SelectTrigger>
              <SelectContent>
                {templates?.map((t) => (
                  <SelectItem key={t.template_key} value={t.template_key}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {adhocFields.map((f) => (
            <div key={f.key} className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{f.label}</label>
              <Input
                value={fields[f.key] || ''}
                onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
              />
            </div>
          ))}

          {templateKey && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Pratinjau Pesan</label>
              {resolveQuery.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={12}
                  className="text-xs"
                />
              )}
              {!phone && !resolveQuery.isLoading && (
                <p className="text-destructive text-xs">
                  Customer belum punya nomor HP — tidak bisa membuka WhatsApp.
                </p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={handleOpenWhatsApp} disabled={!templateKey || !phone || resolveQuery.isLoading}>
            <MessageCircle className="size-4" /> Buka WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function OrderPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { customerFilter, statusFilter, paymentStatusFilter, jenisCategoryFilter, search, sortField, sortDir } =
    useFilterStore((state) => state.order)
  const setOrderFilter = useFilterStore((state) => state.setOrder)
  const resetOrderFilter = useFilterStore((state) => state.resetOrder)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<Order | undefined>(undefined)
  const [deletingItem, setDeletingItem] = React.useState<Order | null>(null)
  const [followUpOrder, setFollowUpOrder] = React.useState<Order | null>(null)
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
    queryKey: ['order-list', filters],
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
      // paymentStatusFilter may be missing on state persisted before this
      // filter existed — treat anything but a real category as "semua".
      if (
        (paymentStatusFilter === 'lunas' || paymentStatusFilter === 'belum_lunas') &&
        o.status_pembayaran !== paymentStatusFilter
      ) {
        return false
      }
      if (jenisCategoryFilter !== ALL && o.jenis_category !== jenisCategoryFilter) return false
      if (query) {
        const haystack = `${o.order_name} ${o.customer_name || ''}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
    const sorted = [...filtered].sort((a, b) => compareOrders(a, b, sortField))
    return sortDir === 'asc' ? sorted : sorted.reverse()
  }, [data, statusFilter, paymentStatusFilter, jenisCategoryFilter, search, sortField, sortDir])

  const rowsWithActions = React.useMemo(
    () =>
      sortedData.map((order) => ({
        order,
        actions: [
          { label: 'Lihat', icon: Eye, onClick: () => navigate(`/admin/order/${order.id}`) },
          { label: 'Follow Up WA', icon: MessageCircle, onClick: () => setFollowUpOrder(order) },
          {
            label: 'Lacak Order',
            icon: SquareArrowOutUpRight,
            onClick: () => handleOpenTrackingLink(order),
            loading: trackingLinkPendingId === order.id,
          },
          {
            label: 'Edit',
            icon: Pencil,
            onClick: () => {
              setEditingItem(order)
              setFormOpen(true)
            },
          },
          {
            label: 'Hapus',
            icon: Trash2,
            variant: 'destructive',
            disabled: order.task_count > 0,
            onClick: () => setDeletingItem(order),
          },
        ] satisfies RowAction[],
      })),
    [sortedData, trackingLinkPendingId]
  )

  const deleteMutation = useMutation({
    mutationFn: (id: string) => orderApi.deleteOrder(id),
    onSuccess: () => {
      toast.success('Order dihapus')
      setDeletingItem(null)
      queryClient.invalidateQueries({ queryKey: ['order-list'] })
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
            <label className="text-muted-foreground text-xs font-medium">Status Pembayaran</label>
            <Select
              value={paymentStatusFilter || ALL}
              onValueChange={(v) => setOrderFilter({ paymentStatusFilter: v as typeof paymentStatusFilter })}
            >
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua</SelectItem>
                <SelectItem value="lunas">Lunas</SelectItem>
                <SelectItem value="belum_lunas">Belum Lunas</SelectItem>
              </SelectContent>
            </Select>
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
            <>
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Jenis Category</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Total Rincian</TableHead>
                    <TableHead>Pembayaran</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-muted-foreground text-center">
                        Belum ada order.
                      </TableCell>
                    </TableRow>
                  )}
                  {rowsWithActions.map(({ order, actions }) => (
                    <TableRow key={order.id} className="cursor-pointer" onClick={() => navigate(`/admin/order/${order.id}`)}>
                      <TableCell className="font-medium">{order.order_name}</TableCell>
                      <TableCell>{order.customer_name}</TableCell>
                      <TableCell className="max-w-40 truncate">{order.jenis_category || '-'}</TableCell>
                      <TableCell>{order.deadline ? formatDate(order.deadline) : '-'}</TableCell>
                      <TableCell>
                        {formatCurrency(order.sisa_pembayaran)}
                        {order.total_dp > 0 && (
                          <span className="text-muted-foreground block text-xs">
                            -{formatCurrency(order.total_dp)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={order.status_pembayaran === 'lunas' ? 'default' : 'secondary'}>
                          {order.status_pembayaran === 'lunas' ? 'Lunas' : 'Belum Lunas'}
                        </Badge>
                      </TableCell>
                      <TableCell><OrderTaskStatusBadge status={order.status} /></TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <RowActionsMenu actions={actions} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {data?.length === 0 && (
                <p className="text-muted-foreground px-4 py-6 text-center text-sm md:hidden">Belum ada order.</p>
              )}
              <MobileCardList className="p-4">
                {rowsWithActions.map(({ order, actions }) => (
                  <MobileCard key={order.id} onClick={() => navigate(`/admin/order/${order.id}`)}>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{order.order_name}</p>
                        <p className="text-muted-foreground text-xs">{order.customer_name}</p>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <RowActionsMenu actions={actions} />
                      </div>
                    </div>
                    <MobileCardRow label="Jenis Category">{order.jenis_category || '-'}</MobileCardRow>
                    <MobileCardRow label="Deadline">
                      {order.deadline ? formatDate(order.deadline) : '-'}
                    </MobileCardRow>
                    <MobileCardRow label="Total Rincian">
                      <div>
                        {formatCurrency(order.sisa_pembayaran)}
                        {order.total_dp > 0 && (
                          <span className="text-muted-foreground block text-xs">
                            -{formatCurrency(order.total_dp)}
                          </span>
                        )}
                      </div>
                    </MobileCardRow>
                    <MobileCardRow label="Pembayaran">
                      <Badge variant={order.status_pembayaran === 'lunas' ? 'default' : 'secondary'}>
                        {order.status_pembayaran === 'lunas' ? 'Lunas' : 'Belum Lunas'}
                      </Badge>
                    </MobileCardRow>
                    <MobileCardRow label="Status">
                      <OrderTaskStatusBadge status={order.status} />
                    </MobileCardRow>
                  </MobileCard>
                ))}
              </MobileCardList>
            </>
          )}
        </CardContent>
      </Card>

      <OrderFormDialog order={editingItem} open={formOpen} onOpenChange={setFormOpen} />

      <FollowUpWADialog order={followUpOrder} onOpenChange={(open) => !open && setFollowUpOrder(null)} />

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
