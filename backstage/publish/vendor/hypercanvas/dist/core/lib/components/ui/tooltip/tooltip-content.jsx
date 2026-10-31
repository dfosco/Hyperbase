import { useContext, useLayoutEffect, useRef } from "react";
import { TooltipContext } from "./tooltip.jsx";
import "./tooltip-content.css";

/**
 * Native popover tooltip. Rendered inline (no portal); the browser promotes it
 * to the top layer, so it escapes overflow/stacking without any JS positioning.
 */
export default function TooltipContent({ children, side = "top", align = "center", className, style, ...props }) {
const ctx = useContext(TooltipContext);
const ref = useRef(null);
const open = ctx?.open;

useLayoutEffect(() => {
const el = ref.current;
if (!open || !el) return;
try { el.showPopover?.(); } catch { /* already shown / unsupported */ }
return () => { try { el.hidePopover?.(); } catch { /* already hidden */ } };
}, [open]);

if (!open) return null;
return (
<div
ref={ref}
popover="manual"
role="tooltip"
data-hc-ui=""
data-slot="tooltip-content"
data-side={side}
data-align={align}
className={className}
style={{ ...style, positionAnchor: ctx.anchorName }}
{...props}
>
{children}
</div>
);
}
