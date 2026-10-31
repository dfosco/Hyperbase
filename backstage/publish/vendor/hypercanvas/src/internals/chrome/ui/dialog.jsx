"use client"

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "../utils.js"

import { Button } from "./button.jsx"
import { XIcon } from "lucide-react"

function Dialog({
  ...props
}) {
  return <DialogPrimitive.Root data-hc-ui="" data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}) {
  return <DialogPrimitive.Trigger data-hc-ui="" data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}) {
  return <DialogPrimitive.Portal data-hc-ui="" data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}) {
  return <DialogPrimitive.Close data-hc-ui="" data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}) {
  return (
    <DialogPrimitive.Backdrop
      data-hc-ui="" data-slot="dialog-overlay"
      className={cn(
        "hc-fixed hc-inset-0 hc-isolate hc-z-[10000] hc-bg-black/10 hc-duration-100 hc-supports-backdrop-filter:backdrop-blur-xs hc-data-open:animate-in hc-data-open:fade-in-0 hc-data-closed:animate-out hc-data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-hc-ui="" data-slot="dialog-content"
        className={cn(
          "hc-fixed hc-top-1/2 hc-left-1/2 hc-z-[10001] hc-grid hc-w-full hc-max-w-[calc(100%-2rem)] hc--translate-x-1/2 hc--translate-y-1/2 hc-gap-4 hc-rounded-xl hc-bg-popover hc-p-4 hc-font-sans hc-text-sm hc-text-popover-foreground hc-ring-1 hc-ring-foreground/10 hc-duration-100 hc-outline-none hc-sm:max-w-sm hc-data-open:animate-in hc-data-open:fade-in-0 hc-data-open:zoom-in-95 hc-data-closed:animate-out hc-data-closed:fade-out-0 hc-data-closed:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-hc-ui="" data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="hc-absolute hc-top-2 hc-right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon
            />
            <span className="hc-sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({
  className,
  ...props
}) {
  return (
    <div
      data-hc-ui="" data-slot="dialog-header"
      className={cn("hc-flex hc-flex-col hc-gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}) {
  return (
    <div
      data-hc-ui="" data-slot="dialog-footer"
      className={cn(
        "hc--mx-4 hc--mb-4 hc-flex hc-flex-col-reverse hc-gap-2 hc-rounded-b-xl hc-border-t hc-bg-muted/50 hc-p-4 hc-sm:flex-row hc-sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}) {
  return (
    <DialogPrimitive.Title
      data-hc-ui="" data-slot="dialog-title"
      className={cn(
        "hc-text-base hc-leading-none hc-font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}) {
  return (
    <DialogPrimitive.Description
      data-hc-ui="" data-slot="dialog-description"
      className={cn(
        "hc-text-sm hc-text-muted-foreground hc-*:[a]:underline hc-*:[a]:underline-offset-3 hc-*:[a]:hover:text-foreground",
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
