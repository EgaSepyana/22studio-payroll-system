import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import * as ownerReportApi from '@/services/ownerReportApi'
import { formatCurrency } from '@/utils/format'

export default function OwnerBalanceSheetPage() {
  const queryClient = useQueryClient()
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['owner-balance-sheet'],
    queryFn: ownerReportApi.getBalanceSheet,
  })

  return (
    <div>
      <PageHeader
        title="Neraca"
        description="Posisi keuangan usaha saat ini — aset vs kewajiban dan ekuitas"
        breadcrumbs={[{ label: 'Dashboard', to: '/owner' }, { label: 'Neraca' }]}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['owner-balance-sheet'] })}
            disabled={isFetching}
          >
            <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} /> Refresh
          </Button>
        }
      />

      {isLoading || !data ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Card className="shadow-sm">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground text-sm">Total Aset</span>
                <span className="font-semibold">{formatCurrency(data.assets.total)}</span>
                <span className="text-muted-foreground">vs</span>
                <span className="text-muted-foreground text-sm">Kewajiban + Ekuitas</span>
                <span className="font-semibold">{formatCurrency(data.total_liabilities_and_equity)}</span>
              </div>
              <Badge
                variant={data.is_balanced ? 'secondary' : 'destructive'}
                className="gap-1.5 px-3 py-1 text-sm"
              >
                {data.is_balanced ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
                {data.is_balanced ? 'BALANCE' : 'TIDAK BALANCE'}
                {!data.is_balanced && <span className="font-normal">({formatCurrency(data.discrepancy)})</span>}
              </Badge>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Aset</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <Table>
                  <TableHeader />
                  <TableBody>
                    {data.assets.cash.rows.map((r) => (
                      <TableRow key={r.label}>
                        <TableCell className="pl-6 text-sm">{r.label}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(r.total)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30 font-medium">
                      <TableCell>Kas & Bank</TableCell>
                      <TableCell className="text-right">{formatCurrency(data.assets.cash.total)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Piutang</TableCell>
                      <TableCell className="text-right">{formatCurrency(data.assets.receivables.total)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Stok Persediaan</TableCell>
                      <TableCell className="text-right">{formatCurrency(data.assets.inventory.total)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Aset Tetap</TableCell>
                      <TableCell className="text-right">{formatCurrency(data.assets.fixed_assets.total)}</TableCell>
                    </TableRow>
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Total Aset</TableCell>
                      <TableCell className="text-right">{formatCurrency(data.assets.total)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Kewajiban & Ekuitas</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <Table>
                  <TableHeader />
                  <TableBody>
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Total Kewajiban</TableCell>
                      <TableCell className="text-right">{formatCurrency(data.liabilities.total)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6 text-sm">Modal</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(data.equity.capital)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6 text-sm">Laba Ditahan</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(data.equity.retained_earnings)}</TableCell>
                    </TableRow>
                    <TableRow className="bg-muted/30 font-medium">
                      <TableCell>Total Ekuitas</TableCell>
                      <TableCell className="text-right">{formatCurrency(data.equity.total)}</TableCell>
                    </TableRow>
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Total Kewajiban + Ekuitas</TableCell>
                      <TableCell className="text-right">{formatCurrency(data.total_liabilities_and_equity)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
