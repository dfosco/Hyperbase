import { forwardRef } from "react";
import { cn } from "../../../utils/index.js";

const Textarea = forwardRef(function Textarea({ className, "data-slot": dataSlot = "textarea", ...props }, ref) {
return (
<textarea
ref={ref}
data-hc-ui="" data-slot={dataSlot}
className={cn(
"hc-border-input hc-dark:bg-input/30 hc-focus-visible:border-ring hc-focus-visible:ring-ring/50 hc-aria-invalid:ring-destructive/20 hc-dark:aria-invalid:ring-destructive/40 hc-aria-invalid:border-destructive hc-dark:aria-invalid:border-destructive/50 hc-disabled:bg-input/50 hc-dark:disabled:bg-input/80 hc-rounded-lg hc-border hc-bg-transparent hc-px-2.5 hc-py-2 hc-text-base hc-transition-colors hc-focus-visible:ring-3 hc-aria-invalid:ring-3 hc-md:text-sm hc-placeholder:text-muted-foreground hc-flex hc-field-sizing-content hc-min-h-16 hc-w-full hc-outline-none hc-disabled:cursor-not-allowed hc-disabled:opacity-50",
className
)}
{...props}
/>
);
});

export default Textarea;
