import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Eye, CheckCircle2, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import * as payrollApi from '@/services/payrollApi'
import * as employeeApi from '@/services/employeeApi'
import { getErrorMessage } from '@/services/api'
import { formatCurrency, formatDate, formatDateTime, MONTH_NAMES } from '@/utils/format'

const ALL = 'all'
const now = new Date()
const YEARS = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)

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
            {data ? `${data.employee_name} — ${MONTH_NAMES[data.month - 1]} ${data.year}` : 'Memuat...'}
          </DialogDescription>
        </DialogHeader>
        {isLoading || !data ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="max-h-72 overflow-y-auto rounded-md border">
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
                      <TableCell>{formatDate(item.work_date)}</TableCell>
                      <TableCell>{item.article_name}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between rounded-md bg-muted px-4 py-3">
              <span className="text-sm font-medium">Total Gaji</span>
              <span className="text-lg font-semibold">{formatCurrency(data.total_salary)}</span>
            </div>
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
  const [month, setMonth] = React.useState(String(now.getMonth() + 1))
  const [year, setYear] = React.useState(String(now.getFullYear()))
  const [employeeId, setEmployeeId] = React.useState(ALL)
  const [detailId, setDetailId] = React.useState<string | null>(null)

  const { data: employees } = useQuery({ queryKey: ['employees'], queryFn: employeeApi.listEmployees })

  const { data, isLoading } = useQuery({
    queryKey: ['payroll', month, year, employeeId],
    queryFn: () => payrollApi.listPayroll(Number(month), Number(year), employeeId === ALL ? undefined : employeeId),
  })

  const payMutation = useMutation({
    mutationFn: payrollApi.markPayrollPaid,
    onSuccess: () => {
      toast.success('Payroll ditandai sudah dibayar')
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <div>
      <PageHeader title="Payroll" description="Perhitungan gaji karyawan berdasarkan hasil kerja" />

      <Card className="mb-4 shadow-sm">
        <CardContent className="flex flex-wrap items-end gap-3">
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
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Karyawan</label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua Karyawan</SelectItem>
                {employees?.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
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
                  <TableHead>Nama</TableHead>
                  <TableHead>Total Pendapatan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground text-center">
                      Belum ada pekerjaan pada periode ini.
                    </TableCell>
                  </TableRow>
                )}
                {data?.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.employee_name}</TableCell>
                    <TableCell>{formatCurrency(row.total_salary)}</TableCell>
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
                                {MONTH_NAMES[row.month - 1]} {row.year} akan ditandai sudah dibayar. Tindakan ini
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
