import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, PlayCircle, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import * as ownerReportApi from '@/services/ownerReportApi'
import { getErrorMessage } from '@/services/api'
import { formatCurrency } from '@/utils/format'
import type { OwnerProfitLoss, OwnerReportRow } from '@/types'

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function ReportTable({ title, rows, total, emptyLabel }: { title: string; rows: OwnerReportRow[]; total: number; emptyLabel: string }) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kategori</TableHead>
              <TableHead className="text-right">Jumlah</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="text-muted-foreground text-center">{emptyLabel}</TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.label}>
                <TableCell>{r.label}</TableCell>
                <TableCell className="text-right">{formatCurrency(r.total)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/50 font-semibold">
              <TableCell>Total</TableCell>
              <TableCell className="text-right">{formatCurrency(total)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export default function OwnerProfitLossPage() {
  const [month, setMonth] = React.useState(currentMonth())
  const [report, setReport] = React.useState<OwnerProfitLoss | null>(null)

  const mutation = useMutation({
    mutationFn: () => ownerReportApi.getProfitLoss(month),
    onSuccess: (data) => setReport(data),
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <div>
      <PageHeader
        title="Laba Rugi"
        description="Laporan pendapatan, HPP, dan laba bersih per bulan"
        breadcrumbs={[{ label: 'Dashboard', to: '/owner' }, { label: 'Laba Rugi' }]}
      />

      <div className="flex flex-col gap-4">
        <Card className="shadow-sm">
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-muted-foreground text-xs font-medium">Bulan</label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
            </div>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <PlayCircle className="size-4" />}
              Tampilkan
            </Button>
          </CardContent>
        </Card>

        {!report ? (
          <p className="text-muted-foreground py-10 text-center text-sm">
            Pilih bulan lalu klik "Tampilkan" untuk melihat laporan.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard label="Laba Kotor" value={formatCurrency(report.gross_profit)} icon={TrendingUp} accent={report.gross_profit >= 0 ? 'success' : 'destructive'} />
              <StatCard label="Total HPP" value={formatCurrency(report.cogs.total)} icon={TrendingDown} />
              <StatCard
                label="Laba Bersih"
                value={formatCurrency(report.net_profit)}
                icon={Wallet}
                accent={report.net_profit >= 0 ? 'success' : 'destructive'}
              />
            </div>

            <ReportTable title="Pendapatan (Omset)" rows={report.revenue.rows} total={report.revenue.total} emptyLabel="Belum ada pendapatan bulan ini." />
            <ReportTable title="Harga Pokok Penjualan (HPP)" rows={report.cogs.rows} total={report.cogs.total} emptyLabel="Belum ada HPP bulan ini." />

            <Card className="shadow-sm">
              <CardContent className="flex items-center justify-between py-4">
                <span className="font-medium">Laba Kotor (Pendapatan − HPP)</span>
                <span className={`text-lg font-semibold ${report.gross_profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(report.gross_profit)}
                </span>
              </CardContent>
            </Card>

            <ReportTable title="Beban Operasional" rows={report.expenses.rows} total={report.expenses.total} emptyLabel="Belum ada beban operasional bulan ini." />

            <Card className="shadow-sm">
              <CardContent className="flex items-center justify-between py-4">
                <span className="font-medium">Laba Bersih (Laba Kotor − Beban Operasional)</span>
                <span className={`text-lg font-semibold ${report.net_profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(report.net_profit)}
                </span>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
