import { forwardRef } from "react";
import { Menu as BUIMenu } from "@base-ui/react/menu";
import { cn } from "../../../utils/index.js";

/**
 * `onSelect` (radix-style) is accepted as an alias for `onClick`. To keep the
 * menu open after activating an item (was `e.preventDefault()` in radix),
 * pass `closeOnSelect={false}`.
 */
const DropdownMenuItem = forwardRef(function DropdownMenuItem({ className, inset, variant = "default", onSelect, onClick, closeOnSelect = true, ...props }, ref) {
const handleClick = (e) => {
if (onSelect) onSelect(e);
if (onClick) onClick(e);
};
return (
<BUIMenu.Item
ref={ref}
data-hc-ui="" data-slot="dropdown-menu-item"
data-inset={inset}
data-variant={variant}
closeOnClick={closeOnSelect}
onClick={handleClick}
className={cn(
"hc-focus:bg-accent hc-focus:text-accent-foreground hc-data-[highlighted]:bg-accent hc-data-[highlighted]:text-accent-foreground hc-data-[variant=destructive]:text-destructive hc-data-[variant=destructive]:focus:bg-destructive/10 hc-data-[variant=destructive]:data-[highlighted]:bg-destructive/10 hc-dark:data-[variant=destructive]:focus:bg-destructive/20 hc-data-[variant=destructive]:focus:text-destructive hc-data-[variant=destructive]:*:[svg]:text-destructive hc-not-data-[variant=destructive]:focus:**:text-accent-foreground hc-gap-2 hc-rounded-[4px] hc-px-2.5 hc-py-2 hc-text-sm hc-data-inset:pl-7 hc-[&_svg:not([class*='size-'])]:size-4 hc-group/dropdown-menu-item hc-relative hc-flex hc-cursor-default hc-items-center hc-outline-hidden hc-select-none hc-data-[disabled]:pointer-events-none hc-data-[disabled]:opacity-50 hc-data-[inset]:pl-8 hc-[&_svg]:pointer-events-none hc-[&_svg]:shrink-0",
className
)}
{...props}
/>
);
});
export default DropdownMenuItem;
