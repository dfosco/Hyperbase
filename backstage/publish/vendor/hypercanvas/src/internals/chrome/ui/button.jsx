import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva } from "class-variance-authority";
import { cn } from "../utils.js"

const buttonVariants = cva(
  "hc-group/button hc-inline-flex hc-shrink-0 hc-items-center hc-justify-center hc-rounded-lg hc-border hc-border-transparent hc-bg-clip-padding hc-text-sm hc-font-medium hc-whitespace-nowrap hc-transition-all hc-outline-none hc-select-none hc-focus-visible:border-ring hc-focus-visible:ring-3 hc-focus-visible:ring-ring/50 hc-active:not-aria-[haspopup]:translate-y-px hc-disabled:pointer-events-none hc-disabled:opacity-50 hc-aria-invalid:border-destructive hc-aria-invalid:ring-3 hc-aria-invalid:ring-destructive/20 hc-dark:aria-invalid:border-destructive/50 hc-dark:aria-invalid:ring-destructive/40 hc-[&_svg]:pointer-events-none hc-[&_svg]:shrink-0 hc-[&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "hc-bg-primary hc-text-primary-foreground hc-hover:bg-primary/80",
        outline:
          "hc-border-border hc-bg-background hc-hover:bg-muted hc-hover:text-foreground hc-aria-expanded:bg-muted hc-aria-expanded:text-foreground hc-dark:border-input hc-dark:bg-input/30 hc-dark:hover:bg-input/50",
        secondary:
          "hc-bg-secondary hc-text-secondary-foreground hc-hover:bg-[color-mix(in_oklch,var(--hc-color-secondary),var(--hc-color-foreground)_5%)] hc-aria-expanded:bg-secondary hc-aria-expanded:text-secondary-foreground",
        ghost:
          "hc-hover:bg-muted hc-hover:text-foreground hc-aria-expanded:bg-muted hc-aria-expanded:text-foreground hc-dark:hover:bg-muted/50",
        destructive:
          "hc-bg-destructive/10 hc-text-destructive hc-hover:bg-destructive/20 hc-focus-visible:border-destructive/40 hc-focus-visible:ring-destructive/20 hc-dark:bg-destructive/20 hc-dark:hover:bg-destructive/30 hc-dark:focus-visible:ring-destructive/40",
        link: "hc-text-primary hc-underline-offset-4 hc-hover:underline",
      },
      size: {
        default:
          "hc-h-8 hc-gap-1.5 hc-px-2.5 hc-has-data-[icon=inline-end]:pr-2 hc-has-data-[icon=inline-start]:pl-2",
        xs: "hc-h-6 hc-gap-1 hc-rounded-[min(var(--hc-radius-md),10px)] hc-px-2 hc-text-xs hc-in-data-[slot=button-group]:rounded-lg hc-has-data-[icon=inline-end]:pr-1.5 hc-has-data-[icon=inline-start]:pl-1.5 hc-[&_svg:not([class*='size-'])]:size-3",
        sm: "hc-h-7 hc-gap-1 hc-rounded-[min(var(--hc-radius-md),12px)] hc-px-2.5 hc-text-[0.8rem] hc-in-data-[slot=button-group]:rounded-lg hc-has-data-[icon=inline-end]:pr-1.5 hc-has-data-[icon=inline-start]:pl-1.5 hc-[&_svg:not([class*='size-'])]:size-3.5",
        lg: "hc-h-9 hc-gap-1.5 hc-px-2.5 hc-has-data-[icon=inline-end]:pr-2 hc-has-data-[icon=inline-start]:pl-2",
        icon: "hc-size-8",
        "icon-xs":
          "hc-size-6 hc-rounded-[min(var(--hc-radius-md),10px)] hc-in-data-[slot=button-group]:rounded-lg hc-[&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "hc-size-7 hc-rounded-[min(var(--hc-radius-md),12px)] hc-in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "hc-size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}) {
  return (
    <ButtonPrimitive
      data-hc-ui="" data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
