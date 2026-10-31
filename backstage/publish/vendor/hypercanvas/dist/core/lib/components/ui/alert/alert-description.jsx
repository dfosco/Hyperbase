import { forwardRef } from "react";
import { cn } from "../../../utils/index.js";

const AlertDescription = forwardRef(function AlertDescription({ className, children, ...props }, ref) {
return (
<div ref={ref} data-hc-ui="" data-slot="alert-description" className={cn("hc-text-muted-foreground hc-text-sm hc-text-balance hc-md:text-pretty hc-[&_p:not(:last-child)]:mb-4 hc-[&_a]:hover:text-foreground hc-[&_a]:underline hc-[&_a]:underline-offset-3", className)} {...props}>
{children}
</div>
);
});
export default AlertDescription;
