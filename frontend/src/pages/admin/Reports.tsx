import * as React from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { FileDown, FileSpreadsheet } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MobileCardList, MobileCard, MobileCardRow } from '@/components/MobileCardList'
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
import { useFilterStore } from '@/stores/filterStore'
import * as reportApi from '@/services/reportApi'
import { getErrorMessage } from '@/services/api'
import { formatCurrency } from '@/utils/format'
import type { Divisi, ReportGroupBy } from '@/types'

const GROUP_OPTIONS: { value: ReportGroupBy; label: string }[] = [
  { value: 'daily', label: 'Harian' },
  { value: 'weekly', label: 'Mingguan' },
  { value: 'monthly', label: 'Bulanan' },
  { value: 'yearly', label: 'Tahunan' },
  { value: 'customer', label: 'Per Customer' },
  { value: 'article', label: 'Per Artikel' },
  { value: 'employee', label: 'Per Karyawan' },
]

const ALL = 'all'
const DIVISIONS: Divisi[] = ['Jahit', 'Sablon', 'Cutting', 'Finishing']

export default function Reports() {
  const { groupBy, divisiFilter } = useFilterStore((state) => state.reports)
  const setReportsFilter = useFilterStore((state) => state.setReports)
  const [dateFrom, setDateFrom] = React.useState('')
  const [dateTo, setDateTo] = React.useState('')

  const filters = {
    groupBy,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    divisi: divisiFilter === ALL ? undefined : (divisiFilter as Divisi),
  }

  const { data, isLoading } = useQuery({
    queryKey: ['report', filters],
    queryFn: () => reportApi.buildReport(filters),
  })

  const exportMutation = useMutation({
    mutationFn: (format: 'pdf' | 'excel') => reportApi.exportReport(filters, format),
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <div>
      <PageHeader
        title="Laporan"
        description="Laporan pekerjaan per periode, customer, artikel, dan karyawan"
        breadcrumbs={[{ label: 'Dashboard', to: '/admin' }, { label: 'Laporan' }]}
      />

      <Card className="mb-4 shadow-sm">
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Kelompokkan Berdasarkan</label>
            <Select value={groupBy} onValueChange={(v) => setReportsFilter({ groupBy: v as ReportGroupBy })}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {GROUP_OPTIONS.map((opt) => (
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
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Divisi</label>
            <Select value={divisiFilter} onValueChange={(v) => setReportsFilter({ divisiFilter: v as Divisi | 'all' })}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua Divisi</SelectItem>
                {DIVISIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" disabled={exportMutation.isPending} onClick={() => exportMutation.mutate('excel')}>
              <FileSpreadsheet className="size-4" /> Excel
            </Button>
            <Button variant="outline" disabled={exportMutation.isPending} onClick={() => exportMutation.mutate('pdf')}>
              <FileDown className="size-4" /> PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="px-0">
          {isLoading ? (
            <div className="space-y-3 px-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <>
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Keterangan</TableHead>
                    <TableHead>Jumlah Pekerjaan</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground text-center">
                        Tidak ada data untuk periode ini.
                      </TableCell>
                    </TableRow>
                  )}
                  {data?.rows.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      <TableCell>{row.count}</TableCell>
                      <TableCell>{row.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.total)}</TableCell>
                    </TableRow>
                  ))}
                  {data && data.rows.length > 0 && (
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Grand Total</TableCell>
                      <TableCell />
                      <TableCell>{data.grand_quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(data.grand_total)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {data?.rows.length === 0 && (
                <p className="text-muted-foreground px-4 py-6 text-center text-sm md:hidden">
                  Tidak ada data untuk periode ini.
                </p>
              )}
              <MobileCardList className="p-4">
                {data?.rows.map((row) => (
                  <MobileCard key={row.key}>
                    <p className="mb-2 font-medium">{row.label}</p>
                    <MobileCardRow label="Jumlah Pekerjaan">{row.count}</MobileCardRow>
                    <MobileCardRow label="Quantity">{row.quantity}</MobileCardRow>
                    <MobileCardRow label="Total">{formatCurrency(row.total)}</MobileCardRow>
                  </MobileCard>
                ))}
                {data && data.rows.length > 0 && (
                  <MobileCard className="bg-muted/50">
                    <p className="mb-2 font-semibold">Grand Total</p>
                    <MobileCardRow label="Quantity">{data.grand_quantity}</MobileCardRow>
                    <MobileCardRow label="Total">{formatCurrency(data.grand_total)}</MobileCardRow>
                  </MobileCard>
                )}
              </MobileCardList>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
