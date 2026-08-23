import * as React from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, Receipt, TrendingUp, ShoppingBag, Sparkles } from 'lucide-react'
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
import * as ownerIncomeApi from '@/services/ownerIncomeApi'
import * as ownerSettingsApi from '@/services/ownerSettingsApi'
import * as ownerCashApi from '@/services/ownerCashApi'
import { getErrorMessage } from '@/services/api'
import { formatCurrency, formatDate, todayISO } from '@/utils/format'
import type { OwnerIncome } from '@/types'

const NONE = '__none__'

const schema = z.object({
  date: z.string().min(1, 'Tanggal wajib diisi'),
  category_id: z.string().min(1, 'Kategori wajib dipilih'),
  account_id: z.string().min(1, 'Akun kas wajib dipilih'),
  amount: z.coerce.number().positive('Jumlah harus lebih dari 0'),
  description: z.string().optional(),
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

function IncomeFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const { data: categories } = useQuery({
    queryKey: ['owner-categories', 'income'],
    queryFn: () => ownerSettingsApi.listCategories('income'),
  })
  const { data: accounts } = useQuery({ queryKey: ['owner-cash-accounts'], queryFn: ownerCashApi.listAccounts })
  const activeAccounts = React.useMemo(() => (accounts || []).filter((a) => a.is_active), [accounts])
  const activeCategories = React.useMemo(() => (categories || []).filter((c) => c.is_active), [categories])

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { date: todayISO(), category_id: '', account_id: '', amount: 0, description: '' },
  })

  React.useEffect(() => {
    if (open) form.reset({ date: todayISO(), category_id: '', account_id: '', amount: 0, description: '' })
  }, [open, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => ownerIncomeApi.createIncome(values),
    onSuccess: () => {
      toast.success('Pemasukan ditambahkan')
      queryClient.invalidateQueries({ queryKey: ['owner-income'] })
      queryClient.invalidateQueries({ queryKey: ['owner-cash-balances'] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Input Pemasukan</DialogTitle>
          <DialogDescription>Catat pemasukan di luar penjualan stok.</DialogDescription>
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
                  <FormLabel>Akun Kas Tujuan</FormLabel>
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Keterangan (opsional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Catatan pemasukan" {...field} />
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

export default function OwnerIncomePage() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState<OwnerIncome | null>(null)
  const [categoryFilter, setCategoryFilter] = React.useState<string>(NONE)
  const [monthFilter, setMonthFilter] = React.useState('')
  const [accountFilter, setAccountFilter] = React.useState<string>(NONE)

  const { data: categories } = useQuery({
    queryKey: ['owner-categories', 'income'],
    queryFn: () => ownerSettingsApi.listCategories('income'),
  })
  const { data: accounts } = useQuery({ queryKey: ['owner-cash-accounts'], queryFn: ownerCashApi.listAccounts })

  const { data, isLoading } = useQuery({
    queryKey: ['owner-income', categoryFilter, monthFilter, accountFilter],
    queryFn: () =>
      ownerIncomeApi.listIncome({
        category_id: categoryFilter === NONE ? undefined : categoryFilter,
        month: monthFilter || undefined,
        account_id: accountFilter === NONE ? undefined : accountFilter,
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: ownerIncomeApi.deleteIncome,
    onSuccess: () => {
      toast.success('Pemasukan dihapus')
      setDeleting(null)
      queryClient.invalidateQueries({ queryKey: ['owner-income'] })
      queryClient.invalidateQueries({ queryKey: ['owner-cash-balances'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const summary = React.useMemo(() => {
    const rows = data || []
    const total = rows.reduce((sum, r) => sum + r.amount, 0)
    const sales = rows.filter((r) => r.is_sales_category).reduce((sum, r) => sum + r.amount, 0)
    const other = total - sales
    return { count: rows.length, total, sales, other }
  }, [data])

  const rowsWithActions = React.useMemo(
    () =>
      (data || []).map((income) => ({
        income,
        actions: [
          { label: 'Hapus', icon: Trash2, variant: 'destructive', onClick: () => setDeleting(income) },
        ] satisfies RowAction[],
      })),
    [data]
  )

  return (
    <div>
      <PageHeader
        title="Pemasukan"
        description="Catat pemasukan di luar hasil penjualan stok"
        breadcrumbs={[{ label: 'Dashboard', to: '/owner' }, { label: 'Pemasukan' }]}
        action={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" /> Input Pemasukan
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Jumlah Record" value={summary.count} icon={Receipt} />
          <StatCard label="Total Pemasukan" value={formatCurrency(summary.total)} icon={TrendingUp} accent="success" />
          <StatCard label="Penjualan" value={formatCurrency(summary.sales)} icon={ShoppingBag} />
          <StatCard label="Pendapatan Lainnya" value={formatCurrency(summary.other)} icon={Sparkles} />
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
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="w-full sm:w-40"
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
                      <TableHead>Keterangan</TableHead>
                      <TableHead className="text-right">Jumlah</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-muted-foreground text-center">
                          Belum ada data pemasukan.
                        </TableCell>
                      </TableRow>
                    )}
                    {rowsWithActions.map(({ income, actions }) => (
                      <TableRow key={income.id}>
                        <TableCell>{formatDate(income.date)}</TableCell>
                        <TableCell>{income.category_name || '-'}</TableCell>
                        <TableCell>{income.account_name || '-'}</TableCell>
                        <TableCell className="max-w-48 truncate">{income.description || '-'}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(income.amount)}</TableCell>
                        <TableCell className="text-right">
                          <RowActionsMenu actions={actions} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {data?.length === 0 && (
                  <p className="text-muted-foreground px-4 py-6 text-center text-sm md:hidden">
                    Belum ada data pemasukan.
                  </p>
                )}
                <MobileCardList className="p-4">
                  {rowsWithActions.map(({ income, actions }) => (
                    <MobileCard key={income.id}>
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{income.category_name}</p>
                          <p className="text-muted-foreground text-xs">{formatDate(income.date)}</p>
                        </div>
                        <RowActionsMenu actions={actions} />
                      </div>
                      <MobileCardRow label="Akun Kas">{income.account_name || '-'}</MobileCardRow>
                      <MobileCardRow label="Jumlah">{formatCurrency(income.amount)}</MobileCardRow>
                      {income.description && (
                        <MobileCardRow label="Keterangan">{income.description}</MobileCardRow>
                      )}
                    </MobileCard>
                  ))}
                </MobileCardList>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <IncomeFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pemasukan?</AlertDialogTitle>
            <AlertDialogDescription>Data pemasukan ini akan dihapus permanen.</AlertDialogDescription>
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
