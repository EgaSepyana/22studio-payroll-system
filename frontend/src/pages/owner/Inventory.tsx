import * as React from 'react'
import { z } from 'zod'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, Package, Boxes, Wallet, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
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
import * as ownerInventoryApi from '@/services/ownerInventoryApi'
import * as ownerSettingsApi from '@/services/ownerSettingsApi'
import * as ownerCashApi from '@/services/ownerCashApi'
import { getErrorMessage } from '@/services/api'
import { formatCurrency, todayISO } from '@/utils/format'
import type { OwnerFundingSource, OwnerInventoryExitType, OwnerInventoryItem, OwnerInventoryItemType } from '@/types'

const NONE = '__none__'

const FUNDING_OPTIONS: { value: OwnerFundingSource; label: string }[] = [
  { value: 'cash', label: 'Kas' },
  { value: 'payable', label: 'Hutang (Kredit)' },
  { value: 'capital', label: 'Modal' },
]

const ITEM_TYPE_OPTIONS: { value: OwnerInventoryItemType; label: string }[] = [
  { value: 'raw_material', label: 'Bahan Baku' },
  { value: 'finished_good', label: 'Barang Jadi' },
]

const ITEM_TYPE_LABEL: Record<OwnerInventoryItemType, string> = {
  raw_material: 'Bahan Baku',
  finished_good: 'Barang Jadi',
}

const EXIT_TYPE_OPTIONS: { value: OwnerInventoryExitType; label: string }[] = [
  { value: 'production', label: 'Produksi (Konversi)' },
  { value: 'sold', label: 'Terjual' },
  { value: 'damaged', label: 'Rusak / Hilang' },
]

function numOrEmpty(field: { value: unknown }) {
  return (field.value ?? '') as string | number
}

interface FundingFormValues {
  funding_source: OwnerFundingSource
  account_id?: string
  creditor_name?: string
  creditor_address?: string
  due_date?: string
  capital_source_name?: string
  capital_note?: string
}

