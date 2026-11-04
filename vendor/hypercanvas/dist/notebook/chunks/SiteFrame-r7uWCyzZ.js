import { jsxs, jsx } from "react/jsx-runtime";
import { useFeatureFlag } from "../useFeatureFlag.js";
import { u as useCanvasFrameTheme, b as useFrameSnapshot, c as useFrameSnapshotLifecycle, a as useObservedFrameLifecycle } from "./useCanvasFrameTheme-D4Yco8Ax.js";
import { a as useGuardedExpandOverride } from "./useExpandOverride-CWRcTp1O.js";
import { forwardRef, useMemo, useState, useRef, useEffect, useCallback, useImperativeHandle } from "react";
import { c as sitePreviewPath, a as normalizeSiteRoute, s as siteRouteFromPreviewUrl } from "./contract-Tm25L5gq.js";
import { o as observeSiteFrameRoute, n as siteViewerPath, E as ExpandedPane } from "./Document-DbLUnVhy.js";
import { r as resolveFrameTheme, a as resolveBasePathAsset } from "./basePathAsset-Bs6UgtNi.js";
import { getConfig } from "../core-2.js";
import { W as WidgetWrapper } from "./WidgetWrapper-Clt_WBi9.js";
import { u as useOverride } from "./useOverride-CmpCccmF.js";
import { f as findAllConnectedSplitTargets, a as buildSplitLayout, b as buildPaneForWidget } from "./MarkdownBlock-DRLSDL1g.js";
import { R as ResizeHandle } from "./ResizeHandle-Dj9zO6GI.js";
import { I as Icon } from "./Icon-CY9OeunJ.js";
import { c as Alert } from "./alert-BjgVTE5o.js";
function hasProdModeParam() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("prodMode");
}
function isLocalDev() {
  if (typeof window === "undefined") return false;
  if (hasProdModeParam()) return false;
  return window.__SB_LOCAL_DEV__ === true;
}
const RETRY_DELAYS_MS = [1e3, 6e3];
const inFlight = /* @__PURE__ */ new Map();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function attempt(base, siteId) {
  const read = await fetch(`${base}/_hypercanvas/frame-snapshot/document?${new URLSearchParams({ kind: "site", id: siteId })}`);
  if (!read.ok) return false;
  const { generation, document: document2 } = await read.json();
  if (!generation || !document2) return false;
  if (document2.allThemesMatch) return true;
  const capture = await fetch(`${base}/_hypercanvas/frame-snapshot/capture-document`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "site", id: siteId, sourceKey: document2.sourceKey, generation })
  });
  return capture.ok;
}
function captureSiteHomeOnStart(siteId, basePath = "/") {
  if (typeof siteId !== "string" || !siteId || typeof window === "undefined") return Promise.resolve();
  const w = window;
  if (w.__hypercanvasFrameCapture === true || window.parent !== window || w.__HYPERCANVAS_NOTEBOOK_PUBLICATION__ != null) return Promise.resolve();
  const existing = inFlight.get(siteId);
  if (existing) return existing;
  const base = basePath.replace(/\/$/, "");
  const run = (async () => {
    for (let index = 0; index <= RETRY_DELAYS_MS.length; index++) {
      await wait(RETRY_DELAYS_MS[index] ?? 0);
      try {
        if (await attempt(base, siteId)) return;
      } catch {
      }
    }
  })().finally(() => inFlight.delete(siteId));
  inFlight.set(siteId, run);
  return run;
}
function notifySiteStarted(siteId, developmentBaseUrl = null) {
  if (!siteId || typeof document === "undefined") return;
  document.dispatchEvent(new CustomEvent("storyboard:site-started", { detail: { siteId, developmentBaseUrl } }));
  document.dispatchEvent(new CustomEvent("storyboard:sites-changed"));
  void captureSiteHomeOnStart(siteId, globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/");
}
const FRAME_DEVICE_PRESETS = Object.freeze({
  desktop: Object.freeze({ label: "Desktop", width: 800, height: 600 }),
  mobile: Object.freeze({ label: "Mobile", width: 390, height: 844 })
});
function resolveFrameDevicePreset(device) {
  if (typeof device !== "string") return null;
  const key = device.toLowerCase();
  return Object.prototype.hasOwnProperty.call(FRAME_DEVICE_PRESETS, key) ? FRAME_DEVICE_PRESETS[key] : null;
}
const THEME_FRAME_TYPES = /* @__PURE__ */ new Set(["prototype", "component", "story", "component-set"]);
const DEVICE_FRAME_TYPES = /* @__PURE__ */ new Set(["prototype", "site-frame"]);
function getFrameActionUpdates(widgetType, action, options = {}, props = {}, supportedThemes = {}) {
  if (action === "set-frame-theme") {
    if (!THEME_FRAME_TYPES.has(widgetType)) return null;
    if (options.value !== "inherit" && (typeof options.value !== "string" || !Object.prototype.hasOwnProperty.call(supportedThemes, options.value))) return null;
    const params = new URLSearchParams(props.search || "");
    if (["story", "component-set"].includes(widgetType) && params.has("theme")) {
      if (options.value === "inherit") params.delete("theme");
      else params.set("theme", options.value);
      const search = params.toString();
      return { frameThemeOverride: null, search: search ? `?${search}` : "" };
    }
    return { frameThemeOverride: options.value === "inherit" ? null : options.value };
  }
  if (action === "set-frame-device") {
    if (!DEVICE_FRAME_TYPES.has(widgetType)) return null;
    const preset = resolveFrameDevicePreset(options.value);
    if (!preset) return null;
    const updates = { frameDevice: options.value.toLowerCase(), width: preset.width };
    if (props.frameClipHeight === true) updates.height = preset.height;
    return updates;
  }
  if (action === "set-frame-clip-height") {
    if (!DEVICE_FRAME_TYPES.has(widgetType) || typeof options.value !== "boolean") return null;
    const updates = { frameClipHeight: options.value };
    if (options.value) {
      const preset = resolveFrameDevicePreset(props.frameDevice || "desktop");
      if (preset) updates.height = preset.height;
    }
    return updates;
  }
  return null;
}
const root = "_root_1qeo4_1";
const header = "_header_1qeo4_3";
const headerIcon = "_headerIcon_1qeo4_4";
const title = "_title_1qeo4_5";
const route = "_route_1qeo4_6";
const viewport = "_viewport_1qeo4_7";
const snapshot = "_snapshot_1qeo4_8";
const empty = "_empty_1qeo4_15";
const pending = "_pending_1qeo4_16";
const status = "_status_1qeo4_17";
const snapshotLink = "_snapshotLink_1qeo4_18";
const publishedLink = "_publishedLink_1qeo4_20";
const sitePickerArea = "_sitePickerArea_1qeo4_21";
const sitePicker = "_sitePicker_1qeo4_21";
const sitePickerHeading = "_sitePickerHeading_1qeo4_23";
const sitePickerItem = "_sitePickerItem_1qeo4_24";
const sitePickerMessage = "_sitePickerMessage_1qeo4_27";
const lifecycleToast = "_lifecycleToast_1qeo4_39";
const loadingIndicator = "_loadingIndicator_1qeo4_40";
const spinner = "_spinner_1qeo4_41";
const styles = {
  root,
  header,
  headerIcon,
  title,
  route,
  viewport,
  snapshot,
  empty,
  pending,
  status,
  snapshotLink,
  publishedLink,
  sitePickerArea,
  sitePicker,
  sitePickerHeading,
  sitePickerItem,
  sitePickerMessage,
  lifecycleToast,
  loadingIndicator,
  spinner
};
const DEFAULT_SIZE = { width: 800, height: 600 };
const START_TIMEOUT_MS = 3e4;
function publishedAssetUrl(file) {
  const base = globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/";
  return (base.endsWith("/") ? base : base + "/") + String(file || "").replace(/^\/+/, "");
}
function publishedDescriptor(widgetId, siteId, route2) {
  const pages = window.__HYPERCANVAS_NOTEBOOK_PUBLICATION__?.pages;
  if (!Array.isArray(pages)) return null;
  const base = new URL(globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/", window.location.origin).pathname.replace(/\/+$/, "");
  const currentPath = window.location.pathname.startsWith(base + "/") ? window.location.pathname.slice(base.length) : window.location.pathname;
  const current = currentPath.replace(/\/+$/, "") || "/";
  const page = pages.filter((item) => {
    if (!item?.route) return false;
    const pageRoute = String(item.route).replace(/\/+$/, "") || "/";
    return current === pageRoute || pageRoute !== "/" && current.startsWith(pageRoute + "/");
  }).sort((left, right) => String(right.route || "").length - String(left.route || "").length)[0];
  const frames = page?.siteFrames;
  if (!frames || typeof frames !== "object") return null;
  return frames[widgetId] || Object.values(frames).find((item) => item?.siteId === siteId && (item?.route || "") === route2) || null;
}
const SiteFrame = forwardRef(function SiteFrame2({ id: widgetId, canvasId, props: widgetProps, selected = false, onUpdate, resizable }, ref) {
  const props = widgetProps || {};
  const frameActionProps = useMemo(() => ({
    frameDevice: props.frameDevice,
    frameClipHeight: props.frameClipHeight,
    height: props.height
  }), [props.frameDevice, props.frameClipHeight, props.height]);
  const siteId = typeof props.siteId === "string" ? props.siteId : "";
  const route2 = typeof props.route === "string" ? props.route : "";
  const width = positive(props.width, DEFAULT_SIZE.width);
  const height = positive(props.height, DEFAULT_SIZE.height);
  const manualSnapshot = typeof props.snapshot === "string" && props.snapshot ? props.snapshot : "";
  const manualSnapshotDark = typeof props.snapshotDark === "string" && props.snapshotDark ? props.snapshotDark : "";
  const published = typeof window === "undefined" || window.__SB_LOCAL_DEV__ !== true;
  const exportedFrame = published ? publishedDescriptor(widgetId, siteId, route2) : null;
  const [error, setError] = useState("");
  const [siteList, setSiteList] = useState(null);
  const [admitted, setAdmitted] = useState(false);
  const [startingSite, setStartingSite] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const frameRef = useRef(null);
  const rootRef = useRef(null);
  const viewportRef = useRef(null);
  const [expandOverrideRaw, setExpandOverride, clearExpandOverride] = useOverride(`_site_expanded_${widgetId}`);
  const expandOverride = useGuardedExpandOverride(widgetId, expandOverrideRaw, setExpandOverride, clearExpandOverride);
  const expandMode = ["single", "split", "immersive"].includes(expandOverride) ? expandOverride : null;
  const frameRouteCleanup = useRef(null);
  const routeRef = useRef(route2);
  const observedSrc = useRef(null);
  const [interacting, setInteracting] = useState(false);
  const { theme: inheritedTheme, systemDark } = useCanvasFrameTheme();
  const themes = getConfig("theming")?.themes || { light: {}, dark: {} };
  const urlTheme = new URL(route2 || "/", window.location.origin).searchParams.get("theme");
  const frameTheme = urlTheme === "system" ? systemDark ? "dark" : "light" : ["light", "dark"].includes(urlTheme) ? urlTheme : resolveFrameTheme(urlTheme || props.frameThemeOverride, inheritedTheme, themes);
  const snapshotTarget = useMemo(() => siteId && !published ? { kind: "site", siteId, route: route2, width, height } : null, [height, published, route2, siteId, width]);
  const { snapshot: frameSnapshot, reload: reloadSnapshot } = useFrameSnapshot({
    target: snapshotTarget,
    theme: frameTheme,
    captureTheme: frameTheme,
    widgetId,
    canvasId,
    // Initial canvas open is read-only. Settled edits and interaction-end
    // refresh through the shared coalescer, never on every navigation/render.
    autoCapture: false
  });
  const generatedPoster = frameSnapshot?.variants?.[frameTheme]?.dataUrl || frameSnapshot?.light?.dataUrl || frameSnapshot?.dark?.dataUrl || "";
  const generatedPosterDark = (String(frameTheme).startsWith("dark") ? frameSnapshot?.variants?.[frameTheme]?.dataUrl : "") || frameSnapshot?.dark?.dataUrl || "";
  const variantPoster = exportedFrame?.snapshotVariants?.[frameTheme] || props.snapshotVariants?.[frameTheme];
  const poster = published && variantPoster ? publishedAssetUrl(variantPoster) : published && exportedFrame?.snapshot ? publishedAssetUrl(exportedFrame.snapshot) : published ? resolveBasePathAsset(manualSnapshot, globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/") : manualSnapshot || manualSnapshotDark || generatedPoster;
  const posterDark = published && exportedFrame?.snapshotDark ? publishedAssetUrl(exportedFrame.snapshotDark) : published ? resolveBasePathAsset(manualSnapshotDark, globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/") : manualSnapshotDark || (manualSnapshot ? "" : generatedPosterDark);
  const frameSrc = useMemo(() => siteId && !published ? sitePreviewPath(globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/", siteId, normalizeSiteRoute(route2)) : "", [published, route2, siteId]);
  const [mountedSrc, setMountedSrc] = useState(frameSrc);
  useEffect(() => {
    if (observedSrc.current === frameSrc) return;
    if (mountedSrc !== frameSrc) {
      setMountedSrc(frameSrc);
      setLoadedSrc(null);
    }
  }, [frameSrc, mountedSrc]);
  const currentSnapshotTarget = useCallback(() => {
    let latestRoute = routeRef.current;
    try {
      const href = frameRef.current?.contentWindow?.location?.href;
      const live = href && siteRouteFromPreviewUrl(href, siteId, {
        basePath: globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/",
        origin: window.location.origin
      });
      if (typeof live === "string") latestRoute = live;
    } catch {
    }
    if (latestRoute !== routeRef.current) {
      routeRef.current = latestRoute;
      onUpdate?.({ route: latestRoute });
    }
    return snapshotTarget ? { ...snapshotTarget, route: latestRoute } : null;
  }, [onUpdate, siteId, snapshotTarget]);
  const { markDirty: markSnapshotDirty, flush: flushSnapshot, onLoad: captureMissingAfterLoad, prepareRefresh } = useFrameSnapshotLifecycle({
    target: snapshotTarget,
    theme: frameTheme,
    snapshotReady: Boolean(frameSnapshot?.generation),
    enabled: admitted && !published && !manualSnapshot && !manualSnapshotDark,
    interactive: interacting || Boolean(expandMode),
    rootRef,
    iframeRef: frameRef,
    reload: reloadSnapshot,
    getCurrentTarget: currentSnapshotTarget,
    onInteractionEnd: () => setInteracting(false)
  });
  const openUrl = published ? exportedFrame?.openUrl || (typeof props.openUrl === "string" ? props.openUrl : "") : "";
  const descriptorError = frameSnapshot?.status === "error" ? frameSnapshot.error?.message || "Preview unavailable" : "";
  const publishedError = exportedFrame?.available === false ? exportedFrame.diagnostics?.[0]?.message || "Site Frame unavailable" : "";
  const shownError = error || publishedError || descriptorError;
  const lifecycleDebug = useFeatureFlag("frame-lifecycle-overlay") && !published;
  const lifecycle = useObservedFrameLifecycle({
    iframeRef: frameRef,
    source: mountedSrc,
    debug: lifecycleDebug,
    interactive: interacting || Boolean(expandMode),
    starting: startingSite,
    error,
    onReady: () => {
      setLoadedSrc(frameSrc);
      captureMissingAfterLoad();
    }
  });
  const missingPreview = !poster && !shownError && Boolean(siteId) && frameSnapshot?.status === "missing";
  const stalePreview = !manualSnapshot && frameSnapshot?.stale === true;
  useEffect(() => {
    if (siteId || published) return void 0;
    let active = true;
    const loadSites = async () => {
      try {
        const base = (globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/").replace(/\/$/, "");
        const response = await fetch(`${base}/_hypercanvas/site/list`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || "Could not load Sites");
        if (!active) return;
        setSiteList({
          sites: Array.isArray(data?.sites) ? data.sites.filter((site) => typeof site?.id === "string" && site.id) : [],
          error: ""
        });
      } catch (cause) {
        if (active) setSiteList({ sites: [], error: cause?.message || "Could not load Sites" });
      }
    };
    void loadSites();
    document.addEventListener("storyboard:sites-changed", loadSites);
    return () => {
      active = false;
      document.removeEventListener("storyboard:sites-changed", loadSites);
    };
  }, [published, siteId]);
  useEffect(() => {
    routeRef.current = route2;
  }, [route2]);
  const captureNow = useCallback(() => {
    if (published || manualSnapshot || manualSnapshotDark) return;
    setCapturing(true);
    if (!admitted) {
      void reloadSnapshot({ capture: true, force: true, target: currentSnapshotTarget() }).finally(() => setCapturing(false));
      return;
    }
    markSnapshotDirty();
    void Promise.resolve(flushSnapshot()).finally(() => setCapturing(false));
  }, [admitted, currentSnapshotTarget, reloadSnapshot, flushSnapshot, manualSnapshot, manualSnapshotDark, markSnapshotDirty, published]);
  const handleFrameLoad = useCallback(() => {
    captureMissingAfterLoad();
    frameRouteCleanup.current?.();
    frameRouteCleanup.current = observeSiteFrameRoute(frameRef.current, {
      siteId,
      basePath: globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/",
      onRouteChange: (nextRoute) => {
        if (nextRoute === routeRef.current) return;
        routeRef.current = nextRoute;
        observedSrc.current = sitePreviewPath(globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/", siteId, normalizeSiteRoute(nextRoute));
        markSnapshotDirty();
        onUpdate?.({ route: nextRoute });
      }
    });
  }, [captureMissingAfterLoad, markSnapshotDirty, onUpdate, siteId]);
  useEffect(() => () => frameRouteCleanup.current?.(), []);
  useEffect(() => {
    const started = (event) => {
      if (event.detail?.siteId !== siteId) return;
      if (!admitted) return;
      setError("");
      setLoadedSrc(null);
      setReloadToken((token) => token + 1);
    };
    document.addEventListener("storyboard:site-started", started);
    return () => document.removeEventListener("storyboard:site-started", started);
  }, [admitted, siteId]);
  const ensureSiteRunning = useCallback(() => {
    if (!siteId) return;
    const base = (globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/").replace(/\/$/, "");
    void (async () => {
      try {
        const statusResponse = await fetch(`${base}/_hypercanvas/site/${encodeURIComponent(siteId)}/status`);
        const { binding } = await statusResponse.json().catch(() => ({}));
        const startable = binding?.source === "managed" && Boolean(binding?.startCommand) && ["stopped", "error"].includes(binding?.status);
        if (!startable) return;
        setStartingSite(true);
        const response = await fetch(`${base}/_hypercanvas/site/${encodeURIComponent(siteId)}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmed: true, timeoutMs: START_TIMEOUT_MS })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || "Could not start Site");
        notifySiteStarted(siteId, data?.binding?.developmentBaseUrl);
      } catch (cause) {
        setError(cause?.message || "Could not start Site");
      } finally {
        setStartingSite(false);
      }
    })();
  }, [siteId]);
  const attachExpandedPane = useCallback((container) => {
    const viewport2 = viewportRef.current;
    if (!viewport2 || !container) return void 0;
    setAdmitted(true);
    ensureSiteRunning();
    const parent = viewport2.parentElement;
    const nextSibling = viewport2.nextSibling;
    const originalStyle = viewport2.getAttribute("style");
    container.appendChild(viewport2);
    viewport2.style.width = "100%";
    viewport2.style.height = "100%";
    return () => {
      if (nextSibling?.parentNode === parent) parent.insertBefore(viewport2, nextSibling);
      else parent?.appendChild(viewport2);
      if (originalStyle === null) viewport2.removeAttribute("style");
      else viewport2.setAttribute("style", originalStyle);
    };
  }, [ensureSiteRunning]);
  useImperativeHandle(ref, () => ({
    attachExpandedPane,
    handleAction(actionId, opts) {
      const frameUpdates = getFrameActionUpdates("site-frame", actionId, opts, frameActionProps);
      if (frameUpdates) {
        onUpdate?.(frameUpdates);
        return true;
      }
      if (actionId === "expand" || actionId === "expand-single" || actionId === "split-screen") {
        if (published || !siteId) return true;
        setAdmitted(true);
        setExpandOverride(actionId === "split-screen" ? "split" : opts?.altKey ? "immersive" : "single");
        return true;
      }
      if (actionId === "open-external" && siteId) {
        if (openUrl) window.open(openUrl, "_blank", "noopener,noreferrer");
        else window.open(siteViewerPath(globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/", siteId, route2), "_blank", "noopener,noreferrer");
      } else if (actionId === "refresh-frame") {
        if (admitted) prepareRefresh();
        else captureNow();
        setLoadedSrc(null);
        setReloadToken((token) => token + 1);
      } else if (actionId === "recapture-preview") {
        if (published || !siteId) return true;
        captureNow();
      } else return false;
    }
  }), [admitted, attachExpandedPane, captureNow, frameActionProps, onUpdate, openUrl, prepareRefresh, published, route2, setExpandOverride, siteId]);
  const expandedLayout = useMemo(() => {
    if (!expandMode || published) return null;
    const primary = window.__storyboardCanvasBridgeState?.widgets?.find((widget) => widget.id === widgetId) || { id: widgetId, type: "site-frame", props: { siteId, route: route2, title: props.title } };
    const connected = expandMode === "split" ? findAllConnectedSplitTargets(widgetId) : [];
    return buildSplitLayout(primary, connected, (widget) => {
      const pane = buildPaneForWidget(widget);
      return widget.id === widgetId ? { ...pane, attach: attachExpandedPane } : pane;
    });
  }, [attachExpandedPane, expandMode, props.title, published, route2, siteId, widgetId]);
  useEffect(() => {
    if (!isLocalDev()) return void 0;
    const activated = (event) => {
      if (event.detail?.widgetType !== "site-frame" || event.detail?.widgetId !== widgetId) return;
      setAdmitted(true);
      setInteracting(true);
      ensureSiteRunning();
    };
    document.addEventListener("storyboard:interact-gate-activated", activated);
    return () => document.removeEventListener("storyboard:interact-gate-activated", activated);
  }, [ensureSiteRunning, widgetId]);
  const posterNode = poster ? /* @__PURE__ */ jsxs("picture", { children: [
    published && posterDark && !variantPoster ? /* @__PURE__ */ jsx("source", { media: "(prefers-color-scheme: dark)", srcSet: posterDark }) : null,
    /* @__PURE__ */ jsx("img", { className: styles.snapshot, src: !published && String(frameTheme).startsWith("dark") ? posterDark || poster : poster, alt: "" })
  ] }) : null;
  return /* @__PURE__ */ jsxs(WidgetWrapper, { children: [
    /* @__PURE__ */ jsxs("section", { ref: rootRef, className: styles.root, style: { width, height }, "data-selected": selected || void 0, "data-testid": "site-frame", children: [
      /* @__PURE__ */ jsxs("header", { className: styles.header, children: [
        /* @__PURE__ */ jsx("span", { className: styles.headerIcon, children: /* @__PURE__ */ jsx(Icon, { name: "iconoir/globe", size: 16 }) }),
        /* @__PURE__ */ jsx("span", { className: styles.title, children: props.title || siteId || "Site" }),
        /* @__PURE__ */ jsx("span", { className: styles.route, children: route2 || "/" })
      ] }),
      !siteId ? published ? /* @__PURE__ */ jsx("div", { className: styles.empty, children: "Select a Site" }) : /* @__PURE__ */ jsx("div", { className: styles.sitePickerArea, children: /* @__PURE__ */ jsxs("div", { className: styles.sitePicker, role: "group", "aria-label": "Choose a Site", children: [
        /* @__PURE__ */ jsx("div", { className: styles.sitePickerHeading, children: "Choose a Site" }),
        siteList === null ? /* @__PURE__ */ jsx("div", { className: styles.sitePickerMessage, role: "status", children: "Loading Sites…" }) : null,
        siteList?.error ? /* @__PURE__ */ jsx(Alert, { unstyled: true, className: styles.sitePickerMessage, diagnostic: { source: "site-error", reason: "site-load-failed" }, children: siteList.error }) : null,
        siteList && !siteList.error && siteList.sites.length === 0 ? /* @__PURE__ */ jsx("div", { className: styles.sitePickerMessage, children: "No Sites available" }) : null,
        siteList?.sites.map((site) => {
          const title2 = typeof site.title === "string" && site.title.trim() ? site.title : site.id;
          return /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              "aria-label": `Use ${title2}`,
              className: styles.sitePickerItem,
              onMouseDown: (event) => event.stopPropagation(),
              onPointerDown: (event) => event.stopPropagation(),
              onClick: (event) => {
                event.stopPropagation();
                onUpdate?.({ siteId: site.id, title: title2, route: "" });
              },
              children: [
                /* @__PURE__ */ jsx("span", { children: title2 }),
                title2 !== site.id ? /* @__PURE__ */ jsx("small", { children: site.id }) : null
              ]
            },
            site.id
          );
        })
      ] }) }) : published ? poster && openUrl ? /* @__PURE__ */ jsx("a", { className: styles.snapshotLink, href: openUrl, target: "_blank", rel: "noopener noreferrer", title: props.title || siteId, children: posterNode }) : poster ? posterNode : openUrl ? /* @__PURE__ */ jsx("a", { className: styles.publishedLink, href: openUrl, target: "_blank", rel: "noopener noreferrer", children: "Open production site" }) : shownError ? /* @__PURE__ */ jsx(Alert, { unstyled: true, className: styles.empty, diagnostic: { source: "site-error", reason: "site-load-failed" }, children: shownError }) : /* @__PURE__ */ jsx("div", { className: styles.empty, children: "Preview unavailable" }) : /* @__PURE__ */ jsxs("div", { ref: viewportRef, className: styles.viewport, children: [
        posterNode && (!admitted || loadedSrc === null || startingSite) ? posterNode : null,
        startingSite ? /* @__PURE__ */ jsx("div", { className: styles.pending, children: "Starting site…" }) : null,
        admitted && frameSrc && !startingSite ? /* @__PURE__ */ jsx("iframe", { ref: lifecycle.attach, title: props.title || siteId, src: mountedSrc || frameSrc, style: { colorScheme: String(frameTheme).startsWith("dark") ? "dark" : "light" }, onLoad: (event) => {
          event.target.blur();
          lifecycle.onLoad();
          handleFrameLoad();
        }, onError: lifecycle.onError }, reloadToken) : null,
        lifecycle.loading ? /* @__PURE__ */ jsx("div", { className: styles.loadingIndicator, role: "status", "aria-label": "Loading Frame", children: /* @__PURE__ */ jsx("span", { className: styles.spinner }) }) : null,
        lifecycleDebug ? /* @__PURE__ */ jsxs("span", { className: styles.lifecycleToast, "data-frame-lifecycle": lifecycle.phase, children: [
          lifecycle.phase,
          lifecycle.elapsed === null ? "" : ` · ${lifecycle.elapsed.toFixed(1)}s`
        ] }) : null,
        lifecycle.error && !error ? /* @__PURE__ */ jsx(Alert, { unstyled: true, className: styles.status, diagnostic: { source: "site-error", reason: "site-load-failed" }, children: lifecycle.error }) : null,
        shownError && !startingSite && !poster ? /* @__PURE__ */ jsx(Alert, { unstyled: true, className: styles.empty, diagnostic: { source: "site-error", reason: "site-load-failed" }, children: shownError }) : null,
        shownError && !startingSite && poster ? /* @__PURE__ */ jsx(Alert, { unstyled: true, className: styles.status, diagnostic: { source: "site-error", reason: "site-load-failed" }, children: shownError }) : null,
        missingPreview && !startingSite && !admitted && capturing ? /* @__PURE__ */ jsx("div", { className: styles.pending, children: "Capturing preview…" }) : null,
        missingPreview && !startingSite && admitted && capturing ? /* @__PURE__ */ jsx("span", { className: styles.status, children: "Capturing preview…" }) : null,
        missingPreview && !startingSite && !admitted && !capturing ? /* @__PURE__ */ jsx("div", { className: styles.pending, children: "No preview captured" }) : null,
        stalePreview && admitted ? /* @__PURE__ */ jsx("span", { className: styles.status, children: "Preview may be out of date" }) : null
      ] })
    ] }),
    expandedLayout && /* @__PURE__ */ jsx(ExpandedPane, { ownerId: widgetId, initialLayout: expandedLayout, variant: expandMode === "immersive" ? "immersive" : "full", onClose: clearExpandOverride }),
    resizable && /* @__PURE__ */ jsx(ResizeHandle, { targetRef: rootRef, onResize: (w, h) => onUpdate?.({ width: w, height: h }) })
  ] });
});
function positive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
export {
  SiteFrame as default
};
