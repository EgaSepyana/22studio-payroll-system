import * as React from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, Receipt, Wallet, CheckCircle2, HandCoins, Banknote } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { RowActionsMenu, type RowAction } from '@/components/RowActionsMenu'
import { MobileCardList, MobileCard, MobileCardRow } from '@/components/MobileCardList'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import * as ownerLiabilityApi from '@/services/ownerLiabilityApi'
import * as ownerSettingsApi from '@/services/ownerSettingsApi'
import * as ownerCashApi from '@/services/ownerCashApi'
import { getErrorMessage } from '@/services/api'
import { formatCurrency, formatDate, todayISO } from '@/utils/format'
import type { OwnerLiability, OwnerLiabilityDetail, OwnerLiabilityStatus } from '@/types'

const NONE = '__none__'

const STATUS_LABEL: Record<OwnerLiabilityStatus, string> = { unpaid: 'Unpaid', partial: 'Partial', paid: 'Paid' }
const STATUS_VARIANT: Record<OwnerLiabilityStatus, 'default' | 'secondary' | 'destructive'> = {
  unpaid: 'destructive',
  partial: 'default',
  paid: 'secondary',
}
const STATUS_OPTIONS: { value: OwnerLiabilityStatus; label: string }[] = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
]

const schema = z.object({
  date: z.string().min(1, 'Tanggal wajib diisi'),
  due_date: z.string().optional(),
  creditor_name: z.string().min(1, 'Nama kreditur wajib diisi'),
  creditor_address: z.string().optional(),
  category_id: z.string().min(1, 'Kategori wajib dipilih'),
  qty: z.coerce.number().positive('Kuantitas harus lebih dari 0'),
  unit_price: z.coerce.number().nonnegative('Harga satuan tidak valid'),
  description: z.string().optional(),
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

function LiabilityFormDialog({
  liability,
  open,
  onOpenChange,
}: {
  liability?: OwnerLiability
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isEdit = !!liability
  const queryClient = useQueryClient()
  const { data: categories } = useQuery({
    queryKey: ['owner-categories', 'liability'],
    queryFn: () => ownerSettingsApi.listCategories('liability'),
  })
  const activeCategories = React.useMemo(() => (categories || []).filter((c) => c.is_active), [categories])

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: liability?.date || todayISO(),
      due_date: liability?.due_date || '',
      creditor_name: liability?.creditor_name || '',
      creditor_address: liability?.creditor_address || '',
      category_id: liability?.category_id || '',
      qty: liability?.qty || 1,
      unit_price: liability?.unit_price || 0,
      description: liability?.description || '',
    },
  })

  React.useEffect(() => {
    if (open) {
      form.reset({
        date: liability?.date || todayISO(),
        due_date: liability?.due_date || '',
        creditor_name: liability?.creditor_name || '',
        creditor_address: liability?.creditor_address || '',
        category_id: liability?.category_id || '',
        qty: liability?.qty || 1,
        unit_price: liability?.unit_price || 0,
        description: liability?.description || '',
      })
    }
  }, [open, liability, form])

  const qty = Number(form.watch('qty')) || 0
  const unitPrice = Number(form.watch('unit_price')) || 0

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      isEdit ? ownerLiabilityApi.updateLiability(liability.id, values) : ownerLiabilityApi.createLiability(values),
    onSuccess: () => {
      toast.success(isEdit ? 'Kewajiban diperbarui' : 'Kewajiban ditambahkan')
      queryClient.invalidateQueries({ queryKey: ['owner-liabilities'] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Kewajiban' : 'Tambah Kewajiban'}</DialogTitle>
          <DialogDescription>Catat utang ke supplier atau upah tenaga kerja.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="flex flex-col gap-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tanggal</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jatuh Tempo</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="creditor_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Kreditur</FormLabel>
                  <FormControl>
                    <Input placeholder="Nama supplier / karyawan" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="creditor_address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alamat (opsional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Alamat kreditur" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kategori</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="qty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kuantitas</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="any" {...field} value={(field.value ?? '') as string | number} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unit_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Harga Satuan</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="any" {...field} value={(field.value ?? '') as string | number} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="bg-muted/50 flex items-center justify-between rounded-md px-3 py-2 text-sm">
              <span className="text-muted-foreground">Nilai Total</span>
              <span className="font-medium">{formatCurrency(qty * unitPrice)}</span>
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Keterangan (opsional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Catatan kewajiban" {...field} />
                  </FormControl>
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

const paymentSchema = z.object({
  date: z.string().min(1, 'Tanggal wajib diisi'),
  amount: z.coerce.number().positive('Jumlah harus lebih dari 0'),
  account_id: z.string().min(1, 'Akun kas wajib dipilih'),
  description: z.string().optional(),
})
type PaymentFormInput = z.input<typeof paymentSchema>
type PaymentFormValues = z.output<typeof paymentSchema>

function LiabilityDetailDialog({
  liabilityId,
  open,
  onOpenChange,
}: {
  liabilityId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const { data: detail, isLoading } = useQuery({
    queryKey: ['owner-liability-detail', liabilityId],
    queryFn: () => ownerLiabilityApi.getLiabilityDetail(liabilityId as string),
    enabled: !!liabilityId && open,
  })
  const { data: accounts } = useQuery({ queryKey: ['owner-cash-accounts'], queryFn: ownerCashApi.listAccounts })
  const activeAccounts = React.useMemo(() => (accounts || []).filter((a) => a.is_active), [accounts])
  const [deletingPaymentId, setDeletingPaymentId] = React.useState<string | null>(null)

  const form = useForm<PaymentFormInput, unknown, PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { date: todayISO(), amount: 0, account_id: '', description: '' },
  })

  React.useEffect(() => {
    if (detail) {
      form.reset({ date: todayISO(), amount: detail.remaining, account_id: '', description: '' })
    }
  }, [detail?.id, detail?.remaining, form, detail])

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['owner-liability-detail', liabilityId] })
    queryClient.invalidateQueries({ queryKey: ['owner-liabilities'] })
    queryClient.invalidateQueries({ queryKey: ['owner-cash-balances'] })
  }

  const payMutation = useMutation({
    mutationFn: (values: PaymentFormValues) => ownerLiabilityApi.createPayment(liabilityId as string, values),
    onSuccess: () => {
      toast.success('Pembayaran dicatat')
      invalidate()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const deletePaymentMutation = useMutation({
    mutationFn: (paymentId: string) => ownerLiabilityApi.deletePayment(liabilityId as string, paymentId),
    onSuccess: () => {
      toast.success('Pembayaran dihapus')
      setDeletingPaymentId(null)
      invalidate()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const detailTyped = detail as OwnerLiabilityDetail | undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{detailTyped ? `${detailTyped.code} — ${detailTyped.creditor_name}` : 'Detail Kewajiban'}</DialogTitle>
          <DialogDescription>Ringkasan dan riwayat pembayaran.</DialogDescription>
        </DialogHeader>

        {isLoading || !detailTyped ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="bg-muted/50 grid grid-cols-2 gap-3 rounded-md p-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Nilai Total</p>
                <p className="font-medium">{formatCurrency(detailTyped.value)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Sudah Dibayar</p>
                <p className="font-medium">{formatCurrency(detailTyped.amount_paid)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Sisa</p>
                <p className="font-medium">{formatCurrency(detailTyped.remaining)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Status</p>
                <Badge variant={STATUS_VARIANT[detailTyped.status]}>{STATUS_LABEL[detailTyped.status]}</Badge>
              </div>
            </div>

            {detailTyped.status !== 'paid' && (
              <Form {...form}>
                <form
                  className="flex flex-col gap-3 rounded-md border p-3"
                  onSubmit={form.handleSubmit((values) => payMutation.mutate(values))}
                >
                  <p className="flex items-center gap-1.5 text-sm font-medium"><HandCoins className="size-4" /> Bayar</p>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Tanggal</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Jumlah</FormLabel>
                          <FormControl>
                            <Input type="number" min={0} step="any" {...field} value={(field.value ?? '') as string | number} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="account_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Akun Kas</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full"><SelectValue placeholder="Pilih akun kas" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {activeAccounts.map((a) => (
                              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea placeholder="Catatan pembayaran (opsional)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" size="sm" className="w-fit" disabled={payMutation.isPending}>
                    {payMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                    Catat Pembayaran
                  </Button>
                </form>
              </Form>
            )}

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium"><Banknote className="size-4" /> Riwayat Pembayaran</p>
              {detailTyped.payments.length === 0 ? (
                <p className="text-muted-foreground text-sm">Belum ada pembayaran.</p>
              ) : (
                <div className="flex flex-col divide-y">
                  {detailTyped.payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <div>
                        <p>{formatDate(p.date)} — {p.account_name}</p>
                        {p.description && <p className="text-muted-foreground text-xs">{p.description}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatCurrency(p.amount)}</span>
                        <Button variant="ghost" size="icon" onClick={() => setDeletingPaymentId(p.id)}>
                          <Trash2 className="text-destructive size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>

      <AlertDialog open={!!deletingPaymentId} onOpenChange={(o) => !o && setDeletingPaymentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pembayaran?</AlertDialogTitle>
            <AlertDialogDescription>
              Sisa kewajiban akan bertambah kembali sebesar jumlah pembayaran ini.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deletingPaymentId && deletePaymentMutation.mutate(deletingPaymentId)}
            >
              {deletePaymentMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}

export default function OwnerLiabilitiesPage() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<OwnerLiability | undefined>(undefined)
  const [deleting, setDeleting] = React.useState<OwnerLiability | null>(null)
  const [detailId, setDetailId] = React.useState<string | null>(null)
  const [detailOpen, setDetailOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [categoryFilter, setCategoryFilter] = React.useState<string>(NONE)
  const [statusFilter, setStatusFilter] = React.useState<string>(NONE)

  const { data: categories } = useQuery({
    queryKey: ['owner-categories', 'liability'],
    queryFn: () => ownerSettingsApi.listCategories('liability'),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['owner-liabilities', search, categoryFilter, statusFilter],
    queryFn: () =>
      ownerLiabilityApi.listLiabilities({
        search: search || undefined,
        category_id: categoryFilter === NONE ? undefined : categoryFilter,
        status: statusFilter === NONE ? undefined : (statusFilter as OwnerLiabilityStatus),
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: ownerLiabilityApi.deleteLiability,
    onSuccess: () => {
      toast.success('Kewajiban dihapus')
      setDeleting(null)
      queryClient.invalidateQueries({ queryKey: ['owner-liabilities'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const summary = React.useMemo(() => {
    const rows = data || []
    return {
      count: rows.length,
      value: rows.reduce((sum, r) => sum + r.value, 0),
      paid: rows.reduce((sum, r) => sum + r.amount_paid, 0),
      remaining: rows.reduce((sum, r) => sum + r.remaining, 0),
    }
  }, [data])

  const rowsWithActions = React.useMemo(
    () =>
      (data || []).map((liability) => ({
        liability,
        actions: [
          {
            label: 'Edit',
            icon: Pencil,
            onClick: () => {
              setEditing(liability)
              setDialogOpen(true)
            },
          },
          {
            label: 'Bayar',
            icon: HandCoins,
            disabled: liability.status === 'paid',
            onClick: () => {
              setDetailId(liability.id)
              setDetailOpen(true)
            },
          },
          {
            label: 'Hapus',
            icon: Trash2,
            variant: 'destructive',
            disabled: liability.amount_paid > 0,
            onClick: () => setDeleting(liability),
          },
        ] satisfies RowAction[],
      })),
    [data]
  )

  return (
    <div>
      <PageHeader
        title="Kewajiban"
        description="Utang ke supplier dan upah tenaga kerja, dengan dukungan pembayaran bertahap"
        breadcrumbs={[{ label: 'Dashboard', to: '/owner' }, { label: 'Kewajiban' }]}
        action={
          <Button
            onClick={() => {
              setEditing(undefined)
              setDialogOpen(true)
            }}
          >
            <Plus className="size-4" /> Tambah Kewajiban
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Jumlah Record" value={summary.count} icon={Receipt} />
          <StatCard label="Total Nilai" value={formatCurrency(summary.value)} icon={Wallet} />
          <StatCard label="Sudah Dibayar" value={formatCurrency(summary.paid)} icon={CheckCircle2} accent="success" />
          <StatCard label="Sisa Kewajiban" value={formatCurrency(summary.remaining)} icon={HandCoins} accent="warning" />
        </div>

        <Card className="shadow-sm">
          <CardContent className="flex flex-wrap gap-3">
            <Input
              placeholder="Cari kode/nama kreditur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-56"
            />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Semua kategori" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Semua kategori</SelectItem>
                {categories?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Semua status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Semua status</SelectItem>
                {STATUS_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
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
                      <TableHead>Kode</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Kreditur</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead className="text-right">Sisa</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Jatuh Tempo</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-muted-foreground text-center">
                          Belum ada data kewajiban.
                        </TableCell>
                      </TableRow>
                    )}
                    {rowsWithActions.map(({ liability, actions }) => (
                      <TableRow
                        key={liability.id}
                        className="cursor-pointer"
                        onClick={() => {
                          setDetailId(liability.id)
                          setDetailOpen(true)
                        }}
                      >
                        <TableCell className="font-medium">{liability.code}</TableCell>
                        <TableCell>{formatDate(liability.date)}</TableCell>
                        <TableCell>{liability.creditor_name}</TableCell>
                        <TableCell>{liability.category_name || '-'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(liability.remaining)}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[liability.status]}>{STATUS_LABEL[liability.status]}</Badge>
                        </TableCell>
                        <TableCell>{liability.due_date ? formatDate(liability.due_date) : '-'}</TableCell>
                        <TableCell className="text-right">
                          <RowActionsMenu actions={actions} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {data?.length === 0 && (
                  <p className="text-muted-foreground px-4 py-6 text-center text-sm md:hidden">
                    Belum ada data kewajiban.
                  </p>
                )}
                <MobileCardList className="p-4">
                  {rowsWithActions.map(({ liability, actions }) => (
                    <MobileCard
                      key={liability.id}
                      onClick={() => {
                        setDetailId(liability.id)
                        setDetailOpen(true)
                      }}
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{liability.code} — {liability.creditor_name}</p>
                          <p className="text-muted-foreground text-xs">{formatDate(liability.date)}</p>
                        </div>
                        <RowActionsMenu actions={actions} />
                      </div>
                      <MobileCardRow label="Kategori">{liability.category_name || '-'}</MobileCardRow>
                      <MobileCardRow label="Sisa">{formatCurrency(liability.remaining)}</MobileCardRow>
                      <MobileCardRow label="Status">
                        <Badge variant={STATUS_VARIANT[liability.status]}>{STATUS_LABEL[liability.status]}</Badge>
                      </MobileCardRow>
                    </MobileCard>
                  ))}
                </MobileCardList>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <LiabilityFormDialog liability={editing} open={dialogOpen} onOpenChange={setDialogOpen} />
      <LiabilityDetailDialog liabilityId={detailId} open={detailOpen} onOpenChange={setDetailOpen} />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kewajiban?</AlertDialogTitle>
            <AlertDialogDescription>
              Kewajiban "{deleting?.code} — {deleting?.creditor_name}" akan dihapus permanen beserta entri HPP terkait.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
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
