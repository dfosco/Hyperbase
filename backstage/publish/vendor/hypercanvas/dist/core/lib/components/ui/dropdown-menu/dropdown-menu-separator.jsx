import { forwardRef } from "react";
import { Separator as BUISeparator } from "@base-ui/react/separator";
import { cn } from "../../../utils/index.js";

const DropdownMenuSeparator = forwardRef(function DropdownMenuSeparator({ className, ...props }, ref) {
return (
<BUISeparator
ref={ref}
data-hc-ui="" data-slot="dropdown-menu-separator"
className={cn("hc-bg-border hc--mx-1.5 hc-my-1 hc-h-px", className)}
{...props}
/>
);
});
export default DropdownMenuSeparator;
