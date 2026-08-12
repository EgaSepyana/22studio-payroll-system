import * as React from 'react'
import { cn } from '@/lib/utils'

// Mobile-only stand-in for a wide table (hidden md:block on the Table,
// this shown md:hidden alongside it) — one card per row instead of a
// horizontally-scrolling table.
export function MobileCardList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-3 md:hidden', className)}>{children}</div>
}

export function MobileCard({
  onClick,
  children,
  className,
}: {
  onClick?: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'bg-card rounded-lg border p-3 shadow-sm',
        onClick && 'cursor-pointer active:bg-muted/50',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

export function MobileCardRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  )
}
