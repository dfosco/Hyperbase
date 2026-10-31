import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"
import { cn } from "../utils.js"

import { Button } from "./button.jsx"
import { XIcon } from "lucide-react"

function Sheet({
  ...props
}) {
  return <SheetPrimitive.Root data-hc-ui="" data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}) {
  return <SheetPrimitive.Trigger data-hc-ui="" data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}) {
  return <SheetPrimitive.Close data-hc-ui="" data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}) {
  return <SheetPrimitive.Portal data-hc-ui="" data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}) {
  return (
    <SheetPrimitive.Backdrop
      data-hc-ui="" data-slot="sheet-overlay"
      className={cn(
        "hc-fixed hc-inset-0 hc-z-[10000] hc-bg-black/10 hc-transition-opacity hc-duration-150 hc-data-ending-style:opacity-0 hc-data-starting-style:opacity-0 hc-supports-backdrop-filter:backdrop-blur-xs",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-hc-ui="" data-slot="sheet-content"
        data-side={side}
        className={cn(
          "hc-fixed hc-z-[10001] hc-flex hc-flex-col hc-gap-4 hc-bg-popover hc-bg-clip-padding hc-text-sm hc-text-popover-foreground hc-shadow-lg hc-transition hc-duration-200 hc-ease-in-out hc-data-ending-style:opacity-0 hc-data-starting-style:opacity-0 hc-data-[side=bottom]:inset-x-0 hc-data-[side=bottom]:bottom-0 hc-data-[side=bottom]:h-auto hc-data-[side=bottom]:border-t hc-data-[side=bottom]:data-ending-style:translate-y-[2.5rem] hc-data-[side=bottom]:data-starting-style:translate-y-[2.5rem] hc-data-[side=left]:inset-y-0 hc-data-[side=left]:left-0 hc-data-[side=left]:h-full hc-data-[side=left]:w-3/4 hc-data-[side=left]:border-r hc-data-[side=left]:data-ending-style:translate-x-[-2.5rem] hc-data-[side=left]:data-starting-style:translate-x-[-2.5rem] hc-data-[side=right]:inset-y-0 hc-data-[side=right]:right-0 hc-data-[side=right]:h-full hc-data-[side=right]:w-3/4 hc-data-[side=right]:border-l hc-data-[side=right]:data-ending-style:translate-x-[2.5rem] hc-data-[side=right]:data-starting-style:translate-x-[2.5rem] hc-data-[side=top]:inset-x-0 hc-data-[side=top]:top-0 hc-data-[side=top]:h-auto hc-data-[side=top]:border-b hc-data-[side=top]:data-ending-style:translate-y-[-2.5rem] hc-data-[side=top]:data-starting-style:translate-y-[-2.5rem] hc-data-[side=left]:sm:max-w-sm hc-data-[side=right]:sm:max-w-sm",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-hc-ui="" data-slot="sheet-close"
            render={
              <Button
                variant="ghost"
                className="hc-absolute hc-top-3 hc-right-3"
                size="icon-sm"
              />
            }
          >
            <XIcon
            />
            <span className="hc-sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  )
}

function SheetHeader({
  className,
  ...props
}) {
  return (
    <div
      data-hc-ui="" data-slot="sheet-header"
      className={cn("hc-flex hc-flex-col hc-gap-0.5 hc-p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({
  className,
  ...props
}) {
  return (
    <div
      data-hc-ui="" data-slot="sheet-footer"
      className={cn("hc-mt-auto hc-flex hc-flex-col hc-gap-2 hc-p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}) {
  return (
    <SheetPrimitive.Title
      data-hc-ui="" data-slot="sheet-title"
      className={cn(
        "hc-text-base hc-font-medium hc-text-foreground",
        className
      )}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}) {
  return (
    <SheetPrimitive.Description
      data-hc-ui="" data-slot="sheet-description"
      className={cn("hc-text-sm hc-text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
