import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, X, Check, Printer, FileDown } from 'lucide-react'
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
import * as orderApi from '@/services/orderApi'
import { getErrorMessage } from '@/services/api'
import { formatCurrency, formatDate } from '@/utils/format'
import type { OrderItem, OrderStatus } from '@/types'

const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'Desain Fix', label: 'Desain Fix' },
  { value: 'On Progress', label: 'On Progress' },
  { value: 'Done', label: 'Done' },
  { value: 'Di Ambil Costumer', label: 'Di Ambil Costumer' },
]

interface ItemFormState {
  nama_item: string
  harga: string
  qty: string
}

const emptyForm: ItemFormState = { nama_item: '', harga: '', qty: '' }

function ItemInlineForm({
  initial,
  pending,
  onSubmit,
  onCancel,
}: {
  initial?: ItemFormState
  pending: boolean
  onSubmit: (data: { nama_item: string; harga: number; qty: number }) => void
  onCancel?: () => void
}) {
  const [form, setForm] = React.useState<ItemFormState>(initial || emptyForm)
  const [error, setError] = React.useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const nama_item = form.nama_item.trim()
    const harga = Number(form.harga)
    const qty = Number(form.qty)
    if (!nama_item) return setError('Nama item wajib diisi')
    if (!(harga >= 0)) return setError('Harga tidak valid')
    if (!(qty > 0)) return setError('Qty harus lebih dari 0')
    setError(null)
    onSubmit({ nama_item, harga, qty })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="flex-1">
        <Input
          placeholder="Nama item"
          value={form.nama_item}
          onChange={(e) => setForm((f) => ({ ...f, nama_item: e.target.value }))}
        />
      </div>
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

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showAddForm, setShowAddForm] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<OrderItem | null>(null)
  const [deletingItem, setDeletingItem] = React.useState<OrderItem | null>(null)
  const [pdfPending, setPdfPending] = React.useState<'print' | 'download' | null>(null)

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
    mutationFn: (status: OrderStatus) => orderApi.updateOrder(id!, { status }),
    onSuccess: () => {
      toast.success('Status order diperbarui')
      invalidate()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const addMutation = useMutation({
    mutationFn: (input: orderApi.OrderItemInput) => orderApi.addOrderItem(id!, input),
    onSuccess: () => {
      toast.success('Item ditambahkan')
      setShowAddForm(false)
      invalidate()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const updateMutation = useMutation({
    mutationFn: (vars: { itemId: string; input: orderApi.OrderItemInput }) =>
      orderApi.updateOrderItem(id!, vars.itemId, vars.input),
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
            <Select
              value={data.status}
              onValueChange={(v) => statusMutation.mutate(v as OrderStatus)}
              disabled={statusMutation.isPending}
            >
              <SelectTrigger className="h-8 w-full">
                <SelectValue>
                  <OrderTaskStatusBadge status={data.status} />
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ORDER_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {data.notes && (
            <div className="sm:col-span-3">
              <p className="text-muted-foreground text-xs">Catatan</p>
              <p className="font-medium">{data.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-sm font-semibold">Rincian Order</h3>
            {!showAddForm && (
              <Button size="sm" onClick={() => setShowAddForm(true)}>
                <Plus className="size-4" /> Tambah Item
              </Button>
            )}
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Item</TableHead>
                  <TableHead className="w-32">Harga</TableHead>
                  <TableHead className="w-20">Qty</TableHead>
                  <TableHead className="w-32">Total</TableHead>
                  <TableHead className="w-24 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.length === 0 && !showAddForm && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground text-center">
                      Belum ada rincian item.
                    </TableCell>
                  </TableRow>
                )}
                {data.items.map((item) =>
                  editingItem?.id === item.id ? (
                    <TableRow key={item.id}>
                      <TableCell colSpan={5}>
                        <ItemInlineForm
                          initial={{ nama_item: item.nama_item, harga: String(item.harga), qty: String(item.qty) }}
                          pending={updateMutation.isPending}
                          onSubmit={(input) => updateMutation.mutate({ itemId: item.id, input })}
                          onCancel={() => setEditingItem(null)}
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={item.id}>
                      <TableCell>{item.nama_item}</TableCell>
                      <TableCell>{formatCurrency(item.harga)}</TableCell>
                      <TableCell>{item.qty}</TableCell>
                      <TableCell>{formatCurrency(item.total)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => setEditingItem(item)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeletingItem(item)}>
                          <Trash2 className="text-destructive size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                )}
                {showAddForm && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <ItemInlineForm
                        pending={addMutation.isPending}
                        onSubmit={(input) => addMutation.mutate(input)}
                        onCancel={() => setShowAddForm(false)}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end gap-2 text-sm font-semibold">
            <span>Total</span>
            <span>{formatCurrency(data.items_total)}</span>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Item?</AlertDialogTitle>
            <AlertDialogDescription>
              Item "{deletingItem?.nama_item}" akan dihapus permanen.
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
