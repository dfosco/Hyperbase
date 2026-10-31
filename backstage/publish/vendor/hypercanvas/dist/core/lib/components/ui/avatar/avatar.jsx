import { forwardRef } from "react";
import { Avatar as BUIAvatar } from "@base-ui/react/avatar";
import { cn } from "../../../utils/index.js";

const Avatar = forwardRef(function Avatar({ className, size = "default", ...props }, ref) {
return (
<BUIAvatar.Root
ref={ref}
data-hc-ui="" data-slot="avatar"
data-size={size}
className={cn(
"hc-size-8 hc-rounded-full hc-after:rounded-full hc-data-[size=lg]:size-10 hc-data-[size=sm]:size-6 hc-after:border-border hc-group/avatar hc-relative hc-flex hc-shrink-0 hc-select-none hc-after:absolute hc-after:inset-0 hc-after:border hc-after:mix-blend-darken hc-dark:after:mix-blend-lighten",
className
)}
{...props}
/>
);
});
export default Avatar;
