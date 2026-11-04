import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "../utils.js"

function Input({
  className,
  type,
  ...props
}) {
  return (
    <InputPrimitive
      type={type}
      data-hc-ui="" data-slot="input"
      className={cn(
        "hc-h-8 hc-w-full hc-min-w-0 hc-rounded-lg hc-border hc-border-input hc-bg-transparent hc-px-2.5 hc-py-1 hc-text-base hc-transition-colors hc-outline-none hc-file:inline-flex hc-file:h-6 hc-file:border-0 hc-file:bg-transparent hc-file:text-sm hc-file:font-medium hc-file:text-foreground hc-placeholder:text-muted-foreground hc-focus-visible:border-ring hc-focus-visible:ring-3 hc-focus-visible:ring-ring/50 hc-disabled:pointer-events-none hc-disabled:cursor-not-allowed hc-disabled:bg-input/50 hc-disabled:opacity-50 hc-aria-invalid:border-destructive hc-aria-invalid:ring-3 hc-aria-invalid:ring-destructive/20 hc-md:text-sm hc-dark:bg-input/30 hc-dark:disabled:bg-input/80 hc-dark:aria-invalid:border-destructive/50 hc-dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
