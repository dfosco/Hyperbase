import { forwardRef } from "react";
import { Menu as BUIMenu } from "@base-ui/react/menu";
import Check from '../../../../../internals/lucide/icons/check.js'
import { cn } from "../../../utils/index.js";

const DropdownMenuRadioItem = forwardRef(function DropdownMenuRadioItem({ className, children, value, onSelect, onClick, closeOnSelect = true, ...props }, ref) {
const handleClick = (e) => {
if (onSelect) onSelect(e);
if (onClick) onClick(e);
};
return (
<BUIMenu.RadioItem
ref={ref}
data-hc-ui="" data-slot="dropdown-menu-radio-item"
value={value}
onClick={handleClick}
closeOnClick={closeOnSelect}
className={cn(
"hc-focus:bg-accent hc-focus:text-accent-foreground hc-data-[highlighted]:bg-accent hc-data-[highlighted]:text-accent-foreground hc-focus:**:text-accent-foreground hc-gap-1.5 hc-rounded-md hc-py-1 hc-pr-8 hc-pl-1.5 hc-text-sm hc-data-inset:pl-7 hc-[&_svg:not([class*='size-'])]:size-4 hc-relative hc-flex hc-cursor-default hc-items-center hc-outline-hidden hc-select-none hc-data-[disabled]:pointer-events-none hc-data-[disabled]:opacity-50 hc-[&_svg]:pointer-events-none hc-[&_svg]:shrink-0",
className
)}
{...props}
>
<span
className="hc-absolute hc-right-2 hc-flex hc-items-center hc-justify-center hc-pointer-events-none"
data-hc-ui="" data-slot="dropdown-menu-radio-item-indicator"
>
<BUIMenu.RadioItemIndicator>
<Check />
</BUIMenu.RadioItemIndicator>
</span>
{children}
</BUIMenu.RadioItem>
);
});
export default DropdownMenuRadioItem;
