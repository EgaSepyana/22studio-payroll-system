import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import * as payrollApi from '@/services/payrollApi'
import { formatCurrency, MONTH_NAMES } from '@/utils/format'

export default function RiwayatGaji() {
  const { data, isLoading } = useQuery({
    queryKey: ['payroll-mine'],
    queryFn: payrollApi.listMyPayrollHistory,
  })

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-semibold">Riwayat Gaji</h1>
        <p className="text-muted-foreground text-sm">Riwayat gaji bulanan dan status pembayaran.</p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : data?.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">Belum ada riwayat gaji.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {data?.map((row) => (
            <Card key={row.id} className="shadow-sm">
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="text-sm font-medium">
                    {MONTH_NAMES[row.month - 1]} {row.year}
                  </p>
                  {row.kasbon_deduction > 0 ? (
                    <div>
                      <p className="text-muted-foreground text-xs">
                        Pendapatan {formatCurrency(row.total_salary)} &middot; Kasbon -{formatCurrency(row.kasbon_deduction)}
                      </p>
                      <p className="text-lg font-semibold">{formatCurrency(row.net_salary)}</p>
                    </div>
                  ) : (
                    <p className="text-lg font-semibold">{formatCurrency(row.total_salary)}</p>
                  )}
                </div>
                <Badge
                  variant={row.payment_status === 'paid' ? 'default' : 'secondary'}
                  className={row.payment_status === 'paid' ? 'bg-success text-success-foreground' : ''}
                >
                  {row.payment_status === 'paid' ? 'Sudah Dibayar' : 'Belum Dibayar'}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
