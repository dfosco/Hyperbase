import { forwardRef } from "react";
import { cn } from "../../../utils/index.js";

const DropdownMenuLabel = forwardRef(function DropdownMenuLabel({ className, inset, children, ...props }, ref) {
return (
<div
ref={ref}
data-hc-ui="" data-slot="dropdown-menu-label"
data-inset={inset}
className={cn("hc-text-muted-foreground hc-px-1.5 hc-py-1 hc-text-xs hc-font-medium hc-data-inset:pl-7 hc-data-[inset]:pl-8", className)}
{...props}
>
{children}
</div>
);
});
export default DropdownMenuLabel;
