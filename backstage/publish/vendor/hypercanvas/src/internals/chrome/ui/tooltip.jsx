"use client"

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { cn } from "../utils.js"

function TooltipProvider({
  delay = 0,
  ...props
}) {
  return (
    <TooltipPrimitive.Provider
      data-hc-ui="" data-slot="tooltip-provider"
      delay={delay}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}) {
  return <TooltipPrimitive.Root data-hc-ui="" data-slot="tooltip" {...props} />
}

function TooltipTrigger({
  ...props
}) {
  return <TooltipPrimitive.Trigger data-hc-ui="" data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  children,
  ...props
}) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="hc-isolate hc-z-50"
      >
        <TooltipPrimitive.Popup
          data-hc-ui="" data-slot="tooltip-content"
          className={cn(
            "hc-z-50 hc-inline-flex hc-w-fit hc-max-w-xs hc-origin-(--transform-origin) hc-items-center hc-gap-1.5 hc-rounded-md hc-bg-foreground hc-px-3 hc-py-1.5 hc-text-xs hc-text-background hc-has-data-[slot=kbd]:pr-1.5 hc-data-[side=bottom]:slide-in-from-top-2 hc-data-[side=inline-end]:slide-in-from-left-2 hc-data-[side=inline-start]:slide-in-from-right-2 hc-data-[side=left]:slide-in-from-right-2 hc-data-[side=right]:slide-in-from-left-2 hc-data-[side=top]:slide-in-from-bottom-2 hc-**:data-[slot=kbd]:relative hc-**:data-[slot=kbd]:isolate hc-**:data-[slot=kbd]:z-50 hc-**:data-[slot=kbd]:rounded-sm hc-data-[state=delayed-open]:animate-in hc-data-[state=delayed-open]:fade-in-0 hc-data-[state=delayed-open]:zoom-in-95 hc-data-open:animate-in hc-data-open:fade-in-0 hc-data-open:zoom-in-95 hc-data-closed:animate-out hc-data-closed:fade-out-0 hc-data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow className="hc-z-50 hc-size-2.5 hc-translate-y-[calc(-50%-2px)] hc-rotate-45 hc-rounded-[2px] hc-bg-foreground hc-fill-foreground hc-data-[side=bottom]:top-1 hc-data-[side=inline-end]:top-1/2! hc-data-[side=inline-end]:-left-1 hc-data-[side=inline-end]:-translate-y-1/2 hc-data-[side=inline-start]:top-1/2! hc-data-[side=inline-start]:-right-1 hc-data-[side=inline-start]:-translate-y-1/2 hc-data-[side=left]:top-1/2! hc-data-[side=left]:-right-1 hc-data-[side=left]:-translate-y-1/2 hc-data-[side=right]:top-1/2! hc-data-[side=right]:-left-1 hc-data-[side=right]:-translate-y-1/2 hc-data-[side=top]:-bottom-2.5" />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
