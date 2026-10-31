import { forwardRef } from "react";
import { Menu as BUIMenu } from "@base-ui/react/menu";
import { cn } from "../../../utils/index.js";

const DropdownMenuGroupHeading = forwardRef(function DropdownMenuGroupHeading({ className, inset, ...props }, ref) {
return (
<BUIMenu.GroupLabel
ref={ref}
data-hc-ui="" data-slot="dropdown-menu-group-heading"
data-inset={inset}
className={cn("hc-px-2 hc-py-1.5 hc-text-sm hc-font-semibold hc-data-[inset]:ps-8", className)}
{...props}
/>
);
});
export default DropdownMenuGroupHeading;
