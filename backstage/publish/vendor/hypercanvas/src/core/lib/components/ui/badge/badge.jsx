import { forwardRef } from "react";
import { cn } from "../../../utils/index.js";
import { tv } from "tailwind-variants";

export const badgeVariants = tv({
base: "hc-h-5 hc-gap-1 hc-rounded-4xl hc-border hc-border-transparent hc-px-2 hc-py-0.5 hc-text-xs hc-font-medium hc-transition-all hc-has-data-[icon=inline-end]:pr-1.5 hc-has-data-[icon=inline-start]:pl-1.5 hc-[&>svg]:size-3! hc-focus-visible:border-ring hc-focus-visible:ring-ring/50 hc-aria-invalid:ring-destructive/20 hc-dark:aria-invalid:ring-destructive/40 hc-aria-invalid:border-destructive hc-group/badge hc-inline-flex hc-w-fit hc-shrink-0 hc-items-center hc-justify-center hc-overflow-hidden hc-whitespace-nowrap hc-transition-colors hc-focus-visible:ring-[3px] hc-[&>svg]:pointer-events-none",
variants: {
variant: {
default: "hc-bg-primary hc-text-primary-foreground hc-[a]:hover:bg-primary/80",
secondary: "hc-bg-secondary hc-text-secondary-foreground hc-[a]:hover:bg-secondary/80",
destructive: "hc-bg-destructive/10 hc-[a]:hover:bg-destructive/20 hc-focus-visible:ring-destructive/20 hc-dark:focus-visible:ring-destructive/40 hc-text-destructive hc-dark:bg-destructive/20",
outline: "hc-border-border hc-text-foreground hc-[a]:hover:bg-muted hc-[a]:hover:text-muted-foreground",
ghost: "hc-hover:bg-muted hc-hover:text-muted-foreground hc-dark:hover:bg-muted/50",
link: "hc-text-primary hc-underline-offset-4 hc-hover:underline",
},
},
defaultVariants: {
variant: "default",
},
});

const Badge = forwardRef(function Badge({ href, className, variant = "default", children, ...props }, ref) {
const Component = href ? "a" : "span";
return (
<Component ref={ref} data-hc-ui="" data-slot="badge" href={href} className={cn(badgeVariants({ variant }), className)} {...props}>
{children}
</Component>
);
});

export default Badge;
