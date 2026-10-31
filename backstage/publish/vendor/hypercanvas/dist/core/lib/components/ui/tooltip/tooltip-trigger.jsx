import { useContext } from "react";
import { TooltipContext } from "./tooltip.jsx";

function isKeyboardFocus(event) {
try {
return event.target.matches(":focus-visible");
} catch {
return true;
}
}

/**
 * Wraps the trigger in an inline-flex span that owns the CSS `anchor-name`.
 * Anchoring to our own wrapper (instead of cloning props onto the child)
 * works for any child — including components like TriggerButton that forward
 * `style`/handlers to an inner element, or apply hover transforms — and keeps
 * the anchor box stable and un-rotated. `asChild` is accepted for API parity.
 */
const TooltipTrigger = function TooltipTrigger({ asChild: _asChild, children }) {
const ctx = useContext(TooltipContext);
if (!ctx) return children;
const { show, hide, anchorName } = ctx;
return (
<span
style={{ display: "inline-flex", anchorName }}
onPointerEnter={(e) => { if (e.pointerType !== "touch") show(); }}
onPointerLeave={hide}
onPointerDown={hide}
onFocus={(e) => { if (isKeyboardFocus(e)) show(); }}
onBlur={hide}
onKeyDown={(e) => { if (e.key === "Escape") hide(); }}
>
{children}
</span>
);
};
export default TooltipTrigger;
