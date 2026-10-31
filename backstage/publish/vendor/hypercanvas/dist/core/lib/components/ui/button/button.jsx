import { forwardRef } from "react";
import { cn } from "../../../utils/index.js";
import { tv } from "tailwind-variants";

export const buttonVariants = tv({
base: "hc-focus-visible:ring-ring/50 hc-aria-invalid:ring-destructive/20 hc-dark:aria-invalid:ring-destructive/40 hc-rounded-lg hc-font-medium hc-focus-visible:ring-3 hc-aria-invalid:ring-3 hc-[&_svg:not([class*='size-'])]:size-4 hc-group/button hc-inline-flex hc-size-full hc-shrink-0 hc-items-center hc-justify-center hc-whitespace-nowrap hc-transition-colors hc-outline-none hc-select-none hc-disabled:pointer-events-none hc-disabled:opacity-50 hc-[&_svg]:pointer-events-none hc-[&_svg]:shrink-0",
variants: {
variant: {
default: "hc-bg-primary hc-text-primary-foreground hc-[a]:hover:bg-primary/80",
outline: "hc-bg-background hc-hover:bg-muted hc-hover:text-foreground hc-dark:bg-input/30 hc-dark:hover:bg-input/50 hc-aria-expanded:bg-muted hc-aria-expanded:text-foreground",
trigger: "hc-focus-visible:ring-0",
secondary: "hc-bg-secondary hc-text-secondary-foreground hc-hover:bg-secondary/80 hc-aria-expanded:bg-secondary hc-aria-expanded:text-secondary-foreground",
ghost: "hc-hover:bg-muted hc-hover:text-foreground hc-dark:hover:bg-muted/50 hc-aria-expanded:bg-muted hc-aria-expanded:text-foreground",
destructive: "hc-bg-destructive/10 hc-hover:bg-destructive/20 hc-focus-visible:ring-destructive/20 hc-dark:focus-visible:ring-destructive/40 hc-dark:bg-destructive/20 hc-text-destructive hc-dark:hover:bg-destructive/30",
link: "hc-text-primary hc-underline-offset-4 hc-hover:underline",
},
size: {
default: "hc-text-sm hc-gap-1.5 hc-px-2.5 hc-has-data-[icon=inline-end]:pr-2 hc-has-data-[icon=inline-start]:pl-2",
xs: "hc-text-xs hc-gap-1 hc-rounded-[min(var(--sb--radius-md),10px)] hc-px-2 hc-in-data-[slot=button-group]:rounded-lg hc-has-data-[icon=inline-end]:pr-1.5 hc-has-data-[icon=inline-start]:pl-1.5 hc-[&_svg:not([class*='size-'])]:size-3",
sm: "hc-text-[0.8rem] hc-gap-1 hc-rounded-[min(var(--sb--radius-md),12px)] hc-px-2.5 hc-in-data-[slot=button-group]:rounded-lg hc-has-data-[icon=inline-end]:pr-1.5 hc-has-data-[icon=inline-start]:pl-1.5 hc-[&_svg:not([class*='size-'])]:size-3.5",
lg: "hc-text-sm hc-gap-1.5 hc-px-2.5 hc-has-data-[icon=inline-end]:pr-3 hc-has-data-[icon=inline-start]:pl-3",
xl: "hc-text-base hc-gap-2 hc-px-4 hc-has-data-[icon=inline-end]:pr-3 hc-has-data-[icon=inline-start]:pl-3 hc-[&_svg:not([class*='size-'])]:size-5",
"2xl": "hc-text-lg hc-gap-2.5 hc-px-5 hc-has-data-[icon=inline-end]:pr-4 hc-has-data-[icon=inline-start]:pl-4 hc-[&_svg:not([class*='size-'])]:size-6",
icon: "hc-text-sm",
"icon-xs": "hc-text-xs hc-rounded-[min(var(--sb--radius-md),10px)] hc-in-data-[slot=button-group]:rounded-lg hc-[&_svg:not([class*='size-'])]:size-3",
"icon-sm": "hc-text-[0.8rem] hc-rounded-[min(var(--sb--radius-md),12px)] hc-in-data-[slot=button-group]:rounded-lg",
"icon-lg": "hc-text-sm",
"icon-xl": "hc-text-base hc-[&_svg:not([class*='size-'])]:size-5",
"icon-2xl": "hc-text-lg hc-[&_svg:not([class*='size-'])]:size-6",
},
},
defaultVariants: {
variant: "default",
size: "default",
},
});

export const wrapperVariants = tv({
base: "hc-inline-flex hc-shrink-0 hc-transition-transform",
variants: {
size: {
default: "hc-h-8",
xs: "hc-h-6 hc-rounded-[min(var(--sb--radius-md),10px)] hc-in-data-[slot=button-group]:rounded-lg",
sm: "hc-h-7 hc-rounded-[min(var(--sb--radius-md),12px)] hc-in-data-[slot=button-group]:rounded-lg",
lg: "hc-h-9",
xl: "hc-h-11",
"2xl": "hc-h-14",
icon: "hc-size-8",
"icon-xs": "hc-size-6 hc-rounded-[min(var(--sb--radius-md),10px)] hc-in-data-[slot=button-group]:rounded-lg",
"icon-sm": "hc-size-7 hc-rounded-[min(var(--sb--radius-md),12px)] hc-in-data-[slot=button-group]:rounded-lg",
"icon-lg": "hc-size-9",
"icon-xl": "hc-size-11",
"icon-2xl": "hc-size-14",
},
},
defaultVariants: {
size: "default",
},
});

const Button = forwardRef(function Button(
{ className, wrapperClass = "", variant = "default", size = "default", href, type = "button", disabled, children, ...props },
ref
) {
return (
<span
data-hc-ui="" data-slot="button-wrapper"
className={cn(wrapperVariants({ size }), wrapperClass)}
style={{ background: "var(--sb--sc-border-color, transparent)", padding: "var(--sb--sc-border-width, 0px)" }}
>
{href ? (
<a
ref={ref}
className={cn(buttonVariants({ variant, size }), className)}
href={disabled ? undefined : href}
aria-disabled={disabled}
role={disabled ? "link" : undefined}
tabIndex={disabled ? -1 : undefined}
data-hc-ui="" data-slot="button"
{...props}
>
{children}
</a>
) : (
<button
ref={ref}
className={cn(buttonVariants({ variant, size }), className)}
type={type}
disabled={disabled}
data-hc-ui="" data-slot="button"
{...props}
>
{children}
</button>
)}
</span>
);
});

export default Button;
