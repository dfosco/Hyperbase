import { forwardRef } from "react";
import { cn } from "../../../utils/index.js";

const PanelFooter = forwardRef(function PanelFooter({ className, children, ...props }, ref) {
return (
<div ref={ref} data-hc-ui="" data-slot="panel-footer" className={cn("hc-flex hc-items-center hc-justify-end hc-gap-2 hc-px-4 hc-pt-2 hc-pb-4", className)} {...props}>
{children}
</div>
);
});
export default PanelFooter;
