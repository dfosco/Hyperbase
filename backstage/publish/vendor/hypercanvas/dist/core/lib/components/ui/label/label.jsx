import { forwardRef } from "react";
import { cn } from "../../../utils/index.js";

const Label = forwardRef(function Label({ className, ...props }, ref) {
return (
<label
ref={ref}
data-hc-ui="" data-slot="label"
className={cn(
"hc-gap-2 hc-text-sm hc-leading-none hc-font-medium hc-group-data-[disabled=true]:opacity-50 hc-peer-disabled:opacity-50 hc-flex hc-items-center hc-select-none hc-group-data-[disabled=true]:pointer-events-none hc-peer-disabled:cursor-not-allowed",
className
)}
{...props}
/>
);
});

export default Label;
