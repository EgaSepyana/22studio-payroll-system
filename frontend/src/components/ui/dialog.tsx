import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

// Radix's Dialog dismisses on any "outside" pointerdown/focus, but a
// DropdownMenu/Select/Popover opened from inside the dialog renders its
// content in its own document.body portal — a sibling in the DOM, so a click
// on one of its items looks like an outside interaction to the dialog and
// closes it out from under the user. Ignore interactions whose target is
// still inside one of those nested Radix portals.
const RADIX_NESTED_PORTAL_SELECTOR = "[data-radix-popper-content-wrapper], [data-radix-menu-content]"

function isInsideNestedRadixPortal(target: EventTarget | null) {
  return target instanceof Element && target.closest(RADIX_NESTED_PORTAL_SELECTOR) !== null
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

// A second, nastier case than a click landing ON the nested portal: while
// that layer is open, Radix drops the dialog content's pointer-events to
// "none" (only the topmost layer stays interactive), so a click meant for a
// field behind it — pick a dropdown item, then click straight into the next
// input — never reaches that field at all. The browser's hit-test falls
// through to whatever's underneath, which is the dialog overlay, and Radix
// reads that as a genuine outside click and closes the dialog too. Detect
// that: if a nested popper was open at pointerdown time, and the pointer
// was physically over the dialog's own content rect, this was a click
// *meant* for the dialog, not a real outside click — let it merely close
// the stale nested layer instead of the dialog underneath it.
function wasPointerOverDialogContent(event: { clientX: number; clientY: number }) {
  const content = document.querySelector('[data-slot="dialog-content"]')
  if (!content) return false
  const rect = content.getBoundingClientRect()
  return (
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  onInteractOutside,
  onPointerDownOutside,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        onInteractOutside={(event) => {
          if (isInsideNestedRadixPortal(event.target)) {
            event.preventDefault()
            return
          }
          if (
            document.querySelector(RADIX_NESTED_PORTAL_SELECTOR) &&
            "clientX" in event.detail.originalEvent &&
            wasPointerOverDialogContent(event.detail.originalEvent)
          ) {
            event.preventDefault()
            return
          }
          onInteractOutside?.(event)
        }}
        onPointerDownOutside={(event) => {
          if (isInsideNestedRadixPortal(event.target)) {
            event.preventDefault()
            return
          }
          if (document.querySelector(RADIX_NESTED_PORTAL_SELECTOR) && wasPointerOverDialogContent(event.detail.originalEvent)) {
            event.preventDefault()
            return
          }
          onPointerDownOutside?.(event)
        }}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-2 right-2"
              size="icon-sm"
            >
              <XIcon
              />
              <span className="sr-only">Close</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props  
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
