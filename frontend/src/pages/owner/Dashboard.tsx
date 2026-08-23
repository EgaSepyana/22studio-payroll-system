import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import { TrendingUp, TrendingDown, Wallet, HandCoins, RefreshCw, ShoppingCart, Wallet2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import * as ownerDashboardApi from '@/services/ownerDashboardApi'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrency, formatDateTime } from '@/utils/format'

const chartConfig = {
  revenue: { label: 'Pemasukan', color: 'var(--color-chart-1)' },
  expense: { label: 'Pengeluaran', color: 'var(--color-chart-2)' },
} satisfies ChartConfig

export default function OwnerDashboard() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['owner-dashboard'],
    queryFn: ownerDashboardApi.getDashboard,
  })

  return (
    <div>
      <PageHeader
        title={`Halo, ${user?.name || 'Owner'}`}
        description="Ringkasan keuangan usaha bulan ini"
        breadcrumbs={[{ label: 'Dashboard' }]}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['owner-dashboard'] })}
            disabled={isFetching}
          >
            <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} /> Refresh
          </Button>
        }
      />

      {isLoading || !data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard label="Pemasukan Bulan Ini" value={formatCurrency(data.revenue)} icon={TrendingUp} accent="success" />
            <StatCard label="Pengeluaran Bulan Ini" value={formatCurrency(data.expense)} icon={TrendingDown} />
            <StatCard
              label="Laba Kotor Bulan Ini"
              value={formatCurrency(data.gross_profit)}
              icon={Wallet}
              accent={data.gross_profit >= 0 ? 'success' : 'destructive'}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {data.cash_accounts.map((a) => (
              <StatCard key={a.id} label={a.name} value={formatCurrency(a.balance)} icon={Wallet2} />
            ))}
            <StatCard label="Total Kas" value={formatCurrency(data.total_cash)} icon={Wallet2} accent="success" />
            <StatCard label="Piutang Belum Tertagih" value={formatCurrency(data.unpaid_receivables)} icon={HandCoins} accent="warning" />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="shadow-sm lg:col-span-3">
              <CardHeader>
                <CardTitle>Tren Pemasukan & Pengeluaran (6 Bulan Terakhir)</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-64 w-full">
                  <BarChart data={data.monthly_trend}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                    <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
                    <Bar dataKey="revenue" fill="var(--color-revenue)" radius={6} />
                    <Bar dataKey="expense" fill="var(--color-expense)" radius={6} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="shadow-sm lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ShoppingCart className="size-4" /> Order Masuk (2 Hari Terakhir)</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col divide-y">
                {data.recent_orders.length === 0 && (
                  <p className="text-muted-foreground text-sm">Belum ada order baru.</p>
                )}
                {data.recent_orders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{o.order_name}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {o.customer_name || '-'} &middot; {formatDateTime(o.created_at)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold">{formatCurrency(o.items_total)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
