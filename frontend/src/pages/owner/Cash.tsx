import * as React from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, Wallet, ArrowLeftRight, Scale, Settings2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import * as ownerCashApi from '@/services/ownerCashApi'
import { getErrorMessage } from '@/services/api'
import { formatCurrency, formatDate, todayISO } from '@/utils/format'
import type {
  OwnerCashAccount,
  OwnerCashTransfer,
  OwnerCashReconciliation,
  OwnerCashReconciliationStatus,
} from '@/types'

// --- Realtime balance summary panel ---

function BalancesPanel() {
  const { data, isLoading } = useQuery({ queryKey: ['owner-cash-balances'], queryFn: ownerCashApi.getBalances })

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {data?.accounts.map((a) => (
        <StatCard key={a.id} label={a.name} value={formatCurrency(a.balance)} icon={Wallet} />
      ))}
      <StatCard label="Total Kas (Realtime)" value={formatCurrency(data?.total || 0)} icon={Scale} accent="success" />
    </div>
  )
}

// --- Akun Kas (settings) ---

function AccountsSection() {
  const queryClient = useQueryClient()
  const [newName, setNewName] = React.useState('')

  const { data, isLoading } = useQuery({ queryKey: ['owner-cash-accounts'], queryFn: ownerCashApi.listAccounts })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['owner-cash-accounts'] })
    queryClient.invalidateQueries({ queryKey: ['owner-cash-balances'] })
  }

  const createMutation = useMutation({
    mutationFn: () => ownerCashApi.createAccount({ name: newName }),
    onSuccess: () => {
      toast.success('Akun kas ditambahkan')
      setNewName('')
      invalidate()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const toggleMutation = useMutation({
    mutationFn: (vars: { id: string; is_active: boolean }) =>
      ownerCashApi.updateAccount(vars.id, { is_active: vars.is_active }),
    onSuccess: invalidate,
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ownerCashApi.deleteAccount(id),
    onSuccess: () => {
      toast.success('Akun kas dihapus')
      invalidate()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <Card className="shadow-sm">
      <CardContent className="flex flex-col gap-4">
        <div>
          <h3 className="font-heading text-sm font-semibold">Akun Kas</h3>
          <p className="text-muted-foreground text-xs">Daftar akun kas/bank yang dipakai di seluruh modul Keuangan.</p>
        </div>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (newName.trim()) createMutation.mutate()
          }}
        >
          <Input
            placeholder="Nama akun baru... (mis. Kas Toko, BCA)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="sm" disabled={createMutation.isPending || !newName.trim()}>
            {createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Tambah
          </Button>
        </form>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : data?.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">Belum ada akun kas.</p>
        ) : (
          <div className="flex flex-col divide-y">
            {data?.map((acc) => (
              <div key={acc.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={acc.is_active ? '' : 'text-muted-foreground line-through'}>{acc.name}</span>
                  {!acc.is_active && <Badge variant="secondary">Nonaktif</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleMutation.mutate({ id: acc.id, is_active: !acc.is_active })}
                  >
                    {acc.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(acc.id)}>
                    <Trash2 className="text-destructive size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// --- Mutasi Kas (transfers) ---

const transferSchema = z.object({
  date: z.string().min(1, 'Tanggal wajib diisi'),
  from_account_id: z.string().min(1, 'Akun sumber wajib dipilih'),
  to_account_id: z.string().min(1, 'Akun tujuan wajib dipilih'),
  amount: z.coerce.number().positive('Jumlah harus lebih dari 0'),
  description: z.string().optional(),
})
type TransferFormInput = z.input<typeof transferSchema>
type TransferFormValues = z.output<typeof transferSchema>

function TransferFormDialog({
  transfer,
  accounts,
  open,
  onOpenChange,
}: {
  transfer?: OwnerCashTransfer
  accounts: OwnerCashAccount[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isEdit = !!transfer
  const queryClient = useQueryClient()
  const form = useForm<TransferFormInput, unknown, TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      date: transfer?.date || todayISO(),
      from_account_id: transfer?.from_account_id || '',
      to_account_id: transfer?.to_account_id || '',
      amount: transfer?.amount || 0,
      description: transfer?.description || '',
    },
  })

  React.useEffect(() => {
    if (open) {
      form.reset({
        date: transfer?.date || todayISO(),
        from_account_id: transfer?.from_account_id || '',
        to_account_id: transfer?.to_account_id || '',
        amount: transfer?.amount || 0,
        description: transfer?.description || '',
      })
    }
  }, [open, transfer, form])

  const fromAccountId = form.watch('from_account_id')

  const mutation = useMutation({
    mutationFn: (values: TransferFormValues) =>
      isEdit ? ownerCashApi.updateTransfer(transfer.id, values) : ownerCashApi.createTransfer(values),
    onSuccess: () => {
      toast.success(isEdit ? 'Mutasi kas diperbarui' : 'Mutasi kas ditambahkan')
      queryClient.invalidateQueries({ queryKey: ['owner-cash-transfers'] })
      queryClient.invalidateQueries({ queryKey: ['owner-cash-balances'] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Mutasi Kas' : 'Tambah Mutasi Kas'}</DialogTitle>
          <DialogDescription>Pindahkan saldo antar akun kas milik usaha.</DialogDescription>
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
              name="from_account_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Akun Sumber</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Pilih akun sumber" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accounts.map((a) => (
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
              name="to_account_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Akun Tujuan</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Pilih akun tujuan" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accounts
                        .filter((a) => a.id !== fromAccountId)
                        .map((a) => (
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
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      {...field}
                      value={(field.value ?? '') as string | number}
                    />
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
                    <Textarea placeholder="Contoh: setor tunai ke bank" {...field} />
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

function TransfersSection({ accounts }: { accounts: OwnerCashAccount[] }) {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<OwnerCashTransfer | undefined>(undefined)
  const [deleting, setDeleting] = React.useState<OwnerCashTransfer | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ['owner-cash-transfers'], queryFn: ownerCashApi.listTransfers })

  const deleteMutation = useMutation({
    mutationFn: ownerCashApi.deleteTransfer,
    onSuccess: () => {
      toast.success('Mutasi kas dihapus')
      setDeleting(null)
      queryClient.invalidateQueries({ queryKey: ['owner-cash-transfers'] })
      queryClient.invalidateQueries({ queryKey: ['owner-cash-balances'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const rowsWithActions = React.useMemo(
    () =>
      (data || []).map((transfer) => ({
        transfer,
        actions: [
          {
            label: 'Edit',
            icon: Settings2,
            onClick: () => {
              setEditing(transfer)
              setDialogOpen(true)
            },
          },
          { label: 'Hapus', icon: Trash2, variant: 'destructive', onClick: () => setDeleting(transfer) },
        ] satisfies RowAction[],
      })),
    [data]
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
          disabled={accounts.length < 2}
        >
          <Plus className="size-4" /> Tambah Mutasi
        </Button>
      </div>

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
                    <TableHead>Dari</TableHead>
                    <TableHead>Ke</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground text-center">
                        Belum ada mutasi kas.
                      </TableCell>
                    </TableRow>
                  )}
                  {rowsWithActions.map(({ transfer, actions }) => (
                    <TableRow key={transfer.id}>
                      <TableCell>{formatDate(transfer.date)}</TableCell>
                      <TableCell>{transfer.from_account_name || '-'}</TableCell>
                      <TableCell>{transfer.to_account_name || '-'}</TableCell>
                      <TableCell className="max-w-48 truncate">{transfer.description || '-'}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(transfer.amount)}</TableCell>
                      <TableCell className="text-right">
                        <RowActionsMenu actions={actions} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {data?.length === 0 && (
                <p className="text-muted-foreground px-4 py-6 text-center text-sm md:hidden">
                  Belum ada mutasi kas.
                </p>
              )}
              <MobileCardList className="p-4">
                {rowsWithActions.map(({ transfer, actions }) => (
                  <MobileCard key={transfer.id}>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{transfer.from_account_name} → {transfer.to_account_name}</p>
                        <p className="text-muted-foreground text-xs">{formatDate(transfer.date)}</p>
                      </div>
                      <RowActionsMenu actions={actions} />
                    </div>
                    <MobileCardRow label="Jumlah">{formatCurrency(transfer.amount)}</MobileCardRow>
                    {transfer.description && <MobileCardRow label="Keterangan">{transfer.description}</MobileCardRow>}
                  </MobileCard>
                ))}
              </MobileCardList>
            </>
          )}
        </CardContent>
      </Card>

      <TransferFormDialog transfer={editing} accounts={accounts} open={dialogOpen} onOpenChange={setDialogOpen} />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Mutasi Kas?</AlertDialogTitle>
            <AlertDialogDescription>Mutasi kas ini akan dihapus permanen.</AlertDialogDescription>
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

// --- Penyesuaian Kas (reconciliations) ---

const RECONCILIATION_STATUS_LABEL: Record<OwnerCashReconciliationStatus, string> = {
  over: 'Lebih',
  short: 'Kurang',
  matched: 'Sesuai',
}

const RECONCILIATION_STATUS_VARIANT: Record<OwnerCashReconciliationStatus, 'default' | 'destructive' | 'secondary'> = {
  over: 'default',
  short: 'destructive',
  matched: 'secondary',
}

const reconciliationSchema = z.object({
  date: z.string().min(1, 'Tanggal wajib diisi'),
  account_id: z.string().min(1, 'Akun wajib dipilih'),
  actual_balance: z.coerce.number(),
  description: z.string().optional(),
})
type ReconciliationFormInput = z.input<typeof reconciliationSchema>
type ReconciliationFormValues = z.output<typeof reconciliationSchema>

function ReconciliationFormDialog({
  accounts,
  open,
  onOpenChange,
}: {
  accounts: OwnerCashAccount[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const form = useForm<ReconciliationFormInput, unknown, ReconciliationFormValues>({
    resolver: zodResolver(reconciliationSchema),
    defaultValues: { date: todayISO(), account_id: '', actual_balance: 0, description: '' },
  })

  React.useEffect(() => {
    if (open) form.reset({ date: todayISO(), account_id: '', actual_balance: 0, description: '' })
  }, [open, form])

  const accountId = form.watch('account_id')

  // Re-fetched live every time the account selection changes, never cached
  // across the save — matches owner.md §4.4's explicit correctness fix.
  // The backend recomputes this again server-side at save time regardless.
  const { data: preview, isFetching: previewLoading } = useQuery({
    queryKey: ['owner-cash-preview-balance', accountId],
    queryFn: () => ownerCashApi.previewSystemBalance(accountId),
    enabled: open && !!accountId,
  })

  const mutation = useMutation({
    mutationFn: (values: ReconciliationFormValues) => ownerCashApi.createReconciliation(values),
    onSuccess: () => {
      toast.success('Penyesuaian kas dicatat')
      queryClient.invalidateQueries({ queryKey: ['owner-cash-reconciliations'] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const actualBalance = Number(form.watch('actual_balance')) || 0
  const systemBalance = preview?.system_balance ?? 0
  const liveDifference = accountId ? actualBalance - systemBalance : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Penyesuaian Kas</DialogTitle>
          <DialogDescription>Cocokkan saldo sistem dengan saldo fisik yang dihitung.</DialogDescription>
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
              name="account_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Akun Kas</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Pilih akun" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {accountId && (
              <div className="bg-muted/50 flex items-center justify-between rounded-md px-3 py-2 text-sm">
                <span className="text-muted-foreground">Saldo Sistem</span>
                {previewLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <span className="font-medium">{formatCurrency(systemBalance)}</span>
                )}
              </div>
            )}

            <FormField
              control={form.control}
              name="actual_balance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Saldo Aktual (hasil hitung fisik)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="any"
                      {...field}
                      value={(field.value ?? '') as string | number}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {liveDifference !== null && (
              <div className="bg-muted/50 flex items-center justify-between rounded-md px-3 py-2 text-sm">
                <span className="text-muted-foreground">Selisih</span>
                <span className="flex items-center gap-2 font-medium">
                  {formatCurrency(liveDifference)}
                  <Badge
                    variant={
                      liveDifference > 0 ? 'default' : liveDifference < 0 ? 'destructive' : 'secondary'
                    }
                  >
                    {liveDifference > 0 ? 'Lebih' : liveDifference < 0 ? 'Kurang' : 'Sesuai'}
                  </Badge>
                </span>
              </div>
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Keterangan (opsional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Catatan hasil hitung fisik" {...field} />
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

function ReconciliationsSection({ accounts }: { accounts: OwnerCashAccount[] }) {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState<OwnerCashReconciliation | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['owner-cash-reconciliations'],
    queryFn: ownerCashApi.listReconciliations,
  })

  const deleteMutation = useMutation({
    mutationFn: ownerCashApi.deleteReconciliation,
    onSuccess: () => {
      toast.success('Penyesuaian kas dihapus')
      setDeleting(null)
      queryClient.invalidateQueries({ queryKey: ['owner-cash-reconciliations'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const rowsWithActions = React.useMemo(
    () =>
      (data || []).map((r) => ({
        reconciliation: r,
        actions: [
          { label: 'Hapus', icon: Trash2, variant: 'destructive', onClick: () => setDeleting(r) },
        ] satisfies RowAction[],
      })),
    [data]
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setDialogOpen(true)} disabled={accounts.length === 0}>
          <Plus className="size-4" /> Tambah Penyesuaian
        </Button>
      </div>

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
                    <TableHead>Akun</TableHead>
                    <TableHead className="text-right">Saldo Sistem</TableHead>
                    <TableHead className="text-right">Saldo Aktual</TableHead>
                    <TableHead className="text-right">Selisih</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-muted-foreground text-center">
                        Belum ada penyesuaian kas.
                      </TableCell>
                    </TableRow>
                  )}
                  {rowsWithActions.map(({ reconciliation: r, actions }) => (
                    <TableRow key={r.id}>
                      <TableCell>{formatDate(r.date)}</TableCell>
                      <TableCell>{r.account_name || '-'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.system_balance)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.actual_balance)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.difference)}</TableCell>
                      <TableCell>
                        <Badge variant={RECONCILIATION_STATUS_VARIANT[r.status]}>
                          {RECONCILIATION_STATUS_LABEL[r.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <RowActionsMenu actions={actions} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {data?.length === 0 && (
                <p className="text-muted-foreground px-4 py-6 text-center text-sm md:hidden">
                  Belum ada penyesuaian kas.
                </p>
              )}
              <MobileCardList className="p-4">
                {rowsWithActions.map(({ reconciliation: r, actions }) => (
                  <MobileCard key={r.id}>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{r.account_name}</p>
                        <p className="text-muted-foreground text-xs">{formatDate(r.date)}</p>
                      </div>
                      <RowActionsMenu actions={actions} />
                    </div>
                    <MobileCardRow label="Saldo Sistem">{formatCurrency(r.system_balance)}</MobileCardRow>
                    <MobileCardRow label="Saldo Aktual">{formatCurrency(r.actual_balance)}</MobileCardRow>
                    <MobileCardRow label="Selisih">{formatCurrency(r.difference)}</MobileCardRow>
                    <MobileCardRow label="Status">
                      <Badge variant={RECONCILIATION_STATUS_VARIANT[r.status]}>
                        {RECONCILIATION_STATUS_LABEL[r.status]}
                      </Badge>
                    </MobileCardRow>
                  </MobileCard>
                ))}
              </MobileCardList>
            </>
          )}
        </CardContent>
      </Card>

      <ReconciliationFormDialog accounts={accounts} open={dialogOpen} onOpenChange={setDialogOpen} />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Penyesuaian Kas?</AlertDialogTitle>
            <AlertDialogDescription>Catatan penyesuaian ini akan dihapus permanen.</AlertDialogDescription>
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

export default function OwnerCashPage() {
  const [tab, setTab] = React.useState<'mutasi' | 'penyesuaian' | 'akun'>('mutasi')
  const { data: accounts } = useQuery({ queryKey: ['owner-cash-accounts'], queryFn: ownerCashApi.listAccounts })
  const activeAccounts = React.useMemo(() => (accounts || []).filter((a) => a.is_active), [accounts])

  return (
    <div>
      <PageHeader
        title="Mutasi & Penyesuaian Kas"
        description="Kelola akun kas, perpindahan saldo antar akun, dan rekonsiliasi saldo fisik"
        breadcrumbs={[{ label: 'Dashboard', to: '/owner' }, { label: 'Mutasi & Penyesuaian Kas' }]}
      />

      <div className="flex flex-col gap-4">
        <BalancesPanel />

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="mutasi"><ArrowLeftRight className="size-4" /> Mutasi Kas</TabsTrigger>
            <TabsTrigger value="penyesuaian"><Scale className="size-4" /> Penyesuaian Kas</TabsTrigger>
            <TabsTrigger value="akun"><Settings2 className="size-4" /> Akun Kas</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === 'mutasi' && <TransfersSection accounts={activeAccounts} />}
        {tab === 'penyesuaian' && <ReconciliationsSection accounts={activeAccounts} />}
        {tab === 'akun' && <AccountsSection />}
      </div>
    </div>
  )
}
