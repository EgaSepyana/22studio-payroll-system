import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Eye, CheckCircle2, Loader2, FileSpreadsheet, FileDown, Printer, FileText } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import * as payrollApi from '@/services/payrollApi'
import * as employeeApi from '@/services/employeeApi'
import { getErrorMessage } from '@/services/api'
import { formatCurrency, formatDate, formatDateTime, todayISO, MONTH_NAMES } from '@/utils/format'
import type { PayrollExportFilters } from '@/services/payrollApi'
import type { Divisi, PayrollRow } from '@/types'

const ALL = 'all'
const DIVISIONS: Divisi[] = ['Jahit', 'Sablon', 'Cutting', 'Finishing']
const now = new Date()
const YEARS = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)

function isDailyRow(row: Pick<PayrollRow, 'pay_source' | 'pay_date'>) {
  return row.pay_source === 'attendance' && !!row.pay_date && row.pay_date !== '0' && row.pay_date !== 0
}

function periodLabel(row: PayrollRow) {
  return isDailyRow(row) ? formatDate(String(row.pay_date)) : `${MONTH_NAMES[row.month - 1]} ${row.year}`
}

function PayrollDetailDialog({ payrollId, onOpenChange }: { payrollId: string | null; onOpenChange: (open: boolean) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['payroll-detail', payrollId],
    queryFn: () => payrollApi.getPayrollDetail(payrollId!),
    enabled: !!payrollId,
  })

  return (
    <Dialog open={!!payrollId} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Detail Payroll</DialogTitle>
          <DialogDescription>
            {data ? `${data.employee_name} — ${periodLabel(data)}` : 'Memuat...'}
          </DialogDescription>
        </DialogHeader>
        {isLoading || !data ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="max-h-72 overflow-y-auto rounded-md border">
              {data.items_type === 'attendance' ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead>Check-out</TableHead>
                      <TableHead className="text-right">Jam Kerja</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{formatDate('date' in item ? item.date : '')}</TableCell>
                        <TableCell>
                          {'check_in' in item && item.check_in ? formatDateTime(item.check_in) : '-'}
                        </TableCell>
                        <TableCell>
                          {'check_out' in item && item.check_out ? formatDateTime(item.check_out) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {'hours' in item ? item.hours ?? '-' : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Artikel</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{'work_date' in item ? formatDate(item.work_date) : '-'}</TableCell>
                        <TableCell>{'article_name' in item ? item.article_name : '-'}</TableCell>
                        <TableCell>{'quantity' in item ? item.quantity : '-'}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency('total' in item ? item.total : 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            {data.kasbon_deduction > 0 ? (
              <div className="flex flex-col gap-1.5 rounded-md bg-muted px-4 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Pendapatan</span>
                  <span className="font-medium">{formatCurrency(data.total_salary)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Kasbon</span>
                  <span className="text-destructive font-medium">-{formatCurrency(data.kasbon_deduction)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between border-t pt-1.5">
                  <span className="text-sm font-medium">Total Dibayar</span>
                  <span className="text-lg font-semibold">{formatCurrency(data.net_salary)}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-md bg-muted px-4 py-3">
                <span className="text-sm font-medium">Total Gaji</span>
                <span className="text-lg font-semibold">{formatCurrency(data.total_salary)}</span>
              </div>
            )}
            {data.payment_status === 'paid' && (
              <p className="text-muted-foreground text-xs">
                Dibayar pada {formatDateTime(data.paid_at)}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function Payroll() {
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = React.useState<'month' | 'range'>('month')
  const [month, setMonth] = React.useState(String(now.getMonth() + 1))
  const [year, setYear] = React.useState(String(now.getFullYear()))
  const [dateFrom, setDateFrom] = React.useState(todayISO())
  const [dateTo, setDateTo] = React.useState(todayISO())
  const [employeeId, setEmployeeId] = React.useState(ALL)
  const [divisiFilter, setDivisiFilter] = React.useState(ALL)
  const [detailId, setDetailId] = React.useState<string | null>(null)
  const [rowAction, setRowAction] = React.useState<{ id: string; type: 'print' | 'excel' | 'pdf' } | null>(null)
  const [bulkExporting, setBulkExporting] = React.useState<'print' | 'excel' | 'pdf' | null>(null)

  const { data: employees } = useQuery({ queryKey: ['employees'], queryFn: employeeApi.listEmployees })
  const finishingEmployees = React.useMemo(
    () => employees?.filter((e) => e.divisi === 'Finishing') || [],
    [employees]
  )

  const isRangeMode = viewMode === 'range'

  const { data: monthData, isLoading: monthLoading } = useQuery({
    queryKey: ['payroll', month, year, employeeId, divisiFilter],
    queryFn: () =>
      payrollApi.listPayroll(
        Number(month),
        Number(year),
        employeeId === ALL ? undefined : employeeId,
        divisiFilter === ALL ? undefined : (divisiFilter as Divisi)
      ),
    enabled: !isRangeMode,
  })

  const rangeFilters = {
    date_from: dateFrom,
    date_to: dateTo,
    employee_id: employeeId === ALL ? undefined : employeeId,
    divisi: divisiFilter === ALL ? undefined : (divisiFilter as Divisi),
  }

  const { data: rangeData, isLoading: rangeLoading } = useQuery({
    queryKey: ['payroll-range', rangeFilters],
    queryFn: () => payrollApi.listPayrollRange(rangeFilters),
    enabled: isRangeMode && !!dateFrom && !!dateTo,
  })

  const data = isRangeMode ? rangeData : monthData
  const isLoading = isRangeMode ? rangeLoading : monthLoading

  const rangeTotals = React.useMemo(() => {
    if (!isRangeMode || !rangeData) return null
    return rangeData.reduce(
      (acc, row) => ({
        kasbon: acc.kasbon + Number(row.kasbon_deduction),
        net: acc.net + Number(row.net_salary),
        unpaidCount: acc.unpaidCount + (row.payment_status === 'unpaid' ? 1 : 0),
      }),
      { kasbon: 0, net: 0, unpaidCount: 0 }
    )
  }, [isRangeMode, rangeData])

  const payMutation = useMutation({
    mutationFn: payrollApi.markPayrollPaid,
    onSuccess: () => {
      toast.success('Payroll ditandai sudah dibayar')
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
      queryClient.invalidateQueries({ queryKey: ['payroll-range'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const payRangeMutation = useMutation({
    mutationFn: () => payrollApi.markRangePaid(rangeFilters),
    onSuccess: () => {
      toast.success('Semua payroll pada rentang tanggal ini ditandai sudah dibayar')
      queryClient.invalidateQueries({ queryKey: ['payroll-range'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  async function handleGenerateSlip(row: PayrollRow, type: 'print' | 'excel' | 'pdf') {
    setRowAction({ id: row.id, type })
    try {
      if (type === 'print') {
        await payrollApi.printPayroll({ id: row.id })
      } else {
        await payrollApi.exportPayroll({ id: row.id }, type)
      }
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setRowAction(null)
    }
  }

  // Generates a combined slip-gaji report for every paid row matching the
  // currently active filter — the month/year/employee/divisi filter in
  // Bulan mode, or the date_from/date_to/employee/divisi filter in Range mode.
  const bulkExportFilters: PayrollExportFilters = isRangeMode
    ? {
        date_from: dateFrom,
        date_to: dateTo,
        employee_id: employeeId === ALL ? undefined : employeeId,
        divisi: divisiFilter === ALL ? undefined : (divisiFilter as Divisi),
      }
    : {
        month: Number(month),
        year: Number(year),
        employee_id: employeeId === ALL ? undefined : employeeId,
        divisi: divisiFilter === ALL ? undefined : (divisiFilter as Divisi),
      }

  async function handleBulkExport(type: 'print' | 'excel' | 'pdf') {
    setBulkExporting(type)
    try {
      if (type === 'print') {
        await payrollApi.printPayroll(bulkExportFilters)
      } else {
        await payrollApi.exportPayroll(bulkExportFilters, type)
      }
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBulkExporting(null)
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <PageHeader title="Payroll" description="Perhitungan gaji karyawan berdasarkan hasil kerja" />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!!bulkExporting} onClick={() => handleBulkExport('print')}>
            {bulkExporting === 'print' ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
            Print
          </Button>
          <Button variant="outline" disabled={!!bulkExporting} onClick={() => handleBulkExport('excel')}>
            {bulkExporting === 'excel' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="size-4" />
            )}
            Excel
          </Button>
          <Button variant="outline" disabled={!!bulkExporting} onClick={() => handleBulkExport('pdf')}>
            {bulkExporting === 'pdf' ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
            PDF
          </Button>
        </div>
      </div>

      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'month' | 'range')} className="mb-4">
        <TabsList>
          <TabsTrigger value="month">Bulan</TabsTrigger>
          <TabsTrigger value="range">Range Tanggal (Absensi)</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="mb-4 shadow-sm">
        <CardContent className="flex flex-wrap items-end gap-3">
          {isRangeMode ? (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-muted-foreground text-xs font-medium">Dari Tanggal</label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-muted-foreground text-xs font-medium">Sampai Tanggal</label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-muted-foreground text-xs font-medium">Bulan</label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((name, idx) => (
                      <SelectItem key={name} value={String(idx + 1)}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-muted-foreground text-xs font-medium">Tahun</label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Karyawan</label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua Karyawan</SelectItem>
                {(isRangeMode ? finishingEmployees : employees)?.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!isRangeMode && (
            <div className="flex flex-col gap-1.5">
              <label className="text-muted-foreground text-xs font-medium">Divisi</label>
              <Select value={divisiFilter} onValueChange={setDivisiFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Semua Divisi</SelectItem>
                  {DIVISIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {isRangeMode && rangeTotals && (
        <Card className="mb-4 shadow-sm">
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-muted-foreground text-xs">Total Kasbon (rentang ini)</p>
                <p className="text-destructive text-lg font-semibold">-{formatCurrency(rangeTotals.kasbon)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Total Gaji Bersih (rentang ini)</p>
                <p className="text-lg font-semibold">{formatCurrency(rangeTotals.net)}</p>
              </div>
            </div>
            {rangeTotals.unpaidCount > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={payRangeMutation.isPending}>
                    {payRangeMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                    <CheckCircle2 className="size-4" /> Tandai Semua Sudah Dibayar ({rangeTotals.unpaidCount})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Bayar Semua Payroll pada Rentang Ini?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {rangeTotals.unpaidCount} payroll harian yang belum dibayar antara {formatDate(dateFrom)} dan{' '}
                      {formatDate(dateTo)} akan ditandai sudah dibayar sekaligus. Tindakan ini tidak dapat dibatalkan.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={() => payRangeMutation.mutate()}>
                      Tandai Semua Sudah Dibayar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </CardContent>
        </Card>
      )}

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
                  <TableHead>Nama</TableHead>
                  {isRangeMode && <TableHead>Tanggal</TableHead>}
                  <TableHead>Total Pendapatan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isRangeMode ? 5 : 4} className="text-muted-foreground text-center">
                      {isRangeMode
                        ? 'Tidak ada absensi pada rentang tanggal ini.'
                        : 'Belum ada pekerjaan pada periode ini.'}
                    </TableCell>
                  </TableRow>
                )}
                {data?.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.employee_name}</TableCell>
                    {isRangeMode && <TableCell>{formatDate(String(row.pay_date))}</TableCell>}
                    <TableCell>
                      {formatCurrency(row.total_salary)}
                      {row.kasbon_deduction > 0 && (
                        <span className="text-destructive block text-xs">
                          -{formatCurrency(row.kasbon_deduction)} kasbon
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.payment_status === 'paid' ? 'default' : 'secondary'}
                        className={row.payment_status === 'paid' ? 'bg-success text-success-foreground' : ''}
                      >
                        {row.payment_status === 'paid' ? 'Sudah Dibayar' : 'Belum Dibayar'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setDetailId(row.id)}>
                        <Eye className="size-4" />
                      </Button>
                      {row.payment_status === 'unpaid' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <CheckCircle2 className="text-success size-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Tandai Sudah Dibayar?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Gaji {row.employee_name} sebesar {formatCurrency(row.total_salary)} untuk{' '}
                                {periodLabel(row)} akan ditandai sudah dibayar. Tindakan ini
                                tidak memerlukan approval dan tidak dapat dibatalkan.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction onClick={() => payMutation.mutate(row.id)}>
                                {payMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                                Tandai Sudah Dibayar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      {row.payment_status === 'paid' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={rowAction?.id === row.id}>
                              {rowAction?.id === row.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <FileText className="size-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleGenerateSlip(row, 'print')}>
                              <Printer className="size-4" /> Print Slip Gaji
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleGenerateSlip(row, 'pdf')}>
                              <FileDown className="size-4" /> Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleGenerateSlip(row, 'excel')}>
                              <FileSpreadsheet className="size-4" /> Download Excel
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PayrollDetailDialog payrollId={detailId} onOpenChange={(open) => !open && setDetailId(null)} />
    </div>
  )
}
