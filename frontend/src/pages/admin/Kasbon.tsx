import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Eye, Check, X as XIcon, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CashAdvanceStatusBadge } from '@/components/CashAdvanceStatusBadge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  DialogDescription,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import * as cashAdvanceApi from '@/services/cashAdvanceApi'
import * as employeeApi from '@/services/employeeApi'
import { getErrorMessage } from '@/services/api'
import { formatCurrency, formatDate, formatDateTime, CASH_ADVANCE_STATUS_OPTIONS } from '@/utils/format'
import type { CashAdvanceStatus } from '@/types'

const ALL = 'all'

function KasbonDetailDialog({ id, onOpenChange }: { id: string | null; onOpenChange: (open: boolean) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['kasbon-detail', id],
    queryFn: () => cashAdvanceApi.getCashAdvanceDetail(id!),
    enabled: !!id,
  })

  return (
    <Dialog open={!!id} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Detail Kasbon</DialogTitle>
          <DialogDescription>{data ? data.employee_name : 'Memuat...'}</DialogDescription>
        </DialogHeader>
        {isLoading || !data ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between rounded-md bg-muted px-4 py-3">
              <span className="font-medium">Nominal</span>
              <span className="text-lg font-semibold">{formatCurrency(data.amount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <CashAdvanceStatusBadge status={data.status} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Diajukan</span>
              <span>{formatDateTime(data.requested_at)}</span>
            </div>
            {data.approved_at && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Diproses</span>
                <span>{formatDateTime(data.approved_at)}</span>
              </div>
            )}
            {data.paid_at && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Dibayar</span>
                <span>{formatDateTime(data.paid_at)}</span>
              </div>
            )}
            {data.reason && (
              <div>
                <p className="text-muted-foreground mb-1">Alasan</p>
                <p>{data.reason}</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function Kasbon() {
  const queryClient = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<CashAdvanceStatus | typeof ALL>(ALL)
  const [dateFrom, setDateFrom] = React.useState('')
  const [dateTo, setDateTo] = React.useState('')
  const [detailId, setDetailId] = React.useState<string | null>(null)

  const { data: employees } = useQuery({ queryKey: ['employees'], queryFn: employeeApi.listEmployees })

  const filters = {
    status: statusFilter === ALL ? undefined : statusFilter,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  }

  const { data, isLoading } = useQuery({
    queryKey: ['kasbon', filters],
    queryFn: () => cashAdvanceApi.listCashAdvances(filters),
  })

  const filtered = React.useMemo(() => {
    if (!search.trim()) return data
    const q = search.trim().toLowerCase()
    return data?.filter((row) => row.employee_name?.toLowerCase().includes(q))
  }, [data, search])

  const approveMutation = useMutation({
    mutationFn: cashAdvanceApi.approveCashAdvance,
    onSuccess: () => {
      toast.success('Kasbon disetujui')
      queryClient.invalidateQueries({ queryKey: ['kasbon'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const rejectMutation = useMutation({
    mutationFn: cashAdvanceApi.rejectCashAdvance,
    onSuccess: () => {
      toast.success('Kasbon ditolak')
      queryClient.invalidateQueries({ queryKey: ['kasbon'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <div>
      <PageHeader title="Cash Advance Management" description="Kelola pengajuan kasbon karyawan" />

      <Card className="mb-4 shadow-sm">
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Cari Karyawan</label>
            <Input
              placeholder="Nama karyawan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48"
              list="kasbon-employee-list"
            />
            <datalist id="kasbon-employee-list">
              {employees?.map((e) => <option key={e.id} value={e.name} />)}
            </datalist>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Status</label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as CashAdvanceStatus | typeof ALL)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua Status</SelectItem>
                {CASH_ADVANCE_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Dari Tanggal</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Sampai Tanggal</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
          </div>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Karyawan</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Nominal</TableHead>
                  <TableHead>Alasan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground text-center">
                      Tidak ada pengajuan kasbon.
                    </TableCell>
                  </TableRow>
                )}
                {filtered?.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.employee_name}</TableCell>
                    <TableCell>{formatDate(row.requested_at)}</TableCell>
                    <TableCell>{formatCurrency(row.amount)}</TableCell>
                    <TableCell className="text-muted-foreground max-w-48 truncate">{row.reason || '-'}</TableCell>
                    <TableCell>
                      <CashAdvanceStatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setDetailId(row.id)}>
                        <Eye className="size-4" />
                      </Button>
                      {row.status === 'pending' && (
                        <>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Check className="text-success size-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Approve Kasbon?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Kasbon {row.employee_name} sebesar {formatCurrency(row.amount)} akan disetujui dan
                                  otomatis menjadi potongan pada payroll berikutnya.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction onClick={() => approveMutation.mutate(row.id)}>
                                  {approveMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                                  Approve
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <XIcon className="text-destructive size-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Reject Kasbon?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Kasbon {row.employee_name} sebesar {formatCurrency(row.amount)} akan ditolak dan
                                  tidak akan mempengaruhi payroll.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-white hover:bg-destructive/90"
                                  onClick={() => rejectMutation.mutate(row.id)}
                                >
                                  {rejectMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                                  Reject
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <KasbonDetailDialog id={detailId} onOpenChange={(open) => !open && setDetailId(null)} />
    </div>
  )
}
