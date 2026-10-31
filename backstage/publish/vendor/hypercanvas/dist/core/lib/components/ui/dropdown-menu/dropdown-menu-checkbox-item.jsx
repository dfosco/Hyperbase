import { forwardRef } from "react";
import { Menu as BUIMenu } from "@base-ui/react/menu";
import Check from '../../../../../internals/lucide/icons/check.js'
import Minus from '../../../../../internals/lucide/icons/minus.js'
import { cn } from "../../../utils/index.js";

const DropdownMenuCheckboxItem = forwardRef(function DropdownMenuCheckboxItem({ className, children, checked, onCheckedChange, onSelect, onClick, closeOnSelect = true, ...props }, ref) {
const isIndeterminate = checked === "indeterminate";
const controlledChecked = isIndeterminate ? false : checked;
const handleClick = (e) => {
if (onSelect) onSelect(e);
if (onClick) onClick(e);
};
return (
<BUIMenu.CheckboxItem
ref={ref}
data-hc-ui="" data-slot="dropdown-menu-checkbox-item"
checked={controlledChecked}
indeterminate={isIndeterminate || undefined}
onCheckedChange={onCheckedChange ? (next) => onCheckedChange(next) : undefined}
onClick={handleClick}
closeOnClick={closeOnSelect}
className={cn(
"hc-focus:bg-accent hc-focus:text-accent-foreground hc-data-[highlighted]:bg-accent hc-data-[highlighted]:text-accent-foreground hc-focus:**:text-accent-foreground hc-gap-2 hc-rounded-[4px] hc-py-2 hc-pr-8 hc-pl-2.5 hc-text-sm hc-data-inset:pl-7 hc-[&_svg:not([class*='size-'])]:size-4 hc-relative hc-flex hc-cursor-default hc-items-center hc-outline-hidden hc-select-none hc-data-[disabled]:pointer-events-none hc-data-[disabled]:opacity-50 hc-[&_svg]:pointer-events-none hc-[&_svg]:shrink-0",
className
)}
{...props}
>
<span
className="hc-absolute hc-right-2 hc-flex hc-items-center hc-justify-center hc-pointer-events-none"
data-hc-ui="" data-slot="dropdown-menu-checkbox-item-indicator"
>
<BUIMenu.CheckboxItemIndicator>
{isIndeterminate ? <Minus /> : <Check />}
</BUIMenu.CheckboxItemIndicator>
</span>
{children}
</BUIMenu.CheckboxItem>
);
});
export default DropdownMenuCheckboxItem;
