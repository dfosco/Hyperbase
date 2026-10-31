import { forwardRef } from "react";
import { cn } from "../../../utils/index.js";
import { tv } from "tailwind-variants";

export const alertVariants = tv({
base: "hc-grid hc-gap-0.5 hc-rounded-lg hc-border hc-px-2.5 hc-py-2 hc-text-left hc-text-sm hc-has-data-[slot=alert-action]:relative hc-has-data-[slot=alert-action]:pr-18 hc-has-[>svg]:grid-cols-[auto_1fr] hc-has-[>svg]:gap-x-2 hc-*:[svg]:row-span-2 hc-*:[svg]:translate-y-0.5 hc-*:[svg]:text-current hc-*:[svg:not([class*='size-'])]:size-4 hc-group/alert hc-relative hc-w-full",
variants: {
variant: {
default: "hc-bg-card hc-text-card-foreground",
destructive: "hc-text-destructive hc-bg-card hc-*:data-[slot=alert-description]:text-destructive/90 hc-*:[svg]:text-current",
},
},
defaultVariants: {
variant: "default",
},
});

const Alert = forwardRef(function Alert({ className, variant = "default", children, ...props }, ref) {
return (
<div ref={ref} data-hc-ui="" data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
{children}
</div>
);
});
export default Alert;
