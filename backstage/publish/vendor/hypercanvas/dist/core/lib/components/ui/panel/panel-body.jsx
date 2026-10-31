import { forwardRef } from "react";
import { cn } from "../../../utils/index.js";

const PanelBody = forwardRef(function PanelBody({ className, children, ...props }, ref) {
return (
<div ref={ref} data-hc-ui="" data-slot="panel-body" className={cn("hc-flex-1 hc-overflow-auto hc-px-4 hc-py-2", className)} {...props}>
{children}
</div>
);
});
export default PanelBody;
