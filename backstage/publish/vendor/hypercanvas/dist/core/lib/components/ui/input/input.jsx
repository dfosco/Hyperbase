import { forwardRef } from "react";
import { cn } from "../../../utils/index.js";

const Input = forwardRef(function Input({ className, type, "data-slot": dataSlot = "input", ...props }, ref) {
return (
<input
ref={ref}
data-hc-ui="" data-slot={dataSlot}
type={type}
className={cn(
"hc-dark:bg-input/30 hc-border-input hc-focus-visible:border-ring hc-focus-visible:ring-ring/50 hc-aria-invalid:ring-destructive/20 hc-dark:aria-invalid:ring-destructive/40 hc-aria-invalid:border-destructive hc-dark:aria-invalid:border-destructive/50 hc-disabled:bg-input/50 hc-dark:disabled:bg-input/80 hc-h-8 hc-rounded-lg hc-border hc-bg-transparent hc-px-2.5 hc-py-1 hc-text-base hc-transition-colors hc-file:h-6 hc-file:text-sm hc-file:font-medium hc-focus-visible:ring-3 hc-aria-invalid:ring-3 hc-md:text-sm hc-file:text-foreground hc-placeholder:text-muted-foreground hc-w-full hc-min-w-0 hc-outline-none hc-file:inline-flex hc-file:border-0 hc-file:bg-transparent hc-disabled:pointer-events-none hc-disabled:cursor-not-allowed hc-disabled:opacity-50",
className
)}
{...props}
/>
);
});

export default Input;
