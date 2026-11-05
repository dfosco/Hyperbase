import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { useFeatureFlag } from "../useFeatureFlag.js";
import { u as useCanvasFrameTheme, a as useObservedFrameLifecycle, b as useFrameSnapshot, c as useFrameSnapshotLifecycle, F as FRAME_HEADER_HEIGHT, p as prototypeContentViewport } from "./useCanvasFrameTheme-D4Yco8Ax.js";
import { a as useGuardedExpandOverride } from "./useExpandOverride-CWRcTp1O.js";
import { forwardRef, useEffect, useMemo, useState, useRef, useCallback, useImperativeHandle } from "react";
import { b as buildPrototypeIndex } from "./viewfinder-D-4ZTzXo.js";
import { u as useOverride } from "./useOverride-CmpCccmF.js";
import { W as WidgetWrapper } from "./WidgetWrapper-Clt_WBi9.js";
import { R as ResizeHandle } from "./ResizeHandle-Dj9zO6GI.js";
import { r as readProp, p as prototypeEmbedSchema } from "./widgetProps-BqIDs1ZC.js";
import "../core-9.js";
import { u as useIframeDevLogs, o as overlayStyles } from "./embedOverlay.module-BVkT7z5d.js";
import { f as findAllConnectedSplitTargets, g as getSplitPaneLabel, b as buildPaneForWidget, a as buildSplitLayout } from "./MarkdownBlock-DRLSDL1g.js";
import { u as useCanvasBridge, h as hasConnectedKnobsWidget } from "./canvasBridge-BSAFcD76.js";
import { s as samePrototypeFrameLocation, c as buildPrototypePickerEntries, e as embedRoutePath, f as stripEmbedRoute, r as resolvePrototypeFrameUrl, h as resolveLivePrototypeRefreshTarget, E as ExpandedPane } from "./Document-DbLUnVhy.js";
import { r as resolveFrameTheme, a as resolveBasePathAsset } from "./basePathAsset-Bs6UgtNi.js";
import { D as DialogRoot$1 } from "./DialogRoot-DGpWyMIY.js";
import { D as DialogContent, c as css } from "./dialog-content-DtvqXfUu.js";
import { getConfig } from "../core-2.js";
function getEmbedChromeVars() {
  return {};
}
function normalizeLegacyEmbedSrc(src) {
  if (typeof src !== "string" || !src) return src;
  const hashMatch = src.match(/^\/?(?:[^#]*\/)?prototypes\.html#(.*)$/);
  if (hashMatch) {
    const inner = hashMatch[1] || "";
    if (!inner) return "/";
    if (inner.startsWith("/")) return inner;
    try {
      const params = new URLSearchParams(inner);
      let route = "";
      const restPairs = [];
      for (const [key, value] of params) {
        if (!route && key.startsWith("/")) {
          route = value ? `${key}?${key}=${value}` : key;
        } else {
          restPairs.push(`${key}=${value}`);
        }
      }
      if (route) {
        return restPairs.length > 0 ? `${route}#${restPairs.join("&")}` : route;
      }
    } catch {
    }
    return `/${inner}`;
  }
  const pathMatch = src.match(/^\/?(?:[^#?]*\/)?prototypes\.html(\/[^]*)$/);
  if (pathMatch) {
    const inner = pathMatch[1] || "";
    return inner || "/";
  }
  return src;
}
function DialogRoot({ children, ...props }) {
  return /* @__PURE__ */ jsx(DialogRoot$1, { ...props, children });
}
function DialogAdapter({
  title,
  subtitle,
  onClose,
  width = "medium",
  height = "auto",
  children
}) {
  return /* @__PURE__ */ jsx(DialogRoot, { open: true, onOpenChange: (open) => {
    if (!open) onClose?.();
  }, children: /* @__PURE__ */ jsxs(DialogContent, { width, height, "aria-label": typeof title === "string" ? title : void 0, children: [
    (title || subtitle) && /* @__PURE__ */ jsxs("div", { className: css.header, children: [
      /* @__PURE__ */ jsxs("div", { className: css.titleGroup, children: [
        title && /* @__PURE__ */ jsx("h2", { className: css.title, children: title }),
        subtitle && /* @__PURE__ */ jsx("p", { className: css.subtitle, children: subtitle })
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: css.closeBtn,
          onClick: () => onClose?.(),
          "aria-label": "Close",
          children: /* @__PURE__ */ jsx("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: /* @__PURE__ */ jsx("path", { d: "M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" }) })
        }
      )
    ] }),
    /* @__PURE__ */ jsx("div", { className: css.body, children })
  ] }) });
}
const iframeContainer = "_iframeContainer_1sn8k_26";
const placeholder = "_placeholder_1sn8k_38";
const snapshotPoster = "_snapshotPoster_1sn8k_54";
const placeholderLabel = "_placeholderLabel_1sn8k_62";
const refreshMessage = "_refreshMessage_1sn8k_67";
const refreshActions = "_refreshActions_1sn8k_74";
const refreshCancel = "_refreshCancel_1sn8k_81";
const spinner = "_spinner_1sn8k_99";
const iframe = "_iframe_1sn8k_26";
const pickerArea = "_pickerArea_1sn8k_122";
const pickerOverlay = "_pickerOverlay_1sn8k_131";
const picker = "_picker_1sn8k_122";
const pickerHeading = "_pickerHeading_1sn8k_148";
const pickerClose = "_pickerClose_1sn8k_159";
const pickerItem = "_pickerItem_1sn8k_177";
const pickerItemSelected = "_pickerItemSelected_1sn8k_195";
const pickerItemTitle = "_pickerItemTitle_1sn8k_206";
const pickerItemName = "_pickerItemName_1sn8k_214";
const pickerMessage = "_pickerMessage_1sn8k_215";
const expandIframe = "_expandIframe_1sn8k_371";
const lifecycleLayer = "_lifecycleLayer_1sn8k_520";
const lifecycleToast = "_lifecycleToast_1sn8k_521";
const loadingIndicator = "_loadingIndicator_1sn8k_522";
const frameError = "_frameError_1sn8k_524";
const styles = {
  iframeContainer,
  placeholder,
  snapshotPoster,
  placeholderLabel,
  refreshMessage,
  refreshActions,
  refreshCancel,
  spinner,
  iframe,
  pickerArea,
  pickerOverlay,
  picker,
  pickerHeading,
  pickerClose,
  pickerItem,
  pickerItemSelected,
  pickerItemTitle,
  pickerItemName,
  pickerMessage,
  expandIframe,
  lifecycleLayer,
  lifecycleToast,
  loadingIndicator,
  frameError
};
function CollageFrameIcon({ size = 36 }) {
  return /* @__PURE__ */ jsxs("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx("path", { d: "M19.4 20H4.6C4.26863 20 4 19.7314 4 19.4V4.6C4 4.26863 4.26863 4 4.6 4H19.4C19.7314 4 20 4.26863 20 4.6V19.4C20 19.7314 19.7314 20 19.4 20Z" }),
    /* @__PURE__ */ jsx("path", { d: "M11 12V4" }),
    /* @__PURE__ */ jsx("path", { d: "M4 12H20" })
  ] });
}
function isLocalDevEmbedUrl(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return false;
    const h = u.hostname;
    return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]";
  } catch {
    return false;
  }
}
function getAbsoluteEmbedOrigin(url) {
  if (!isLocalDevEmbedUrl(url)) return "";
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}
const EMPTY_THEME_REGISTRY = Object.freeze({});
function requestFrameTheme(iframe2, frameUrl, theme) {
  try {
    const url = new URL(frameUrl, window.location.href);
    if (url.searchParams.has("theme")) return;
    iframe2?.contentWindow?.postMessage({ type: "storyboard:embed:sync-theme", theme }, url.origin);
  } catch {
  }
}
function readUrlTheme(src, themeRegistry) {
  try {
    const value = new URL(src, window.location.href).searchParams.get("theme");
    return ["system", "light", "dark"].includes(value) || value && Object.hasOwn(themeRegistry, value) ? value : null;
  } catch {
    return null;
  }
}
function writeUrlTheme(src, value) {
  const url = new URL(src, window.location.href);
  if (value === "inherit") url.searchParams.delete("theme");
  else url.searchParams.set("theme", String(value));
  return /^[a-z][a-z\d+.-]*:/i.test(src) ? url.href : `${url.pathname}${url.search}${url.hash}`;
}
function readLiveRefreshTarget(iframe2, basePath, authoredSrc) {
  try {
    if (!iframe2?.isConnected) return null;
    const childWindow = iframe2.contentWindow;
    const childDocument = iframe2.contentDocument;
    if (!childWindow || !childDocument) return null;
    const url = childWindow.location.href;
    const resolved = resolveLivePrototypeRefreshTarget(url, {
      expectedOrigin: window.location.origin,
      basePath,
      development: globalThis.__HYPERCANVAS_NOTEBOOK_PREVIEW__,
      authoredSrc
    });
    if (!resolved) return null;
    return { iframe: iframe2, childDocument, url, authoredSrc, ...resolved };
  } catch {
    return null;
  }
}
const PrototypeEmbed = forwardRef(function PrototypeEmbed2({ id: widgetId, canvasId, props, onUpdate, resizable }, ref) {
  const rawStoredSrc = readProp(props, "src", prototypeEmbedSchema);
  const src = normalizeLegacyEmbedSrc(rawStoredSrc);
  const width = readProp(props, "width", prototypeEmbedSchema) || 800;
  const height = readProp(props, "height", prototypeEmbedSchema) || 600;
  const zoom = readProp(props, "zoom", prototypeEmbedSchema) || 100;
  const label = readProp(props, "label", prototypeEmbedSchema) || src;
  const themeRegistry = getConfig("theming")?.themes || EMPTY_THEME_REGISTRY;
  useEffect(() => {
    if (!onUpdate) return;
    if (typeof rawStoredSrc !== "string" || rawStoredSrc === src) return;
    onUpdate({ src });
  }, [rawStoredSrc, src, onUpdate]);
  const basePath = (globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/").replace(/\/$/, "");
  const baseSegment = basePath.replace(/^\//, "");
  const { rawSrc, externalSrc } = useMemo(() => {
    if (!src) return { rawSrc: "", externalSrc: "" };
    if (/^https?:\/\//.test(src)) return { rawSrc: src, externalSrc: src };
    const cleaned = src.replace(/^\/branch--[^/]+/, "");
    let normalized;
    if (baseSegment && cleaned.startsWith(basePath)) normalized = cleaned;
    else if (baseSegment && cleaned.startsWith(baseSegment)) normalized = `/${cleaned}`;
    else normalized = `${basePath}${cleaned}`;
    const withoutBase = baseSegment && normalized.startsWith(basePath) ? normalized.slice(basePath.length) || "/" : normalized;
    const hashIdx = withoutBase.indexOf("#");
    const innerHash = hashIdx >= 0 ? withoutBase.slice(hashIdx + 1) : "";
    const pathAndQuery = hashIdx >= 0 ? withoutBase.slice(0, hashIdx) : withoutBase;
    const routePath = pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`;
    const suffix = innerHash ? `#${innerHash}` : "";
    const directUrl = `${basePath}${routePath}${suffix}`;
    if (globalThis.__HYPERCANVAS_NOTEBOOK_PRODUCTION__ || routePath.startsWith("/@fs/") || routePath.startsWith("/notebook-assets/")) {
      return { rawSrc: directUrl, externalSrc: directUrl };
    }
    const iframeUrl = `${basePath}/prototypes.html${routePath}${suffix}`;
    return { rawSrc: iframeUrl, externalSrc: directUrl };
  }, [src, basePath, baseSegment]);
  const scale = zoom / 100;
  const [editing, setEditing] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const [refreshPrompt, setRefreshPrompt] = useState(null);
  const refreshSnapshotAfterLoadRef = useRef(null);
  const [siteReloadToken, setSiteReloadToken] = useState(0);
  const [expandOverrideRaw, setExpandOverride, clearExpandOverride] = useOverride(`_prototype_expanded_${widgetId}`);
  const expandOverride = useGuardedExpandOverride(widgetId, expandOverrideRaw, setExpandOverride, clearExpandOverride);
  const expandMode = expandOverride === "immersive" ? "immersive" : expandOverride === "split" ? "split" : expandOverride === "single" ? "single" : null;
  const setExpandMode = useCallback((mode) => {
    if (mode) setExpandOverride(mode);
    else clearExpandOverride();
  }, [setExpandOverride, clearExpandOverride]);
  const [immersiveClosing, setImmersiveClosing] = useState(false);
  const expanded = expandMode !== null;
  const { theme: canvasTheme, systemDark } = useCanvasFrameTheme();
  const urlTheme = readUrlTheme(src, themeRegistry);
  const frameTheme = urlTheme === "system" ? systemDark ? "dark" : "light" : urlTheme || resolveFrameTheme(props?.frameThemeOverride, canvasTheme, themeRegistry);
  const embedRef = useRef(null);
  const iframeRef = useRef(null);
  const reportedNavigationRef = useRef(null);
  const inlineContainerRef = useRef(null);
  const modalContainerRef = useRef(null);
  const lifecycleLayerRef = useRef(null);
  const { widgets: bridgeWidgets, connectors: bridgeConnectors } = useCanvasBridge();
  const hasKnobsTarget = useMemo(
    () => hasConnectedKnobsWidget(widgetId, bridgeWidgets, bridgeConnectors),
    [widgetId, bridgeWidgets, bridgeConnectors]
  );
  const iframeSrc = useMemo(() => {
    if (!rawSrc) return "";
    if (/^https?:\/\//.test(rawSrc) && !isLocalDevEmbedUrl(rawSrc)) return rawSrc;
    const hashIdx = rawSrc.indexOf("#");
    const base = hashIdx >= 0 ? rawSrc.slice(0, hashIdx) : rawSrc;
    const hash = hashIdx >= 0 ? rawSrc.slice(hashIdx) : "";
    const queryStart = base.indexOf("?");
    const path = queryStart >= 0 ? base.slice(0, queryStart) : base;
    const existingQuery = queryStart >= 0 ? base.slice(queryStart + 1) : "";
    const generatedParams = new Map([
      ["_sb_embed", ""],
      ["_sb_hide_branch_bar", ""],
      ["_sb_theme_target", "content"],
      ...hasKnobsTarget ? [["sb_knobs", "1"]] : []
    ]);
    const generatedParamKeys = /* @__PURE__ */ new Set([
      "_sb_embed",
      "_sb_hide_branch_bar",
      "_sb_theme_target",
      "_sb_canvas_theme",
      "sb_knobs"
    ]);
    const retainedParams = existingQuery ? existingQuery.split("&").filter((part) => {
      const rawKey = part.split("=", 1)[0];
      try {
        const key = decodeURIComponent(rawKey.replace(/\+/g, " "));
        return !generatedParamKeys.has(key);
      } catch {
        return true;
      }
    }) : [];
    const additions = [...generatedParams].map(([key, value]) => value ? `${key}=${encodeURIComponent(value)}` : key);
    const query = [...retainedParams, ...additions].join("&");
    return `${path}${query ? `?${query}` : ""}${hash}`;
  }, [rawSrc, hasKnobsTarget]);
  const effectiveSrc = iframeSrc;
  const [mountedFrameSrc, setMountedFrameSrc] = useState(null);
  const [admitted, setAdmitted] = useState(false);
  const lifecycleDebug = useFeatureFlag("frame-lifecycle-overlay") && window.__HYPERCANVAS_NOTEBOOK_PUBLICATION__ == null;
  const { phase: lifecyclePhase, elapsed: lifecycleElapsed, loading: lifecycleLoading, ready: lifecycleReady, error: lifecycleError, attach: attachLifecycleFrame, onLoad: observeFrameLoad, onError: observeFrameError, restart: restartFrameLoad } = useObservedFrameLifecycle({
    iframeRef,
    source: mountedFrameSrc || effectiveSrc,
    debug: lifecycleDebug,
    interactive: interactive || expanded,
    onReady: () => {
      document.dispatchEvent(new CustomEvent("storyboard:canvas:iframe-ready", { detail: { widgetId } }));
      captureMissingAfterLoad();
    }
  });
  useEffect(() => {
    if (!admitted || !effectiveSrc) return;
    let liveUrl;
    try {
      liveUrl = iframeRef.current?.contentWindow?.location?.href;
    } catch {
    }
    if (mountedFrameSrc && liveUrl && samePrototypeFrameLocation(liveUrl, effectiveSrc, window.location.href)) {
      return;
    }
    if (mountedFrameSrc !== effectiveSrc) {
      const frame = window.requestAnimationFrame(() => setMountedFrameSrc(effectiveSrc));
      return () => window.cancelAnimationFrame(frame);
    }
  }, [admitted, effectiveSrc, mountedFrameSrc]);
  useEffect(() => {
    if (!admitted || !effectiveSrc) return;
    try {
      const child = iframeRef.current?.contentWindow;
      const live = child && new URL(child.location.href);
      const desired = new URL(effectiveSrc, window.location.href).searchParams.get("sb_knobs") === "1";
      if (!live || live.origin !== window.location.origin) return;
      const current = live.searchParams.get("sb_knobs") === "1";
      if (current === desired) return;
      if (desired) live.searchParams.set("sb_knobs", "1");
      else live.searchParams.delete("sb_knobs");
      child.history.replaceState(child.history.state, "", `${live.pathname}${live.search}${live.hash}`);
    } catch {
    }
  }, [admitted, effectiveSrc]);
  const snapshotTarget = useMemo(() => {
    if (!src) return null;
    let captureUrl = "";
    try {
      const parsed = new URL(effectiveSrc, window.location.origin);
      parsed.searchParams.delete("sb_knobs");
      if (!parsed.searchParams.has("theme")) parsed.searchParams.set("_sb_canvas_theme", frameTheme);
      captureUrl = parsed.href;
    } catch {
      captureUrl = "";
    }
    return { kind: "prototype", src, zoom, width, height, captureUrl };
  }, [effectiveSrc, frameTheme, height, src, width, zoom]);
  const { snapshot: frameSnapshot, reload: reloadFrameSnapshot } = useFrameSnapshot({
    target: snapshotTarget,
    theme: frameTheme,
    captureTheme: frameTheme,
    widgetId,
    canvasId,
    autoCapture: false
  });
  const currentSnapshotTarget = useCallback(() => {
    const live = readLiveRefreshTarget(iframeRef.current, globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/", src);
    const reported = reportedNavigationRef.current;
    if (!live || !snapshotTarget) {
      return snapshotTarget && reported && (reported.authoredSrc === src || reported.src === src) ? { ...snapshotTarget, src: reported.src, captureUrl: reported.captureUrl } : snapshotTarget;
    }
    if (live.src !== src) onUpdate?.({ src: live.src, originalSrc: props?.originalSrc || src });
    const capture = new URL(live.frameUrl);
    capture.searchParams.delete("sb_knobs");
    if (!capture.searchParams.has("theme")) capture.searchParams.set("_sb_canvas_theme", frameTheme);
    return { ...snapshotTarget, src: live.src, captureUrl: capture.href };
  }, [frameTheme, onUpdate, props?.originalSrc, snapshotTarget, src]);
  const manualPoster = String(frameTheme).startsWith("dark") ? props?.snapshotDark || props?.snapshot : props?.snapshot || props?.snapshotDark;
  const { markDirty: markSnapshotDirty, flush: flushSnapshot, onLoad: captureMissingAfterLoad, prepareRefresh } = useFrameSnapshotLifecycle({
    target: snapshotTarget,
    theme: frameTheme,
    enabled: admitted && !manualPoster,
    snapshotReady: Boolean(frameSnapshot?.generation),
    interactive: interactive || expanded,
    rootRef: embedRef,
    iframeRef,
    reload: reloadFrameSnapshot,
    getCurrentTarget: currentSnapshotTarget,
    onInteractionEnd: () => setInteractive(false)
  });
  const requestFrameRefresh = useCallback(() => {
    const iframe2 = iframeRef.current;
    const target = readLiveRefreshTarget(iframe2, globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/", src);
    if (!target) {
      setRefreshPrompt({ kind: "refused" });
      return;
    }
    setRefreshPrompt(null);
    refreshSnapshotAfterLoadRef.current = { src: target.src };
    prepareRefresh({ target: { ...snapshotTarget, src: target.src } });
    restartFrameLoad();
    if (target.src !== src && onUpdate) {
      const originalSrc = readProp(props, "originalSrc", prototypeEmbedSchema);
      onUpdate({ src: target.src, originalSrc: originalSrc || src });
    }
    if (iframe2) {
      const frameLocation = iframe2.contentWindow?.location;
      if (typeof frameLocation?.reload === "function") frameLocation.reload();
      else iframe2.src = target.frameUrl;
    }
  }, [prepareRefresh, restartFrameLoad, onUpdate, props, setRefreshPrompt, snapshotTarget, src]);
  const cancelFrameRefresh = useCallback(() => {
    setRefreshPrompt(null);
  }, [setRefreshPrompt]);
  const configuredPoster = frameSnapshot?.variants?.[frameTheme]?.dataUrl || resolveBasePathAsset(props?.snapshotVariants?.[frameTheme], globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/");
  const posterUrl = manualPoster ? resolveBasePathAsset(manualPoster, globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/") : configuredPoster || (String(frameTheme).startsWith("dark") ? frameSnapshot?.dark?.dataUrl || frameSnapshot?.light?.dataUrl || "" : frameSnapshot?.light?.dataUrl || frameSnapshot?.dark?.dataUrl || "");
  useEffect(() => {
    if (!isLocalDevEmbedUrl(src)) return void 0;
    const localOrigin = getAbsoluteEmbedOrigin(src);
    const started = (event) => {
      const siteOrigin = event.detail?.developmentBaseUrl ? getAbsoluteEmbedOrigin(event.detail.developmentBaseUrl) : "";
      if (siteOrigin && siteOrigin !== localOrigin) return;
      setSiteReloadToken((token) => token + 1);
    };
    document.addEventListener("storyboard:site-started", started);
    return () => document.removeEventListener("storyboard:site-started", started);
  }, [src]);
  const prototypeIndex = useMemo(() => {
    try {
      return buildPrototypeIndex();
    } catch {
      return { folders: [], prototypes: [], globalFlows: [], sorted: { title: { prototypes: [], folders: [] } } };
    }
  }, []);
  const pickerPrototypes = useMemo(() => buildPrototypePickerEntries(prototypeIndex), [prototypeIndex]);
  const selectedDirName = useMemo(() => {
    if (!src) return "";
    const srcPath = embedRoutePath(src);
    if (!srcPath) return "";
    for (const proto of pickerPrototypes) {
      const paths = proto.routes.map((route) => embedRoutePath(route));
      if (paths.includes(srcPath) || srcPath === `/${proto.dirName}`) return proto.dirName;
    }
    return "";
  }, [src, pickerPrototypes]);
  const prototypeTitle = useMemo(() => {
    if (!src) return label || "Prototype";
    const srcPath = embedRoutePath(src);
    for (const proto of pickerPrototypes) {
      for (const flow of proto.flows) {
        if (stripEmbedRoute(flow.route) === src || embedRoutePath(flow.route) === srcPath) {
          if (flow.name === proto.title) return proto.title;
          return `${proto.title} · ${flow.name}`;
        }
      }
      if (srcPath && proto.routes.some((route) => embedRoutePath(route) === srcPath)) return proto.title;
    }
    return label || "Prototype";
  }, [src, label, pickerPrototypes]);
  useIframeDevLogs({
    widget: "PrototypeEmbed",
    loaded: Boolean(effectiveSrc && interactive),
    src: effectiveSrc
  });
  useEffect(() => {
    if (!interactive || expanded) return;
    function handlePointerDown(e) {
      if (embedRef.current && !embedRef.current.contains(e.target)) {
        const chromeEl = e.target.closest(`[data-widget-id="${widgetId}"]`);
        if (chromeEl) return;
        setInteractive(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [interactive, expanded, widgetId]);
  useEffect(() => {
    const iframe2 = iframeRef.current;
    if (!iframe2?.contentWindow || !effectiveSrc) return;
    requestFrameTheme(iframe2, effectiveSrc, frameTheme);
  }, [effectiveSrc, frameTheme]);
  const expandModeRef = useRef(expandMode);
  useEffect(() => {
    expandModeRef.current = expandMode;
  }, [expandMode]);
  useEffect(() => {
    function handleEnter(e) {
      if (e.detail?.widgetId === widgetId) {
        setImmersiveClosing(false);
        setAdmitted(true);
        setExpandMode("immersive");
      }
    }
    function handleExit(e) {
      if (e.detail?.widgetId === widgetId) {
        if (expandModeRef.current === "immersive") {
          setImmersiveClosing(true);
        } else {
          setExpandMode(null);
        }
      }
    }
    document.addEventListener("storyboard:canvas:widget-fullscreen", handleEnter);
    document.addEventListener("storyboard:canvas:widget-fullscreen-exit", handleExit);
    return () => {
      document.removeEventListener("storyboard:canvas:widget-fullscreen", handleEnter);
      document.removeEventListener("storyboard:canvas:widget-fullscreen-exit", handleExit);
    };
  }, [widgetId, setExpandMode]);
  useEffect(() => {
    const iframe2 = iframeRef.current;
    if (!iframe2) return;
    if (expanded && modalContainerRef.current) {
      iframe2._savedClassName = iframe2.className;
      iframe2._savedStyle = iframe2.getAttribute("style") || "";
      iframe2.className = styles.expandIframe;
      iframe2.removeAttribute("style");
      const target = modalContainerRef.current;
      if (lifecycleLayerRef.current) target.appendChild(lifecycleLayerRef.current);
      try {
        if (target.moveBefore) target.moveBefore(iframe2, target.firstChild);
        else target.prepend(iframe2);
      } catch {
        target.prepend(iframe2);
      }
    } else if (!expanded && inlineContainerRef.current) {
      if (iframe2._savedClassName !== void 0) {
        iframe2.className = iframe2._savedClassName;
        iframe2.setAttribute("style", iframe2._savedStyle);
        delete iframe2._savedClassName;
        delete iframe2._savedStyle;
      }
      const target = inlineContainerRef.current;
      if (lifecycleLayerRef.current) target.appendChild(lifecycleLayerRef.current);
      try {
        if (target.moveBefore) target.moveBefore(iframe2, null);
        else target.appendChild(iframe2);
      } catch {
        target.appendChild(iframe2);
      }
    }
  }, [expanded]);
  useEffect(() => {
    function handleMessage(e) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.type !== "storyboard:embed:navigate") return;
      try {
        if (e.origin !== new URL(effectiveSrc, window.location.href).origin) return;
      } catch {
        return;
      }
      if (typeof e.data.src !== "string" || !e.data.src.startsWith("/") || e.data.src.startsWith("//")) return;
      const innerSrc = normalizeLegacyEmbedSrc(e.data.src);
      const embedOrigin = getAbsoluteEmbedOrigin(src);
      const remoteBase = embedOrigin ? new URL(effectiveSrc, window.location.href).pathname.match(/^\/branch--[^/]+/)?.[0] || "" : "";
      const newSrc = embedOrigin && typeof innerSrc === "string" && innerSrc.startsWith("/") ? embedOrigin + (remoteBase && !innerSrc.startsWith(`${remoteBase}/`) ? remoteBase : "") + innerSrc : innerSrc;
      if (newSrc && newSrc !== src) {
        try {
          const capture = new URL(effectiveSrc, window.location.href);
          const route = new URL(innerSrc, capture.origin);
          const isolation = capture.pathname.includes("/prototypes.html/");
          const isolationBase = capture.pathname.split("/prototypes.html/")[0];
          capture.pathname = isolation ? `${isolationBase}/prototypes.html${route.pathname}` : `${remoteBase && !route.pathname.startsWith(`${remoteBase}/`) ? remoteBase : ""}${route.pathname}`;
          capture.search = route.search;
          capture.hash = route.hash;
          capture.searchParams.set("_sb_embed", "");
          capture.searchParams.set("_sb_hide_branch_bar", "");
          capture.searchParams.set("_sb_theme_target", "content");
          capture.searchParams.delete("sb_knobs");
          if (!capture.searchParams.has("theme")) capture.searchParams.set("_sb_canvas_theme", frameTheme);
          reportedNavigationRef.current = { authoredSrc: src, src: newSrc, captureUrl: capture.href };
        } catch {
          return;
        }
        markSnapshotDirty();
        const originalSrc = readProp(props, "originalSrc", prototypeEmbedSchema);
        const nextHasUrlTheme = Boolean(readUrlTheme(newSrc, themeRegistry));
        onUpdate?.({
          src: newSrc,
          originalSrc: originalSrc || src,
          ...nextHasUrlTheme && props?.frameThemeOverride != null ? { frameThemeOverride: null } : {}
        });
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [effectiveSrc, frameTheme, markSnapshotDirty, src, props, onUpdate, themeRegistry]);
  const chromeVars = useMemo(() => getEmbedChromeVars(), [frameTheme]);
  const handleIframeLoad = useCallback((event) => {
    const iframe2 = event.currentTarget;
    iframe2.blur();
    observeFrameLoad();
    requestFrameTheme(iframe2, effectiveSrc, frameTheme);
    captureMissingAfterLoad();
    const pending = refreshSnapshotAfterLoadRef.current;
    if (!pending || iframeRef.current !== iframe2 || src !== pending.src) return;
    const loaded = readLiveRefreshTarget(iframe2, globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/", src);
    if (loaded?.src !== pending.src) {
      refreshSnapshotAfterLoadRef.current = null;
      return;
    }
    refreshSnapshotAfterLoadRef.current = null;
    void flushSnapshot();
  }, [captureMissingAfterLoad, effectiveSrc, flushSnapshot, frameTheme, observeFrameLoad, src]);
  const enterInteractive = useCallback(() => {
    setAdmitted(true);
    setInteractive(true);
  }, [setAdmitted, setInteractive]);
  useImperativeHandle(ref, () => ({
    getIframeWindow() {
      try {
        return iframeRef.current?.contentWindow ?? null;
      } catch {
        return null;
      }
    },
    handleAction(actionId, opts) {
      if (actionId === "edit") {
        setEditing(true);
      } else if (actionId === "expand" || actionId === "expand-single") {
        setAdmitted(true);
        if (opts?.altKey) {
          setExpandMode("immersive");
        } else {
          setExpandMode("single");
        }
      } else if (actionId === "split-screen") {
        setAdmitted(true);
        setExpandMode("split");
      } else if (actionId === "open-external") {
        if (externalSrc) {
          let target = externalSrc;
          try {
            target = resolvePrototypeFrameUrl(iframeRef.current?.contentWindow?.location?.href, externalSrc) || externalSrc;
          } catch {
          }
          window.open(target, "_blank", "noopener,noreferrer");
        }
      } else if (actionId === "refresh-frame") {
        requestFrameRefresh();
      } else if (actionId === "set-frame-theme") {
        if (src) {
          const value = opts?.value ?? "inherit";
          const iframe2 = iframeRef.current;
          if (admitted && iframe2?.contentWindow) {
            try {
              const url = new URL(effectiveSrc, window.location.href);
              iframe2.contentWindow.postMessage({
                type: "storyboard:embed:set-theme",
                theme: value,
                inheritedTheme: resolveFrameTheme(null, canvasTheme, themeRegistry)
              }, url.origin);
              onUpdate?.({ frameThemeOverride: null });
            } catch {
              onUpdate?.({ src: writeUrlTheme(src, value), frameThemeOverride: null });
            }
          } else {
            onUpdate?.({ src: writeUrlTheme(src, value), frameThemeOverride: null });
          }
        }
      } else if (actionId === "zoom-in") {
        const step = zoom < 75 ? 5 : 25;
        onUpdate?.({ zoom: Math.min(200, zoom + step) });
      } else if (actionId === "zoom-out") {
        const step = zoom <= 75 ? 5 : 25;
        onUpdate?.({ zoom: Math.max(25, zoom - step) });
      }
    }
  }), [admitted, canvasTheme, effectiveSrc, externalSrc, zoom, onUpdate, themeRegistry, setExpandMode, requestFrameRefresh, src]);
  function handlePickPrototype(proto) {
    if (!proto) return;
    onUpdate?.({ src: proto.route });
    setEditing(false);
    setAdmitted(true);
    setInteractive(true);
  }
  function handleCancelEdit() {
    setEditing(false);
  }
  const handleResize = useCallback((w, h) => {
    onUpdate?.({ width: w, height: h });
  }, [onUpdate]);
  const prototypeChooser = /* @__PURE__ */ jsx(
    "div",
    {
      className: `${styles.pickerArea}${iframeSrc && editing ? ` ${styles.pickerOverlay}` : ""}`,
      onMouseDown: (e) => e.stopPropagation(),
      onPointerDown: (e) => e.stopPropagation(),
      children: /* @__PURE__ */ jsxs("div", { className: styles.picker, role: "group", "aria-label": "Choose a Prototype", onKeyDown: (e) => {
        if (e.key === "Escape") handleCancelEdit();
      }, children: [
        /* @__PURE__ */ jsxs("div", { className: styles.pickerHeading, children: [
          "Choose a Prototype",
          editing && src ? /* @__PURE__ */ jsx("button", { type: "button", className: styles.pickerClose, onClick: handleCancelEdit, "aria-label": "Close", children: "✕" }) : null
        ] }),
        pickerPrototypes.length === 0 ? /* @__PURE__ */ jsx("div", { className: styles.pickerMessage, children: "No prototypes yet" }) : null,
        pickerPrototypes.map((proto) => {
          const isSelected = proto.dirName === selectedDirName;
          return /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              "aria-label": `Use ${proto.title}`,
              "aria-pressed": isSelected,
              className: `${styles.pickerItem}${isSelected ? ` ${styles.pickerItemSelected}` : ""}`,
              onClick: (e) => {
                e.stopPropagation();
                handlePickPrototype(proto);
              },
              children: [
                /* @__PURE__ */ jsx("span", { className: styles.pickerItemTitle, children: proto.title }),
                proto.dirName !== proto.title ? /* @__PURE__ */ jsx("small", { className: styles.pickerItemName, children: proto.dirName }) : null
              ]
            },
            proto.dirName
          );
        })
      ] })
    }
  );
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs(WidgetWrapper, { children: [
      /* @__PURE__ */ jsxs(
        "div",
        {
          ref: embedRef,
          className: "hc-relative hc-overflow-hidden hc-rounded-lg hc-bg-background hc-shadow-[0_4px_16px_rgba(0,0,0,0.08)] hc-flex hc-flex-col",
          style: {
            width,
            height,
            ...chromeVars
          },
          children: [
            /* @__PURE__ */ jsxs(
              "div",
              {
                className: "hc-flex-shrink-0 hc-flex hc-items-center hc-gap-1.5 hc-px-3 hc-py-2 hc-text-xs hc-font-medium hc-whitespace-nowrap hc-overflow-hidden hc-text-ellipsis hc-select-none hc-border-b hc-border-border-muted hc-bg-background-muted hc-text-foreground-muted",
                style: { height: FRAME_HEADER_HEIGHT, boxSizing: "border-box" },
                children: [
                  /* @__PURE__ */ jsx("span", { className: "hc-inline-flex hc-flex-shrink-0", children: /* @__PURE__ */ jsx(CollageFrameIcon, { size: 16 }) }),
                  /* @__PURE__ */ jsx("span", { className: "hc-overflow-hidden hc-text-ellipsis", children: prototypeTitle })
                ]
              }
            ),
            !iframeSrc ? prototypeChooser : /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsxs(
                "div",
                {
                  ref: inlineContainerRef,
                  className: styles.iframeContainer,
                  style: expanded ? { visibility: "hidden" } : void 0,
                  children: [
                    admitted ? /* @__PURE__ */ jsx(
                      "iframe",
                      {
                        ref: attachLifecycleFrame,
                        src: mountedFrameSrc || effectiveSrc,
                        className: styles.iframe,
                        style: {
                          ...prototypeContentViewport({ width, height, zoom }),
                          transform: `scale(${scale})`,
                          transformOrigin: "0 0",
                          pointerEvents: interactive || expanded ? void 0 : "none",
                          // Match the placeholder's themed background so any
                          // brief gap during navigation (refresh or src change)
                          // never flashes the browser's default white.
                          background: "var(--hc-color-background)",
                          colorScheme: String(frameTheme).startsWith("dark") ? "dark" : "light"
                        },
                        title: `${prototypeTitle} prototype`,
                        sandbox: "allow-same-origin allow-scripts allow-forms allow-popups",
                        onLoad: handleIframeLoad,
                        onError: observeFrameError
                      },
                      siteReloadToken
                    ) : null,
                    !admitted || !lifecycleReady ? /* @__PURE__ */ jsxs("div", { className: styles.placeholder, "aria-hidden": "true", children: [
                      posterUrl ? /* @__PURE__ */ jsx("img", { className: styles.snapshotPoster, src: posterUrl, alt: "", draggable: "false" }) : /* @__PURE__ */ jsx("span", { className: styles.placeholderLabel, children: lifecycleError || (admitted ? "" : "No preview captured") }),
                      !posterUrl && frameSnapshot?.status === "error" ? /* @__PURE__ */ jsx("span", { className: styles.placeholderLabel, children: "Preview unavailable" }) : null
                    ] }) : null,
                    /* @__PURE__ */ jsxs("div", { ref: lifecycleLayerRef, className: styles.lifecycleLayer, children: [
                      lifecycleLoading ? /* @__PURE__ */ jsx("div", { className: styles.loadingIndicator, role: "status", "aria-label": "Loading Frame", children: /* @__PURE__ */ jsx("span", { className: styles.spinner }) }) : null,
                      lifecycleError ? /* @__PURE__ */ jsx("span", { className: styles.frameError, role: "status", children: lifecycleError }) : null,
                      lifecycleDebug ? /* @__PURE__ */ jsxs("span", { className: styles.lifecycleToast, "data-frame-lifecycle": lifecyclePhase, children: [
                        lifecyclePhase,
                        lifecycleElapsed === null ? "" : ` · ${lifecycleElapsed.toFixed(1)}s`
                      ] }) : null
                    ] })
                  ]
                }
              ),
              !interactive && !expanded && !lifecycleLoading && /* @__PURE__ */ jsx(
                "div",
                {
                  className: overlayStyles.interactOverlay,
                  "data-canvas-interact-gate": "true",
                  onClick: (e) => {
                    if (e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
                    enterInteractive();
                  },
                  role: "button",
                  tabIndex: 0,
                  onKeyDown: (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      enterInteractive();
                    }
                  },
                  "aria-label": "Click to interact with prototype",
                  children: /* @__PURE__ */ jsx("span", { className: overlayStyles.interactHint, children: "Click to interact" })
                }
              )
            ] }),
            iframeSrc && editing ? prototypeChooser : null
          ]
        }
      ),
      resizable && /* @__PURE__ */ jsx(ResizeHandle, { targetRef: embedRef, onResize: handleResize })
    ] }),
    refreshPrompt ? /* @__PURE__ */ jsxs(
      DialogAdapter,
      {
        title: "Frame not refreshed",
        onClose: cancelFrameRefresh,
        width: "small",
        children: [
          /* @__PURE__ */ jsx("p", { className: styles.refreshMessage, children: "The current frame URL cannot be safely refreshed. Navigate within the frame and try again." }),
          /* @__PURE__ */ jsx("div", { className: styles.refreshActions, children: /* @__PURE__ */ jsx("button", { type: "button", className: styles.refreshCancel, onClick: cancelFrameRefresh, autoFocus: true, children: "Close" }) })
        ]
      }
    ) : null,
    expanded && /* @__PURE__ */ jsx(
      PrototypeExpandPane,
      {
        widgetId,
        modalContainerRef,
        frameTheme,
        splitMode: expandMode === "split",
        immersive: expandMode === "immersive",
        closing: immersiveClosing,
        onClose: () => {
          const iframe2 = iframeRef.current;
          if (iframe2 && inlineContainerRef.current) {
            if (iframe2._savedClassName !== void 0) {
              iframe2.className = iframe2._savedClassName;
              iframe2.setAttribute("style", iframe2._savedStyle);
              delete iframe2._savedClassName;
              delete iframe2._savedStyle;
            }
            const target = inlineContainerRef.current;
            if (lifecycleLayerRef.current) target.appendChild(lifecycleLayerRef.current);
            try {
              if (target.moveBefore) target.moveBefore(iframe2, null);
              else target.appendChild(iframe2);
            } catch {
              target.appendChild(iframe2);
            }
          }
          setImmersiveClosing(false);
          setExpandMode(null);
          document.dispatchEvent(new CustomEvent("storyboard:canvas:immersive-closed", {
            detail: { widgetId }
          }));
        }
      }
    )
  ] });
});
function PrototypeExpandPane({ widgetId, modalContainerRef, frameTheme, splitMode, immersive, closing, onClose }) {
  const connectedWidgets = useMemo(
    () => splitMode ? findAllConnectedSplitTargets(widgetId) : [],
    [widgetId, splitMode]
  );
  const primaryWidget = useMemo(() => {
    const bridge = window.__storyboardCanvasBridgeState;
    return bridge?.widgets?.find((w) => w.id === widgetId) || { id: widgetId, type: "prototype", position: { x: 0, y: 0 }, props: {} };
  }, [widgetId]);
  const buildPaneFn = useCallback((widget) => {
    if (widget.id === widgetId) {
      return {
        id: widgetId,
        label: getSplitPaneLabel(primaryWidget),
        widgetType: "prototype",
        kind: "external",
        attach: (container) => {
          modalContainerRef.current = container;
          return () => {
            modalContainerRef.current = null;
          };
        }
      };
    }
    return buildPaneForWidget(widget, "splitbar", frameTheme);
  }, [widgetId, primaryWidget, modalContainerRef, frameTheme]);
  const layout = useMemo(
    () => buildSplitLayout(primaryWidget, connectedWidgets, buildPaneFn),
    [primaryWidget, connectedWidgets, buildPaneFn]
  );
  const variant = immersive ? "immersive" : layout.flat().length <= 1 ? "modal" : "full";
  return /* @__PURE__ */ jsx(
    ExpandedPane,
    {
      ownerId: widgetId,
      initialLayout: layout,
      variant,
      closing: immersive ? closing : false,
      onClose
    }
  );
}
export {
  PrototypeEmbed as default,
  getAbsoluteEmbedOrigin,
  isLocalDevEmbedUrl
};
