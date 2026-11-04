import { jsx } from "react/jsx-runtime";
import { useRef, useEffect, useCallback } from "react";
import { a as acquireIframePointerLock } from "./iframePointerLock-CuQbsxGb.js";
const handle = "_handle_rjpec_1";
const styles = {
  handle
};
const CURSOR_ATTRIBUTE = "data-sb-resize-cursor";
function lockResizeCursor(cursor, doc = globalThis.document) {
  const root = doc?.documentElement;
  if (!root) return () => {
  };
  const previous = root.getAttribute(CURSOR_ATTRIBUTE);
  root.setAttribute(CURSOR_ATTRIBUTE, cursor);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (previous == null) root.removeAttribute(CURSOR_ATTRIBUTE);
    else root.setAttribute(CURSOR_ATTRIBUTE, previous);
  };
}
function ResizeHandle({ targetRef, minWidth = 180, minHeight = 60, axis = "both", onResize, onResizeStart, onResizeEnd }) {
  const activeCleanupRef = useRef(null);
  const cursor = axis === "vertical" ? "ns-resize" : axis === "horizontal" ? "ew-resize" : "nwse-resize";
  useEffect(() => () => {
    activeCleanupRef.current?.(false);
  }, []);
  const handleMouseDown = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    if (activeCleanupRef.current) return;
    const el = targetRef?.current;
    if (!el) return;
    const doc = el.ownerDocument || globalThis.document;
    if (!doc) return;
    const win = doc.defaultView;
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = el.offsetWidth;
    const startH = el.offsetHeight;
    let lastW = startW;
    let lastH = startH;
    const releaseIframePointerLock = acquireIframePointerLock(doc);
    const releaseCursor = lockResizeCursor(cursor, doc);
    let finished = false;
    function finish(commit = true) {
      if (finished) return;
      finished = true;
      doc.removeEventListener("mousemove", onMove);
      doc.removeEventListener("mouseup", onMouseUp);
      doc.removeEventListener("pointercancel", onCancel, true);
      win?.removeEventListener("blur", onCancel);
      activeCleanupRef.current = null;
      releaseCursor();
      releaseIframePointerLock();
      if (commit) onResizeEnd?.(lastW, lastH);
    }
    function onMouseUp() {
      finish(true);
    }
    function onCancel() {
      finish(true);
    }
    const rect = el.getBoundingClientRect();
    const scale = startW > 0 && rect.width > 0 ? rect.width / startW : 1;
    function onMove(ev) {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      lastW = axis === "vertical" ? startW : Math.max(minWidth, startW + dx);
      lastH = axis === "horizontal" ? startH : Math.max(minHeight, startH + dy);
      onResize?.(lastW, lastH);
    }
    activeCleanupRef.current = finish;
    doc.addEventListener("mousemove", onMove);
    doc.addEventListener("mouseup", onMouseUp);
    doc.addEventListener("pointercancel", onCancel, true);
    win?.addEventListener("blur", onCancel);
    try {
      onResizeStart?.();
    } catch (error) {
      finish(false);
      throw error;
    }
  }, [targetRef, minWidth, minHeight, axis, cursor, onResize, onResizeStart, onResizeEnd]);
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: styles.handle,
      style: { cursor },
      onMouseDown: handleMouseDown,
      onPointerDown: (e) => e.stopPropagation(),
      role: "separator",
      "aria-orientation": axis === "vertical" ? "vertical" : "horizontal",
      "aria-label": "Resize"
    }
  );
}
export {
  ResizeHandle as R
};
