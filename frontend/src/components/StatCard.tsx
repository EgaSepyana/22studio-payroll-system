import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  value: ReactNode
  icon: LucideIcon
  accent?: 'primary' | 'success' | 'warning' | 'destructive'
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex items-start gap-3">
        <div
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg',
            accent === 'success' && 'bg-success/10 text-success',
            accent === 'warning' && 'bg-warning/10 text-warning',
            accent === 'destructive' && 'bg-destructive/10 text-destructive',
            (!accent || accent === 'primary') && 'bg-primary/10 text-primary'
          )}
        >
          <Icon className="size-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs font-medium">{label}</p>
          <p className="text-base leading-tight font-semibold break-words sm:text-lg">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
