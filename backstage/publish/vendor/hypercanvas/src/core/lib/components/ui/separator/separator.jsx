import { forwardRef } from "react";
import { Separator as BUISeparator } from "@base-ui/react/separator";
import { cn } from "../../../utils/index.js";

const Separator = forwardRef(function Separator({ className, orientation = "horizontal", "data-slot": dataSlot = "separator", ...rest }, ref) {
// `decorative` is a legacy Radix prop; base-ui infers role from orientation, so we drop it silently.
const { decorative: _decorative, ...props } = rest;
void _decorative;
return (
<BUISeparator
ref={ref}
data-hc-ui="" data-slot={dataSlot}
orientation={orientation}
className={cn(
"hc-bg-border hc-shrink-0 hc-data-[orientation=horizontal]:h-px hc-data-[orientation=horizontal]:w-full hc-data-[orientation=vertical]:w-px",
"hc-data-[orientation=vertical]:h-full",
className
)}
{...props}
/>
);
});

export default Separator;
