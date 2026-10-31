import { forwardRef } from "react";
import { Dialog as BUIDialog } from "@base-ui/react/dialog";
import { cn } from "../../../utils/index.js";

const PanelContent = forwardRef(function PanelContent({ className, children, ...props }, ref) {
return (
<BUIDialog.Portal>
<BUIDialog.Popup
ref={ref}
data-hc-ui="" data-slot="panel-content"
className={cn(
"hc-font-sans hc-fixed hc-z-[10000] hc-bottom-28 hc-right-6 hc-w-[400px] hc-max-h-[90vh] hc-flex hc-flex-col",
"hc-bg-popover hc-text-popover-foreground hc-border-3 hc-border-slate-400",
"hc-rounded-xl hc-shadow-xl hc-overflow-x-hidden hc-overflow-y-auto",
"hc-data-[open]:animate-in hc-data-[open]:fade-in-0 hc-data-[open]:slide-in-from-bottom-4",
"hc-data-[closed]:animate-out hc-data-[closed]:fade-out-0 hc-data-[closed]:slide-out-to-bottom-4",
"hc-duration-150",
className
)}
{...props}
>
{children}
</BUIDialog.Popup>
</BUIDialog.Portal>
);
});
export default PanelContent;
