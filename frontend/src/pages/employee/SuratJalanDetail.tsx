import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, Printer, FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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
import * as suratJalanApi from '@/services/suratJalanApi'
import { getErrorMessage } from '@/services/api'
import { formatDate } from '@/utils/format'
import type { SuratJalanItem } from '@/types'

interface ItemFormState {
  nama_item: string
  qty: string
}

const emptyForm: ItemFormState = { nama_item: '', qty: '' }

function ItemFormDialog({
  item,
  open,
  pending,
  onOpenChange,
  onSubmit,
}: {
  item?: SuratJalanItem
  open: boolean
  pending: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: { nama_item: string; qty: number }) => void
}) {
  const [form, setForm] = React.useState<ItemFormState>(emptyForm)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setForm(item ? { nama_item: item.nama_item, qty: String(item.qty) } : emptyForm)
      setError(null)
    }
  }, [open, item])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const nama_item = form.nama_item.trim()
    const qty = Number(form.qty)
    if (!nama_item) return setError('Nama item wajib diisi')
    if (!(qty > 0)) return setError('Qty harus lebih dari 0')
    setError(null)
    onSubmit({ nama_item, qty })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit Item' : 'Tambah Item'}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <Input
            className="h-12 text-base"
            placeholder="Nama item"
            value={form.nama_item}
            onChange={(e) => setForm((f) => ({ ...f, nama_item: e.target.value }))}
          />
          <Input
            type="number"
            min={1}
            className="h-12 text-base"
            placeholder="Qty"
            value={form.qty}
            onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
          />
          {error && <p className="text-destructive text-xs">{error}</p>}
          <DialogFooter>
            <Button type="submit" className="h-12 w-full text-base" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function SuratJalanDetailMobile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<SuratJalanItem | undefined>(undefined)
  const [deletingItem, setDeletingItem] = React.useState<SuratJalanItem | null>(null)
  const [pdfPending, setPdfPending] = React.useState<'print' | 'download' | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['surat-jalan-detail', id],
    queryFn: () => suratJalanApi.getSuratJalanDetail(id!),
    enabled: !!id,
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['surat-jalan-detail', id] })
    queryClient.invalidateQueries({ queryKey: ['surat-jalan'] })
  }

  const addMutation = useMutation({
    mutationFn: (input: suratJalanApi.SuratJalanItemInput) => suratJalanApi.addSuratJalanItem(id!, input),
    onSuccess: () => {
      toast.success('Item ditambahkan')
      setFormOpen(false)
      invalidate()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const updateMutation = useMutation({
    mutationFn: (vars: { itemId: string; input: suratJalanApi.SuratJalanItemInput }) =>
      suratJalanApi.updateSuratJalanItem(id!, vars.itemId, vars.input),
    onSuccess: () => {
      toast.success('Item diperbarui')
      setEditingItem(undefined)
      invalidate()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => suratJalanApi.deleteSuratJalanItem(id!, itemId),
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
      await suratJalanApi.printSuratJalan(id)
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
      await suratJalanApi.downloadSuratJalanPdf(id, data.no_document)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setPdfPending(null)
    }
  }

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" className="w-fit px-0" onClick={() => navigate('/app/surat-jalan')}>
        <ArrowLeft className="size-4" /> Kembali
      </Button>

      <div>
        <h1 className="font-heading text-xl font-semibold">{data.no_document}</h1>
        <p className="text-muted-foreground text-sm">{data.customer_name} — {formatDate(data.created_at)}</p>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="h-11 flex-1" disabled={!!pdfPending} onClick={handlePrint}>
          {pdfPending === 'print' ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
          Print
        </Button>
        <Button variant="outline" className="h-11 flex-1" disabled={!!pdfPending} onClick={handleDownload}>
          {pdfPending === 'download' ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
          PDF
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-2 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Nama Penerima</p>
            <p className="font-medium">{data.penerima_nama || '-'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Telepon Penerima</p>
            <p className="font-medium">{data.penerima_telepon || '-'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Alamat Penerima</p>
            <p className="font-medium">{data.penerima_alamat || '-'}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="font-heading text-sm font-semibold">Barang</h3>
        <Button
          size="sm"
          onClick={() => {
            setEditingItem(undefined)
            setFormOpen(true)
          }}
        >
          <Plus className="size-4" /> Tambah Item
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {data.items.length === 0 && (
          <p className="text-muted-foreground py-6 text-center text-sm">Belum ada item.</p>
        )}
        {data.items.map((item) => (
          <Card key={item.id} className="shadow-sm">
            <CardContent className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.nama_item}</p>
                <p className="text-muted-foreground text-xs">Qty: {item.qty}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditingItem(item)
                    setFormOpen(true)
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeletingItem(item)}>
                  <Trash2 className="text-destructive size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ItemFormDialog
        item={editingItem}
        open={formOpen}
        pending={editingItem ? updateMutation.isPending : addMutation.isPending}
        onOpenChange={setFormOpen}
        onSubmit={(input) =>
          editingItem ? updateMutation.mutate({ itemId: editingItem.id, input }) : addMutation.mutate(input)
        }
      />

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
