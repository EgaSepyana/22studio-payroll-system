import { Loader2, MoreVertical, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface RowAction {
  label: string
  icon: LucideIcon
  onClick: () => void
  variant?: 'default' | 'destructive'
  disabled?: boolean
  loading?: boolean
}

// Desktop keeps the familiar row of ghost icon buttons (unchanged look).
// Below md — where a row of 3-5 32px icon buttons gets cramped and falls
// under the 44px touch-target minimum — every action collapses into a single
// dropdown behind one properly-sized trigger instead.
export function RowActionsMenu({ actions }: { actions: RowAction[] }) {
  if (actions.length === 0) return null

  return (
    <>
      <div className="hidden items-center justify-end gap-0.5 md:flex">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant="ghost"
            size="icon"
            disabled={action.disabled || action.loading}
            onClick={(e) => {
              e.stopPropagation()
              action.onClick()
            }}
            title={action.label}
            className={action.variant === 'destructive' ? 'text-destructive hover:text-destructive' : ''}
          >
            {action.loading ? <Loader2 className="size-4 animate-spin" /> : <action.icon className="size-4" />}
          </Button>
        ))}
      </div>

      <div className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              onClick={(e) => e.stopPropagation()}
              aria-label="Buka menu aksi"
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {actions.map((action) => (
              <DropdownMenuItem
                key={action.label}
                variant={action.variant}
                disabled={action.disabled || action.loading}
                onClick={action.onClick}
              >
                {action.loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <action.icon className="size-4" />
                )}
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}
