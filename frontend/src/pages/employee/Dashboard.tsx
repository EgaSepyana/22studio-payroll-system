import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { PlusCircle, Wallet, CalendarDays, ClipboardList, Layers, Clock, Timer } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/StatCard'
import { useAuth } from '@/hooks/useAuth'
import * as dashboardApi from '@/services/dashboardApi'
import { formatCurrency } from '@/utils/format'

export default function Dashboard() {
  const { user } = useAuth()
  const isFinishing = user?.divisi === 'Finishing'
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'employee'],
    queryFn: dashboardApi.getEmployeeDashboard,
  })

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-heading text-xl font-semibold">Halo, {user?.name}</h1>
        <p className="text-muted-foreground text-sm">
          {isFinishing ? 'Berikut ringkasan absensimu.' : 'Berikut ringkasan pekerjaanmu.'}
        </p>
      </div>

      <Button asChild size="lg" className="h-14 w-full text-base">
        <Link to={isFinishing ? '/app/absensi' : '/app/input'}>
          {isFinishing ? <Clock className="size-5" /> : <PlusCircle className="size-5" />}
          {isFinishing ? 'Absen Sekarang' : 'Input Pekerjaan Baru'}
        </Link>
      </Button>

      {isLoading || !data ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : isFinishing ? (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Pendapatan Hari Ini" value={formatCurrency(data.income_today)} icon={Wallet} accent="success" />
          <StatCard label="Pendapatan Bulan Ini" value={formatCurrency(data.income_this_month)} icon={CalendarDays} />
          <StatCard label="Jam Kerja Hari Ini" value={`${data.hours_today ?? 0} jam`} icon={Clock} />
          <StatCard label="Jam Kerja Bulan Ini" value={`${data.hours_this_month ?? 0} jam`} icon={Timer} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Pendapatan Hari Ini" value={formatCurrency(data.income_today)} icon={Wallet} accent="success" />
          <StatCard label="Pendapatan Bulan Ini" value={formatCurrency(data.income_this_month)} icon={CalendarDays} />
          <StatCard label="Jumlah Pekerjaan" value={data.work_count_this_month} icon={ClipboardList} />
          <StatCard label="Total Quantity" value={data.total_quantity_this_month} icon={Layers} />
        </div>
      )}

      <Card className="shadow-sm">
        <CardContent className="text-muted-foreground text-sm">
          {isFinishing
            ? 'Tips: jangan lupa check-out setelah selesai bekerja agar jam kerjamu tercatat dengan akurat.'
            : 'Tips: catat pekerjaanmu segera setelah selesai agar perhitungan gaji selalu akurat dan up to date.'}
        </CardContent>
      </Card>
    </div>
  )
}
