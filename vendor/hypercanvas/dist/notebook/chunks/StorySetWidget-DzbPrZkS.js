import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { u as useStoryFrame, g as getStoryPathByName, s as styles } from "./StoryWidget.module-XxDW57Xe.js";
import { forwardRef, useRef, useState, useCallback, useEffect, useMemo, useImperativeHandle } from "react";
import { getStoryData } from "../core-0.js";
import { u as useThemeState, a as useThemeSyncTargets } from "./useThemeState-6KPJA_hY.js";
import { getConfig } from "../core-2.js";
import { b as resolveStoryFrameTheme } from "./basePathAsset-Bs6UgtNi.js";
import { u as useCanvasFrameTheme } from "./useCanvasFrameTheme-D4Yco8Ax.js";
import { s as storyFrameUrl } from "./storyFrameUrl-CIBAtrso.js";
import { l as Icon, E as ExpandedPane } from "./Document-2gwDP-Y5.js";
import { W as WidgetWrapper } from "./WidgetWrapper-Clt_WBi9.js";
import { R as ResizeHandle } from "./ResizeHandle-Dj9zO6GI.js";
import { u as useExpandOverride } from "./useExpandOverride-BmLmUDhU.js";
import { u as useIframeDevLogs, o as overlayStyles } from "./embedOverlay.module-BVkT7z5d.js";
function GridIcon({ size = 16 }) {
  return /* @__PURE__ */ jsx(Icon, { name: "iconoir/view-grid", size });
}
function resolveStorySetUrl(storyId, layout, selected, density, theme, routeState = {}) {
  return storyFrameUrl(getStoryData(storyId), storyId, { ...routeState, layout, selected, density }, { theme, componentSet: true });
}
const StorySetWidget = forwardRef(function StorySetWidget2({ id: widgetId, canvasId, props, onUpdate, resizable }, ref) {
  const storyId = props?.storyId || "";
  const search = props?.search || "";
  const hash = props?.hash || "";
  const rawLayout = props?.layout || "auto";
  const layout = rawLayout === "horizontal" ? "wide" : rawLayout === "vertical" ? "tall" : rawLayout;
  const density = props?.density || "";
  const selected = props?.selected || "";
  const width = props?.width;
  const height = props?.height;
  const containerRef = useRef(null);
  const iframeRef = useRef(null);
  const contentSizeRef = useRef({ width: 0, height: 0 });
  const [snapping, setSnapping] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const [storyIndexKey, setStoryIndexKey] = useState(0);
  const [expandedMode, setExpandedMode] = useExpandOverride("storyset", widgetId);
  const expanded = expandedMode === "1" || expandedMode === "immersive";
  const immersive = expandedMode === "immersive";
  const setExpanded = useCallback((mode) => {
    if (!mode) setExpandedMode(null);
    else if (mode === "immersive") setExpandedMode("immersive");
    else setExpandedMode("1");
  }, [setExpandedMode]);
  useEffect(() => {
    const handler = () => setStoryIndexKey((k) => k + 1);
    document.addEventListener("storyboard:story-index-changed", handler);
    return () => document.removeEventListener("storyboard:story-index-changed", handler);
  }, []);
  useEffect(() => {
    if (!interactive) return;
    function handlePointerDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        const chromeEl = e.target.closest(`[data-widget-id="${widgetId}"]`);
        if (chromeEl) return;
        setInteractive(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [interactive, widgetId]);
  useEffect(() => {
    function handleMessage(e) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.type === "storyboard:component-set:select") {
        const newSelected = e.data.exportName || "";
        if (newSelected !== selected) {
          onUpdate?.({ selected: newSelected });
        }
      } else if (e.data?.type === "storyboard:component-set:initial-size") {
        if (typeof width === "number" && typeof height === "number") return;
        const headerH = 37;
        const newW = typeof width === "number" ? width : Math.max(200, Math.ceil(e.data.width));
        const newH = typeof height === "number" ? height : Math.max(120, Math.ceil(e.data.height) + headerH + 8);
        onUpdate?.({ width: newW, height: newH });
      } else if (e.data?.type === "storyboard:component-set:content-size") {
        contentSizeRef.current = {
          width: Math.ceil(e.data.width) || 0,
          height: Math.ceil(e.data.height) || 0
        };
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [selected, width, height, onUpdate]);
  const handleResize = useCallback((w, h) => {
    onUpdate?.({ width: w, height: h });
  }, [onUpdate]);
  const handleResizeEnd = useCallback((w, h) => {
    const headerH = 37;
    const contentH = contentSizeRef.current.height;
    const contentW = contentSizeRef.current.width;
    if (!contentH && !contentW) return;
    const fitH = contentH ? contentH + headerH + 8 : h;
    const fitW = contentW || w;
    const shouldSnapH = contentH && h > fitH + 2;
    const shouldSnapW = contentW && w > fitW + 2;
    if (!shouldSnapH && !shouldSnapW) return;
    setSnapping(true);
    onUpdate?.({
      width: shouldSnapW ? fitW : w,
      height: shouldSnapH ? fitH : h
    });
    setTimeout(() => setSnapping(false), 260);
  }, [onUpdate]);
  const { resolved: resolvedTheme } = useThemeState() || {};
  const { prototype: prototypeSync } = useThemeSyncTargets() || {};
  const inheritedTheme = prototypeSync ? resolvedTheme || "light" : "light";
  const { systemDark } = useCanvasFrameTheme();
  const effectiveTheme = resolveStoryFrameTheme(search, props?.frameThemeOverride, inheritedTheme, getConfig("theming")?.themes || {}, systemDark);
  const iframeSrc = useMemo(
    () => resolveStorySetUrl(storyId, layout, selected, density, effectiveTheme, { search, hash }),
    // storyIndexKey forces re-evaluation when HMR mutates the story index
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storyId, layout, selected, density, storyIndexKey, effectiveTheme, search, hash]
  );
  const {
    admitted,
    activate: enterInteractive,
    attachExpandedPane,
    viewportRef,
    poster,
    debug,
    phase,
    elapsed,
    loading,
    ready,
    error,
    attach,
    onLoad,
    onError,
    refresh,
    published,
    snapshotStatus
  } = useStoryFrame({ widgetId, canvasId, props, componentSet: true, iframeSrc, theme: effectiveTheme, expanded, interactive, setInteractive, rootRef: containerRef, iframeRef });
  useImperativeHandle(ref, () => ({
    attachExpandedPane,
    getIframeWindow() {
      try {
        return iframeRef.current?.contentWindow ?? null;
      } catch {
        return null;
      }
    },
    handleAction(actionId, opts) {
      if (actionId === "expand" || actionId === "expand-single") {
        setExpanded(opts?.altKey ? "immersive" : "open");
        return true;
      } else if (actionId === "refresh-frame") {
        refresh();
        return true;
      } else if (actionId === "open-external") {
        const story = getStoryData(storyId);
        if (story?._route) {
          const base = (globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/").replace(/\/$/, "");
          window.open(`${base}${story._route}`, "_blank", "noopener");
        }
        return true;
      } else if (actionId === "edit-source") {
        (async () => {
          const src = await getStoryPathByName(storyId);
          if (!src) return;
          document.dispatchEvent(new CustomEvent("storyboard:canvas:add-widget", {
            detail: { type: "file", props: { path: src }, near: widgetId, direction: "right" }
          }));
        })();
        return true;
      }
    }
  }), [storyId, setExpanded, attachExpandedPane, refresh, widgetId]);
  useIframeDevLogs({
    widget: "StorySetWidget",
    loaded: interactive && Boolean(iframeSrc),
    src: iframeSrc
  });
  const displayName = storyId || "Component Set";
  if (!storyId) {
    return /* @__PURE__ */ jsx(WidgetWrapper, { children: /* @__PURE__ */ jsx(
      "div",
      {
        ref: containerRef,
        className: "hc-relative hc-overflow-hidden hc-min-w-[200px] hc-min-h-[120px] hc-w-full hc-h-full hc-rounded-lg hc-bg-background hc-shadow-[0_4px_16px_rgba(0,0,0,0.08)]",
        children: /* @__PURE__ */ jsxs("div", { className: "hc-flex hc-items-center hc-gap-2 hc-p-4 hc-text-sm hc-leading-snug hc-font-[system-ui,-apple-system,sans-serif] hc-text-foreground-danger", children: [
          /* @__PURE__ */ jsx("span", { className: "hc-text-xl hc-flex-shrink-0", children: /* @__PURE__ */ jsx(GridIcon, { size: 20 }) }),
          /* @__PURE__ */ jsx("span", { className: "hc-break-words", children: "Missing story ID" })
        ] })
      }
    ) });
  }
  if (!iframeSrc) {
    return /* @__PURE__ */ jsx(WidgetWrapper, { children: /* @__PURE__ */ jsx(
      "div",
      {
        ref: containerRef,
        className: "hc-relative hc-overflow-hidden hc-min-w-[200px] hc-min-h-[120px] hc-w-full hc-h-full hc-rounded-lg hc-bg-background hc-shadow-[0_4px_16px_rgba(0,0,0,0.08)]",
        children: /* @__PURE__ */ jsxs("div", { className: "hc-flex hc-items-center hc-gap-2 hc-p-4 hc-text-sm hc-leading-snug hc-font-[system-ui,-apple-system,sans-serif] hc-text-foreground-danger", children: [
          /* @__PURE__ */ jsx("span", { className: "hc-text-xl hc-flex-shrink-0", children: /* @__PURE__ */ jsx(GridIcon, { size: 20 }) }),
          /* @__PURE__ */ jsxs("span", { className: "hc-break-words", children: [
            "Story “",
            storyId,
            "” not found or has no route"
          ] })
        ] })
      }
    ) });
  }
  const sizeStyle = {};
  if (typeof width === "number") sizeStyle.width = `${width}px`;
  if (typeof height === "number") sizeStyle.height = `${height}px`;
  if (snapping) sizeStyle.transition = "width 220ms cubic-bezier(0.2, 0.8, 0.2, 1), height 220ms cubic-bezier(0.2, 0.8, 0.2, 1)";
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs(WidgetWrapper, { children: [
      /* @__PURE__ */ jsxs(
        "div",
        {
          ref: containerRef,
          className: "hc-relative hc-overflow-hidden hc-min-w-[200px] hc-min-h-[120px] hc-w-full hc-h-full hc-rounded-lg hc-bg-background hc-shadow-[0_4px_16px_rgba(0,0,0,0.08)] hc-flex hc-flex-col",
          style: sizeStyle,
          children: [
            /* @__PURE__ */ jsxs("div", { className: "hc-flex-shrink-0 hc-flex hc-items-center hc-gap-1.5 hc-px-3 hc-py-2 hc-text-xs hc-font-medium hc-whitespace-nowrap hc-overflow-hidden hc-text-ellipsis hc-select-none hc-border-b hc-border-border-muted hc-bg-background-muted hc-text-foreground-muted", children: [
              /* @__PURE__ */ jsx("span", { className: "hc-inline-flex hc-flex-shrink-0", children: /* @__PURE__ */ jsx(GridIcon, { size: 16 }) }),
              /* @__PURE__ */ jsx("span", { className: "hc-overflow-hidden hc-text-ellipsis", children: displayName }),
              selected && /* @__PURE__ */ jsxs("span", { className: "hc-font-semibold hc-flex-shrink-0 hc-text-foreground-accent", children: [
                "· ",
                selected
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { ref: viewportRef, className: styles.content, style: {}, "data-story-frame": "collection", children: [
              admitted && /* @__PURE__ */ jsx(
                "iframe",
                {
                  ref: attach,
                  src: iframeSrc,
                  className: styles.iframe,
                  "aria-label": `${displayName} component set`,
                  style: { pointerEvents: interactive || expanded ? void 0 : "none" },
                  onLoad: (event) => {
                    event.target.blur();
                    onLoad();
                  },
                  onError
                }
              ),
              (!admitted || !ready) && /* @__PURE__ */ jsx("div", { className: styles.placeholder, "aria-hidden": "true", children: poster ? /* @__PURE__ */ jsx("img", { src: poster, className: styles.snapshotImage, alt: "" }) : /* @__PURE__ */ jsx("span", { children: snapshotStatus === "missing" ? "No saved preview" : displayName }) }),
              loading && /* @__PURE__ */ jsx("div", { className: styles.loadingIndicator, "aria-label": "Loading Frame", children: /* @__PURE__ */ jsx("div", { className: styles.spinner }) }),
              error && /* @__PURE__ */ jsx("div", { className: styles.frameError, role: "status", children: error }),
              debug && /* @__PURE__ */ jsxs("div", { className: styles.lifecycleToast, "data-frame-lifecycle": phase, children: [
                phase,
                elapsed === null ? "" : ` · ${elapsed.toFixed(1)}s`
              ] }),
              !interactive && !expanded && !loading && /* @__PURE__ */ jsx(
                "div",
                {
                  className: overlayStyles.interactOverlay,
                  "data-canvas-interact-gate": "true",
                  role: "button",
                  tabIndex: 0,
                  "aria-label": published ? "Open live preview" : "Click to interact",
                  onClick: (event) => {
                    if (!event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) enterInteractive();
                  },
                  onKeyDown: (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      enterInteractive();
                    }
                  },
                  children: /* @__PURE__ */ jsx("span", { className: overlayStyles.interactHint, children: published ? "Open live preview" : "Click to interact" })
                }
              )
            ] })
          ]
        }
      ),
      resizable && /* @__PURE__ */ jsx(ResizeHandle, { targetRef: containerRef, width, height, onResize: handleResize, onResizeEnd: handleResizeEnd })
    ] }),
    expanded && /* @__PURE__ */ jsx(
      ComponentSetExpandPane,
      {
        widgetId,
        attachExpandedPane,
        theme: effectiveTheme,
        search: props?.search,
        hash: props?.hash,
        density,
        storyId,
        layout,
        selected,
        immersive,
        onClose: () => setExpanded(null)
      }
    )
  ] });
});
function ComponentSetExpandPane({ widgetId, storyId, attachExpandedPane, immersive, onClose }) {
  const pane = useMemo(() => ({ id: widgetId, label: storyId, widgetType: "component-set", kind: "external", attach: attachExpandedPane }), [widgetId, storyId, attachExpandedPane]);
  const paneLayout = useMemo(() => [[pane]], [pane]);
  return /* @__PURE__ */ jsx(
    ExpandedPane,
    {
      ownerId: widgetId,
      initialLayout: paneLayout,
      variant: immersive ? "immersive" : "modal",
      onClose
    }
  );
}
export {
  StorySetWidget as default,
  resolveStorySetUrl
};
