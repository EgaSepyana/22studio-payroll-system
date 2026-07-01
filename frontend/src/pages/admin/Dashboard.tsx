import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import { Users, Building2, Package, ClipboardList, Wallet, TrendingUp } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import * as dashboardApi from '@/services/dashboardApi'
import { formatCurrency, formatDate } from '@/utils/format'

const chartConfig = {
  total: { label: 'Total Pendapatan', color: 'var(--color-chart-1)' },
} satisfies ChartConfig

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'admin'],
    queryFn: dashboardApi.getAdminDashboard,
  })

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Dashboard" description="Ringkasan aktivitas 22Studio hari ini" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Total Karyawan" value={data.total_employees} icon={Users} />
        <StatCard label="Total Customer" value={data.total_customers} icon={Building2} />
        <StatCard label="Total Artikel" value={data.total_articles} icon={Package} />
        <StatCard label="Pekerjaan Hari Ini" value={data.total_work_today} icon={ClipboardList} />
        <StatCard
          label="Pendapatan Hari Ini"
          value={formatCurrency(data.total_revenue_today)}
          icon={TrendingUp}
          accent="success"
        />
        <StatCard
          label="Payroll Bulan Ini"
          value={formatCurrency(data.total_payroll_this_month)}
          icon={Wallet}
          accent="warning"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <Card className="shadow-sm lg:col-span-3">
          <CardHeader>
            <CardTitle>Grafik Pekerjaan Bulanan</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <BarChart data={data.monthly_chart}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  fontSize={12}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatCurrency(Number(value))}
                    />
                  }
                />
                <Bar dataKey="total" fill="var(--color-total)" radius={6} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle>Top Produktivitas Karyawan</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {data.top_productivity.length === 0 && (
              <p className="text-muted-foreground text-sm">Belum ada data pekerjaan.</p>
            )}
            {data.top_productivity.map((item, idx) => (
              <div key={item.employee_name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="size-6 justify-center rounded-full p-0">
                    {idx + 1}
                  </Badge>
                  <span className="text-sm font-medium">{item.employee_name}</span>
                </div>
                <span className="text-muted-foreground text-sm">{item.quantity} pcs</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 shadow-sm">
        <CardHeader>
          <CardTitle>Aktivitas Terbaru</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {data.recent_activity.length === 0 && (
            <p className="text-muted-foreground text-sm">Belum ada aktivitas.</p>
          )}
          {data.recent_activity.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div>
                <p className="text-sm font-medium">{item.employee_name}</p>
                <p className="text-muted-foreground text-xs">
                  {formatDate(item.work_date)} &middot; {item.quantity} pcs
                </p>
              </div>
              <span className="text-sm font-semibold">{formatCurrency(item.total)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
