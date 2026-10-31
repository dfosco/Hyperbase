import { forwardRef } from "react";
import { cn } from "../../../utils/index.js";

const AvatarGroup = forwardRef(function AvatarGroup({ className, children, ...props }, ref) {
return (
<div
ref={ref}
data-hc-ui="" data-slot="avatar-group"
className={cn(
"cn-avatar-group hc-*:data-[slot=avatar]:ring-background hc-group/avatar-group hc-flex hc--space-x-2 hc-*:data-[slot=avatar]:ring-2",
className
)}
{...props}
>
{children}
</div>
);
});
export default AvatarGroup;
