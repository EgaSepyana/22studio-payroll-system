import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  Check,
  Printer,
  FileDown,
  FileSpreadsheet,
  ChevronRight,
  ChevronDown,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { OrderTaskStatusBadge } from '@/components/OrderTaskStatusBadge'
import { RowActionsMenu } from '@/components/RowActionsMenu'
import { Textarea } from '@/components/ui/textarea'
import * as orderApi from '@/services/orderApi'
import { getErrorMessage } from '@/services/api'
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format'
import type { OrderDP, OrderItem, OrderItemSize, OrderStatus, OrderTimelineEntry } from '@/types'

const FIXED_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL', '6XL']
const SIZE_SELECT_OPTIONS = [...FIXED_SIZES, 'Custom']

// Mirrors backend orderService.js's MANUAL_TRANSITIONS — Desain Fix -> On
// Progress -> Done are never here since those stay purely automatic
// (driven by task completion). Only these 3 manual transitions ever show an
// action button + confirm dialog.
const MANUAL_TRANSITIONS: Partial<Record<OrderStatus, { next: OrderStatus; label: string; requiresShipping: boolean }>> = {
  'Belum Di Proses': { next: 'Desain Fix', label: 'Konfirmasi Desain Fix', requiresShipping: false },
  Done: { next: 'Dikirim', label: 'Tandai Dikirim', requiresShipping: true },
  Dikirim: { next: 'Di Ambil Costumer', label: 'Tandai Diambil Customer', requiresShipping: false },
}

function ItemEditForm({
  initial,
  pending,
  onSubmit,
  onCancel,
}: {
  initial?: { nama_item: string; warna: string }
  pending: boolean
  onSubmit: (data: { nama_item: string; warna: string }) => void
  onCancel?: () => void
}) {
  const [namaItem, setNamaItem] = React.useState(initial?.nama_item || '')
  const [warna, setWarna] = React.useState(initial?.warna || '')
  const [error, setError] = React.useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const nama_item = namaItem.trim()
    if (!nama_item) return setError('Nama item wajib diisi')
    setError(null)
    onSubmit({ nama_item, warna: warna.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="flex-1">
        <Input placeholder="Nama item" value={namaItem} onChange={(e) => setNamaItem(e.target.value)} />
      </div>
      <div className="w-full sm:w-40">
        <Input placeholder="Color" value={warna} onChange={(e) => setWarna(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="icon" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="icon" onClick={onCancel}>
            <X className="size-4" />
          </Button>
        )}
      </div>
      {error && <p className="text-destructive w-full text-xs sm:hidden">{error}</p>}
    </form>
  )
}

interface SizeFormState {
  sizeOption: string
  customSize: string
  harga: string
  qty: string
}

function emptySizeForm(): SizeFormState {
  return { sizeOption: '', customSize: '', harga: '', qty: '' }
}

function sizeFormFromInitial(initial: { size: string; harga: string; qty: string }): SizeFormState {
  const isFixed = FIXED_SIZES.includes(initial.size)
  return {
    sizeOption: isFixed ? initial.size : 'Custom',
    customSize: isFixed ? '' : initial.size,
    harga: initial.harga,
    qty: initial.qty,
  }
}

function SizeInlineForm({
  initial,
  pending,
  onSubmit,
  onCancel,
}: {
  initial?: { size: string; harga: string; qty: string }
  pending: boolean
  onSubmit: (data: { size: string; harga: number; qty: number }) => void
  onCancel?: () => void
}) {
  const [form, setForm] = React.useState<SizeFormState>(
    initial ? sizeFormFromInitial(initial) : emptySizeForm()
  )
  const [error, setError] = React.useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const size = form.sizeOption === 'Custom' ? form.customSize.trim() : form.sizeOption
    const harga = Number(form.harga)
    const qty = Number(form.qty)
    if (!size) return setError('Size wajib diisi')
    if (!(harga >= 0)) return setError('Harga tidak valid')
    if (!(qty > 0)) return setError('Qty harus lebih dari 0')
    setError(null)
    onSubmit({ size, harga, qty })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="w-full sm:w-28">
        <Select
          value={form.sizeOption}
          onValueChange={(v) => setForm((f) => ({ ...f, sizeOption: v }))}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Size" />
          </SelectTrigger>
          <SelectContent>
            {SIZE_SELECT_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {form.sizeOption === 'Custom' && (
        <div className="w-full sm:w-28">
          <Input
            placeholder="Nama size"
            value={form.customSize}
            onChange={(e) => setForm((f) => ({ ...f, customSize: e.target.value }))}
          />
        </div>
      )}
      <div className="w-full sm:w-32">
        <Input
          type="number"
          min={0}
          placeholder="Harga"
          value={form.harga}
          onChange={(e) => setForm((f) => ({ ...f, harga: e.target.value }))}
        />
      </div>
      <div className="w-full sm:w-24">
        <Input
          type="number"
          min={1}
          placeholder="Qty"
          value={form.qty}
          onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="icon" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="icon" onClick={onCancel}>
            <X className="size-4" />
          </Button>
        )}
      </div>
      {error && <p className="text-destructive w-full text-xs sm:hidden">{error}</p>}
    </form>
  )
}

