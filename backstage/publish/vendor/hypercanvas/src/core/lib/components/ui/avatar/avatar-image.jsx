import { forwardRef } from "react";
import { Avatar as BUIAvatar } from "@base-ui/react/avatar";
import { cn } from "../../../utils/index.js";

const AvatarImage = forwardRef(function AvatarImage({ className, ...props }, ref) {
return (
<BUIAvatar.Image
ref={ref}
data-hc-ui="" data-slot="avatar-image"
className={cn("hc-rounded-full hc-aspect-square hc-size-full hc-object-cover", className)}
{...props}
/>
);
});
export default AvatarImage;
