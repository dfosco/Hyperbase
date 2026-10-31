import { createContext, useCallback, useId, useMemo, useState } from "react";

export const TooltipContext = createContext(null);

/**
 * Tooltip root — plain React state, no portal, no positioning library.
 * The content is a native `popover` element rendered inline next to the
 * trigger and positioned with CSS anchor positioning (see tooltip-content.css).
 */
export default function Tooltip({ children }) {
const [open, setOpen] = useState(false);
const anchorName = `--hc-tt-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
const show = useCallback(() => setOpen(true), []);
const hide = useCallback(() => setOpen(false), []);
const value = useMemo(() => ({ open, show, hide, anchorName }), [open, show, hide, anchorName]);
return <TooltipContext.Provider value={value}>{children}</TooltipContext.Provider>;
}
