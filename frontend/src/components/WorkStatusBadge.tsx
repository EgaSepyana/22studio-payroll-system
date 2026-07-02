import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { workStatusLabel } from '@/utils/format'
import type { WorkStatus } from '@/types'

export function WorkStatusBadge({ status }: { status: WorkStatus }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        status === 'selesai' && 'bg-success text-success-foreground',
        status === 'on_progress' && 'bg-warning text-warning-foreground',
        status === 'belum_selesai' && 'bg-destructive/10 text-destructive'
      )}
    >
      {workStatusLabel(status)}
    </Badge>
  )
}
