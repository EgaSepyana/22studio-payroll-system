import { cn } from '@/lib/utils'
import type { OrderStatus, TaskStatus } from '@/types'

export function ProgressBar({
  value,
  status,
  className,
}: {
  value: number
  status?: OrderStatus | TaskStatus
  className?: string
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100

  let barColor = 'bg-primary'
  if (status === 'completed' || status === 'Done') barColor = 'bg-success'
  else if (status === 'Di Ambil Costumer') barColor = 'bg-primary'
  else if (status === 'in_progress' || status === 'On Progress') barColor = 'bg-warning'
  else if (status === 'open' || status === 'Desain Fix') barColor = 'bg-muted-foreground/40'
  else if (pct >= 100) barColor = 'bg-success'

  return (
    <div className={cn('bg-muted h-1.5 w-full overflow-hidden rounded-full', className)}>
      <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
    </div>
  )
}
