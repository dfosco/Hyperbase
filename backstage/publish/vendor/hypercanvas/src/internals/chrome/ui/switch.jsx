"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "../utils.js"

function Switch({
  className,
  size = "default",
  ...props
}) {
  return (
    <SwitchPrimitive.Root
      data-hc-ui="" data-slot="switch"
      data-size={size}
      className={cn(
        "hc-peer hc-group/switch hc-relative hc-inline-flex hc-shrink-0 hc-items-center hc-rounded-full hc-border hc-border-transparent hc-transition-all hc-outline-none hc-group-has-[:focus-visible]/field-label:border-transparent hc-group-has-[:focus-visible]/field-label:ring-0 hc-after:absolute hc-after:-inset-x-3 hc-after:-inset-y-2 hc-focus-visible:border-ring hc-focus-visible:ring-3 hc-focus-visible:ring-ring/50 hc-aria-invalid:border-destructive hc-aria-invalid:ring-3 hc-aria-invalid:ring-destructive/20 hc-data-[size=default]:h-[18.4px] hc-data-[size=default]:w-[32px] hc-data-[size=sm]:h-[14px] hc-data-[size=sm]:w-[24px] hc-dark:aria-invalid:border-destructive/50 hc-dark:aria-invalid:ring-destructive/40 hc-data-checked:bg-primary hc-data-unchecked:bg-input hc-dark:data-unchecked:bg-input/80 hc-data-disabled:cursor-not-allowed hc-data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-hc-ui="" data-slot="switch-thumb"
        className="hc-pointer-events-none hc-block hc-rounded-full hc-bg-background hc-ring-0 hc-transition-transform hc-group-data-[size=default]/switch:size-4 hc-group-data-[size=sm]/switch:size-3 hc-group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] hc-group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] hc-dark:data-checked:bg-primary-foreground hc-group-data-[size=default]/switch:data-unchecked:translate-x-0 hc-group-data-[size=sm]/switch:data-unchecked:translate-x-0 hc-dark:data-unchecked:bg-foreground"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
