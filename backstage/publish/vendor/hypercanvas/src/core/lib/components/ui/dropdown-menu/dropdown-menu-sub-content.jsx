import { forwardRef } from "react";
import { Menu as BUIMenu } from "@base-ui/react/menu";
import { cn } from "../../../utils/index.js";

const DropdownMenuSubContent = forwardRef(function DropdownMenuSubContent({ className, sideOffset = 0, align = "start", ...props }, ref) {
return (
<BUIMenu.Portal>
<BUIMenu.Positioner sideOffset={sideOffset} align={align}>
<BUIMenu.Popup
ref={ref}
data-hc-ui="" data-slot="dropdown-menu-sub-content"
className={cn("hc-font-sans hc-data-[open]:animate-in hc-data-[closed]:animate-out hc-data-[closed]:fade-out-0 hc-data-[open]:fade-in-0 hc-data-[closed]:zoom-out-95 hc-data-[open]:zoom-in-95 hc-data-[side=bottom]:slide-in-from-top-2 hc-data-[side=left]:slide-in-from-right-2 hc-data-[side=right]:slide-in-from-left-2 hc-data-[side=top]:slide-in-from-bottom-2 hc-z-[10000] hc-bg-popover hc-border-3 hc-border-border hc-text-popover-foreground hc-fill-popover-foreground hc-min-w-[96px] hc-rounded-xl hc-p-2 hc-shadow-xl hc-duration-100 hc-w-auto", className)}
{...props}
/>
</BUIMenu.Positioner>
</BUIMenu.Portal>
);
});
export default DropdownMenuSubContent;
