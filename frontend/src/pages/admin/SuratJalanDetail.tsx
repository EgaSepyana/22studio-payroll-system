import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, Printer, FileDown, X, Check } from 'lucide-react'
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

function ItemInlineForm({
  initial,
  pending,
  onSubmit,
  onCancel,
}: {
  initial?: ItemFormState
  pending: boolean
  onSubmit: (data: { nama_item: string; qty: number }) => void
  onCancel?: () => void
}) {
  const [form, setForm] = React.useState<ItemFormState>(initial || emptyForm)
  const [error, setError] = React.useState<string | null>(null)

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="flex-1">
        <Input
          placeholder="Nama item"
          value={form.nama_item}
          onChange={(e) => setForm((f) => ({ ...f, nama_item: e.target.value }))}
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

export default function SuratJalanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showAddForm, setShowAddForm] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<SuratJalanItem | null>(null)
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
      setShowAddForm(false)
      invalidate()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const updateMutation = useMutation({
    mutationFn: (vars: { itemId: string; input: suratJalanApi.SuratJalanItemInput }) =>
      suratJalanApi.updateSuratJalanItem(id!, vars.itemId, vars.input),
    onSuccess: () => {
      toast.success('Item diperbarui')
      setEditingItem(null)
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
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  return (
    <div>
      <Button variant="ghost" className="mb-3" onClick={() => navigate('/admin/surat-jalan')}>
        <ArrowLeft className="size-4" /> Kembali
      </Button>

      <PageHeader
        title={data.no_document}
        description={`${data.customer_name} — ${formatDate(data.created_at)}`}
        breadcrumbs={[
          { label: 'Dashboard', to: '/admin' },
          { label: 'Surat Jalan', to: '/admin/surat-jalan' },
          { label: data.no_document },
        ]}
        action={
          <div className="flex gap-2">
            <Button variant="outline" disabled={!!pdfPending} onClick={handlePrint}>
              {pdfPending === 'print' ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
              Print
            </Button>
            <Button variant="outline" disabled={!!pdfPending} onClick={handleDownload}>
              {pdfPending === 'download' ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
              Download PDF
            </Button>
          </div>
        }
      />

      <Card className="mb-4 shadow-sm">
        <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
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

      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-sm font-semibold">Barang</h3>
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
                  <TableHead className="w-24">Qty</TableHead>
                  <TableHead className="w-24 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.length === 0 && !showAddForm && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground text-center">
                      Belum ada item.
                    </TableCell>
                  </TableRow>
                )}
                {data.items.map((item) =>
                  editingItem?.id === item.id ? (
                    <TableRow key={item.id}>
                      <TableCell colSpan={3}>
                        <ItemInlineForm
                          initial={{ nama_item: item.nama_item, qty: String(item.qty) }}
                          pending={updateMutation.isPending}
                          onSubmit={(input) => updateMutation.mutate({ itemId: item.id, input })}
                          onCancel={() => setEditingItem(null)}
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={item.id}>
                      <TableCell>{item.nama_item}</TableCell>
                      <TableCell>{item.qty}</TableCell>
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
                    <TableCell colSpan={3}>
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
