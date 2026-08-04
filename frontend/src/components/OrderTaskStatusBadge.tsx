import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { OrderStatus, TaskStatus } from '@/types'

const LABELS: Record<OrderStatus | TaskStatus, string> = {
  // Task statuses (also used by legacy Order rows predating the 4-value enum).
  open: 'Belum Dikerjakan',
  in_progress: 'Sedang Dikerjakan',
  completed: 'Selesai',
  // Order statuses.
  'Belum Di Proses': 'Belum Di Proses',
  'Desain Fix': 'Desain Fix',
  'On Progress': 'On Progress',
  Done: 'Done',
  Dikirim: 'Dikirim',
  'Di Ambil Costumer': 'Di Ambil Costumer',
}

export function OrderTaskStatusBadge({ status }: { status: OrderStatus | TaskStatus }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        (status === 'completed' || status === 'Done') && 'bg-success text-success-foreground',
        (status === 'in_progress' || status === 'On Progress') && 'bg-warning text-warning-foreground',
        (status === 'open' || status === 'Desain Fix' || status === 'Belum Di Proses') &&
          'bg-muted text-muted-foreground',
        status === 'Dikirim' && 'bg-primary/70 text-primary-foreground',
        status === 'Di Ambil Costumer' && 'bg-primary text-primary-foreground'
      )}
    >
      {LABELS[status]}
    </Badge>
  )
}