function AddItemTemplateDialog({
  open,
  pending,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  pending: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: orderApi.OrderItemTemplateInput) => void
}) {
  const [namaItem, setNamaItem] = React.useState('')
  const [warna, setWarna] = React.useState('')
  const [qtyBySize, setQtyBySize] = React.useState<Record<string, string>>({})
  const [hargaBySize, setHargaBySize] = React.useState<Record<string, string>>({})
  const [customSize, setCustomSize] = React.useState('')
  const [customQty, setCustomQty] = React.useState('')
  const [customHarga, setCustomHarga] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) {
      setNamaItem('')
      setWarna('')
      setQtyBySize({})
      setHargaBySize({})
      setCustomSize('')
      setCustomQty('')
      setCustomHarga('')
      setError(null)
    }
  }, [open])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = namaItem.trim()
    if (!name) return setError('Nama item wajib diisi')

    const sizes: { size: string; harga?: number; qty: number }[] = []
    for (const size of FIXED_SIZES) {
      const qty = Number(qtyBySize[size])
      if (qty > 0) sizes.push({ size, harga: Number(hargaBySize[size]) || 0, qty })
    }
    const customQtyNum = Number(customQty)
    if (customSize.trim() && customQtyNum > 0) {
      sizes.push({ size: customSize.trim(), harga: Number(customHarga) || 0, qty: customQtyNum })
    }
    if (sizes.length === 0) return setError('Isi qty minimal satu size')

    setError(null)
    onSubmit({ nama_item: name, warna: warna.trim() || undefined, sizes })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <label className="w-20 shrink-0 text-sm font-medium">Nama Item</label>
            <Input value={namaItem} onChange={(e) => setNamaItem(e.target.value)} className="flex-1" />
          </div>
          <div className="flex items-center gap-3">
            <label className="w-20 shrink-0 text-sm font-medium">Color</label>
            <Input value={warna} onChange={(e) => setWarna(e.target.value)} className="flex-1" />
          </div>
          <div className="flex items-center gap-3">
            <span className="w-20 shrink-0" />
            <span className="text-muted-foreground flex-1 text-xs">Harga</span>
            <span className="text-muted-foreground w-20 shrink-0 text-xs">Qty</span>
          </div>
          {FIXED_SIZES.map((size) => (
            <div key={size} className="flex items-center gap-3">
              <label className="w-20 shrink-0 text-sm">{size}</label>
              <Input
                type="number"
                min={0}
                placeholder="Harga"
                value={hargaBySize[size] || ''}
                onChange={(e) => setHargaBySize((prev) => ({ ...prev, [size]: e.target.value }))}
                className="flex-1"
              />
              <Input
                type="number"
                min={0}
                placeholder="Qty"
                value={qtyBySize[size] || ''}
                onChange={(e) => setQtyBySize((prev) => ({ ...prev, [size]: e.target.value }))}
                className="w-20 shrink-0"
              />
            </div>
          ))}
          <div className="flex items-center gap-3">
            <Input
              placeholder="Nama size"
              value={customSize}
              onChange={(e) => setCustomSize(e.target.value)}
              className="w-20 shrink-0"
            />
            <Input
              type="number"
              min={0}
              placeholder="Harga"
              value={customHarga}
              onChange={(e) => setCustomHarga(e.target.value)}
              className="flex-1"
            />
            <Input
              type="number"
              min={0}
              placeholder="Qty"
              value={customQty}
              onChange={(e) => setCustomQty(e.target.value)}
              className="w-20 shrink-0"
            />
          </div>
          {error && <p className="text-destructive text-xs">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Tambah
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DPFormDialog({
  dp,
  open,
  pending,
  onOpenChange,
  onSubmit,
}: {
  dp?: OrderDP
  open: boolean
  pending: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: { dp_at: string; total_dp: number }) => void
}) {
  const [dpAt, setDpAt] = React.useState('')
  const [totalDp, setTotalDp] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setDpAt(dp?.dp_at || '')
      setTotalDp(dp ? String(dp.total_dp) : '')
      setError(null)
    }
  }, [open, dp])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = Number(totalDp)
    if (!dpAt) return setError('Tanggal DP wajib diisi')
    if (!(amount > 0)) return setError('Nominal DP harus lebih dari 0')
    setError(null)
    onSubmit({ dp_at: dpAt, total_dp: amount })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{dp ? 'Edit DP' : 'Tambah DP'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Tanggal DP</label>
            <Input type="date" value={dpAt} onChange={(e) => setDpAt(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Nominal DP</label>
            <Input
              type="number"
              min={0}
              placeholder="Rp"
              value={totalDp}
              onChange={(e) => setTotalDp(e.target.value)}
            />
          </div>
          {error && <p className="text-destructive text-xs">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function StatusTransitionDialog({
  transition,
  pending,
  onOpenChange,
  onSubmit,
}: {
  transition: { next: OrderStatus; label: string; requiresShipping: boolean } | null
  pending: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: { status: OrderStatus; note?: string; resi?: string; shipping_method?: string }) => void
}) {
  const [note, setNote] = React.useState('')
  const [resi, setResi] = React.useState('')
  const [method, setMethod] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (transition) {
      setNote('')
      setResi('')
      setMethod('')
      setError(null)
    }
  }, [transition])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!transition) return
    if (transition.requiresShipping && (!resi.trim() || !method.trim())) {
      return setError('Resi dan metode pengiriman wajib diisi')
    }
    setError(null)
    onSubmit({
      status: transition.next,
      note: note.trim() || undefined,
      resi: transition.requiresShipping ? resi.trim() : undefined,
      shipping_method: transition.requiresShipping ? method.trim() : undefined,
    })
  }

  return (
    <Dialog open={!!transition} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{transition?.label}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {transition?.requiresShipping && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Metode Pengiriman</label>
                <Input placeholder="Contoh: JNE REG" value={method} onChange={(e) => setMethod(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">No. Resi</label>
                <Input value={resi} onChange={(e) => setResi(e.target.value)} />
              </div>
            </>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Catatan (opsional)</label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && <p className="text-destructive text-xs">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Konfirmasi
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [addItemDialogOpen, setAddItemDialogOpen] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<OrderItem | null>(null)
  const [deletingItem, setDeletingItem] = React.useState<OrderItem | null>(null)
  const [expandedItemIds, setExpandedItemIds] = React.useState<Set<string>>(new Set())
  const [addingSizeItemId, setAddingSizeItemId] = React.useState<string | null>(null)
  const [editingSize, setEditingSize] = React.useState<{ itemId: string; size: OrderItemSize } | null>(null)
  const [deletingSize, setDeletingSize] = React.useState<{ itemId: string; size: OrderItemSize } | null>(null)
  const [pdfPending, setPdfPending] = React.useState<'print' | 'download' | 'excel' | null>(null)
  const [dpDialogOpen, setDpDialogOpen] = React.useState(false)
  const [editingDP, setEditingDP] = React.useState<OrderDP | undefined>(undefined)
  const [deletingDP, setDeletingDP] = React.useState<OrderDP | null>(null)
  const [transitionDialogOpen, setTransitionDialogOpen] = React.useState(false)

  function toggleExpanded(itemId: string) {
    setExpandedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  const { data, isLoading } = useQuery({
    queryKey: ['order-detail', id],
    queryFn: () => orderApi.getOrderDetail(id!),
    enabled: !!id,
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['order-detail', id] })
    queryClient.invalidateQueries({ queryKey: ['order-list'] })
  }

  const statusMutation = useMutation({
    mutationFn: (vars: { status: OrderStatus; note?: string; resi?: string; shipping_method?: string }) =>
      orderApi.updateOrder(id!, vars),
    onSuccess: () => {
      toast.success('Status order diperbarui')
      setTransitionDialogOpen(false)
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['order-timeline', id] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const { data: timelineData } = useQuery({
    queryKey: ['order-timeline', id],
    queryFn: () => orderApi.getOrderTimeline(id!),
    enabled: !!id,
  })

  const pendingTransition = data ? MANUAL_TRANSITIONS[data.status] || null : null

  const addMutation = useMutation({
    mutationFn: (input: orderApi.OrderItemTemplateInput) => orderApi.addOrderItemFromTemplate(id!, input),
    onSuccess: (item) => {
      toast.success('Item ditambahkan')
      setAddItemDialogOpen(false)
      setExpandedItemIds((prev) => new Set(prev).add(item.id))
      invalidate()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const updateMutation = useMutation({
    mutationFn: (vars: { itemId: string; nama_item: string; warna: string }) =>
      orderApi.updateOrderItem(id!, vars.itemId, { nama_item: vars.nama_item, warna: vars.warna }),
    onSuccess: () => {
      toast.success('Item diperbarui')
      setEditingItem(null)
      invalidate()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => orderApi.deleteOrderItem(id!, itemId),
    onSuccess: () => {
      toast.success('Item dihapus')
      setDeletingItem(null)
      invalidate()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const addSizeMutation = useMutation({
    mutationFn: (vars: { itemId: string; input: orderApi.OrderItemSizeInput }) =>
      orderApi.addOrderItemSize(id!, vars.itemId, vars.input),
    onSuccess: () => {
      toast.success('Size ditambahkan')
      setAddingSizeItemId(null)
      invalidate()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const updateSizeMutation = useMutation({
    mutationFn: (vars: { itemId: string; sizeId: string; input: orderApi.OrderItemSizeInput }) =>
      orderApi.updateOrderItemSize(id!, vars.itemId, vars.sizeId, vars.input),
    onSuccess: () => {
      toast.success('Size diperbarui')
      setEditingSize(null)
      invalidate()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const deleteSizeMutation = useMutation({
    mutationFn: (vars: { itemId: string; sizeId: string }) =>
      orderApi.deleteOrderItemSize(id!, vars.itemId, vars.sizeId),
    onSuccess: () => {
      toast.success('Size dihapus')
      setDeletingSize(null)
      invalidate()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const addDPMutation = useMutation({
    mutationFn: (input: orderApi.OrderDPInput) => orderApi.addOrderDP(id!, input),
    onSuccess: () => {
      toast.success('DP ditambahkan')
      setDpDialogOpen(false)
      invalidate()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const updateDPMutation = useMutation({
    mutationFn: (vars: { dpId: string; input: orderApi.OrderDPInput }) =>
      orderApi.updateOrderDP(id!, vars.dpId, vars.input),
    onSuccess: () => {
      toast.success('DP diperbarui')
      setEditingDP(undefined)
      setDpDialogOpen(false)
      invalidate()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const deleteDPMutation = useMutation({
    mutationFn: (dpId: string) => orderApi.deleteOrderDP(id!, dpId),
    onSuccess: () => {
      toast.success('DP dihapus')
      setDeletingDP(null)
      invalidate()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  async function handlePrint() {
    if (!id) return
    setPdfPending('print')
    try {
      await orderApi.printOrderInvoice(id)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setPdfPending(null)
    }
  }

  async function handleDownload() {
    if (!id || !data) return
    setPdfPending('download')
    try {
      await orderApi.downloadOrderInvoicePdf(id, data.order_name)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setPdfPending(null)
    }
  }

  async function handleDownloadExcel() {
    if (!id || !data) return
    setPdfPending('excel')
    try {
      await orderApi.downloadOrderInvoiceExcel(id, data.order_name)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setPdfPending(null)
    }
  }

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
      <Button variant="ghost" className="mb-3" onClick={() => navigate('/admin/order')}>
        <ArrowLeft className="size-4" /> Kembali
      </Button>

      <PageHeader
        title={data.order_name}
        description={data.customer_name || undefined}
        breadcrumbs={[
          { label: 'Dashboard', to: '/admin' },
          { label: 'Order', to: '/admin/order' },
          { label: data.order_name },
        ]}
        action={
          <div className="flex gap-2">
            <Button variant="outline" disabled={!!pdfPending} onClick={handlePrint}>
              {pdfPending === 'print' ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
              Print Invoice
            </Button>
            <Button variant="outline" disabled={!!pdfPending} onClick={handleDownload}>
              {pdfPending === 'download' ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
              Download PDF
            </Button>
            <Button variant="outline" disabled={!!pdfPending} onClick={handleDownloadExcel}>
              {pdfPending === 'excel' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="size-4" />
              )}
              Download Excel
            </Button>
          </div>
        }
      />

      <Card className="mb-4 shadow-sm">
        <CardContent className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground text-xs">Deadline</p>
            <p className="font-medium">{data.deadline ? formatDate(data.deadline) : '-'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Progress Task</p>
            <p className="font-medium">{data.completed_task_count}/{data.task_count} task selesai</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1 text-xs">Status</p>
            <div className="flex items-center gap-2">
              <OrderTaskStatusBadge status={data.status} />
              {pendingTransition && (
                <Button size="sm" variant="outline" onClick={() => setTransitionDialogOpen(true)}>
                  {pendingTransition.label}
                </Button>
              )}
            </div>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Jenis Category</p>
            <p className="font-medium">{data.jenis_category || '-'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Order From</p>
            <p className="font-medium">{data.order_from || '-'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Broker</p>
            <p className="font-medium">{data.broker || '-'}</p>
          </div>
          <div className="sm:col-span-3">
            <p className="text-muted-foreground text-xs">Desain Fix</p>
            {data.desain_fix_url ? (
              <a
                href={data.desain_fix_url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 flex max-w-xs items-center gap-2"
              >
                <img
                  src={data.desain_fix_url}
                  alt="Desain Fix"
                  className="border-border h-24 w-24 rounded-md border object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
                <span className="text-primary text-xs hover:underline">Buka gambar</span>
              </a>
            ) : (
              <p className="font-medium">-</p>
            )}
          </div>
          {data.notes && (
            <div className="sm:col-span-3">
              <p className="text-muted-foreground text-xs">Catatan</p>
              <p className="font-medium">{data.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {timelineData && timelineData.timeline.length > 0 && (
        <Card className="mb-4 shadow-sm">
          <CardContent className="flex flex-col gap-3">
            <h3 className="font-heading text-sm font-semibold">Riwayat Status</h3>
            <div className="flex flex-col gap-3">
              {timelineData.timeline.map((entry: OrderTimelineEntry) => (
                <div key={entry.id} className="border-border flex items-start gap-3 border-l-2 pl-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <OrderTaskStatusBadge status={entry.stage} />
                      {entry.sub_stage && <span className="text-muted-foreground text-xs">{entry.sub_stage}</span>}
                    </div>
                    {entry.note && <p className="text-muted-foreground mt-0.5 text-xs">{entry.note}</p>}
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {formatDateTime(entry.created_at)} — {entry.actor}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {timelineData.shipping && (
              <div className="border-border mt-1 border-t pt-3 text-sm">
                <p className="text-muted-foreground text-xs">Pengiriman</p>
                <p className="font-medium">
                  {timelineData.shipping.method} — {timelineData.shipping.resi}
                </p>
                {timelineData.shipping.note && (
                  <p className="text-muted-foreground text-xs">{timelineData.shipping.note}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-sm font-semibold">Rincian Order</h3>
            <Button size="sm" onClick={() => setAddItemDialogOpen(true)}>
              <Plus className="size-4" /> Tambah Item
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Item</TableHead>
                  <TableHead className="w-28">Color</TableHead>
                  <TableHead className="w-20">Qty</TableHead>
                  <TableHead className="w-32">Total</TableHead>
                  <TableHead className="w-24 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground text-center">
                      Belum ada rincian item.
                    </TableCell>
                  </TableRow>
                )}
                {data.items.map((item) => {
                  const isExpanded = expandedItemIds.has(item.id)
                  return (
                    <React.Fragment key={item.id}>
                      {editingItem?.id === item.id ? (
                        <TableRow>
                          <TableCell colSpan={5}>
                            <ItemEditForm
                              initial={{ nama_item: item.nama_item, warna: item.warna }}
                              pending={updateMutation.isPending}
                              onSubmit={(vals) => updateMutation.mutate({ itemId: item.id, ...vals })}
                              onCancel={() => setEditingItem(null)}
                            />
                          </TableCell>
                        </TableRow>
                      ) : (
                        <TableRow>
                          <TableCell>
                            <button
                              type="button"
                              className="flex items-center gap-1.5 text-left hover:underline"
                              onClick={() => toggleExpanded(item.id)}
                            >
                              {isExpanded ? (
                                <ChevronDown className="text-muted-foreground size-4 shrink-0" />
                              ) : (
                                <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                              )}
                              {item.nama_item}
                            </button>
                          </TableCell>
                          <TableCell>{item.warna || '-'}</TableCell>
                          <TableCell>{item.qty}</TableCell>
                          <TableCell>{formatCurrency(item.total)}</TableCell>
                          <TableCell className="text-right">
                            <RowActionsMenu
                              actions={[
                                { label: 'Edit', icon: Pencil, onClick: () => setEditingItem(item) },
                                {
                                  label: 'Hapus',
                                  icon: Trash2,
                                  variant: 'destructive',
                                  onClick: () => setDeletingItem(item),
                                },
                              ]}
                            />
                          </TableCell>
                        </TableRow>
                      )}

                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-muted/30 p-0">
                            <div className="flex flex-col gap-2 p-3 pl-9">
                              {item.sizes.length === 0 && addingSizeItemId !== item.id && (
                                <p className="text-muted-foreground text-xs">Belum ada size.</p>
                              )}
                              {item.sizes.map((size) =>
                                editingSize?.itemId === item.id && editingSize.size.id === size.id ? (
                                  <SizeInlineForm
                                    key={size.id}
                                    initial={{ size: size.size, harga: String(size.harga), qty: String(size.qty) }}
                                    pending={updateSizeMutation.isPending}
                                    onSubmit={(input) =>
                                      updateSizeMutation.mutate({ itemId: item.id, sizeId: size.id, input })
                                    }
                                    onCancel={() => setEditingSize(null)}
                                  />
                                ) : (
                                  <div key={size.id} className="flex items-center gap-2 text-sm">
                                    <span className="w-28 font-medium">{size.size}</span>
                                    <span className="w-32">{formatCurrency(size.harga)}</span>
                                    <span className="w-24">{size.qty}</span>
                                    <span className="flex-1">{formatCurrency(size.total)}</span>
                                    <RowActionsMenu
                                      actions={[
                                        {
                                          label: 'Edit',
                                          icon: Pencil,
                                          onClick: () => setEditingSize({ itemId: item.id, size }),
                                        },
                                        {
                                          label: 'Hapus',
                                          icon: Trash2,
                                          variant: 'destructive',
                                          onClick: () => setDeletingSize({ itemId: item.id, size }),
                                        },
                                      ]}
                                    />
                                  </div>
                                )
                              )}
                              {addingSizeItemId === item.id ? (
                                <SizeInlineForm
                                  pending={addSizeMutation.isPending}
                                  onSubmit={(input) => addSizeMutation.mutate({ itemId: item.id, input })}
                                  onCancel={() => setAddingSizeItemId(null)}
                                />
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-fit"
                                  onClick={() => setAddingSizeItemId(item.id)}
                                >
                                  <Plus className="size-4" /> Tambah Size
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end gap-2 text-sm font-semibold">
            <span>Total Item</span>
            <span>{formatCurrency(data.items_total)}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4 shadow-sm">
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-sm font-semibold">Pembayaran (DP)</h3>
            <Button
              size="sm"
              onClick={() => {
                setEditingDP(undefined)
                setDpDialogOpen(true)
              }}
            >
              <Plus className="size-4" /> Tambah DP
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal DP</TableHead>
                  <TableHead className="w-40">Nominal</TableHead>
                  <TableHead className="w-24 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.dp.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground text-center">
                      Belum ada DP.
                    </TableCell>
                  </TableRow>
                )}
                {data.dp.map((dp) => (
                  <TableRow key={dp.id}>
                    <TableCell>{formatDate(dp.dp_at)}</TableCell>
                    <TableCell>{formatCurrency(dp.total_dp)}</TableCell>
                    <TableCell className="text-right">
                      <RowActionsMenu
                        actions={[
                          {
                            label: 'Edit',
                            icon: Pencil,
                            onClick: () => {
                              setEditingDP(dp)
                              setDpDialogOpen(true)
                            },
                          },
                          { label: 'Hapus', icon: Trash2, variant: 'destructive', onClick: () => setDeletingDP(dp) },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col items-end gap-1 text-sm">
            <div className="text-muted-foreground flex gap-2">
              <span>Total Item</span>
              <span className="w-32 text-right">{formatCurrency(data.items_total)}</span>
            </div>
            <div className="text-muted-foreground flex gap-2">
              <span>Total DP</span>
              <span className="w-32 text-right">-{formatCurrency(data.total_dp)}</span>
            </div>
            <div className="flex gap-2 font-semibold">
              <span>Sisa Pembayaran</span>
              <span className="w-32 text-right">{formatCurrency(data.sisa_pembayaran)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <AddItemTemplateDialog
        open={addItemDialogOpen}
        pending={addMutation.isPending}
        onOpenChange={setAddItemDialogOpen}
        onSubmit={(input) => addMutation.mutate(input)}
      />

      <AlertDialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Item?</AlertDialogTitle>
            <AlertDialogDescription>
              Item "{deletingItem?.nama_item}" beserta seluruh sizenya akan dihapus permanen.
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

      <AlertDialog open={!!deletingSize} onOpenChange={(open) => !open && setDeletingSize(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Size?</AlertDialogTitle>
            <AlertDialogDescription>
              Size "{deletingSize?.size.size}" akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() =>
                deletingSize &&
                deleteSizeMutation.mutate({ itemId: deletingSize.itemId, sizeId: deletingSize.size.id })
              }
            >
              {deleteSizeMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DPFormDialog
        dp={editingDP}
        open={dpDialogOpen}
        pending={editingDP ? updateDPMutation.isPending : addDPMutation.isPending}
        onOpenChange={(open) => {
          setDpDialogOpen(open)
          if (!open) setEditingDP(undefined)
        }}
        onSubmit={(input) =>
          editingDP ? updateDPMutation.mutate({ dpId: editingDP.id, input }) : addDPMutation.mutate(input)
        }
      />

      <AlertDialog open={!!deletingDP} onOpenChange={(open) => !open && setDeletingDP(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus DP?</AlertDialogTitle>
            <AlertDialogDescription>
              DP tanggal {deletingDP && formatDate(deletingDP.dp_at)} sebesar{' '}
              {deletingDP && formatCurrency(deletingDP.total_dp)} akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deletingDP && deleteDPMutation.mutate(deletingDP.id)}
            >
              {deleteDPMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <StatusTransitionDialog
        transition={transitionDialogOpen ? pendingTransition : null}
        pending={statusMutation.isPending}
        onOpenChange={setTransitionDialogOpen}
        onSubmit={(vars) => statusMutation.mutate(vars)}
      />
    </div>
  )
}
