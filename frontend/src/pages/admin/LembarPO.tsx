import * as React from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, Printer, FileDown } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
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
import * as lembarPOApi from '@/services/lembarPOApi'
import * as orderApi from '@/services/orderApi'
import { getErrorMessage } from '@/services/api'
import type { LembarPO, OrderStatus } from '@/types'

const schema = z.object({
  order_id: z.string().min(1, 'Order wajib dipilih'),
  sablon_bordir: z.string().optional(),
  catatan: z.string().optional(),
  label: z.boolean().optional(),
  bahan_tipe: z.string().optional(),
  pola_potong: z.string().optional(),
  hangtag: z.boolean().optional(),
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

function LembarPOFormDialog({
  lembarPO,
  open,
  onOpenChange,
}: {
  lembarPO?: LembarPO
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isEdit = !!lembarPO
  const queryClient = useQueryClient()
  const { data: orders } = useQuery({ queryKey: ['order-list', {}], queryFn: () => orderApi.listOrders() })
  const { data: existingLembarPO } = useQuery({ queryKey: ['lembar-po'], queryFn: lembarPOApi.listLembarPO })

  const usedOrderIds = new Set(
    (existingLembarPO || []).filter((l) => l.id !== lembarPO?.id).map((l) => l.order_id)
  )
  const EXCLUDED_STATUSES: OrderStatus[] = ['Done', 'Dikirim', 'Di Ambil Costumer']
  const availableOrders = (orders || []).filter(
    (o) =>
      !usedOrderIds.has(o.id) &&
      // Keep the order currently linked to this Lembar PO selectable even if
      // its status has since moved past the cutoff — otherwise editing an
      // older Lembar PO would show an order_id with no matching option.
      (!EXCLUDED_STATUSES.includes(o.status) || o.id === lembarPO?.order_id)
  )

  function defaults(): FormInput {
    return {
      order_id: lembarPO?.order_id || '',
      sablon_bordir: lembarPO?.sablon_bordir || '',
      catatan: lembarPO?.catatan || '',
      label: lembarPO?.label || false,
      bahan_tipe: lembarPO?.bahan_tipe || '',
      pola_potong: lembarPO?.pola_potong || '',
      hangtag: lembarPO?.hangtag || false,
    }
  }

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults(),
  })

  React.useEffect(() => {
    if (open) form.reset(defaults())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lembarPO])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      isEdit ? lembarPOApi.updateLembarPO(lembarPO.id, values) : lembarPOApi.createLembarPO(values),
    onSuccess: () => {
      toast.success(isEdit ? 'Lembar PO berhasil diperbarui' : 'Lembar PO berhasil ditambahkan')
      queryClient.invalidateQueries({ queryKey: ['lembar-po'] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Lembar PO' : 'Tambah Lembar PO'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="flex flex-col gap-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <FormField
              control={form.control}
              name="order_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Order</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Pilih order" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableOrders.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.order_name} — {o.customer_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-3 rounded-md border p-3">
                <h4 className="text-sm font-semibold">Jahit</h4>
                <FormField
                  control={form.control}
                  name="sablon_bordir"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sablon / Bordir</FormLabel>
                      <FormControl><Input placeholder="Rubber, Bordir, dll" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="catatan"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Catatan</FormLabel>
                      <FormControl><Textarea placeholder="Catatan untuk Jahit" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="!mt-0">Label</FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex flex-col gap-3 rounded-md border p-3">
                <h4 className="text-sm font-semibold">Finishing</h4>
                <FormField
                  control={form.control}
                  name="bahan_tipe"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bahan & Tipe</FormLabel>
                      <FormControl><Input placeholder="Cotton 20s, dll" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pola_potong"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pola Potong</FormLabel>
                      <FormControl><Input placeholder="Pola Dewasa, dll" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="hangtag"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="!mt-0">Hangtag</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            </div>

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

export default function LembarPOPage() {
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<LembarPO | undefined>(undefined)
  const [deletingItem, setDeletingItem] = React.useState<LembarPO | null>(null)
  const [pdfActionId, setPdfActionId] = React.useState<string | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ['lembar-po'], queryFn: lembarPOApi.listLembarPO })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => lembarPOApi.deleteLembarPO(id),
    onSuccess: () => {
      toast.success('Lembar PO dihapus')
      setDeletingItem(null)
      queryClient.invalidateQueries({ queryKey: ['lembar-po'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  async function handlePrint(row: LembarPO) {
    setPdfActionId(row.id)
    try {
      await lembarPOApi.printLembarPO(row.id)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setPdfActionId(null)
    }
  }

  async function handleDownload(row: LembarPO) {
    setPdfActionId(row.id)
    try {
      await lembarPOApi.downloadLembarPOPdf(row.id, row.order_name || row.id)
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
          { label: 'Print', icon: Printer, loading: pdfActionId === row.id, onClick: () => handlePrint(row) },
          {
            label: 'Download PDF',
            icon: FileDown,
            disabled: pdfActionId === row.id,
            onClick: () => handleDownload(row),
          },
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
        title="Lembar PO"
        description="Kelola lembar PO (production order) untuk setiap order"
        breadcrumbs={[{ label: 'Dashboard', to: '/admin' }, { label: 'Lembar PO' }]}
        action={
          <Button
            onClick={() => {
              setEditingItem(undefined)
              setFormOpen(true)
            }}
          >
            <Plus className="size-4" /> Tambah Lembar PO
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
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Sablon / Bordir</TableHead>
                    <TableHead>Bahan & Tipe</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Hangtag</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-muted-foreground text-center">
                        Belum ada Lembar PO.
                      </TableCell>
                    </TableRow>
                  )}
                  {rowsWithActions.map(({ row, actions }) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.order_name || '-'}</TableCell>
                      <TableCell>{row.customer_name || '-'}</TableCell>
                      <TableCell>{row.sablon_bordir || '-'}</TableCell>
                      <TableCell>{row.bahan_tipe || '-'}</TableCell>
                      <TableCell>{row.label ? 'Ya' : 'Tidak'}</TableCell>
                      <TableCell>{row.hangtag ? 'Ya' : 'Tidak'}</TableCell>
                      <TableCell className="text-right">
                        <RowActionsMenu actions={actions} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {data?.length === 0 && (
                <p className="text-muted-foreground px-4 py-6 text-center text-sm md:hidden">
                  Belum ada Lembar PO.
                </p>
              )}
              <MobileCardList className="p-4">
                {rowsWithActions.map(({ row, actions }) => (
                  <MobileCard key={row.id}>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{row.order_name || '-'}</p>
                        <p className="text-muted-foreground text-xs">{row.customer_name || '-'}</p>
                      </div>
                      <RowActionsMenu actions={actions} />
                    </div>
                    <MobileCardRow label="Sablon / Bordir">{row.sablon_bordir || '-'}</MobileCardRow>
                    <MobileCardRow label="Bahan & Tipe">{row.bahan_tipe || '-'}</MobileCardRow>
                    <MobileCardRow label="Label">{row.label ? 'Ya' : 'Tidak'}</MobileCardRow>
                    <MobileCardRow label="Hangtag">{row.hangtag ? 'Ya' : 'Tidak'}</MobileCardRow>
                  </MobileCard>
                ))}
              </MobileCardList>
            </>
          )}
        </CardContent>
      </Card>

      <LembarPOFormDialog lembarPO={editingItem} open={formOpen} onOpenChange={setFormOpen} />

      <AlertDialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Lembar PO?</AlertDialogTitle>
            <AlertDialogDescription>
              Lembar PO untuk order "{deletingItem?.order_name}" akan dihapus permanen.
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