function FundingFields<T extends FundingFormValues>({ form: formProp }: { form: UseFormReturn<T> }) {
  const form = formProp as unknown as UseFormReturn<FundingFormValues>
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

// --- Register new item ---

const registerSchema = z.object({
  date: z.string().min(1, 'Tanggal wajib diisi'),
  name: z.string().min(1, 'Nama item wajib diisi'),
  category_id: z.string().min(1, 'Kategori wajib dipilih'),
  location_id: z.string().min(1, 'Lokasi wajib dipilih'),
  item_type: z.enum(['raw_material', 'finished_good']),
  qty: z.coerce.number().positive('Kuantitas harus lebih dari 0'),
  unit_price: z.coerce.number().nonnegative('Harga satuan tidak valid'),
  description: z.string().optional(),
  funding_source: z.enum(['cash', 'payable', 'capital']),
  account_id: z.string().optional(),
  creditor_name: z.string().optional(),
  creditor_address: z.string().optional(),
  due_date: z.string().optional(),
  capital_source_name: z.string().optional(),
  capital_note: z.string().optional(),
})
type RegisterFormInput = z.input<typeof registerSchema>
type RegisterFormValues = z.output<typeof registerSchema>

function RegisterItemDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const { data: categories } = useQuery({
    queryKey: ['owner-categories', 'inventory'],
    queryFn: () => ownerSettingsApi.listCategories('inventory'),
  })
  const { data: locations } = useQuery({ queryKey: ['owner-locations'], queryFn: ownerSettingsApi.listLocations })
  const activeCategories = (categories || []).filter((c) => c.is_active)
  const activeLocations = (locations || []).filter((l) => l.is_active)

  const form = useForm<RegisterFormInput, unknown, RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      date: todayISO(),
      name: '',
      category_id: '',
      location_id: '',
      item_type: 'raw_material',
      qty: 1,
      unit_price: 0,
      description: '',
      funding_source: 'cash',
    },
  })

  React.useEffect(() => {
    if (open) {
      form.reset({
        date: todayISO(),
        name: '',
        category_id: '',
        location_id: '',
        item_type: 'raw_material',
        qty: 1,
        unit_price: 0,
        description: '',
        funding_source: 'cash',
      })
    }
  }, [open, form])

  const mutation = useMutation({
    mutationFn: (values: RegisterFormValues) => ownerInventoryApi.registerItem(values),
    onSuccess: () => {
      toast.success('Item stok baru terdaftar')
      queryClient.invalidateQueries({ queryKey: ['owner-inventory'] })
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
          <DialogTitle>Input Stok</DialogTitle>
          <DialogDescription>Mendaftarkan item baru beserta kuantitas awal.</DialogDescription>
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
                  <FormLabel>Nama Item</FormLabel>
                  <FormControl><Input placeholder="Contoh: Kain Cotton Combed 30s" autoFocus {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="item_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipe Item</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {ITEM_TYPE_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
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
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="qty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kuantitas Awal</FormLabel>
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

// --- Edit item ---

const editSchema = z.object({
  name: z.string().min(1, 'Nama item wajib diisi'),
  category_id: z.string().min(1, 'Kategori wajib dipilih'),
  location_id: z.string().min(1, 'Lokasi wajib dipilih'),
  description: z.string().optional(),
})
type EditFormInput = z.input<typeof editSchema>
type EditFormValues = z.output<typeof editSchema>

function EditItemDialog({
  item,
  open,
  onOpenChange,
}: {
  item: OwnerInventoryItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const { data: categories } = useQuery({
    queryKey: ['owner-categories', 'inventory'],
    queryFn: () => ownerSettingsApi.listCategories('inventory'),
  })
  const { data: locations } = useQuery({ queryKey: ['owner-locations'], queryFn: ownerSettingsApi.listLocations })
  const activeCategories = (categories || []).filter((c) => c.is_active)
  const activeLocations = (locations || []).filter((l) => l.is_active)

  const form = useForm<EditFormInput, unknown, EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: '', category_id: '', location_id: '', description: '' },
  })

  React.useEffect(() => {
    if (open && item) {
      form.reset({
        name: item.name,
        category_id: item.category_id,
        location_id: item.location_id,
        description: item.description,
      })
    }
  }, [open, item, form])

  const mutation = useMutation({
    mutationFn: (values: EditFormValues) => ownerInventoryApi.updateItem(item!.id, values),
    onSuccess: () => {
      toast.success('Item stok diperbarui')
      queryClient.invalidateQueries({ queryKey: ['owner-inventory'] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Item Stok</DialogTitle>
          <DialogDescription>Ganti nama, kategori, atau lokasi item.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="flex flex-col gap-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Item</FormLabel>
                  <FormControl><Input autoFocus {...field} /></FormControl>
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

// --- Stock in ---

const stockInSchema = z.object({
  date: z.string().min(1, 'Tanggal wajib diisi'),
  qty: z.coerce.number().positive('Kuantitas harus lebih dari 0'),
  unit_price: z.coerce.number().nonnegative().optional(),
  funding_source: z.enum(['cash', 'payable', 'capital']),
  account_id: z.string().optional(),
  creditor_name: z.string().optional(),
  creditor_address: z.string().optional(),
  due_date: z.string().optional(),
  capital_source_name: z.string().optional(),
  capital_note: z.string().optional(),
})
type StockInFormInput = z.input<typeof stockInSchema>
type StockInFormValues = z.output<typeof stockInSchema>

function StockInDialog({
  item,
  open,
  onOpenChange,
}: {
  item: OwnerInventoryItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const form = useForm<StockInFormInput, unknown, StockInFormValues>({
    resolver: zodResolver(stockInSchema),
    defaultValues: { date: todayISO(), qty: 1, unit_price: undefined, funding_source: 'cash' },
  })

  React.useEffect(() => {
    if (open) form.reset({ date: todayISO(), qty: 1, unit_price: undefined, funding_source: 'cash' })
  }, [open, form])

  const mutation = useMutation({
    mutationFn: (values: StockInFormValues) => ownerInventoryApi.stockIn({ ...values, item_id: item!.id }),
    onSuccess: () => {
      toast.success('Stok masuk dicatat')
      queryClient.invalidateQueries({ queryKey: ['owner-inventory'] })
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
          <DialogTitle>Stok Masuk</DialogTitle>
          <DialogDescription>{item ? `Menambah stok "${item.name}"` : ''}</DialogDescription>
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
                    <FormLabel>Harga Beli (opsional)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="any" placeholder="Harga terakhir" {...field} value={numOrEmpty(field)} />
                    </FormControl>
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

// --- Stock out (exit type branching) ---

const stockOutSchema = z.object({
  date: z.string().min(1, 'Tanggal wajib diisi'),
  qty: z.coerce.number().positive('Kuantitas harus lebih dari 0'),
  exit_type: z.enum(['production', 'sold', 'damaged']),
  description: z.string().optional(),
  output_name: z.string().optional(),
  output_category_id: z.string().optional(),
  output_location_id: z.string().optional(),
  sale_price: z.coerce.number().nonnegative().optional(),
  sale_method: z.enum(['cash', 'credit']).optional(),
  account_id: z.string().optional(),
  loss_value: z.coerce.number().nonnegative().optional(),
})
type StockOutFormInput = z.input<typeof stockOutSchema>
type StockOutFormValues = z.output<typeof stockOutSchema>

function StockOutDialog({
  item,
  open,
  onOpenChange,
}: {
  item: OwnerInventoryItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const { data: categories } = useQuery({
    queryKey: ['owner-categories', 'inventory'],
    queryFn: () => ownerSettingsApi.listCategories('inventory'),
  })
  const { data: locations } = useQuery({ queryKey: ['owner-locations'], queryFn: ownerSettingsApi.listLocations })
  const { data: accounts } = useQuery({ queryKey: ['owner-cash-accounts'], queryFn: ownerCashApi.listAccounts })
  const activeCategories = (categories || []).filter((c) => c.is_active)
  const activeLocations = (locations || []).filter((l) => l.is_active)
  const activeAccounts = (accounts || []).filter((a) => a.is_active)

  const form = useForm<StockOutFormInput, unknown, StockOutFormValues>({
    resolver: zodResolver(stockOutSchema),
    defaultValues: { date: todayISO(), qty: 1, exit_type: 'sold', sale_method: 'cash' },
  })

  React.useEffect(() => {
    if (open) form.reset({ date: todayISO(), qty: 1, exit_type: 'sold', sale_method: 'cash' })
  }, [open, form])

  const exitType = form.watch('exit_type')
  const saleMethod = form.watch('sale_method')

  const mutation = useMutation({
    mutationFn: (values: StockOutFormValues) => ownerInventoryApi.stockOut({ ...values, item_id: item!.id }),
    onSuccess: () => {
      toast.success('Stok keluar dicatat')
      queryClient.invalidateQueries({ queryKey: ['owner-inventory'] })
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
          <DialogTitle>Stok Keluar</DialogTitle>
          <DialogDescription>{item ? `Mengeluarkan stok "${item.name}" (tersedia ${item.qty})` : ''}</DialogDescription>
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
              name="exit_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipe Keluar</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {EXIT_TYPE_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {exitType === 'production' && (
              <>
                <FormField
                  control={form.control}
                  name="output_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nama Item Hasil Produksi</FormLabel>
                      <FormControl><Input placeholder="Contoh: Kaos Polos Cotton Combed" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="output_category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kategori Hasil Produksi (opsional)</FormLabel>
                      <Select value={field.value || ''} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger className="w-full"><SelectValue placeholder="Sama seperti item asal" /></SelectTrigger></FormControl>
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
                  name="output_location_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lokasi Hasil Produksi (opsional)</FormLabel>
                      <Select value={field.value || ''} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger className="w-full"><SelectValue placeholder="Sama seperti item asal" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {activeLocations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {exitType === 'sold' && (
              <>
                <FormField
                  control={form.control}
                  name="sale_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Harga Jual</FormLabel>
                      <FormControl><Input type="number" min={0} step="any" {...field} value={numOrEmpty(field)} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sale_method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Metode Pembayaran</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="cash">Tunai</SelectItem>
                          <SelectItem value="credit">Piutang (Kredit)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {saleMethod === 'cash' && (
                  <FormField
                    control={form.control}
                    name="account_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Akun Kas Tujuan</FormLabel>
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
              </>
            )}

            {exitType === 'damaged' && (
              <FormField
                control={form.control}
                name="loss_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nilai Kerugian (opsional)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="any" placeholder="Default: nilai buku saat ini" {...field} value={numOrEmpty(field)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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

export default function OwnerInventoryPage() {
  const queryClient = useQueryClient()
  const [registerOpen, setRegisterOpen] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<OwnerInventoryItem | null>(null)
  const [stockInItem, setStockInItem] = React.useState<OwnerInventoryItem | null>(null)
  const [stockOutItem, setStockOutItem] = React.useState<OwnerInventoryItem | null>(null)
  const [deleting, setDeleting] = React.useState<OwnerInventoryItem | null>(null)
  const [search, setSearch] = React.useState('')
  const [categoryFilter, setCategoryFilter] = React.useState<string>(NONE)
  const [locationFilter, setLocationFilter] = React.useState<string>(NONE)
  const [sort, setSort] = React.useState<'name' | 'qty_asc' | 'qty_desc'>('name')

  const { data: categories } = useQuery({
    queryKey: ['owner-categories', 'inventory'],
    queryFn: () => ownerSettingsApi.listCategories('inventory'),
  })
  const { data: locations } = useQuery({ queryKey: ['owner-locations'], queryFn: ownerSettingsApi.listLocations })

  const { data, isLoading } = useQuery({
    queryKey: ['owner-inventory', search, categoryFilter, locationFilter, sort],
    queryFn: () =>
      ownerInventoryApi.listItems({
        search: search || undefined,
        category_id: categoryFilter === NONE ? undefined : categoryFilter,
        location_id: locationFilter === NONE ? undefined : locationFilter,
        sort,
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: ownerInventoryApi.deleteItem,
    onSuccess: () => {
      toast.success('Item stok dihapus')
      setDeleting(null)
      queryClient.invalidateQueries({ queryKey: ['owner-inventory'] })
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
      (data || []).map((item) => ({
        item,
        actions: [
          { label: 'Edit', icon: Pencil, onClick: () => setEditingItem(item) },
          { label: 'Stok Masuk', icon: ArrowDownToLine, onClick: () => setStockInItem(item) },
          { label: 'Stok Keluar', icon: ArrowUpFromLine, disabled: item.qty === 0, onClick: () => setStockOutItem(item) },
          { label: 'Hapus', icon: Trash2, variant: 'destructive', onClick: () => setDeleting(item) },
        ] satisfies RowAction[],
      })),
    [data]
  )

  return (
    <div>
      <PageHeader
        title="Stok Persediaan"
        description="Bahan baku dan barang jadi — masuk, keluar, dan konversi produksi"
        breadcrumbs={[{ label: 'Dashboard', to: '/owner' }, { label: 'Stok Persediaan' }]}
        action={
          <Button onClick={() => setRegisterOpen(true)}>
            <Plus className="size-4" /> Input Stok
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Jumlah Item" value={summary.count} icon={Package} />
          <StatCard label="Total Kuantitas" value={summary.qty} icon={Boxes} />
          <StatCard label="Estimasi Total Nilai" value={formatCurrency(summary.value)} icon={Wallet} accent="success" />
        </div>

        <Card className="shadow-sm">
          <CardContent className="flex flex-wrap gap-3">
            <Input
              placeholder="Cari nama/kode item..."
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
                <SelectItem value="qty_asc">Stok Terendah</SelectItem>
                <SelectItem value="qty_desc">Stok Tertinggi</SelectItem>
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
                      <TableHead>Tipe</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Lokasi</TableHead>
                      <TableHead className="text-right">Stok</TableHead>
                      <TableHead className="text-right">Total Nilai</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-muted-foreground text-center">Belum ada data stok.</TableCell>
                      </TableRow>
                    )}
                    {rowsWithActions.map(({ item, actions }) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.code}</TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell><Badge variant="secondary">{ITEM_TYPE_LABEL[item.item_type]}</Badge></TableCell>
                        <TableCell>{item.category_name || '-'}</TableCell>
                        <TableCell>{item.location_name || '-'}</TableCell>
                        <TableCell className="text-right">{item.qty}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(item.value)}</TableCell>
                        <TableCell className="text-right"><RowActionsMenu actions={actions} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {data?.length === 0 && (
                  <p className="text-muted-foreground px-4 py-6 text-center text-sm md:hidden">Belum ada data stok.</p>
                )}
                <MobileCardList className="p-4">
                  {rowsWithActions.map(({ item, actions }) => (
                    <MobileCard key={item.id}>
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{item.code} — {item.name}</p>
                          <p className="text-muted-foreground text-xs">{ITEM_TYPE_LABEL[item.item_type]} · {item.category_name}</p>
                        </div>
                        <RowActionsMenu actions={actions} />
                      </div>
                      <MobileCardRow label="Lokasi">{item.location_name || '-'}</MobileCardRow>
                      <MobileCardRow label="Stok">{item.qty}</MobileCardRow>
                      <MobileCardRow label="Total Nilai">{formatCurrency(item.value)}</MobileCardRow>
                    </MobileCard>
                  ))}
                </MobileCardList>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <RegisterItemDialog open={registerOpen} onOpenChange={setRegisterOpen} />
      <EditItemDialog item={editingItem} open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)} />
      <StockInDialog item={stockInItem} open={!!stockInItem} onOpenChange={(open) => !open && setStockInItem(null)} />
      <StockOutDialog item={stockOutItem} open={!!stockOutItem} onOpenChange={(open) => !open && setStockOutItem(null)} />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Item Stok?</AlertDialogTitle>
            <AlertDialogDescription>
              Item "{deleting?.name}" akan dihapus permanen. Hanya bisa dihapus jika belum ada riwayat transaksi.
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
