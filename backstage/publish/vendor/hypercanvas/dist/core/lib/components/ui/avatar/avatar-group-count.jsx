import { forwardRef } from "react";
import { cn } from "../../../utils/index.js";

const AvatarGroupCount = forwardRef(function AvatarGroupCount({ className, children, ...props }, ref) {
return (
<div
ref={ref}
data-hc-ui="" data-slot="avatar-group-count"
className={cn(
"hc-bg-muted hc-text-muted-foreground hc-size-8 hc-rounded-full hc-text-sm hc-group-has-data-[size=lg]/avatar-group:size-10 hc-group-has-data-[size=sm]/avatar-group:size-6 hc-[&>svg]:size-4 hc-group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 hc-group-has-data-[size=sm]/avatar-group:[&>svg]:size-3 hc-ring-background hc-relative hc-flex hc-shrink-0 hc-items-center hc-justify-center hc-ring-2",
className
)}
{...props}
>
{children}
</div>
);
});
export default AvatarGroupCount;
