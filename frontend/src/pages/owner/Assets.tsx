import * as React from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, Package, Boxes, Wallet, ShoppingCart, Banknote } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import * as ownerAssetApi from '@/services/ownerAssetApi'
import * as ownerSettingsApi from '@/services/ownerSettingsApi'
import * as ownerCashApi from '@/services/ownerCashApi'
import { getErrorMessage } from '@/services/api'
import { formatCurrency, todayISO } from '@/utils/format'
import type { OwnerFixedAsset, OwnerFundingSource } from '@/types'

const NONE = '__none__'

const FUNDING_OPTIONS: { value: OwnerFundingSource; label: string }[] = [
  { value: 'cash', label: 'Kas' },
  { value: 'payable', label: 'Hutang (Kredit)' },
  { value: 'capital', label: 'Modal' },
]

function numOrEmpty(field: { value: unknown }) {
  return (field.value ?? '') as string | number
}

// --- Register new asset ---

const registerSchema = z.object({
  date: z.string().min(1, 'Tanggal wajib diisi'),
  name: z.string().min(1, 'Nama aset wajib diisi'),
  category_id: z.string().min(1, 'Kategori wajib dipilih'),
  location_id: z.string().min(1, 'Lokasi wajib dipilih'),
  description: z.string().optional(),
})
type RegisterFormInput = z.input<typeof registerSchema>
type RegisterFormValues = z.output<typeof registerSchema>

function RegisterAssetDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const { data: categories } = useQuery({
    queryKey: ['owner-categories', 'asset'],
    queryFn: () => ownerSettingsApi.listCategories('asset'),
  })
  const { data: locations } = useQuery({ queryKey: ['owner-locations'], queryFn: ownerSettingsApi.listLocations })

  const form = useForm<RegisterFormInput, unknown, RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { date: todayISO(), name: '', category_id: '', location_id: '', description: '' },
  })

  React.useEffect(() => {
    if (open) form.reset({ date: todayISO(), name: '', category_id: '', location_id: '', description: '' })
  }, [open, form])

  const mutation = useMutation({
    mutationFn: (values: RegisterFormValues) => ownerAssetApi.registerAsset(values),
    onSuccess: () => {
      toast.success('Aset baru terdaftar')
      queryClient.invalidateQueries({ queryKey: ['owner-assets'] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const activeCategories = (categories || []).filter((c) => c.is_active)
  const activeLocations = (locations || []).filter((l) => l.is_active)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Input Aset Baru</DialogTitle>
          <DialogDescription>Mendaftarkan identitas aset dengan kuantitas awal nol.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="flex flex-col gap-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tanggal</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Aset</FormLabel>
                  <FormControl><Input placeholder="Contoh: Mesin Jahit" autoFocus {...field} /></FormControl>
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
                    <FormControl><SelectTrigger className="w-full"><SelectValue placeholder="Pilih kategori" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {activeCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="location_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lokasi</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className="w-full"><SelectValue placeholder="Pilih lokasi" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {activeLocations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
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
                  <FormLabel>Catatan (opsional)</FormLabel>
                  <FormControl><Textarea {...field} /></FormControl>
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

// --- Buy more (funding source branching) ---

const buySchema = z.object({
  date: z.string().min(1, 'Tanggal wajib diisi'),
  qty: z.coerce.number().positive('Kuantitas harus lebih dari 0'),
  unit_price: z.coerce.number().nonnegative('Harga satuan tidak valid'),
  funding_source: z.enum(['cash', 'payable', 'capital']),
  account_id: z.string().optional(),
  creditor_name: z.string().optional(),
  creditor_address: z.string().optional(),
  due_date: z.string().optional(),
  capital_source_name: z.string().optional(),
  capital_note: z.string().optional(),
})
type BuyFormInput = z.input<typeof buySchema>
type BuyFormValues = z.output<typeof buySchema>

function FundingFields({ form }: { form: ReturnType<typeof useForm<BuyFormInput, unknown, BuyFormValues>> }) {
  const fundingSource = form.watch('funding_source')
  const { data: accounts } = useQuery({ queryKey: ['owner-cash-accounts'], queryFn: ownerCashApi.listAccounts })
  const activeAccounts = (accounts || []).filter((a) => a.is_active)

  return (
    <>
      <FormField
        control={form.control}
        name="funding_source"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Sumber Dana</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                {FUNDING_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      {fundingSource === 'cash' && (
        <FormField
          control={form.control}
          name="account_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Akun Kas</FormLabel>
              <Select value={field.value || ''} onValueChange={field.onChange}>
                <FormControl><SelectTrigger className="w-full"><SelectValue placeholder="Pilih akun kas" /></SelectTrigger></FormControl>
                <SelectContent>
                  {activeAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
      {fundingSource === 'payable' && (
        <>
          <FormField
            control={form.control}
            name="creditor_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nama Kreditur / Supplier</FormLabel>
                <FormControl><Input placeholder="Nama supplier" {...field} /></FormControl>
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
                <FormControl><Input {...field} /></FormControl>
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
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
      {fundingSource === 'capital' && (
        <>
          <FormField
            control={form.control}
            name="capital_source_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sumber Modal</FormLabel>
                <FormControl><Input placeholder="Nama sumber modal" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="capital_note"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Catatan (opsional)</FormLabel>
                <FormControl><Textarea {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    </>
  )
}

function BuyAssetDialog({
  asset,
  open,
  onOpenChange,
}: {
  asset: OwnerFixedAsset | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const form = useForm<BuyFormInput, unknown, BuyFormValues>({
    resolver: zodResolver(buySchema),
    defaultValues: { date: todayISO(), qty: 1, unit_price: 0, funding_source: 'cash' },
  })

  React.useEffect(() => {
    if (open) form.reset({ date: todayISO(), qty: 1, unit_price: 0, funding_source: 'cash' })
  }, [open, form])

  const mutation = useMutation({
    mutationFn: (values: BuyFormValues) => ownerAssetApi.buyAsset({ ...values, asset_id: asset!.id }),
    onSuccess: () => {
      toast.success('Pembelian aset dicatat')
      queryClient.invalidateQueries({ queryKey: ['owner-assets'] })
      queryClient.invalidateQueries({ queryKey: ['owner-cash-balances'] })
      queryClient.invalidateQueries({ queryKey: ['owner-liabilities'] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aset Beli / Masuk</DialogTitle>
          <DialogDescription>{asset ? `Menambah kuantitas "${asset.name}"` : ''}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="flex flex-col gap-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tanggal</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
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
                    <FormLabel>Kuantitas Masuk</FormLabel>
                    <FormControl><Input type="number" min={0} step="any" {...field} value={numOrEmpty(field)} /></FormControl>
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
                    <FormControl><Input type="number" min={0} step="any" {...field} value={numOrEmpty(field)} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FundingFields form={form} />
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

// --- Sell asset (cash-only, per this phase's explicit scope) ---

const sellSchema = z.object({
  date: z.string().min(1, 'Tanggal wajib diisi'),
  qty: z.coerce.number().positive('Kuantitas harus lebih dari 0'),
  sale_price: z.coerce.number().nonnegative().optional(),
  account_id: z.string().min(1, 'Akun kas tujuan wajib dipilih'),
})
type SellFormInput = z.input<typeof sellSchema>
type SellFormValues = z.output<typeof sellSchema>

function SellAssetDialog({
  asset,
  open,
  onOpenChange,
}: {
  asset: OwnerFixedAsset | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const { data: accounts } = useQuery({ queryKey: ['owner-cash-accounts'], queryFn: ownerCashApi.listAccounts })
  const activeAccounts = (accounts || []).filter((a) => a.is_active)

  const form = useForm<SellFormInput, unknown, SellFormValues>({
    resolver: zodResolver(sellSchema),
    defaultValues: { date: todayISO(), qty: 1, sale_price: undefined, account_id: '' },
  })

  React.useEffect(() => {
    if (open) form.reset({ date: todayISO(), qty: 1, sale_price: undefined, account_id: '' })
  }, [open, form])

  const mutation = useMutation({
    mutationFn: (values: SellFormValues) => ownerAssetApi.sellAsset({ ...values, asset_id: asset!.id }),
    onSuccess: () => {
      toast.success('Penjualan aset dicatat')
      queryClient.invalidateQueries({ queryKey: ['owner-assets'] })
      queryClient.invalidateQueries({ queryKey: ['owner-cash-balances'] })
      queryClient.invalidateQueries({ queryKey: ['owner-income'] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Jual / Keluar Aset</DialogTitle>
          <DialogDescription>
            {asset ? `Menjual "${asset.name}" (tersedia ${asset.qty})` : ''}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="flex flex-col gap-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tanggal</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
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
                    <FormLabel>Kuantitas Keluar</FormLabel>
                    <FormControl><Input type="number" min={0} step="any" {...field} value={numOrEmpty(field)} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sale_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Harga Jual (opsional)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="any" placeholder="Harga terakhir" {...field} value={numOrEmpty(field)} />
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
                  <FormLabel>Akun Kas Tujuan</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className="w-full"><SelectValue placeholder="Pilih akun kas" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {activeAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
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

export default function OwnerAssetsPage() {
  const queryClient = useQueryClient()
  const [registerOpen, setRegisterOpen] = React.useState(false)
  const [buyingAsset, setBuyingAsset] = React.useState<OwnerFixedAsset | null>(null)
  const [sellingAsset, setSellingAsset] = React.useState<OwnerFixedAsset | null>(null)
  const [deleting, setDeleting] = React.useState<OwnerFixedAsset | null>(null)
  const [search, setSearch] = React.useState('')
  const [categoryFilter, setCategoryFilter] = React.useState<string>(NONE)
  const [locationFilter, setLocationFilter] = React.useState<string>(NONE)
  const [sort, setSort] = React.useState<'name' | 'qty_asc' | 'qty_desc'>('name')

  const { data: categories } = useQuery({
    queryKey: ['owner-categories', 'asset'],
    queryFn: () => ownerSettingsApi.listCategories('asset'),
  })
  const { data: locations } = useQuery({ queryKey: ['owner-locations'], queryFn: ownerSettingsApi.listLocations })

  const { data, isLoading } = useQuery({
    queryKey: ['owner-assets', search, categoryFilter, locationFilter, sort],
    queryFn: () =>
      ownerAssetApi.listAssets({
        search: search || undefined,
        category_id: categoryFilter === NONE ? undefined : categoryFilter,
        location_id: locationFilter === NONE ? undefined : locationFilter,
        sort,
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: ownerAssetApi.deleteAsset,
    onSuccess: () => {
      toast.success('Aset dihapus')
      setDeleting(null)
      queryClient.invalidateQueries({ queryKey: ['owner-assets'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const summary = React.useMemo(() => {
    const rows = data || []
    return {
      count: rows.length,
      qty: rows.reduce((sum, r) => sum + r.qty, 0),
      value: rows.reduce((sum, r) => sum + r.value, 0),
    }
  }, [data])

  const rowsWithActions = React.useMemo(
    () =>
      (data || []).map((asset) => ({
        asset,
        actions: [
          { label: 'Beli / Masuk', icon: ShoppingCart, onClick: () => setBuyingAsset(asset) },
          { label: 'Jual / Keluar', icon: Banknote, disabled: asset.qty === 0, onClick: () => setSellingAsset(asset) },
          { label: 'Hapus', icon: Trash2, variant: 'destructive', onClick: () => setDeleting(asset) },
        ] satisfies RowAction[],
      })),
    [data]
  )

  return (
    <div>
      <PageHeader
        title="Aset"
        description="Aset tetap milik usaha — pembelian, penjualan, dan kepemilikan saat ini"
        breadcrumbs={[{ label: 'Dashboard', to: '/owner' }, { label: 'Aset' }]}
        action={
          <Button onClick={() => setRegisterOpen(true)}>
            <Plus className="size-4" /> Input Aset Baru
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Jumlah Aset" value={summary.count} icon={Package} />
          <StatCard label="Total Kuantitas" value={summary.qty} icon={Boxes} />
          <StatCard label="Total Nilai" value={formatCurrency(summary.value)} icon={Wallet} accent="success" />
        </div>

        <Card className="shadow-sm">
          <CardContent className="flex flex-wrap gap-3">
            <Input
              placeholder="Cari nama aset..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-56"
            />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Semua kategori" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Semua kategori</SelectItem>
                {categories?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Semua lokasi" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Semua lokasi</SelectItem>
                {locations?.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Nama (A-Z)</SelectItem>
                <SelectItem value="qty_asc">Kuantitas Terendah</SelectItem>
                <SelectItem value="qty_desc">Kuantitas Tertinggi</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="px-0">
            {isLoading ? (
              <div className="space-y-3 px-6">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <>
                <Table className="hidden md:table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kode</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Lokasi</TableHead>
                      <TableHead className="text-right">Kuantitas</TableHead>
                      <TableHead className="text-right">Harga Satuan</TableHead>
                      <TableHead className="text-right">Total Nilai</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-muted-foreground text-center">Belum ada data aset.</TableCell>
                      </TableRow>
                    )}
                    {rowsWithActions.map(({ asset, actions }) => (
                      <TableRow key={asset.id}>
                        <TableCell className="font-medium">{asset.code}</TableCell>
                        <TableCell>{asset.name}</TableCell>
                        <TableCell>{asset.category_name || '-'}</TableCell>
                        <TableCell>{asset.location_name || '-'}</TableCell>
                        <TableCell className="text-right">{asset.qty}</TableCell>
                        <TableCell className="text-right">{formatCurrency(asset.unit_price)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(asset.value)}</TableCell>
                        <TableCell className="text-right"><RowActionsMenu actions={actions} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {data?.length === 0 && (
                  <p className="text-muted-foreground px-4 py-6 text-center text-sm md:hidden">Belum ada data aset.</p>
                )}
                <MobileCardList className="p-4">
                  {rowsWithActions.map(({ asset, actions }) => (
                    <MobileCard key={asset.id}>
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{asset.code} — {asset.name}</p>
                          <p className="text-muted-foreground text-xs">{asset.category_name}</p>
                        </div>
                        <RowActionsMenu actions={actions} />
                      </div>
                      <MobileCardRow label="Lokasi">{asset.location_name || '-'}</MobileCardRow>
                      <MobileCardRow label="Kuantitas">{asset.qty}</MobileCardRow>
                      <MobileCardRow label="Total Nilai">{formatCurrency(asset.value)}</MobileCardRow>
                    </MobileCard>
                  ))}
                </MobileCardList>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <RegisterAssetDialog open={registerOpen} onOpenChange={setRegisterOpen} />
      <BuyAssetDialog asset={buyingAsset} open={!!buyingAsset} onOpenChange={(open) => !open && setBuyingAsset(null)} />
      <SellAssetDialog asset={sellingAsset} open={!!sellingAsset} onOpenChange={(open) => !open && setSellingAsset(null)} />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Aset?</AlertDialogTitle>
            <AlertDialogDescription>
              Aset "{deleting?.name}" akan dihapus permanen. Hanya bisa dihapus jika belum ada riwayat transaksi.
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
