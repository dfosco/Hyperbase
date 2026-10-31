import { forwardRef } from "react";
import { Menu as BUIMenu } from "@base-ui/react/menu";
import ChevronRight from '../../../../../internals/lucide/icons/chevron-right.js'
import { cn } from "../../../utils/index.js";

const DropdownMenuSubTrigger = forwardRef(function DropdownMenuSubTrigger({ className, inset, children, ...props }, ref) {
return (
<BUIMenu.SubmenuTrigger
ref={ref}
data-hc-ui="" data-slot="dropdown-menu-sub-trigger"
data-inset={inset}
className={cn(
"hc-focus:bg-accent hc-focus:text-accent-foreground hc-data-[highlighted]:bg-accent hc-data-[highlighted]:text-accent-foreground hc-data-[popup-open]:bg-accent hc-data-[popup-open]:text-accent-foreground hc-not-data-[variant=destructive]:focus:**:text-accent-foreground hc-gap-1.5 hc-rounded-md hc-px-2.5 hc-py-2 hc-text-sm hc-data-inset:pl-7 hc-[&_svg:not([class*='size-'])]:size-4 hc-flex hc-cursor-default hc-items-center hc-outline-hidden hc-select-none hc-data-[inset]:pl-8 hc-[&_svg]:pointer-events-none hc-[&_svg]:shrink-0",
className
)}
{...props}
>
{children}
<ChevronRight className="hc-ml-auto" />
</BUIMenu.SubmenuTrigger>
);
});
export default DropdownMenuSubTrigger;
