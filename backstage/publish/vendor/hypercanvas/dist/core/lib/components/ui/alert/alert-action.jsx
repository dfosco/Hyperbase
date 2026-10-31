import { forwardRef } from "react";
import { cn } from "../../../utils/index.js";

const AlertAction = forwardRef(function AlertAction({ className, children, ...props }, ref) {
return (
<div ref={ref} data-hc-ui="" data-slot="alert-action" className={cn("hc-absolute hc-top-2 hc-right-2", className)} {...props}>
{children}
</div>
);
});
export default AlertAction;
