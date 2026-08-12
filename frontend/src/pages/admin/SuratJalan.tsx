import * as React from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, Printer, FileDown, Eye, X } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import * as suratJalanApi from '@/services/suratJalanApi'
import { useFilterStore } from '@/stores/filterStore'
import * as customerApi from '@/services/customerApi'
import { getErrorMessage } from '@/services/api'
import { formatDate } from '@/utils/format'
import type { SuratJalan } from '@/types'

const ALL = 'all'

const schema = z.object({
  customer_id: z.string().min(1, 'Customer wajib dipilih'),
  penerima_nama: z.string().optional(),
  penerima_telepon: z.string().optional(),
  penerima_alamat: z.string().optional(),
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

function SuratJalanFormDialog({
  suratJalan,
  open,
  onOpenChange,
}: {
  suratJalan?: SuratJalan
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isEdit = !!suratJalan
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: customerApi.listCustomers })

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      customer_id: suratJalan?.customer_id || '',
      penerima_nama: suratJalan?.penerima_nama || '',
      penerima_telepon: suratJalan?.penerima_telepon || '',
      penerima_alamat: suratJalan?.penerima_alamat || '',
    },
  })

  React.useEffect(() => {
    if (open) {
      form.reset({
        customer_id: suratJalan?.customer_id || '',
        penerima_nama: suratJalan?.penerima_nama || '',
        penerima_telepon: suratJalan?.penerima_telepon || '',
        penerima_alamat: suratJalan?.penerima_alamat || '',
      })
    }
  }, [open, suratJalan, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      isEdit ? suratJalanApi.updateSuratJalan(suratJalan.id, values) : suratJalanApi.createSuratJalan(values),
    onSuccess: (result) => {
      toast.success(isEdit ? 'Surat Jalan berhasil diperbarui' : 'Surat Jalan berhasil ditambahkan')
      queryClient.invalidateQueries({ queryKey: ['surat-jalan'] })
      onOpenChange(false)
      if (!isEdit) navigate(`/admin/surat-jalan/${result.id}`)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Surat Jalan' : 'Tambah Surat Jalan'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="flex flex-col gap-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <FormField
              control={form.control}
              name="customer_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
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
              name="penerima_nama"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Penerima</FormLabel>
                  <FormControl><Input placeholder="Nama penerima barang" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="penerima_telepon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telepon Penerima</FormLabel>
                  <FormControl><Input placeholder="08xx-xxxx-xxxx" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="penerima_alamat"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alamat Penerima</FormLabel>
                  <FormControl><Textarea placeholder="Alamat lengkap tujuan pengiriman" {...field} /></FormControl>
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

export default function SuratJalanPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { customerFilter } = useFilterStore((state) => state.suratJalan)
  const setSuratJalanFilter = useFilterStore((state) => state.setSuratJalan)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<SuratJalan | undefined>(undefined)
  const [deletingItem, setDeletingItem] = React.useState<SuratJalan | null>(null)
  const [pdfActionId, setPdfActionId] = React.useState<string | null>(null)

  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: customerApi.listCustomers })

  const filters = {
    customer_id: customerFilter === ALL ? undefined : customerFilter,
  }

  const { data, isLoading } = useQuery({
    queryKey: ['surat-jalan', filters],
    queryFn: () => suratJalanApi.listSuratJalan(filters),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => suratJalanApi.deleteSuratJalan(id),
    onSuccess: () => {
      toast.success('Surat Jalan dihapus')
      setDeletingItem(null)
      queryClient.invalidateQueries({ queryKey: ['surat-jalan'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  async function handlePrint(row: SuratJalan) {
    setPdfActionId(row.id)
    try {
      await suratJalanApi.printSuratJalan(row.id)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setPdfActionId(null)
    }
  }

  async function handleDownload(row: SuratJalan) {
    setPdfActionId(row.id)
    try {
      await suratJalanApi.downloadSuratJalanPdf(row.id, row.no_document)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setPdfActionId(null)
    }
  }

  const rowsWithActions = React.useMemo(
    () =>
      (data || []).map((row) => ({
        row,
        actions: [
          { label: 'Lihat', icon: Eye, onClick: () => navigate(`/admin/surat-jalan/${row.id}`) },
          {
            label: 'Print',
            icon: Printer,
            loading: pdfActionId === row.id,
            onClick: () => handlePrint(row),
          },
          { label: 'Download PDF', icon: FileDown, disabled: pdfActionId === row.id, onClick: () => handleDownload(row) },
          {
            label: 'Edit',
            icon: Pencil,
            onClick: () => {
              setEditingItem(row)
              setFormOpen(true)
            },
          },
          { label: 'Hapus', icon: Trash2, variant: 'destructive', onClick: () => setDeletingItem(row) },
        ] satisfies RowAction[],
      })),
    [data, pdfActionId]
  )

  return (
    <div>
      <PageHeader
        title="Surat Jalan"
        description="Kelola surat jalan pengiriman barang ke customer"
        breadcrumbs={[{ label: 'Dashboard', to: '/admin' }, { label: 'Surat Jalan' }]}
        action={
          <Button
            onClick={() => {
              setEditingItem(undefined)
              setFormOpen(true)
            }}
          >
            <Plus className="size-4" /> Tambah Surat Jalan
          </Button>
        }
      />

      <Card className="mb-4 shadow-sm">
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Customer</label>
            <Select value={customerFilter} onValueChange={(v) => setSuratJalanFilter({ customerFilter: v })}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua Customer</SelectItem>
                {customers?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {customerFilter !== ALL && (
            <Button variant="ghost" onClick={() => setSuratJalanFilter({ customerFilter: ALL })}>
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
                    <TableHead>No Dokumen</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Nama Penerima</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground text-center">
                        Belum ada surat jalan.
                      </TableCell>
                    </TableRow>
                  )}
                  {rowsWithActions.map(({ row, actions }) => (
                    <TableRow key={row.id} className="cursor-pointer" onClick={() => navigate(`/admin/surat-jalan/${row.id}`)}>
                      <TableCell className="font-medium">{row.no_document}</TableCell>
                      <TableCell>{row.customer_name}</TableCell>
                      <TableCell>{row.penerima_nama || '-'}</TableCell>
                      <TableCell>{formatDate(row.created_at)}</TableCell>
                      <TableCell>{row.item_count}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <RowActionsMenu actions={actions} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {data?.length === 0 && (
                <p className="text-muted-foreground px-4 py-6 text-center text-sm md:hidden">
                  Belum ada surat jalan.
                </p>
              )}
              <MobileCardList className="p-4">
                {rowsWithActions.map(({ row, actions }) => (
                  <MobileCard key={row.id} onClick={() => navigate(`/admin/surat-jalan/${row.id}`)}>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{row.no_document}</p>
                        <p className="text-muted-foreground text-xs">{row.customer_name}</p>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <RowActionsMenu actions={actions} />
                      </div>
                    </div>
                    <MobileCardRow label="Nama Penerima">{row.penerima_nama || '-'}</MobileCardRow>
                    <MobileCardRow label="Tanggal">{formatDate(row.created_at)}</MobileCardRow>
                    <MobileCardRow label="Item">{row.item_count}</MobileCardRow>
                  </MobileCard>
                ))}
              </MobileCardList>
            </>
          )}
        </CardContent>
      </Card>

      <SuratJalanFormDialog suratJalan={editingItem} open={formOpen} onOpenChange={setFormOpen} />

      <AlertDialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Surat Jalan?</AlertDialogTitle>
            <AlertDialogDescription>
              Surat Jalan "{deletingItem?.no_document}" beserta seluruh itemnya akan dihapus permanen.
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
