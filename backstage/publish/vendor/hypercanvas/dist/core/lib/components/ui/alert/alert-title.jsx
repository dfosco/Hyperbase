import { forwardRef } from "react";
import { cn } from "../../../utils/index.js";

const AlertTitle = forwardRef(function AlertTitle({ className, children, ...props }, ref) {
return (
<div ref={ref} data-hc-ui="" data-slot="alert-title" className={cn("hc-font-medium hc-group-has-[>svg]/alert:col-start-2 hc-[&_a]:hover:text-foreground hc-[&_a]:underline hc-[&_a]:underline-offset-3", className)} {...props}>
{children}
</div>
);
});
export default AlertTitle;
