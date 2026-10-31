import { cn } from "../utils.js"

function Textarea({
  className,
  ...props
}) {
  return (
    <textarea
      data-hc-ui="" data-slot="textarea"
      className={cn(
        "hc-flex hc-field-sizing-content hc-min-h-16 hc-w-full hc-rounded-lg hc-border hc-border-input hc-bg-transparent hc-px-2.5 hc-py-2 hc-text-base hc-transition-colors hc-outline-none hc-placeholder:text-muted-foreground hc-focus-visible:border-ring hc-focus-visible:ring-3 hc-focus-visible:ring-ring/50 hc-disabled:cursor-not-allowed hc-disabled:bg-input/50 hc-disabled:opacity-50 hc-aria-invalid:border-destructive hc-aria-invalid:ring-3 hc-aria-invalid:ring-destructive/20 hc-md:text-sm hc-dark:bg-input/30 hc-dark:disabled:bg-input/80 hc-dark:aria-invalid:border-destructive/50 hc-dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
