import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { useState, useRef, useEffect, useMemo, forwardRef, useCallback, useImperativeHandle } from "react";
import "./dialog-content-DtvqXfUu.js";
import { listStories, getStoryData } from "../core-0.js";
import { u as useStoryFrame, g as getStoryPathByName, s as styles } from "./StoryWidget.module-BgGSE8e2.js";
import { u as useThemeState, a as useThemeSyncTargets } from "./useThemeState-6KPJA_hY.js";
import { getConfig } from "../core-2.js";
import { b as resolveStoryFrameTheme } from "./basePathAsset-Bs6UgtNi.js";
import { u as useCanvasFrameTheme } from "./useCanvasFrameTheme-D4Yco8Ax.js";
import { s as storyFrameUrl } from "./storyFrameUrl-BrqNbZ2o.js";
import { createInspectorHighlighter } from "./highlighter-65pmvChc.js";
import { I as Icon } from "./Icon-CY9OeunJ.js";
import { W as WidgetWrapper } from "./WidgetWrapper-Clt_WBi9.js";
import { R as ResizeHandle } from "./ResizeHandle-Dj9zO6GI.js";
import { u as useIframeDevLogs, o as overlayStyles } from "./embedOverlay.module-BVkT7z5d.js";
import { f as findAllConnectedSplitTargets, g as getSplitPaneLabel, b as buildPaneForWidget, a as buildSplitLayout } from "./MarkdownBlock-DRLSDL1g.js";
import { u as useExpandOverride } from "./useExpandOverride-CWRcTp1O.js";
import { i as copyCanvasText, E as ExpandedPane } from "./Document-DbLUnVhy.js";
function buildStoryList() {
  let names = [];
  try {
    names = listStories();
  } catch {
    return [];
  }
  return names.map((name) => {
    const data = getStoryData(name) || {};
    const exportNames = Array.isArray(data._exportNames) ? data._exportNames : [];
    return { name, route: data._route || "", module: data._storyModule || "", exportNames };
  }).sort((a, b) => a.name.localeCompare(b.name));
}
function StoryPicker({ type, onPick, onClose, preserveFrameType = false }) {
  const [filter, setFilter] = useState("");
  const filterRef = useRef(null);
  useEffect(() => {
    filterRef.current?.focus();
  }, []);
  const stories = useMemo(() => buildStoryList(), []);
  const filtered = useMemo(() => {
    if (!filter) return stories;
    const q = filter.toLowerCase();
    return stories.filter((s) => s.name.toLowerCase().includes(q) || s.route.toLowerCase().includes(q));
  }, [stories, filter]);
  function pick(story) {
    if (type === "component-set") {
      onPick({ type: "component-set", storyId: story.name, layout: "auto", selected: "" });
      return;
    }
    if (!preserveFrameType && story.exportNames && story.exportNames.length > 1) {
      onPick({ type: "component-set", storyId: story.name, layout: "auto", selected: "" });
    } else {
      onPick({ type: "story", storyId: story.name, exportName: "" });
    }
  }
  return /* @__PURE__ */ jsxs("div", { className: "sb-wad-body", children: [
    /* @__PURE__ */ jsx(
      "input",
      {
        ref: filterRef,
        className: "sb-wad-filter",
        type: "text",
        value: filter,
        onChange: (e) => setFilter(e.target.value),
        placeholder: "Filter stories…",
        onKeyDown: (e) => {
          if (e.key === "Escape") onClose?.();
        }
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "sb-wad-list", role: "listbox", children: [
      filtered.map((s) => {
        const count = s.exportNames?.length || 0;
        const typeLabel = count > 1 ? `Component set · ${count} variants` : "Component";
        return /* @__PURE__ */ jsxs("button", { type: "button", className: "sb-wad-item", role: "option", onClick: () => pick(s), children: [
          /* @__PURE__ */ jsx("span", { className: "sb-wad-item-title", children: s.name }),
          /* @__PURE__ */ jsx("span", { className: "sb-wad-item-hint", children: typeLabel })
        ] }, s.name);
      }),
      filtered.length === 0 && /* @__PURE__ */ jsx("div", { className: "sb-wad-empty", children: "No matches" })
    ] })
  ] });
}
function ComponentIcon({ size = 36 }) {
  return /* @__PURE__ */ jsx(Icon, { name: "iconoir/keyframe", size });
}
function resolveStoryUrl(storyId, exportName, theme, routeState = {}) {
  return storyFrameUrl(getStoryData(storyId), storyId, { ...routeState, exportName }, { theme });
}
const _storySourcesCache = {};
async function fetchStorySource(modulePath) {
  if (modulePath in _storySourcesCache) return _storySourcesCache[modulePath];
  const base = (globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/").replace(/\/$/, "");
  const path = modulePath.startsWith("/") ? modulePath : `/${modulePath}`;
  const res = await fetch(`${base}${path}?raw`);
  if (!res.ok) throw new Error(`Failed to fetch ${base}${path}`);
  const code = await res.text();
  _storySourcesCache[modulePath] = code;
  return code;
}
const StoryWidget = forwardRef(function StoryWidget2({ id: widgetId, canvasId, props, onUpdate, resizable }, ref) {
  const storyId = props?.storyId || "";
  const search = props?.search || "";
  const hash = props?.hash || "";
  const exportName = props?.exportName || "";
  const width = props?.width;
  const height = props?.height;
  const containerRef = useRef(null);
  const [expandMode, setExpandMode] = useExpandOverride("story", widgetId);
  const expanded = expandMode !== null;
  const iframeRef = useRef(null);
  const [interactive, setInteractive] = useState(false);
  const [showCode, setShowCode] = useState(!!props?.showCode);
  const [sourceCode, setSourceCode] = useState(null);
  const [highlightedHtml, setHighlightedHtml] = useState(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [storyIndexKey, setStoryIndexKey] = useState(0);
  useEffect(() => {
    const handler = () => setStoryIndexKey((k) => k + 1);
    document.addEventListener("storyboard:story-index-changed", handler);
    return () => document.removeEventListener("storyboard:story-index-changed", handler);
  }, []);
  const toggleShowCode = useCallback(() => {
    setShowCode((v) => {
      const next = !v;
      if (onUpdate) onUpdate({ showCode: next });
      return next;
    });
  }, [onUpdate]);
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
  const handleResize = useCallback((w, h) => {
    onUpdate?.({ width: w, height: h });
  }, [onUpdate]);
  useEffect(() => {
    if (!showCode || sourceCode !== null) return;
    const story = getStoryData(storyId);
    if (!story?._storyModule) {
      setSourceCode("// Source not available");
      return;
    }
    let cancelled = false;
    setSourceLoading(true);
    fetchStorySource(story._storyModule).then((code) => {
      if (!cancelled) {
        setSourceCode(code || "// Empty file");
        setSourceLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setSourceCode("// Failed to load source");
        setSourceLoading(false);
      }
    });
    return () => {
      cancelled = true;
      setSourceLoading(false);
    };
  }, [showCode, sourceCode, storyId]);
  const [codeThemeKey, setCodeThemeKey] = useState(0);
  useEffect(() => {
    function onThemeChanged() {
      setCodeThemeKey((k) => k + 1);
    }
    document.addEventListener("storyboard:theme:changed", onThemeChanged);
    return () => document.removeEventListener("storyboard:theme:changed", onThemeChanged);
  }, []);
  useEffect(() => {
    if (!sourceCode) return;
    let cancelled = false;
    createInspectorHighlighter().then((hl) => {
      if (cancelled) return;
      const lang = storyId.endsWith(".tsx") ? "tsx" : "jsx";
      setHighlightedHtml(hl.codeToHtml(sourceCode, { lang }));
    });
    return () => {
      cancelled = true;
    };
  }, [sourceCode, storyId, codeThemeKey]);
  const copyCode = useCallback(async () => {
    if (sourceCode) {
      await copyCanvasText(sourceCode, "source code");
      return;
    }
    const story = getStoryData(storyId);
    if (!story?._storyModule) return;
    try {
      const code = await fetchStorySource(story._storyModule);
      setSourceCode(code);
      await copyCanvasText(code, "source code");
    } catch (error2) {
      console.error("[canvas] Failed to load source for copying:", error2);
    }
  }, [sourceCode, storyId]);
  const { resolved: resolvedTheme } = useThemeState() || {};
  const { prototype: prototypeSync } = useThemeSyncTargets() || {};
  const inheritedTheme = prototypeSync ? resolvedTheme || "light" : "light";
  const { systemDark } = useCanvasFrameTheme();
  const effectiveTheme = resolveStoryFrameTheme(search, props?.frameThemeOverride, inheritedTheme, getConfig("theming")?.themes || {}, systemDark);
  const iframeSrc = useMemo(
    () => resolveStoryUrl(storyId, exportName, effectiveTheme, { search, hash }),
    [storyId, exportName, storyIndexKey, effectiveTheme, search, hash]
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
  } = useStoryFrame({ widgetId, canvasId, props, componentSet: false, iframeSrc, theme: effectiveTheme, expanded, interactive, setInteractive, rootRef: containerRef, iframeRef });
  useImperativeHandle(ref, () => ({
    attachExpandedPane,
    getIframeWindow() {
      try {
        return iframeRef.current?.contentWindow ?? null;
      } catch {
        return null;
      }
    },
    getState(key) {
      if (key === "showCode") return showCode;
      return void 0;
    },
    handleAction(actionId, opts) {
      if (actionId === "show-code") toggleShowCode();
      else if (actionId === "copy-code") copyCode();
      else if (actionId === "refresh-frame") refresh();
      else if (actionId === "expand" || actionId === "expand-single") {
        setExpandMode(opts?.altKey ? "immersive" : "single");
      } else if (actionId === "split-screen") setExpandMode("split");
      else if (actionId === "open-external") {
        const story = getStoryData(storyId);
        if (story?._route) {
          const base = (globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/").replace(/\/$/, "");
          window.open(`${base}${story._route}`, "_blank", "noopener");
        }
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
  }), [storyId, showCode, toggleShowCode, copyCode, setExpandMode, attachExpandedPane, refresh, widgetId]);
  useIframeDevLogs({
    widget: "StoryWidget",
    loaded: interactive && !showCode && Boolean(iframeSrc),
    src: iframeSrc
  });
  const displayName = exportName ? `${storyId} / ${exportName}` : storyId;
  if (!storyId) {
    return /* @__PURE__ */ jsx(WidgetWrapper, { children: /* @__PURE__ */ jsx(
      "div",
      {
        ref: containerRef,
        className: "hc-relative hc-overflow-hidden hc-min-w-[100px] hc-min-h-[60px] hc-w-full hc-h-full hc-rounded-lg hc-bg-background hc-shadow-[0_4px_16px_rgba(0,0,0,0.08)]",
        children: onUpdate ? /* @__PURE__ */ jsx(StoryPicker, { type: "story", preserveFrameType: true, onPick: (payload) => onUpdate({ storyId: payload.storyId, exportName: payload.exportName }) }) : /* @__PURE__ */ jsx("div", { className: "hc-p-4 hc-text-sm hc-text-foreground-muted", children: "Choose a component in the editor." })
      }
    ) });
  }
  if (!iframeSrc) {
    return /* @__PURE__ */ jsx(WidgetWrapper, { children: /* @__PURE__ */ jsx(
      "div",
      {
        ref: containerRef,
        className: "hc-relative hc-overflow-hidden hc-min-w-[100px] hc-min-h-[60px] hc-w-full hc-h-full hc-rounded-lg hc-bg-background hc-shadow-[0_4px_16px_rgba(0,0,0,0.08)]",
        children: /* @__PURE__ */ jsxs("div", { className: "hc-flex hc-items-center hc-gap-2 hc-p-4 hc-text-sm hc-leading-snug hc-font-[system-ui,-apple-system,sans-serif] hc-text-foreground-danger", children: [
          /* @__PURE__ */ jsx("span", { className: "hc-text-xl hc-flex-shrink-0", children: /* @__PURE__ */ jsx(ComponentIcon, { size: 20 }) }),
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
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs(WidgetWrapper, { children: [
      /* @__PURE__ */ jsxs(
        "div",
        {
          ref: containerRef,
          className: "hc-relative hc-overflow-hidden hc-min-w-[100px] hc-min-h-[60px] hc-w-full hc-h-full hc-rounded-lg hc-bg-background hc-shadow-[0_4px_16px_rgba(0,0,0,0.08)] hc-flex hc-flex-col",
          style: sizeStyle,
          children: [
            /* @__PURE__ */ jsxs("div", { className: "hc-flex-shrink-0 hc-flex hc-items-center hc-gap-1.5 hc-px-3 hc-py-2 hc-text-xs hc-font-medium hc-whitespace-nowrap hc-overflow-hidden hc-text-ellipsis hc-select-none hc-border-b hc-border-border-muted hc-bg-background-muted hc-text-foreground-muted", children: [
              /* @__PURE__ */ jsx("span", { className: "hc-inline-flex hc-flex-shrink-0", children: /* @__PURE__ */ jsx(ComponentIcon, { size: 16 }) }),
              /* @__PURE__ */ jsx("span", { className: "hc-overflow-hidden hc-text-ellipsis", children: displayName })
            ] }),
            showCode ? /* @__PURE__ */ jsxs(
              "div",
              {
                className: "hc-flex hc-flex-col hc-flex-1 hc-min-h-0 hc-overflow-hidden",
                "data-canvas-allow-text-selection": true,
                onPointerDown: (e) => e.stopPropagation(),
                onMouseDown: (e) => e.stopPropagation(),
                onClick: (e) => e.stopPropagation(),
                children: [
                  /* @__PURE__ */ jsxs("div", { className: "hc-flex hc-items-center hc-justify-between hc-px-2.5 hc-py-1 hc-text-[11px] hc-font-medium hc-select-none hc-flex-shrink-0 hc-border-b hc-border-border-muted hc-bg-background-inset hc-text-foreground-muted", children: [
                    /* @__PURE__ */ jsxs("span", { className: "hc-font-mono", children: [
                      storyId,
                      ".story.jsx"
                    ] }),
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        className: "all-unset hc-cursor-pointer hc-flex hc-items-center hc-justify-center hc-w-5 hc-h-5 hc-rounded hc-text-sm hc-hover:opacity-80 hc-text-foreground-muted",
                        onClick: () => setShowCode(false),
                        "aria-label": "Close code view",
                        children: "×"
                      }
                    )
                  ] }),
                  sourceLoading ? /* @__PURE__ */ jsx("div", { className: "hc-flex-1 hc-flex hc-items-center hc-justify-center hc-text-xs hc-text-foreground-muted", children: "Loading…" }) : highlightedHtml ? /* @__PURE__ */ jsx("div", { className: styles.codeBlock, dangerouslySetInnerHTML: { __html: highlightedHtml } }) : /* @__PURE__ */ jsx("pre", { className: styles.codeBlock, children: /* @__PURE__ */ jsx("code", { children: sourceCode || "" }) })
                ]
              }
            ) : null,
            /* @__PURE__ */ jsxs("div", { ref: viewportRef, className: styles.content, style: { display: showCode ? "none" : void 0 }, "data-story-frame": "story", children: [
              admitted && /* @__PURE__ */ jsx(
                "iframe",
                {
                  ref: attach,
                  src: iframeSrc,
                  className: styles.iframe,
                  "aria-label": displayName,
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
      resizable && /* @__PURE__ */ jsx(ResizeHandle, { targetRef: containerRef, width, height, onResize: handleResize })
    ] }),
    expanded && /* @__PURE__ */ jsx(
      StoryExpandPane,
      {
        widgetId,
        attachExpandedPane,
        theme: effectiveTheme,
        search: props?.search,
        hash: props?.hash,
        storyId,
        exportName,
        splitMode: expandMode === "split",
        immersive: expandMode === "immersive",
        onClose: () => setExpandMode(null)
      }
    )
  ] });
});
function StoryExpandPane({ attachExpandedPane, widgetId, storyId, exportName, theme, splitMode, immersive, onClose }) {
  const connectedWidgets = useMemo(
    () => splitMode ? findAllConnectedSplitTargets(widgetId) : [],
    [widgetId, splitMode]
  );
  const primaryWidget = useMemo(() => {
    const bridge = window.__storyboardCanvasBridgeState;
    return bridge?.widgets?.find((w) => w.id === widgetId) || { id: widgetId, type: "story", position: { x: 0, y: 0 }, props: { storyId, exportName } };
  }, [widgetId, storyId, exportName]);
  const buildPaneFn = useCallback((widget) => {
    if (widget.id === widgetId) {
      return { id: widgetId, label: getSplitPaneLabel({ type: "story", props: { storyId, exportName } }), widgetType: "story", kind: "external", attach: attachExpandedPane };
    }
    return buildPaneForWidget(widget, "splitbar", theme);
  }, [widgetId, storyId, exportName, theme, attachExpandedPane]);
  const layout = useMemo(
    () => buildSplitLayout(primaryWidget, connectedWidgets, buildPaneFn),
    [primaryWidget, connectedWidgets, buildPaneFn]
  );
  const isSinglePane = layout.flat().length <= 1;
  const variant = isSinglePane ? immersive ? "immersive" : "modal" : "full";
  return /* @__PURE__ */ jsx(
    ExpandedPane,
    {
      ownerId: widgetId,
      initialLayout: layout,
      variant,
      onClose
    }
  );
}
export {
  StoryWidget as default,
  resolveStoryUrl
};
