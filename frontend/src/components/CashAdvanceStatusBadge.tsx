import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { cashAdvanceStatusLabel } from '@/utils/format'
import type { CashAdvanceStatus } from '@/types'

export function CashAdvanceStatusBadge({ status }: { status: CashAdvanceStatus }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        status === 'pending' && 'bg-warning text-warning-foreground',
        status === 'approved' && 'bg-success text-success-foreground',
        status === 'rejected' && 'bg-destructive/10 text-destructive',
        status === 'paid' && 'bg-blue-500 text-white'
      )}
    >
      {cashAdvanceStatusLabel(status)}
    </Badge>
  )
}
