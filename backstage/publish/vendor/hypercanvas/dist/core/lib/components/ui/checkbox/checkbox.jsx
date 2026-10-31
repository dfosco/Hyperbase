import { forwardRef } from "react";
import { Checkbox as BUICheckbox } from "@base-ui/react/checkbox";
import Check from '../../../../../internals/lucide/icons/check.js'
import Minus from '../../../../../internals/lucide/icons/minus.js'
import { cn } from "../../../utils/index.js";

const Checkbox = forwardRef(function Checkbox({ className, checked, onCheckedChange, ...props }, ref) {
const isIndeterminate = checked === "indeterminate";
const controlledChecked = isIndeterminate ? false : checked;
return (
<BUICheckbox.Root
ref={ref}
data-hc-ui="" data-slot="checkbox"
className={cn(
"hc-border-input hc-dark:bg-input/30 hc-data-[checked]:bg-primary hc-data-[checked]:text-primary-foreground hc-dark:data-[checked]:bg-primary hc-data-[checked]:border-primary hc-aria-invalid:aria-checked:border-primary hc-aria-invalid:border-destructive hc-dark:aria-invalid:border-destructive/50 hc-focus-visible:border-ring hc-focus-visible:ring-ring/50 hc-aria-invalid:ring-destructive/20 hc-dark:aria-invalid:ring-destructive/40 hc-flex hc-size-4 hc-items-center hc-justify-center hc-rounded-[4px] hc-border hc-transition-colors hc-group-has-disabled/field:opacity-50 hc-focus-visible:ring-3 hc-aria-invalid:ring-3 hc-peer hc-relative hc-shrink-0 hc-outline-none hc-after:absolute hc-after:-inset-x-3 hc-after:-inset-y-2 hc-disabled:cursor-not-allowed hc-disabled:opacity-50",
className
)}
checked={controlledChecked}
indeterminate={isIndeterminate || undefined}
onCheckedChange={onCheckedChange ? (next) => onCheckedChange(next) : undefined}
{...props}
>
<BUICheckbox.Indicator
data-hc-ui="" data-slot="checkbox-indicator"
className="hc-[&>svg]:size-3.5 hc-grid hc-place-content-center hc-text-current hc-transition-none"
>
{isIndeterminate ? <Minus /> : <Check />}
</BUICheckbox.Indicator>
</BUICheckbox.Root>
);
});

export default Checkbox;
