import * as React from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, Receipt, TrendingDown, Link2, Wallet2, X } from 'lucide-react'
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
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import * as ownerExpenseApi from '@/services/ownerExpenseApi'
import * as ownerSettingsApi from '@/services/ownerSettingsApi'
import * as ownerCashApi from '@/services/ownerCashApi'
import { getErrorMessage } from '@/services/api'
import { formatCurrency, formatDate, todayISO } from '@/utils/format'
import type { OwnerExpense, OwnerExpensePickerOrder } from '@/types'

const NONE = '__none__'

const schema = z.object({
  date: z.string().min(1, 'Tanggal wajib diisi'),
  category_id: z.string().min(1, 'Kategori wajib dipilih'),
  account_id: z.string().min(1, 'Akun kas wajib dipilih'),
  order_id: z.string().optional(),
  amount: z.coerce.number().positive('Jumlah harus lebih dari 0'),
  description: z.string().optional(),
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

function InvoicePicker({
  orderId,
  onSelect,
}: {
  orderId: string | undefined
  onSelect: (order: OwnerExpensePickerOrder | null) => void
}) {
  const [search, setSearch] = React.useState('')
  const { data: pickerOrders } = useQuery({
    queryKey: ['owner-expense-order-picker', search],
    queryFn: () => ownerExpenseApi.listOrderPicker(search || undefined),
  })

  const { data: profitability, isFetching: profitLoading } = useQuery({
    queryKey: ['owner-order-profitability', orderId],
    queryFn: () => ownerExpenseApi.getOrderProfitability(orderId as string),
    enabled: !!orderId,
  })

  const selected = (pickerOrders || []).find((o) => o.id === orderId)

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Link2 className="size-4" /> Tautkan ke Invoice (opsional)
        </p>
        {orderId && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onSelect(null)}>
            <X className="size-3.5" /> Lepas
          </Button>
        )}
      </div>

      {!orderId ? (
        <Combobox
          items={pickerOrders || []}
          itemToStringLabel={(o: OwnerExpensePickerOrder) =>
            `${o.invoice_no} — ${o.customer_name || ''} — ${o.order_name}`
          }
          value={null}
          onValueChange={(o: OwnerExpensePickerOrder | null) => onSelect(o)}
          inputValue={search}
          onInputValueChange={setSearch}
        >
          <ComboboxInput placeholder="Cari invoice PROSES (nomor/customer/nama order)..." className="w-full" />
          <ComboboxContent>
            <ComboboxEmpty>Tidak ada invoice yang sedang diproses.</ComboboxEmpty>
            <ComboboxList>
              {(o: OwnerExpensePickerOrder) => (
                <ComboboxItem key={o.id} value={o}>
                  {o.invoice_no} — {o.customer_name || '-'} — {o.order_name}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      ) : (
        <div className="bg-muted/50 flex flex-col gap-2 rounded-md p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Invoice</span>
            <span className="font-medium">{selected?.invoice_no || profitability?.invoice_no}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Customer</span>
            <span>{selected?.customer_name || profitability?.customer_name || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Order</span>
            <span>{selected?.order_name || profitability?.order_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Invoice</span>
            <span>{formatCurrency(selected?.items_total ?? profitability?.invoice_total ?? 0)}</span>
          </div>
          <div className="mt-1 border-t pt-2">
            {profitLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pengeluaran Sejauh Ini</span>
                  <span>{formatCurrency(profitability?.total_expenses || 0)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Estimasi Profit</span>
                  <span className={(profitability?.estimated_profit || 0) < 0 ? 'text-destructive' : 'text-success'}>
                    {formatCurrency(profitability?.estimated_profit || 0)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ExpenseFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const { data: categories } = useQuery({
    queryKey: ['owner-categories', 'expense'],
    queryFn: () => ownerSettingsApi.listCategories('expense'),
  })
  const { data: accounts } = useQuery({ queryKey: ['owner-cash-accounts'], queryFn: ownerCashApi.listAccounts })
  const activeAccounts = React.useMemo(() => (accounts || []).filter((a) => a.is_active), [accounts])
  const activeCategories = React.useMemo(() => (categories || []).filter((c) => c.is_active), [categories])

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { date: todayISO(), category_id: '', account_id: '', order_id: '', amount: 0, description: '' },
  })

  React.useEffect(() => {
    if (open) {
      form.reset({ date: todayISO(), category_id: '', account_id: '', order_id: '', amount: 0, description: '' })
    }
  }, [open, form])

  const orderId = form.watch('order_id')

  const mutation = useMutation({
    mutationFn: (values: FormValues) => ownerExpenseApi.createExpense(values),
    onSuccess: () => {
      toast.success('Pengeluaran ditambahkan')
      queryClient.invalidateQueries({ queryKey: ['owner-expenses'] })
      queryClient.invalidateQueries({ queryKey: ['owner-cash-balances'] })
      queryClient.invalidateQueries({ queryKey: ['owner-order-profitability'] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Input Pengeluaran</DialogTitle>
          <DialogDescription>Catat biaya operasional, opsional ditautkan ke sebuah invoice.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="flex flex-col gap-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
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
            <FormField
              control={form.control}
              name="account_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Akun Kas</FormLabel>
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
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jumlah</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} step="any" {...field} value={(field.value ?? '') as string | number} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="order_id"
              render={({ field }) => (
                <FormItem>
                  <InvoicePicker
                    orderId={orderId}
                    onSelect={(order) => field.onChange(order ? order.id : '')}
                  />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Keterangan (opsional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Catatan pengeluaran" {...field} />
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

export default function OwnerExpensesPage() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState<OwnerExpense | null>(null)
  const [categoryFilter, setCategoryFilter] = React.useState<string>(NONE)
  const [orderSearch, setOrderSearch] = React.useState('')
  const [accountFilter, setAccountFilter] = React.useState<string>(NONE)

  const { data: categories } = useQuery({
    queryKey: ['owner-categories', 'expense'],
    queryFn: () => ownerSettingsApi.listCategories('expense'),
  })
  const { data: accounts } = useQuery({ queryKey: ['owner-cash-accounts'], queryFn: ownerCashApi.listAccounts })

  const { data, isLoading } = useQuery({
    queryKey: ['owner-expenses', categoryFilter, orderSearch, accountFilter],
    queryFn: () =>
      ownerExpenseApi.listExpenses({
        category_id: categoryFilter === NONE ? undefined : categoryFilter,
        order_search: orderSearch || undefined,
        account_id: accountFilter === NONE ? undefined : accountFilter,
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: ownerExpenseApi.deleteExpense,
    onSuccess: () => {
      toast.success('Pengeluaran dihapus')
      setDeleting(null)
      queryClient.invalidateQueries({ queryKey: ['owner-expenses'] })
      queryClient.invalidateQueries({ queryKey: ['owner-cash-balances'] })
      queryClient.invalidateQueries({ queryKey: ['owner-order-profitability'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const summary = React.useMemo(() => {
    const rows = data || []
    const total = rows.reduce((sum, r) => sum + r.amount, 0)
    const biayaOrder = rows.filter((r) => r.order_id).reduce((sum, r) => sum + r.amount, 0)
    const operasional = total - biayaOrder
    return { count: rows.length, total, biayaOrder, operasional }
  }, [data])

  const rowsWithActions = React.useMemo(
    () =>
      (data || []).map((expense) => ({
        expense,
        actions: [
          { label: 'Hapus', icon: Trash2, variant: 'destructive', onClick: () => setDeleting(expense) },
        ] satisfies RowAction[],
      })),
    [data]
  )

  return (
    <div>
      <PageHeader
        title="Pengeluaran"
        description="Catat biaya operasional, opsional ditautkan ke invoice"
        breadcrumbs={[{ label: 'Dashboard', to: '/owner' }, { label: 'Pengeluaran' }]}
        action={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" /> Input Pengeluaran
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Jumlah Record" value={summary.count} icon={Receipt} />
          <StatCard label="Total Pengeluaran" value={formatCurrency(summary.total)} icon={TrendingDown} />
          <StatCard label="Biaya Order" value={formatCurrency(summary.biayaOrder)} icon={Link2} />
          <StatCard label="Operasional Umum" value={formatCurrency(summary.operasional)} icon={Wallet2} />
        </div>

        <Card className="shadow-sm">
          <CardContent className="flex flex-wrap gap-3">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Semua kategori" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Semua kategori</SelectItem>
                {categories?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              placeholder="Cari invoice/customer/order..."
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              className="w-full sm:w-56"
            />
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Semua akun kas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Semua akun kas</SelectItem>
                {accounts?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
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
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Akun Kas</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Keterangan</TableHead>
                      <TableHead className="text-right">Jumlah</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-muted-foreground text-center">
                          Belum ada data pengeluaran.
                        </TableCell>
                      </TableRow>
                    )}
                    {rowsWithActions.map(({ expense, actions }) => (
                      <TableRow key={expense.id}>
                        <TableCell>{formatDate(expense.date)}</TableCell>
                        <TableCell>{expense.category_name || '-'}</TableCell>
                        <TableCell>{expense.account_name || '-'}</TableCell>
                        <TableCell>{expense.invoice_no || '-'}</TableCell>
                        <TableCell>{expense.customer_name || '-'}</TableCell>
                        <TableCell className="max-w-40 truncate">{expense.order_name || '-'}</TableCell>
                        <TableCell className="max-w-40 truncate">{expense.description || '-'}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(expense.amount)}</TableCell>
                        <TableCell className="text-right">
                          <RowActionsMenu actions={actions} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {data?.length === 0 && (
                  <p className="text-muted-foreground px-4 py-6 text-center text-sm md:hidden">
                    Belum ada data pengeluaran.
                  </p>
                )}
                <MobileCardList className="p-4">
                  {rowsWithActions.map(({ expense, actions }) => (
                    <MobileCard key={expense.id}>
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{expense.category_name}</p>
                          <p className="text-muted-foreground text-xs">{formatDate(expense.date)}</p>
                        </div>
                        <RowActionsMenu actions={actions} />
                      </div>
                      <MobileCardRow label="Akun Kas">{expense.account_name || '-'}</MobileCardRow>
                      {expense.invoice_no && <MobileCardRow label="Invoice">{expense.invoice_no}</MobileCardRow>}
                      {expense.order_name && <MobileCardRow label="Order">{expense.order_name}</MobileCardRow>}
                      <MobileCardRow label="Jumlah">{formatCurrency(expense.amount)}</MobileCardRow>
                    </MobileCard>
                  ))}
                </MobileCardList>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <ExpenseFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pengeluaran?</AlertDialogTitle>
            <AlertDialogDescription>Data pengeluaran ini akan dihapus permanen.</AlertDialogDescription>
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
