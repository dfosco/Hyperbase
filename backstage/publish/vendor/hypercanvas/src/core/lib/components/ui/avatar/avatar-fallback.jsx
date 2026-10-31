import { forwardRef } from "react";
import { Avatar as BUIAvatar } from "@base-ui/react/avatar";
import { cn } from "../../../utils/index.js";

const AvatarFallback = forwardRef(function AvatarFallback({ className, ...props }, ref) {
return (
<BUIAvatar.Fallback
ref={ref}
data-hc-ui="" data-slot="avatar-fallback"
className={cn(
"hc-bg-muted hc-text-muted-foreground hc-rounded-full hc-flex hc-size-full hc-items-center hc-justify-center hc-text-sm hc-group-data-[size=sm]/avatar:text-xs",
className
)}
{...props}
/>
);
});
export default AvatarFallback;
