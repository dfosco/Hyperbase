import { forwardRef } from "react";
import { cn } from "../../../utils/index.js";

const AvatarBadge = forwardRef(function AvatarBadge({ className, children, ...props }, ref) {
return (
<span
ref={ref}
data-hc-ui="" data-slot="avatar-badge"
className={cn(
"hc-bg-primary hc-text-primary-foreground hc-ring-background hc-absolute hc-right-0 hc-bottom-0 hc-z-10 hc-inline-flex hc-items-center hc-justify-center hc-rounded-full hc-bg-blend-color hc-ring-2 hc-select-none",
"hc-group-data-[size=sm]/avatar:size-2 hc-group-data-[size=sm]/avatar:[&>svg]:hidden",
"hc-group-data-[size=default]/avatar:size-2.5 hc-group-data-[size=default]/avatar:[&>svg]:size-2",
"hc-group-data-[size=lg]/avatar:size-3 hc-group-data-[size=lg]/avatar:[&>svg]:size-2",
className
)}
{...props}
>
{children}
</span>
);
});
export default AvatarBadge;
