import { forwardRef } from "react";
import { cn } from "../../../utils/index.js";

const PanelHeader = forwardRef(function PanelHeader({ className, children, ...props }, ref) {
return (
<div ref={ref} data-hc-ui="" data-slot="panel-header" className={cn("hc-flex hc-items-center hc-justify-between hc-gap-2 hc-px-4 hc-pt-4 hc-pb-2", className)} {...props}>
{children}
</div>
);
});
export default PanelHeader;
