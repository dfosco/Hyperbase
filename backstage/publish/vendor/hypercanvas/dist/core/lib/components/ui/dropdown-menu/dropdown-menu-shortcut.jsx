import { forwardRef } from "react";
import { cn } from "../../../utils/index.js";

const DropdownMenuShortcut = forwardRef(function DropdownMenuShortcut({ className, children, ...props }, ref) {
return (
<span
ref={ref}
data-hc-ui="" data-slot="dropdown-menu-shortcut"
className={cn("hc-text-muted-foreground hc-group-focus/dropdown-menu-item:text-accent-foreground hc-ml-auto hc-text-xs hc-tracking-widest", className)}
{...props}
>
{children}
</span>
);
});
export default DropdownMenuShortcut;
