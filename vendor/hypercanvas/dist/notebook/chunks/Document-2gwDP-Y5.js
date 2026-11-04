import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { lazy, useSyncExternalStore, useId, useRef, useState, useLayoutEffect, Suspense, createElement, Component, useCallback, useMemo, createContext, useContext, useEffect } from "react";
import { UNSAFE_NavigationContext } from "react-router-dom";
import { c as createLucideIcon, b as createLucideIcon$1, B as Button } from "./createLucideIcon-CV-5aOV3.js";
import { getStoryData } from "../core-0.js";
import { n as normalizeSiteId, a as normalizeSiteRoute, s as siteRouteFromPreviewUrl, g as getPrimerIconComponent, f as feather } from "./primerIcons-Di4IYwoZ.js";
import { a as getWidgetDefinition, s as subscribeToWidgetRegistry, g as getWidgetRegistrySnapshot } from "./_commonjsHelpers-CXnYerf6.js";
import { w as widgetTypesSnapshot, g as getWidgetMeta } from "./widgetConfig-DkrqwrI0.js";
import { createPortal, flushSync } from "react-dom";
import { a as acquireIframePointerLock } from "./iframePointerLock-CuQbsxGb.js";
const __iconData$2 = {
  name: "copy",
  size: 24,
  node: [
    ["rect", { width: "14", height: "14", x: "8", y: "8", rx: "2", ry: "2", key: "17jyea" }],
    ["path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2", key: "zix9uf" }]
  ]
};
__iconData$2.node;
const Copy = createLucideIcon(__iconData$2);
const __iconData$1 = {
  name: "external-link",
  size: 24,
  node: [
    ["path", { d: "M15 3h6v6", key: "1q9fwt" }],
    ["path", { d: "M10 14 21 3", key: "gplh6r" }],
    ["path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6", key: "a6xqqp" }]
  ]
};
__iconData$1.node;
const ExternalLink = createLucideIcon(__iconData$1);
const __iconData = {
  name: "maximize-2",
  size: 24,
  node: [
    ["path", { d: "M15 3h6v6", key: "1q9fwt" }],
    ["path", { d: "m21 3-7 7", key: "1l2asr" }],
    ["path", { d: "m3 21 7-7", key: "tjx5ai" }],
    ["path", { d: "M9 21H3v-6", key: "wtvkvv" }]
  ]
};
__iconData.node;
const Maximize2 = createLucideIcon(__iconData);
function embedRoutePath(value) {
  if (typeof value !== "string") return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    try {
      const parsed = new URL(value);
      return `${parsed.pathname}${parsed.hash}` || "";
    } catch {
      return "";
    }
  }
  return value.replace(/^\/branch--[^/]+/, "").split("?")[0].split("#")[0] || "";
}
function stripEmbedRoute(value) {
  return typeof value === "string" ? value.replace(/^\/branch--[^/]+/, "") : "";
}
function resolvePrototypeFrameUrl(currentUrl, fallbackUrl) {
  try {
    const current = new URL(currentUrl);
    const fallback2 = new URL(fallbackUrl, current);
    if (current.origin !== fallback2.origin) return fallback2.toString();
    const marker = "/prototypes.html";
    const entryIndex = current.pathname.indexOf(`${marker}/`);
    if (entryIndex >= 0) current.pathname = current.pathname.slice(0, entryIndex) + current.pathname.slice(entryIndex + marker.length);
    for (const key of GENERATED_FRAME_PARAMS) current.searchParams.delete(key);
    return current.toString();
  } catch {
    return fallbackUrl || "";
  }
}
const GENERATED_FRAME_PARAMS = /* @__PURE__ */ new Set([
  "_sb_embed",
  "_sb_component_view",
  "_sb_hide_branch_bar",
  "_sb_theme_target",
  "_sb_canvas_theme",
  "sb_knobs"
]);
function samePrototypeFrameLocation(currentUrl, authoredUrl, baseUrl = "http://localhost/") {
  try {
    const current = new URL(currentUrl, baseUrl);
    const authored = new URL(authoredUrl, baseUrl);
    const normalizePath = (pathname) => pathname.replace("/prototypes.html/", "/");
    for (const key of GENERATED_FRAME_PARAMS) {
      current.searchParams.delete(key);
      authored.searchParams.delete(key);
    }
    current.searchParams.sort();
    authored.searchParams.sort();
    return current.origin === authored.origin && normalizePath(current.pathname) === normalizePath(authored.pathname) && current.search === authored.search && current.hash === authored.hash;
  } catch {
    return false;
  }
}
function resolveLivePrototypeRefreshTarget(currentUrl, {
  expectedOrigin,
  basePath = "/",
  development = false,
  authoredSrc = ""
} = {}) {
  try {
    const current = new URL(currentUrl);
    const expected = new URL(expectedOrigin);
    if (!/^https?:$/.test(current.protocol) || !/^https?:$/.test(expected.protocol)) return null;
    if (current.origin !== expected.origin || current.username || current.password) return null;
    if (expected.username || expected.password) return null;
    const authoredIsAbsolute = /^[a-z][a-z0-9+.-]*:/i.test(authoredSrc);
    const authored = authoredSrc ? new URL(authoredSrc, expected) : null;
    if (authoredIsAbsolute && (!/^https?:$/.test(authored.protocol) || authored.origin !== expected.origin || authored.username || authored.password)) return null;
    const authoredDirectHtml = Boolean(authoredIsAbsolute && /\.html$/i.test(authored.pathname));
    if (authoredDirectHtml) {
      if (current.pathname !== authored.pathname) return null;
      return { frameUrl: current.href, src: current.href, sourceKind: "direct-html" };
    }
    if (typeof basePath !== "string" || !basePath.startsWith("/") || /[?#]/.test(basePath)) return null;
    const normalizedBase = basePath.endsWith("/") ? basePath : `${basePath}/`;
    if (!current.pathname.startsWith(normalizedBase)) return null;
    const pathWithinBase = current.pathname.slice(normalizedBase.length);
    let routePath = pathWithinBase;
    if (development) {
      const isolationEntry = "prototypes.html/";
      if (pathWithinBase.startsWith(isolationEntry)) {
        routePath = pathWithinBase.slice(isolationEntry.length);
      } else {
        if (!authored || authored.origin !== expected.origin) return null;
        const authoredPath = authored.pathname.startsWith(normalizedBase) ? authored.pathname.slice(normalizedBase.length) : authored.pathname.replace(/^\/branch--[^/]+\//, "");
        if (pathWithinBase !== authoredPath && !pathWithinBase.startsWith(`${authoredPath}/`)) return null;
        routePath = pathWithinBase;
      }
    }
    if (!routePath || routePath === "/") return null;
    const retainedSearch = current.search ? current.search.slice(1).split("&").filter((part) => {
      const rawKey = part.split("=", 1)[0];
      let key;
      try {
        key = decodeURIComponent(rawKey.replace(/\+/g, " "));
      } catch {
        return false;
      }
      return !GENERATED_FRAME_PARAMS.has(key);
    }).join("&") : "";
    return {
      frameUrl: current.href,
      src: `/${routePath}${retainedSearch ? `?${retainedSearch}` : ""}${current.hash}`,
      sourceKind: "isolated-route"
    };
  } catch {
    return null;
  }
}
function formatName(name) {
  return String(name).replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function buildPrototypePickerEntries(index) {
  const idx = index || {};
  const seen = /* @__PURE__ */ new Map();
  const collect = (proto) => {
    if (!proto || proto.isExternal || !proto.dirName || seen.has(proto.dirName)) return;
    const flows = (proto.flows || []).map((flow) => ({
      name: flow.meta?.title || formatName(flow.name || proto.dirName),
      route: flow.route
    }));
    const defaultFlow = (proto.flows || []).find((flow) => flow.meta?.default === true);
    const route = (defaultFlow || (proto.flows || [])[0])?.route || proto.route || `/${proto.dirName}`;
    const entryRoute = proto.route || `/${proto.dirName}`;
    seen.set(proto.dirName, {
      title: proto.name || proto.dirName,
      dirName: proto.dirName,
      route,
      flows,
      routes: [.../* @__PURE__ */ new Set([entryRoute, ...flows.map((flow) => flow.route)])]
    });
  };
  for (const folder of idx.sorted?.title?.folders || idx.folders || []) {
    for (const proto of folder.prototypes || []) collect(proto);
  }
  for (const proto of idx.sorted?.title?.prototypes || idx.prototypes || []) collect(proto);
  return [...seen.values()].sort((a, b) => a.title.localeCompare(b.title));
}
function storyFrameRoute(story, storyId, props = {}, componentSet = false) {
  if (!story?._storyModule) return "";
  const params = new URLSearchParams(String(props.search || ""));
  params.delete("_sb_component_view");
  params.set("_sb_embed", "");
  params.set("_sb_theme_target", "content");
  let hash = String(props.hash || "");
  if (componentSet) {
    params.delete("export");
    params.set("_sb_component_set", "");
    const layout = props.layout === "horizontal" ? "wide" : props.layout === "vertical" ? "tall" : props.layout || "auto";
    params.set("layout", String(layout));
    if (props.density) params.set("density", String(props.density));
    if (props.selected !== void 0) {
      const fragment = new URLSearchParams(hash.replace(/^#/, ""));
      if ((fragment.get("selected") || "") !== props.selected) {
        if (props.selected) fragment.set("selected", String(props.selected));
        else fragment.delete("selected");
        hash = fragment.size ? `#${fragment}` : "";
      }
    }
  } else {
    params.delete("_sb_component_set");
    if (props.exportName) params.set("export", String(props.exportName));
    else params.delete("export");
  }
  return `${story._route || `/components/${storyId}`}?${params}${hash}`;
}
const ROUTE_EVENT = "hypercanvas:site-route-change";
const PATCHED_HISTORY_KEY = "__hypercanvasSiteHistoryPatched";
function normalizedBasePath(basePath = "/") {
  const base = `/${String(basePath || "/").split("/").filter(Boolean).join("/")}`;
  return base === "/" ? "" : base;
}
function siteViewerPath(basePath, siteId, route = "") {
  const base = normalizedBasePath(basePath);
  const id = encodeURIComponent(normalizeSiteId(siteId));
  const normalizedRoute = normalizeSiteRoute(route);
  return `${base}/sites/${id}${normalizedRoute ? `/${normalizedRoute}` : "/"}`;
}
function observeSiteFrameRoute(iframe, { siteId, basePath = "/", onRouteChange } = {}) {
  let frameWindow;
  try {
    frameWindow = iframe?.contentWindow;
    if (!frameWindow || frameWindow.location.origin !== window.location.origin) return () => {
    };
  } catch {
    return () => {
    };
  }
  const sync = (event) => {
    let route;
    try {
      route = siteRouteFromPreviewUrl(frameWindow.location.href, siteId, {
        basePath,
        origin: window.location.origin
      });
    } catch {
      return;
    }
    if (route !== null) onRouteChange?.(route, { replace: event?.detail?.replace === true || event?.type === "popstate" });
  };
  try {
    const history = frameWindow.history;
    if (!frameWindow[PATCHED_HISTORY_KEY]) {
      for (const methodName of ["pushState", "replaceState"]) {
        const original = history[methodName];
        history[methodName] = function patchedSiteHistoryMethod(...args) {
          const result = original.apply(this, args);
          frameWindow.dispatchEvent(new frameWindow.CustomEvent(ROUTE_EVENT, {
            detail: { replace: methodName === "replaceState" }
          }));
          return result;
        };
      }
      Object.defineProperty(frameWindow, PATCHED_HISTORY_KEY, { value: true });
    }
  } catch {
  }
  frameWindow.addEventListener(ROUTE_EVENT, sync);
  frameWindow.addEventListener("popstate", sync);
  frameWindow.addEventListener("hashchange", sync);
  sync();
  return () => {
    frameWindow.removeEventListener(ROUTE_EVENT, sync);
    frameWindow.removeEventListener("popstate", sync);
    frameWindow.removeEventListener("hashchange", sync);
  };
}
function showToast(message, { duration = 3200 } = {}) {
  if (typeof document === "undefined") return null;
  const attribute = "data-storyboard-toast";
  const stack = document.querySelectorAll(`[${attribute}]`);
  const el = document.createElement("div");
  el.setAttribute(attribute, "");
  const bottomOffset = 24 + stack.length * 44;
  Object.assign(el.style, {
    position: "fixed",
    bottom: `${bottomOffset}px`,
    left: "50%",
    transform: "translateX(-50%) translateY(8px)",
    zIndex: "10060",
    padding: "0.5rem 0.875rem",
    borderRadius: "0.5rem",
    background: "var(--bgColor-emphasis, #1f2328)",
    color: "var(--fgColor-onEmphasis, #ffffff)",
    fontSize: "0.8125rem",
    fontFamily: "var(--hc-font-sans, system-ui, -apple-system, sans-serif)",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
    opacity: "0",
    transition: "opacity 0.15s ease, transform 0.15s ease",
    pointerEvents: "none",
    maxWidth: "32rem",
    textAlign: "center"
  });
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = "1";
    el.style.transform = "translateX(-50%) translateY(0)";
  });
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateX(-50%) translateY(8px)";
    setTimeout(() => el.remove(), 200);
  }, duration);
  return el;
}
async function copyCanvasText(text, label2 = "text") {
  const value = String(text ?? "");
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
  }
  const active = document.activeElement;
  const inputSelection = active && "selectionStart" in active ? { start: active.selectionStart, end: active.selectionEnd, direction: active.selectionDirection } : null;
  const selection = document.getSelection?.();
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange()) : [];
  const field = document.createElement("textarea");
  field.value = value;
  field.readOnly = true;
  field.setAttribute("aria-hidden", "true");
  Object.assign(field.style, { position: "fixed", left: "-10000px", top: "0", opacity: "0" });
  document.body.appendChild(field);
  let copied = false;
  try {
    field.focus();
    field.select();
    copied = !!document.execCommand?.("copy");
  } catch {
    copied = false;
  } finally {
    field.remove();
    if (selection && ranges.length) {
      selection.removeAllRanges();
      for (const range of ranges) selection.addRange(range);
    }
    active?.focus?.({ preventScroll: true });
    if (inputSelection && active?.setSelectionRange) {
      active.setSelectionRange(inputSelection.start, inputSelection.end, inputSelection.direction);
    }
  }
  if (!copied) showToast(`Could not copy ${label2}`);
  return copied;
}
async function copyCanvasImage(blob) {
  try {
    if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
      await navigator.clipboard.write([new ClipboardItem({ [blob.type || "image/png"]: blob })]);
      return true;
    }
  } catch {
  }
  showToast("Could not copy image");
  return false;
}
const document$1 = "_document_1hlsh_1";
const embed = "_embed_1hlsh_9";
const previewSurface = "_previewSurface_1hlsh_10";
const expandedFrame = "_expandedFrame_1hlsh_11";
const unavailable = "_unavailable_1hlsh_14";
const widgetEmbed = "_widgetEmbed_1hlsh_15";
const embedActions = "_embedActions_1hlsh_16";
const embedAction = "_embedAction_1hlsh_16";
const copyNotice = "_copyNotice_1hlsh_19";
const documentCss = {
  document: document$1,
  embed,
  previewSurface,
  expandedFrame,
  unavailable,
  widgetEmbed,
  embedActions,
  embedAction,
  copyNotice
};
const SESSION_TYPES = /* @__PURE__ */ new Set(["terminal", "terminal-read", "agent", "agent-chat", "prompt"]);
const FRAME_TYPES = /* @__PURE__ */ new Set(["prototype", "story", "component-set", "figma-embed", "codepen-embed", "site-frame"]);
const FLOW_TYPES = /* @__PURE__ */ new Set(["sticky-note", "markdown", "image", "link-preview", ...FRAME_TYPES]);
const SAFE_OVERRIDES = { "sticky-note": ["color", "width", "height"] };
function getWidgetSurfaceCatalog(surface2 = "document") {
  return Object.entries(widgetTypesSnapshot()).map(([type, definition]) => {
    const custom = getWidgetDefinition(type)?.component;
    const declared = definition.surfaces || {};
    const lifecycle = SESSION_TYPES.has(type) ? "session" : declared.lifecycle || (FLOW_TYPES.has(type) && !custom ? FRAME_TYPES.has(type) ? "interactive" : "passive" : "canvas");
    const supported = surface2 === "canvas" || !["session", "canvas"].includes(lifecycle) && (declared[surface2] === true || declared[surface2] !== false && FLOW_TYPES.has(type) && !custom);
    const properties = definition.props || {};
    const defaultProps = Object.fromEntries(Object.entries(properties).filter(([, value]) => value && Object.hasOwn(value, "default")).map(([name, value]) => [name, value.default]));
    return {
      type,
      label: definition.label || type,
      supported,
      reason: supported ? null : lifecycle === "session" ? "This widget owns a session. Use a context action in flow surfaces." : lifecycle === "canvas" ? "This widget requires Canvas context or an explicit surface capability." : `This widget is not enabled for ${surface2} surfaces.`,
      capabilities: { document: declared.document ?? (FLOW_TYPES.has(type) && !custom), agent: declared.agent ?? (FLOW_TYPES.has(type) && !custom), lifecycle, sizing: declared.sizing || (FRAME_TYPES.has(type) ? "frame" : "content"), editing: declared.editing || "props", agentProps: declared.agentProps || SAFE_OVERRIDES[type] || ["width", "height"] },
      defaultProps,
      properties
    };
  });
}
function getWidgetSurfaceEntry(type, surface2 = "document") {
  return getWidgetSurfaceCatalog(surface2).find((entry) => entry.type === type) || null;
}
function boundSurfaceProps(props, capabilities, availableWidth) {
  const result = { ...props };
  const number = (value, min, max, fallback2) => typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(value, max)) : fallback2;
  const requestedWidth = number(result.width, 160, 1200, capabilities.sizing === "frame" ? 640 : void 0);
  if (requestedWidth !== void 0) result.width = availableWidth > 0 ? Math.min(requestedWidth, availableWidth) : requestedWidth;
  if (result.height !== void 0 || capabilities.sizing === "frame") result.height = number(result.height, 64, 900, 420);
  return result;
}
const surface = "_surface_1jlw7_1";
const content = "_content_1jlw7_2";
const fallback = "_fallback_1jlw7_4";
const css = {
  surface,
  content,
  fallback
};
const builtinRenderers = {
  "sticky-note": lazy(() => import("./StickyNote-D0qOXpee.js")),
  markdown: lazy(() => import("./MarkdownBlock-DxsMG03P.js").then((n) => n.M)),
  image: lazy(() => import("./MarkdownBlock-DxsMG03P.js").then((n) => n.I)),
  "link-preview": lazy(() => import("./LinkPreview-DjLFNLPe.js")),
  prototype: lazy(() => import("./PrototypeEmbed-nbUrr-Yx.js")),
  story: lazy(() => import("./StoryWidget-3oewpv9w.js")),
  "component-set": lazy(() => import("./StorySetWidget-DzbPrZkS.js")),
  "figma-embed": lazy(() => import("./FigmaEmbed-xmGLzMj0.js")),
  "codepen-embed": lazy(() => import("./CodePenEmbed-CiEJGOBO.js")),
  "site-frame": lazy(() => import("./SiteFrame-ClTn1IVD.js"))
};
const noop = () => {
};
const sameAuthoredValue = (before, after) => {
  if (Object.is(before, after)) return true;
  if (!before || !after || typeof before !== "object" || typeof after !== "object") return false;
  try {
    return JSON.stringify(before) === JSON.stringify(after);
  } catch {
    return false;
  }
};
class WidgetBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? /* @__PURE__ */ jsx("p", { role: "status", children: "This widget could not render in this surface." }) : this.props.children;
  }
}
function WidgetSurface({ type, props = {}, surface: surface2 = "document", id, onUpdate, context, actionRef }) {
  useSyncExternalStore(subscribeToWidgetRegistry, getWidgetRegistrySnapshot, getWidgetRegistrySnapshot);
  const generatedId = useId();
  const root = useRef(null);
  const [width, setWidth] = useState(0);
  const [session, setSession] = useState({ type, id, authored: props, overrides: {} });
  let overrides = session.overrides;
  if (session.type !== type || session.id !== id || !sameAuthoredValue(session.authored, props)) {
    overrides = session.type !== type || session.id !== id ? {} : Object.fromEntries(Object.entries(overrides).filter(([name]) => sameAuthoredValue(session.authored[name], props[name])));
    setSession({ type, id, authored: props, overrides });
  }
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const update2 = () => setWidth(element.getBoundingClientRect().width);
    update2();
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(update2);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const entry = getWidgetSurfaceEntry(type, surface2);
  const readonlySession = context?.mode === "static" && entry?.capabilities.lifecycle === "session";
  const Renderer = !readonlySession && entry?.supported ? getWidgetDefinition(type)?.component || builtinRenderers[type] : null;
  const update = (patch) => {
    if (onUpdate) onUpdate(patch);
    else setSession((current) => ({ ...current, overrides: { ...current.overrides, ...patch } }));
  };
  const fallback2 = props?.fallback;
  const snapshot = typeof props?.snapshot === "string" ? props.snapshot : null;
  const ask = () => window.dispatchEvent(new CustomEvent("hypercanvas:hyperagent-context", { detail: { source: "widget", canvasId: context?.canvasId, widgetId: id, type, url: window.location.href, prompt: "" } }));
  return /* @__PURE__ */ jsx("section", { ref: root, className: css.surface, "data-widget-surface": surface2, "data-widget-type": type, "data-widget-supported": !!Renderer, "aria-label": `${entry?.label || type || "Unknown"} widget`, children: Renderer ? /* @__PURE__ */ jsx(WidgetBoundary, { children: /* @__PURE__ */ jsx(Suspense, { fallback: /* @__PURE__ */ jsx("p", { role: "status", children: "Loading widget…" }), children: /* @__PURE__ */ jsx("div", { className: css.content, children: createElement(Renderer, {
    ref: actionRef,
    id: `surface-${surface2}-${id || generatedId}`,
    props: boundSurfaceProps({ ...props, ...overrides, ...surface2 === "document" && entry.capabilities.sizing === "frame" && width > 0 ? { width } : {} }, entry.capabilities, width),
    context,
    onUpdate: entry.capabilities.editing !== "none" && (typeof onUpdate === "function" || entry.capabilities.lifecycle === "interactive") ? update : void 0,
    resizable: false,
    selected: false,
    onSelect: noop
  }) }) }) }, `${type}:${id || generatedId}`) : /* @__PURE__ */ jsxs("div", { className: css.fallback, children: [
    readonlySession ? snapshot === null ? /* @__PURE__ */ jsxs("p", { role: "status", children: [
      entry?.label || type,
      " is read-only in this published Notebook."
    ] }) : /* @__PURE__ */ jsx("pre", { "aria-label": `${entry?.label || type} snapshot`, style: { margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }, children: snapshot }) : /* @__PURE__ */ jsx("p", { role: "status", children: fallback2?.type === "text" && typeof fallback2.text === "string" ? fallback2.text : entry?.reason || `Unsupported widget: ${type || "unknown"}` }),
    !readonlySession && entry?.capabilities.lifecycle === "session" && /* @__PURE__ */ jsx("button", { type: "button", onClick: ask, children: "Ask Hyper Agent about this widget" })
  ] }) });
}
const __iconNode$e = [
  ["path", { d: "M8 3v3a2 2 0 0 1-2 2H3", key: "hohbtr" }],
  ["path", { d: "M21 8h-3a2 2 0 0 1-2-2V3", key: "5jw1f3" }],
  ["path", { d: "M3 16h3a2 2 0 0 1 2 2v3", key: "198tvr" }],
  ["path", { d: "M16 21v-3a2 2 0 0 1 2-2h3", key: "ph8mxp" }]
];
const Minimize = createLucideIcon$1("minimize", __iconNode$e);
const TooltipContext = createContext(null);
function Tooltip({ children }) {
  const [open, setOpen] = useState(false);
  const tooltipId = `hc-tt-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => setOpen(false), []);
  const anchorRef = useRef(null);
  const value = useMemo(() => ({ open, show, hide, tooltipId, anchorRef }), [open, show, hide, tooltipId]);
  return /* @__PURE__ */ jsx(TooltipContext.Provider, { value, children });
}
function isKeyboardFocus(event) {
  try {
    return event.target.matches(":focus-visible");
  } catch {
    return true;
  }
}
const TooltipTrigger = function TooltipTrigger2({ children }) {
  const ctx = useContext(TooltipContext);
  if (!ctx) return children;
  const { show, hide, open, tooltipId, anchorRef } = ctx;
  return /* @__PURE__ */ jsx(
    "span",
    {
      ref: anchorRef,
      style: { display: "inline-flex" },
      "aria-describedby": open ? tooltipId : void 0,
      onPointerEnter: (e) => {
        if (e.pointerType !== "touch") show();
      },
      onPointerLeave: hide,
      onPointerDown: hide,
      onFocus: (e) => {
        if (isKeyboardFocus(e)) show();
      },
      onBlur: hide,
      onKeyDown: (e) => {
        if (e.key === "Escape") hide();
      },
      children
    }
  );
};
const GAP = 8;
const EDGE = 4;
function clampToViewport(value, size, viewportSize) {
  return Math.max(EDGE, Math.min(value, viewportSize - size - EDGE));
}
function computeTooltipPosition({ anchor, tip, side, align, viewportWidth, viewportHeight }) {
  const vertical = side === "top" || side === "bottom";
  if (vertical) {
    const above = anchor.top - GAP - tip.height;
    const below = anchor.bottom + GAP;
    const top = side === "top" ? above >= EDGE ? above : below : below + tip.height <= viewportHeight - EDGE ? below : above;
    const x = align === "start" ? anchor.left : align === "end" ? anchor.right - tip.width : anchor.left + anchor.width / 2 - tip.width / 2;
    return { left: clampToViewport(x, tip.width, viewportWidth), top: clampToViewport(top, tip.height, viewportHeight) };
  }
  const start = anchor.left - GAP - tip.width;
  const end = anchor.right + GAP;
  const left = side === "left" ? start >= EDGE ? start : end : end + tip.width <= viewportWidth - EDGE ? end : start;
  const y = align === "start" ? anchor.top : align === "end" ? anchor.bottom - tip.height : anchor.top + anchor.height / 2 - tip.height / 2;
  return { left: clampToViewport(left, tip.width, viewportWidth), top: clampToViewport(y, tip.height, viewportHeight) };
}
function TooltipContent({ children, side = "top", align = "center", className, style, ...props }) {
  const ctx = useContext(TooltipContext);
  const ref = useRef(null);
  const open = ctx?.open;
  const anchorRef = ctx?.anchorRef;
  useLayoutEffect(() => {
    const el = ref.current;
    const anchor = anchorRef?.current;
    if (!open || !el || !anchor) return void 0;
    try {
      el.showPopover?.();
    } catch {
    }
    const place = () => {
      const position = computeTooltipPosition({
        anchor: anchor.getBoundingClientRect(),
        tip: el.getBoundingClientRect(),
        side,
        align,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      });
      el.style.left = `${Math.round(position.left)}px`;
      el.style.top = `${Math.round(position.top)}px`;
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(place) : null;
    observer?.observe(anchor);
    observer?.observe(el);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      observer?.disconnect();
      try {
        el.hidePopover?.();
      } catch {
      }
    };
  }, [open, side, align, anchorRef]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    /* @__PURE__ */ jsx(
      "div",
      {
        ref,
        id: ctx.tooltipId,
        popover: "manual",
        role: "tooltip",
        "data-hc-ui": "",
        "data-slot": "tooltip-content",
        "data-side": side,
        "data-align": align,
        className,
        style,
        ...props,
        children
      }
    ),
    document.body
  );
}
const DIRECTION_MAP = {
  n: { side: "top", align: "center" },
  s: { side: "bottom", align: "center" },
  e: { side: "right", align: "center" },
  w: { side: "left", align: "center" },
  ne: { side: "top", align: "end" },
  nw: { side: "top", align: "start" },
  se: { side: "bottom", align: "end" },
  sw: { side: "bottom", align: "start" }
};
function TooltipAdapter({ text, direction = "n", children, ...rest }) {
  const { side, align } = DIRECTION_MAP[direction] || DIRECTION_MAP.n;
  return /* @__PURE__ */ jsxs(Tooltip, { ...rest, children: [
    /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children }),
    /* @__PURE__ */ jsx(TooltipContent, { side, align, children: text })
  ] });
}
const __iconNode$d = [
  [
    "path",
    {
      d: "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",
      key: "1nclc0"
    }
  ],
  ["circle", { cx: "12", cy: "12", r: "3", key: "1v7zrd" }]
];
const Eye = createLucideIcon$1("eye", __iconNode$d);
const __iconNode$c = [
  [
    "path",
    {
      d: "M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49",
      key: "ct8e1f"
    }
  ],
  ["path", { d: "M14.084 14.158a3 3 0 0 1-4.242-4.242", key: "151rxh" }],
  [
    "path",
    {
      d: "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143",
      key: "13bj9a"
    }
  ],
  ["path", { d: "m2 2 20 20", key: "1ooewy" }]
];
const EyeOff = createLucideIcon$1("eye-off", __iconNode$c);
const __iconNode$b = [
  ["path", { d: "m16 18 6-6-6-6", key: "eg8j8" }],
  ["path", { d: "m8 6-6 6 6 6", key: "ppft3o" }]
];
const Code = createLucideIcon$1("code", __iconNode$b);
const __iconNode$a = [
  ["path", { d: "m14 10 7-7", key: "oa77jy" }],
  ["path", { d: "M20 10h-6V4", key: "mjg0md" }],
  ["path", { d: "m3 21 7-7", key: "tjx5ai" }],
  ["path", { d: "M4 14h6v6", key: "rmj7iw" }]
];
const Minimize2 = createLucideIcon$1("minimize-2", __iconNode$a);
const __iconNode$9 = [
  ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2", key: "1m3agn" }],
  ["circle", { cx: "9", cy: "9", r: "2", key: "af1f0g" }],
  ["path", { d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21", key: "1xmnt7" }]
];
const Image$1 = createLucideIcon$1("image", __iconNode$9);
const __iconNode$8 = [
  ["path", { d: "M12 22v-6", key: "6o8u61" }],
  ["path", { d: "M12 8V2", key: "1wkif3" }],
  ["path", { d: "M4 12H2", key: "rhcxmi" }],
  ["path", { d: "M10 12H8", key: "s88cx1" }],
  ["path", { d: "M16 12h-2", key: "10asgb" }],
  ["path", { d: "M22 12h-2", key: "14jgyd" }],
  ["path", { d: "m15 19-3 3-3-3", key: "11eu04" }],
  ["path", { d: "m15 5-3-3-3 3", key: "itvq4r" }]
];
const UnfoldVertical = createLucideIcon$1("unfold-vertical", __iconNode$8);
const __iconNode$7 = [
  ["path", { d: "M12 22v-6", key: "6o8u61" }],
  ["path", { d: "M12 8V2", key: "1wkif3" }],
  ["path", { d: "M4 12H2", key: "rhcxmi" }],
  ["path", { d: "M10 12H8", key: "s88cx1" }],
  ["path", { d: "M16 12h-2", key: "10asgb" }],
  ["path", { d: "M22 12h-2", key: "14jgyd" }],
  ["path", { d: "m15 19-3-3-3 3", key: "e37ymu" }],
  ["path", { d: "m15 5-3 3-3-3", key: "19d6lf" }]
];
const FoldVertical = createLucideIcon$1("fold-vertical", __iconNode$7);
const __iconNode$6 = [
  ["path", { d: "M8 3H5a2 2 0 0 0-2 2v3", key: "1dcmit" }],
  ["path", { d: "M21 8V5a2 2 0 0 0-2-2h-3", key: "1e4gt3" }],
  ["path", { d: "M3 16v3a2 2 0 0 0 2 2h3", key: "wsl5sc" }],
  ["path", { d: "M16 21h3a2 2 0 0 0 2-2v-3", key: "18trek" }]
];
const Maximize = createLucideIcon$1("maximize", __iconNode$6);
const __iconNode$5 = [
  ["path", { d: "M16.247 7.761a6 6 0 0 1 0 8.478", key: "1fwjs5" }],
  ["path", { d: "M19.075 4.933a10 10 0 0 1 0 14.134", key: "ehdyv1" }],
  ["path", { d: "M4.925 19.067a10 10 0 0 1 0-14.134", key: "1q22gi" }],
  ["path", { d: "M7.753 16.239a6 6 0 0 1 0-8.478", key: "r2q7qm" }],
  ["circle", { cx: "12", cy: "12", r: "2", key: "1c9p78" }]
];
const Radio = createLucideIcon$1("radio", __iconNode$5);
const __iconNode$4 = [["path", { d: "M20 6 9 17l-5-5", key: "1gmf2c" }]];
const Check = createLucideIcon$1("check", __iconNode$4);
const __iconNode$3 = [
  ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
  ["path", { d: "M12 3v18", key: "108xh3" }]
];
const Columns2 = createLucideIcon$1("columns-2", __iconNode$3);
const __iconNode$2 = [
  ["path", { d: "M12 4v16", key: "1654pz" }],
  ["path", { d: "M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2", key: "e0r10z" }],
  ["path", { d: "M9 20h6", key: "s66wpe" }]
];
const Type = createLucideIcon$1("type", __iconNode$2);
const customIcons = {
  "home": {
    viewBox: "0 0 16 16",
    path: "M6.906.664a1.749 1.749 0 0 1 2.187 0l5.25 4.2c.415.332.657.835.657 1.367v7.019A1.75 1.75 0 0 1 13.25 15h-3.5a.75.75 0 0 1-.75-.75V9H7v5.25a.75.75 0 0 1-.75.75h-3.5A1.75 1.75 0 0 1 1 13.25V6.23c0-.531.242-1.034.657-1.366l5.25-4.2Zm1.25 1.171a.25.25 0 0 0-.312 0l-5.25 4.2a.25.25 0 0 0-.094.196v7.019c0 .138.112.25.25.25H5.5V8.25a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 .75.75v5.25h2.75a.25.25 0 0 0 .25-.25V6.23a.25.25 0 0 0-.094-.195Z"
  },
  "folder": {
    viewBox: "0 0 24 24",
    path: "M4 20q-.825 0-1.412-.587T2 18V6q0-.825.588-1.412T4 4h5.175q.4 0 .763.15t.637.425L12 6h8q.825 0 1.413.588T22 8v10q0 .825-.587 1.413T20 20z"
  },
  "folder-open": {
    viewBox: "0 0 24 24",
    path: "M4 20q-.825 0-1.412-.587T2 18V6q0-.825.588-1.412T4 4h5.175q.4 0 .763.15t.637.425L12 6h9q.425 0 .713.288T22 7t-.288.713T21 8H7.85q-1.55 0-2.7.975T4 11.45V18l1.975-6.575q.2-.65.738-1.037T7.9 10h12.9q1.025 0 1.613.813t.312 1.762l-1.8 6q-.2.65-.737 1.038T19 20z"
  },
  // CollageFrame icon (from PrototypeEmbed widget title bar)
  "prototype": {
    viewBox: "0 0 24 24",
    strokePaths: [
      "M19.4 20H4.6C4.26863 20 4 19.7314 4 19.4V4.6C4 4.26863 4.26863 4 4.6 4H19.4C19.7314 4 20 4.26863 20 4.6V19.4C20 19.7314 19.7314 20 19.4 20Z",
      "M11 12V4",
      "M4 12H20"
    ]
  },
  // Smiley face icon (from assets/icons/canvas.svg)
  "canvas": {
    viewBox: "0 0 28 23",
    strokeRect: { x: 1, y: 1, width: 26, height: 21, rx: 7 },
    fillPaths: [
      "M17.8421 12.9776V12.9788L17.8409 12.9812C18.2386 12.451 18.9901 12.3434 19.5204 12.7409C20.0506 13.1385 20.1582 13.8901 19.7606 14.4204L18.8008 13.7008C19.7416 14.4064 19.7606 14.4209 19.7606 14.4215L19.7583 14.4239C19.7573 14.4252 19.756 14.427 19.7548 14.4286C19.7524 14.4317 19.7499 14.436 19.7466 14.4403C19.7399 14.449 19.7311 14.4601 19.7208 14.4731C19.7001 14.4992 19.6715 14.5332 19.6364 14.5751C19.566 14.6589 19.4665 14.7734 19.3387 14.9067C19.0842 15.1723 18.712 15.5216 18.2312 15.8713C17.2736 16.5677 15.831 17.3011 14.0003 17.3011C12.1695 17.3011 10.727 16.5677 9.76938 15.8713C9.28854 15.5216 8.91634 15.1723 8.66184 14.9067C8.53409 14.7734 8.43453 14.6589 8.36415 14.5751C8.32905 14.5332 8.30044 14.4992 8.27977 14.4731C8.26946 14.4601 8.26066 14.449 8.25398 14.4403C8.25066 14.436 8.24819 14.4317 8.24578 14.4286C8.24457 14.427 8.24325 14.4252 8.24226 14.4239L8.23992 14.4215C8.24001 14.4209 8.25896 14.4064 9.19979 13.7008L8.23992 14.4204C7.8424 13.8901 7.94999 13.1385 8.48018 12.7409C9.01029 12.3435 9.76077 12.4513 10.1585 12.9812L10.1597 12.98L10.1585 12.9776H10.1573C10.1583 12.9789 10.1602 12.9801 10.162 12.9823C10.1691 12.9914 10.182 13.0091 10.2018 13.0327C10.2416 13.08 10.3064 13.1534 10.394 13.2449C10.5708 13.4293 10.8366 13.6804 11.1805 13.9305C11.873 14.4341 12.8308 14.9009 14.0003 14.9009C15.1698 14.9009 16.1276 14.4341 16.8201 13.9305C17.164 13.6804 17.4298 13.4293 17.6065 13.2449C17.6942 13.1534 17.759 13.08 17.7987 13.0327C17.8186 13.0091 17.8314 12.9914 17.8386 12.9823L17.8421 12.9776Z",
      "M10.4111 6.5C11.0739 6.5 11.6112 7.03731 11.6112 7.70012C11.6112 8.36293 11.0739 8.90025 10.4111 8.90025H10.3993C9.73653 8.90025 9.19922 8.36293 9.19922 7.70012C9.19922 7.03731 9.73653 6.5 10.3993 6.5H10.4111Z",
      "M17.6103 6.5C18.2731 6.5 18.8104 7.03731 18.8104 7.70012C18.8104 8.36293 18.2731 8.90025 17.6103 8.90025H17.5986C16.9358 8.90025 16.3984 8.36293 16.3984 7.70012C16.3984 7.03731 16.9358 6.5 17.5986 6.5H17.6103Z"
    ]
  },
  "sticky-note": {
    viewBox: "0 0 14 14",
    fillRule: "evenodd",
    path: "M3.709.471C4.763.353 5.867.25 7 .25s2.237.104 3.29.22h.003a3.694 3.694 0 0 1 3.247 3.256v.004c.113 1.049.21 2.145.21 3.27q-.001.595-.032 1.176l-.008.067c-.556 3.437-3.804 5.226-6.192 5.498h-.006l-.048.006a.6.6 0 0 1-.126 0q-.168.003-.338.003c-1.133 0-2.236-.103-3.29-.221h-.003A3.695 3.695 0 0 1 .46 10.272v-.004C.346 9.221.25 8.126.25 7s.097-2.222.21-3.27v-.003A3.694 3.694 0 0 1 3.707.472zm8.784 7.047h-2.37c-.854 0-1.514.656-1.628 1.442c-.22 1.52-.706 2.546-1.413 3.54H7c-1.061 0-2.108-.097-3.15-.213a2.445 2.445 0 0 1-2.148-2.153C1.592 9.1 1.5 8.057 1.5 7s.091-2.1.202-3.134A2.444 2.444 0 0 1 3.85 1.714C4.89 1.597 5.938 1.5 7 1.5s2.107.098 3.151.213a2.444 2.444 0 0 1 2.147 2.152C12.408 4.9 12.5 5.944 12.5 7q0 .259-.007.518"
  },
  "agents": {
    viewBox: "0 0 32 32",
    path: "M27.2 16c0-6.19-5.01-11.2-11.2-11.2S4.8 9.81 4.8 16S9.81 27.2 16 27.2S27.2 22.19 27.2 16m-5.6 2.1a1.4 1.4 0 0 1 0 2.8h-4.2a1.4 1.4 0 0 1 0-2.8zm-11.2-6.8a1.397 1.397 0 0 1 1.84.361l.08.119l2.1 3.5l.087.171a1.4 1.4 0 0 1 0 1.1l-.088.171l-2.1 3.5a1.4 1.4 0 0 1-2.4-1.44l1.67-2.78l-1.67-2.78l-.067-.127a1.394 1.394 0 0 1 .547-1.79zM30 16c0 7.73-6.27 14-14 14S2 23.73 2 16S8.27 2 16 2s14 6.27 14 14"
  },
  "mascot": {
    viewBox: "0 0 632 632",
    fillRule: "evenodd",
    path: "M127 239a68 68 0 1 0 136 0a68 68 0 1 0-136 0ZM368.09 239a68 68 0 1 0 136 0a68 68 0 1 0-136 0ZM384.017 338C392.689 338 400.414 345.179 398.942 354.406C392.562 394.413 358.095 425 316.5 425C274.905 425 240.438 394.413 234.058 354.406C232.586 345.179 240.311 338 248.983 338C257.937 338 264.507 345.273 266.394 353.173C271.837 375.96 292.219 392.871 316.5 392.871C340.781 392.871 361.163 375.96 366.606 353.173C368.493 345.273 375.063 338 384.017 338ZM572 316C572 208.029 572 153.622 544.053 116.073L543.388 115.19C535.764 105.176 526.824 96.2366 516.811 88.6125C479.232 60 424.821 60.0002 316 60.0002C207.179 60.0002 152.768 60 115.19 88.6125L114.254 89.3312C104.619 96.7965 95.9983 105.489 88.6125 115.19L87.9474 116.073C60.0002 153.622 60.0002 208.029 60.0002 316C60.0002 424.821 60 479.232 88.6125 516.811C96.2366 526.824 105.176 535.764 115.19 543.388C152.768 572 207.179 572 316 572C423.971 572 478.379 572 515.927 544.053L516.811 543.388C526.511 536.002 535.204 527.381 542.669 517.746L543.388 516.811C572 479.232 572 424.821 572 316ZM632 316C632 369.024 632.088 413.784 628.05 449.806C623.878 487.024 614.683 522.218 591.125 553.158C580.234 567.463 567.463 580.234 553.158 591.125C522.218 614.683 487.024 623.878 449.806 628.05C413.784 632.088 369.024 632 316 632C262.977 632 218.216 632.088 182.194 628.05C144.976 623.878 109.783 614.683 78.8419 591.125C64.5374 580.234 51.7667 567.463 40.8752 553.158C17.3168 522.218 8.12283 487.024 3.95035 449.806C-0.0879664 413.784 0.000154094 369.024 0.000154094 316C0.000154094 262.977-0.0879664 218.216 3.95035 182.194C8.12283 144.976 17.3168 109.783 40.8752 78.8419C51.7667 64.5374 64.5374 51.7667 78.8419 40.8752C109.783 17.3168 144.976 8.12283 182.194 3.95035C218.216-0.0879664 262.977 0.000154094 316 0.000154094C369.024 0.000154094 413.784-0.0879655 449.806 3.95035C487.024 8.12283 522.218 17.3168 553.158 40.8752C567.463 51.7667 580.234 64.5374 591.125 78.8419C614.683 109.783 623.878 144.976 628.05 182.194C632.088 218.216 632 262.977 632 316Z"
  },
  "codex": {
    viewBox: "0 0 24 24",
    fillRule: "evenodd",
    path: "M8.086.457a6.105 6.105 0 013.046-.415c1.333.153 2.521.72 3.564 1.7a.117.117 0 00.107.029c1.408-.346 2.762-.224 4.061.366l.063.03.154.076c1.357.703 2.33 1.77 2.918 3.198.278.679.418 1.388.421 2.126a5.655 5.655 0 01-.18 1.631.167.167 0 00.04.155 5.982 5.982 0 011.578 2.891c.385 1.901-.01 3.615-1.183 5.14l-.182.22a6.063 6.063 0 01-2.934 1.851.162.162 0 00-.108.102c-.255.736-.511 1.364-.987 1.992-1.199 1.582-2.962 2.462-4.948 2.451-1.583-.008-2.986-.587-4.21-1.736a.145.145 0 00-.14-.032c-.518.167-1.04.191-1.604.185a5.924 5.924 0 01-2.595-.622 6.058 6.058 0 01-2.146-1.781c-.203-.269-.404-.522-.551-.821a7.74 7.74 0 01-.495-1.283 6.11 6.11 0 01-.017-3.064.166.166 0 00.008-.074.115.115 0 00-.037-.064 5.958 5.958 0 01-1.38-2.202 5.196 5.196 0 01-.333-1.589 6.915 6.915 0 01.188-2.132c.45-1.484 1.309-2.648 2.577-3.493.282-.188.55-.334.802-.438.286-.12.573-.22.861-.304a.129.129 0 00.087-.087A6.016 6.016 0 015.635 2.31C6.315 1.464 7.132.846 8.086.457zm-.804 7.85a.848.848 0 00-1.473.842l1.694 2.965-1.688 2.848a.849.849 0 001.46.864l1.94-3.272a.849.849 0 00.007-.854l-1.94-3.393zm5.446 6.24a.849.849 0 000 1.695h4.848a.849.849 0 000-1.696h-4.848z"
  },
  "opencode": {
    viewBox: "0 0 24 24",
    title: "OpenCode",
    path: "M22 24H2V0h20zM17 4.8H7v14.4h10z"
  },
  "claude": {
    viewBox: "0 0 24 24",
    path: "m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"
  },
  "flow": {
    viewBox: "0 0 24 24",
    strokeWidth: "2.5",
    strokePaths: [
      "M13 19L22 12L13 5L13 19Z",
      "M2 19L11 12L2 5L2 19Z"
    ]
  },
  // Component icon (puzzle piece / brick)
  "component": {
    viewBox: "0 0 24 24",
    strokeWidth: "1.5",
    strokePaths: [
      "M3.5 10.5V5.5C3.5 4.94772 3.94772 4.5 4.5 4.5H9.5",
      "M14.5 4.5H19.5C20.0523 4.5 20.5 4.94772 20.5 5.5V10.5",
      "M20.5 13.5V18.5C20.5 19.0523 20.0523 19.5 19.5 19.5H14.5",
      "M9.5 19.5H4.5C3.94772 19.5 3.5 19.0523 3.5 18.5V13.5",
      "M12 4.5V7.5",
      "M12 16.5V19.5",
      "M20.5 12H17.5",
      "M6.5 12H3.5"
    ]
  }
};
const iconoirIcons = {
  "square-dashed": {
    viewBox: "0 0 24 24",
    strokeWidth: "1.5",
    content: '<path d="M7 4H4V7" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 11V13" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 4H13" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 20H13" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 11V13" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 4H20V7" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 20H4V17" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 20H20V17" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  "key-command": {
    viewBox: "0 0 24 24",
    strokeWidth: "1.5",
    content: '<path d="M9 6V18" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 6V18" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 6C9 4.34315 7.65685 3 6 3C4.34315 3 3 4.34315 3 6C3 7.65685 4.34315 9 6 9H18C19.6569 9 21 7.65685 21 6C21 4.34315 19.6569 3 18 3C16.3431 3 15 4.34315 15 6" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 18C9 19.6569 7.65685 21 6 21C4.34315 21 3 19.6569 3 18C3 16.3431 4.34315 15 6 15H18C19.6569 15 21 16.3431 21 18C21 19.6569 19.6569 21 18 21C16.3431 21 15 19.6569 15 18" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  "globe": {
    viewBox: "0 0 24 24",
    strokeWidth: "1.5",
    content: '<circle cx="12" cy="12" r="9" stroke="currentColor"/><path d="M3 12H21M12 3C14.5 5.5 16 8.5 16 12C16 15.5 14.5 18.5 12 21C9.5 18.5 8 15.5 8 12C8 8.5 9.5 5.5 12 3Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  "computer": {
    viewBox: "0 0 24 24",
    strokeWidth: "1.5",
    content: '<path d="M2 21H17M21 21H22M2 16.4V3.6C2 3.26863 2.26863 3 2.6 3H21.4C21.7314 3 22 3.26863 22 3.6V16.4C22 16.7314 21.7314 17 21.4 17H2.6C2.26863 17 2 16.7314 2 16.4Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  "arrow-separate": {
    viewBox: "0 0 24 24",
    strokeWidth: "1.5",
    content: '<path d="M8 7L3 12L8 17" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 7L21 12L16 17" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  "plus-circle": {
    viewBox: "0 0 24 24",
    strokeWidth: "1.5",
    content: '<path d="M8 12H12M16 12H12M12 12V8M12 12V16" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  "plus-circle-solid": {
    viewBox: "0 0 24 24",
    fill: true,
    content: '<path fill-rule="evenodd" clip-rule="evenodd" d="M12 1.25C6.06294 1.25 1.25 6.06294 1.25 12C1.25 17.9371 6.06294 22.75 12 22.75C17.9371 22.75 22.75 17.9371 22.75 12C22.75 6.06294 17.9371 1.25 12 1.25ZM12.75 8C12.75 7.58579 12.4142 7.25 12 7.25C11.5858 7.25 11.25 7.58579 11.25 8V11.25H8C7.58579 11.25 7.25 11.5858 7.25 12C7.25 12.4142 7.58579 12.75 8 12.75H11.25V16C11.25 16.4142 11.5858 16.75 12 16.75C12.4142 16.75 12.75 16.4142 12.75 16V12.75H16C16.4142 12.75 16.75 12.4142 16.75 12C16.75 11.5858 16.4142 11.25 16 11.25H12.75V8Z" fill="currentColor"/>'
  },
  "grid-plus": {
    viewBox: "0 0 24 24",
    strokeWidth: "1.5",
    content: '<path d="M13.9922 17H16.9922M19.9922 17H16.9922M16.9922 17V14M16.9922 17V20" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 9.4V4.6C4 4.26863 4.26863 4 4.6 4H9.4C9.73137 4 10 4.26863 10 4.6V9.4C10 9.73137 9.73137 10 9.4 10H4.6C4.26863 10 4 9.73137 4 9.4Z" stroke="currentColor" stroke-width="1.5"/><path d="M4 19.4V14.6C4 14.2686 4.26863 14 4.6 14H9.4C9.73137 14 10 14.2686 10 14.6V19.4C10 19.7314 9.73137 20 9.4 20H4.6C4.26863 20 4 19.7314 4 19.4Z" stroke="currentColor" stroke-width="1.5"/><path d="M14 9.4V4.6C14 4.26863 14.2686 4 14.6 4H19.4C19.7314 4 20 4.26863 20 4.6V9.4C20 9.73137 19.7314 10 19.4 10H14.6C14.2686 10 14 9.73137 14 9.4Z" stroke="currentColor" stroke-width="1.5"/>'
  },
  "view-grid": {
    viewBox: "0 0 24 24",
    strokeWidth: "1.5",
    content: '<path d="M14 20.4V14.6C14 14.2686 14.2686 14 14.6 14H20.4C20.7314 14 21 14.2686 21 14.6V20.4C21 20.7314 20.7314 21 20.4 21H14.6C14.2686 21 14 20.7314 14 20.4Z" stroke="currentColor" stroke-width="1.5"/><path d="M3 20.4V14.6C3 14.2686 3.26863 14 3.6 14H9.4C9.73137 14 10 14.2686 10 14.6V20.4C10 20.7314 9.73137 21 9.4 21H3.6C3.26863 21 3 20.7314 3 20.4Z" stroke="currentColor" stroke-width="1.5"/><path d="M14 9.4V3.6C14 3.26863 14.2686 3 14.6 3H20.4C20.7314 3 21 3.26863 21 3.6V9.4C21 9.73137 20.7314 10 20.4 10H14.6C14.2686 10 14 9.73137 14 9.4Z" stroke="currentColor" stroke-width="1.5"/><path d="M3 9.4V3.6C3 3.26863 3.26863 3 3.6 3H9.4C9.73137 3 10 3.26863 10 3.6V9.4C10 9.73137 9.73137 10 9.4 10H3.6C3.26863 10 3 9.73137 3 9.4Z" stroke="currentColor" stroke-width="1.5"/>'
  },
  "select-point-3d": {
    viewBox: "0 0 24 24",
    strokeWidth: "1.5",
    content: '<path d="M12 13C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13Z" fill="currentColor" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 7.35304L21 16.647C21 16.8649 20.8819 17.0656 20.6914 17.1715L12.2914 21.8381C12.1102 21.9388 11.8898 21.9388 11.7086 21.8381L3.30861 17.1715C3.11814 17.0656 3 16.8649 3 16.647L2.99998 7.35304C2.99998 7.13514 3.11812 6.93437 3.3086 6.82855L11.7086 2.16188C11.8898 2.06121 12.1102 2.06121 12.2914 2.16188L20.6914 6.82855C20.8818 6.93437 21 7.13514 21 7.35304Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  "square-3d-three-points": {
    viewBox: "0 0 24 24",
    strokeWidth: "1.5",
    content: '<path d="M3 21V3.6C3 3.26863 3.26863 3 3.6 3H21" stroke="currentColor"/><path d="M17 21H20.4C20.7314 21 21 20.7314 21 20.4V17" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 7V9" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 12V14" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 21H9" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 21H14" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 4C3.55228 4 4 3.55228 4 3C4 2.44772 3.55228 2 3 2C2.44772 2 2 2.44772 2 3C2 3.55228 2.44772 4 3 4Z" fill="currentColor" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 22C3.55228 22 4 21.5523 4 21C4 20.4477 3.55228 20 3 20C2.44772 20 2 20.4477 2 21C2 21.5523 2.44772 22 3 22Z" fill="currentColor" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 4C21.5523 4 22 3.55228 22 3C22 2.44772 21.5523 2 21 2C20.4477 2 20 2.44772 20 3C20 3.55228 20.4477 4 21 4Z" fill="currentColor" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  "crown": {
    viewBox: "0 0 476 342",
    strokeWidth: "0",
    fill: true,
    content: '<path d="M237.662 5.06897e-06C234.508 -0.00234318 231.407 0.811233 228.661 2.36166C225.915 3.91209 223.616 6.14664 221.989 8.84813L143.696 138.937L28.232 63.8869C25.2791 61.9709 21.8359 60.9481 18.3159 60.9415C14.796 60.9348 11.3489 61.9445 8.38878 63.8492C5.42868 65.754 3.08142 68.4728 1.62894 71.6792C0.176467 74.8855 -0.319454 78.443 0.200748 81.9244L36.7632 325.674C37.4116 330.007 39.5942 333.963 42.9136 336.821C46.2331 339.68 50.4688 341.252 54.8495 341.25H420.475C424.855 341.252 429.091 339.68 432.41 336.821C435.73 333.963 437.912 330.007 438.561 325.674L475.123 81.9244C475.643 78.443 475.148 74.8855 473.695 71.6792C472.243 68.4728 469.895 65.754 466.935 63.8492C463.975 61.9445 460.528 60.9348 457.008 60.9415C453.488 60.9481 450.045 61.9709 447.092 63.8869L331.628 138.937L253.335 8.8725C251.711 6.16648 249.414 3.92709 246.667 2.37228C243.92 0.817458 240.818 0.000185041 237.662 5.06897e-06Z" fill="currentColor"/>'
  },
  "upload-square-solid": {
    viewBox: "0 0 24 24",
    strokeWidth: "0",
    fill: true,
    content: '<path fill-rule="evenodd" clip-rule="evenodd" d="M2.25 3.6C2.25 2.85441 2.85442 2.25 3.6 2.25H20.4C21.1456 2.25 21.75 2.85442 21.75 3.6V20.4C21.75 21.1456 21.1456 21.75 20.4 21.75H3.6C2.85442 21.75 2.25 21.1456 2.25 20.4V3.6ZM5.25 18C5.25 17.5858 5.58579 17.25 6 17.25L18 17.25C18.4142 17.25 18.75 17.5858 18.75 18C18.75 18.4142 18.4142 18.75 18.75 18.75L6 18.75C5.58579 18.75 5.25 17.5858 5.25 18ZM12.5303 5.46967C12.2374 5.17678 11.7626 5.17678 11.4697 5.46967L7.96967 8.96967C7.67678 9.26256 7.67678 9.73744 7.96967 10.0303C8.26256 10.3232 8.73744 10.3232 9.03033 10.0303L11.25 7.81066V14C11.25 14.4142 11.5858 14.75 12 14.75C12.4142 14.75 12.75 14.4142 12.75 14V7.81066L14.9697 10.0303C15.2626 10.3232 15.7374 10.3232 16.0303 10.0303C16.3232 10.3232 16.3232 9.26256 16.0303 8.96967L12.5303 5.46967Z" fill="currentColor"/>'
  },
  "upload-square": {
    viewBox: "0 0 24 24",
    strokeWidth: "1.5",
    content: '<path d="M3 20.4V3.6C3 3.26863 3.26863 3 3.6 3H20.4C20.7314 3 21 3.26863 21 3.6V20.4C21 20.7314 20.7314 21 20.4 21H3.6C3.26863 21 3 20.7314 3 20.4Z" stroke="currentColor" stroke-width="1.5"/><path d="M6 18L18 18" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 14V6M12 6L15.5 9.5M12 6L8.5 9.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  "settings": {
    viewBox: "0 0 24 24",
    strokeWidth: "1.5",
    content: '<path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M19.6224 10.3954L18.5247 7.7448L20 6L18 4L16.2647 5.48295L13.5578 4.36974L12.9353 2H10.981L10.3491 4.40113L7.70441 5.51596L6 4L4 6L5.45337 7.78885L4.3725 10.4463L2 11V13L4.40111 13.6555L5.51575 16.2997L4 18L6 20L7.79116 18.5403L10.397 19.6123L11 22H13L13.6045 19.6132L16.2551 18.5155C16.6969 18.8313 18 20 18 20L20 18L18.5159 16.2494L19.6139 13.598L21.9999 12.9772L22 11L19.6224 10.3954Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  "white-flag": {
    viewBox: "0 0 24 24",
    strokeWidth: "1.5",
    content: '<path d="M5 15L5.95039 4.54568C5.97849 4.23663 6.23761 4 6.54793 4H20.343C20.6958 4 20.9725 4.30295 20.9405 4.65432L20.0496 14.4543C20.0215 14.7634 19.7624 15 19.4521 15H5ZM5 15L4.4 21" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  "light-bulb": {
    viewBox: "0 0 24 24",
    strokeWidth: "1.5",
    content: '<path d="M9 18H15" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 21H14" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.00082 15C9.00098 13 8.50098 12.5 7.50082 11.5C6.50067 10.5 6.02422 9.48689 6.00082 8C5.95284 4.95029 8.00067 3 12.0008 3C16.001 3 18.0488 4.95029 18.0008 8C17.9774 9.48689 17.5007 10.5 16.5008 11.5C15.501 12.5 15.001 13 15.0008 15" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  "light-bulb-off": {
    viewBox: "0 0 24 24",
    strokeWidth: "1.5",
    content: '<path d="M9 18H15" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 21H14" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M16.4999 11.5C17.4997 10.5 17.9765 9.48689 17.9999 8C18.0479 4.95029 16 3 11.9999 3C10.8324 3 9.83119 3.16613 8.99988 3.47724" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.99985 15C9 13 8.5 12.5 7.49985 11.5C6.4997 10.5 6.02324 9.48689 5.99985 8C5.99142 7.46458 6.0476 6.96304 6.1676 6.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 3L21 21" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  "keyframes": {
    viewBox: "0 0 24 24",
    strokeWidth: "1.5",
    content: '<path d="M13.8476 13.317L9.50515 18.2798C8.70833 19.1905 7.29167 19.1905 6.49485 18.2798L2.15238 13.317C1.49259 12.563 1.49259 11.437 2.15238 10.683L6.49485 5.72018C7.29167 4.80952 8.70833 4.80952 9.50515 5.72017L13.8476 10.683C14.5074 11.437 14.5074 12.563 13.8476 13.317Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 19L17.8844 13.3016C18.5263 12.5526 18.5263 11.4474 17.8844 10.6984L13 5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 19L21.8844 13.3016C22.5263 12.5526 22.5263 11.4474 21.8844 10.6984L17 5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  "keyframes-couple-solid": {
    viewBox: "0 0 24 24",
    fill: true,
    content: '<path fill-rule="evenodd" clip-rule="evenodd" d="M14.0658 5.18029L12.5606 6.87362L11.4395 5.87707L12.9447 4.18374C14.0386 2.95308 15.9614 2.95308 17.0554 4.18373L22.3794 10.1733C23.3056 11.2152 23.3057 12.7855 22.3795 13.8273L17.0554 19.8169C15.9614 21.0476 14.0386 21.0477 12.9447 19.8169L11.4395 18.1236L12.5606 17.1271L14.0658 18.8204C14.563 19.3798 15.437 19.3798 15.9342 18.8204L21.2583 12.8308C21.6793 12.3572 21.6793 11.6435 21.2584 11.17L15.9343 5.18029C15.437 4.6209 14.563 4.6209 14.0658 5.18029" fill="currentColor"/><path d="M6.94474 4.18374C8.03866 2.95307 9.96152 2.95308 11.0555 4.18374L16.3795 10.1733C17.3057 11.2152 17.3058 12.7855 16.3796 13.8273L11.0555 19.8169C9.96155 21.0476 8.03866 21.0477 6.94474 19.8169L1.62067 13.8273C0.694507 12.7855 0.694485 11.2152 1.62064 10.1734L6.94474 4.18374Z" fill="currentColor"/>'
  },
  "keyframe": {
    viewBox: "0 0 24 24",
    strokeWidth: "1.5",
    content: '<path d="M20.777 13.3453L13.4799 21.3721C12.6864 22.245 11.3136 22.245 10.5201 21.3721L3.22304 13.3453C2.52955 12.5825 2.52955 11.4175 3.22304 10.6547L10.5201 2.62787C11.3136 1.755 12.6864 1.755 13.4799 2.62787L20.777 10.6547C21.4705 11.4175 21.4705 12.5825 20.777 13.3453Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  "wrench": {
    viewBox: "0 0 24 24",
    strokeWidth: "1.5",
    content: '<path d="M10.0503 10.6066L2.97923 17.6777C2.19818 18.4587 2.19818 19.725 2.97923 20.5061V20.5061C3.76027 21.2871 5.0266 21.2871 5.80765 20.5061L12.8787 13.435" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.0502 10.6066C9.20638 8.45358 9.37134 5.6286 11.1109 3.88909C12.8504 2.14957 16.0606 1.76777 17.8284 2.82843L14.7877 5.8691L14.5051 8.98014L17.6161 8.69753L20.6568 5.65685C21.7175 7.42462 21.3357 10.6349 19.5961 12.3744C17.8566 14.1139 15.0316 14.2789 12.8786 13.435" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>'
  }
};
const legacyIconNames = {
  "file-code": "file-text",
  "file-directory-fill": "folder",
  "file-directory-open-fill": "folder",
  gear: "settings",
  "light-bulb": "sun",
  markdown: "file-text",
  repo: "folder",
  sync: "refresh-cw",
  comment: "message-square",
  apps: "grid",
  "home-fill": "home",
  "mark-github": "github",
  megaphone: "volume-2",
  paintbrush: "edit-3",
  "comment-discussion": "message-circle"
};
function Icon({
  name,
  size = 16,
  label: label2,
  color,
  offsetX = 0,
  offsetY = 0,
  rotate = 0,
  flipX = false,
  flipY = false,
  strokeWeight,
  scale = 1,
  className
}) {
  const source = name.includes("/") ? name.split("/")[0] : null;
  const iconName = name.includes("/") ? name.slice(name.indexOf("/") + 1) : name;
  const ariaProps = label2 ? { "aria-label": label2, role: "img" } : { "aria-hidden": true };
  const scaleX = (flipX ? -1 : 1) * scale;
  const scaleY = (flipY ? -1 : 1) * scale;
  const hasTransform = offsetX || offsetY || rotate || flipX || flipY || scale !== 1;
  const wrapperStyle = {
    ...color ? { color } : {},
    display: "inline-flex",
    ...hasTransform ? {
      translate: offsetX || offsetY ? `${offsetX}px ${offsetY}px` : void 0,
      rotate: rotate ? `${rotate}deg` : void 0,
      scale: flipX || flipY || scale !== 1 ? `${scaleX} ${scaleY}` : void 0
    } : {}
  };
  let svgContent = null;
  const custom = !source ? customIcons[iconName] : null;
  if (custom) {
    if (custom.path) {
      svgContent = /* @__PURE__ */ jsxs("svg", { width: size, height: size, viewBox: custom.viewBox, fill: "currentColor", ...ariaProps, children: [
        custom.title && /* @__PURE__ */ jsx("title", { children: custom.title }),
        /* @__PURE__ */ jsx("path", { d: custom.path, fillRule: custom.fillRule, clipRule: custom.fillRule })
      ] });
    } else if (custom.strokePaths) {
      svgContent = /* @__PURE__ */ jsx("svg", { width: size, height: size, viewBox: custom.viewBox, fill: "none", stroke: "currentColor", strokeWidth: strokeWeight ?? custom.strokeWidth ?? "1.5", strokeLinecap: "round", strokeLinejoin: "round", ...ariaProps, children: custom.strokePaths.map((d, i) => /* @__PURE__ */ jsx("path", { d }, i)) });
    } else if (custom.strokeRect || custom.fillPaths) {
      svgContent = /* @__PURE__ */ jsxs("svg", { width: size, height: size, viewBox: custom.viewBox, fill: "none", stroke: "currentColor", strokeWidth: strokeWeight ?? "2", ...ariaProps, children: [
        custom.strokeRect && /* @__PURE__ */ jsx("rect", { ...custom.strokeRect }),
        custom.fillPaths?.map((d, i) => /* @__PURE__ */ jsx("path", { d, fill: "currentColor", stroke: "none" }, i))
      ] });
    }
  }
  if (iconName === "copilot" && source === null) {
    svgContent = /* @__PURE__ */ jsxs("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "currentColor", ...ariaProps, children: [
      /* @__PURE__ */ jsx("path", { d: "M7.998 15.035c-4.562 0-7.873-2.914-7.998-3.749V9.338c.085-.628.677-1.686 1.588-2.065.013-.07.024-.143.036-.218.029-.183.06-.384.126-.612-.201-.508-.254-1.084-.254-1.656 0-.87.128-1.769.693-2.484.579-.733 1.494-1.124 2.724-1.261 1.206-.134 2.262.034 2.944.765.05.053.096.108.139.165.044-.057.094-.112.143-.165.682-.731 1.738-.899 2.944-.765 1.23.137 2.145.528 2.724 1.261.566.715.693 1.614.693 2.484 0 .572-.053 1.148-.254 1.656.066.228.098.429.126.612.012.076.024.148.037.218.924.385 1.522 1.471 1.591 2.095v1.872c0 .766-3.351 3.795-8.002 3.795Zm0-1.485c2.28 0 4.584-1.11 5.002-1.433V7.862l-.023-.116c-.49.21-1.075.291-1.727.291-1.146 0-2.059-.327-2.71-.991A3.222 3.222 0 0 1 8 6.303a3.24 3.24 0 0 1-.544.743c-.65.664-1.563.991-2.71.991-.652 0-1.236-.081-1.727-.291l-.023.116v4.255c.419.323 2.722 1.433 5.002 1.433ZM6.762 2.83c-.193-.206-.637-.413-1.682-.297-1.019.113-1.479.404-1.713.7-.247.312-.369.789-.369 1.554 0 .793.129 1.171.308 1.371.162.181.519.379 1.442.379.853 0 1.339-.235 1.638-.54.315-.322.527-.827.617-1.553.117-.935-.037-1.395-.241-1.614Zm4.155-.297c-1.044-.116-1.488.091-1.681.297-.204.219-.359.679-.242 1.614.091.726.303 1.231.618 1.553.299.305.784.54 1.638.54.922 0 1.28-.198 1.442-.379.179-.2.308-.578.308-1.371 0-.765-.123-1.242-.37-1.554-.233-.296-.693-.587-1.713-.7Z" }),
      /* @__PURE__ */ jsx("path", { d: "M6.25 9.037a.75.75 0 0 1 .75.75v1.501a.75.75 0 0 1-1.5 0V9.787a.75.75 0 0 1 .75-.75Zm4.25.75v1.501a.75.75 0 0 1-1.5 0V9.787a.75.75 0 0 1 1.5 0Z" })
    ] });
  }
  if (!svgContent && source === "primer") {
    const PrimerIcon = getPrimerIconComponent(iconName);
    if (PrimerIcon) {
      svgContent = createElement(
        Suspense,
        { fallback: null },
        createElement(PrimerIcon, { size, ...ariaProps })
      );
    }
  }
  if (!svgContent && source === "primer") {
    const icon = feather.icons[legacyIconNames[iconName] || iconName];
    if (icon) {
      const html = icon.toSvg({
        width: size,
        height: size,
        "stroke-width": strokeWeight ?? 2,
        ...label2 ? { "aria-label": label2 } : { "aria-hidden": "true" }
      });
      svgContent = /* @__PURE__ */ jsx("span", { dangerouslySetInnerHTML: { __html: html } });
    }
  }
  if (!svgContent && source === "feather") {
    const icon = feather.icons[iconName];
    if (icon) {
      const html = icon.toSvg({
        width: size,
        height: size,
        "stroke-width": strokeWeight ?? 2,
        ...label2 ? { "aria-label": label2 } : { "aria-hidden": "true" }
      });
      svgContent = /* @__PURE__ */ jsx("span", { dangerouslySetInnerHTML: { __html: html } });
    }
  }
  if (!svgContent && source === "iconoir") {
    const iconoir = iconoirIcons[iconName];
    if (iconoir) {
      const sw = strokeWeight ?? iconoir.strokeWidth;
      svgContent = /* @__PURE__ */ jsx(
        "svg",
        {
          width: size,
          height: size,
          viewBox: iconoir.viewBox,
          fill: iconoir.fill ? "currentColor" : "none",
          strokeWidth: iconoir.fill ? void 0 : sw,
          ...ariaProps,
          dangerouslySetInnerHTML: { __html: iconoir.content }
        }
      );
    }
  }
  if (!svgContent) return null;
  return /* @__PURE__ */ jsx("span", { className, style: wrapperStyle, children: svgContent });
}
const __iconNode$1 = [
  [
    "path",
    {
      d: "M16 10a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 14.286V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z",
      key: "1n2ejm"
    }
  ],
  [
    "path",
    {
      d: "M20 9a2 2 0 0 1 2 2v10.286a.71.71 0 0 1-1.212.502l-2.202-2.202A2 2 0 0 0 17.172 19H10a2 2 0 0 1-2-2v-1",
      key: "1qfcsi"
    }
  ]
];
const MessagesSquare = createLucideIcon$1("messages-square", __iconNode$1);
const __iconNode = [
  ["path", { d: "m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7", key: "132q7q" }],
  ["rect", { x: "2", y: "4", width: "20", height: "16", rx: "2", key: "izxlao" }]
];
const Mail = createLucideIcon$1("mail", __iconNode);
function ViewGridIcon() {
  return /* @__PURE__ */ jsx(Icon, { name: "iconoir/view-grid", size: 12 });
}
function FrameDeviceIcon() {
  return /* @__PURE__ */ jsx(Icon, { name: "iconoir/computer", size: 12 });
}
function FrameThemeIcon() {
  return /* @__PURE__ */ jsx(Icon, { name: "primer/sun", size: 12 });
}
function DeleteIcon() {
  return /* @__PURE__ */ jsx("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: /* @__PURE__ */ jsx("path", { d: "M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.15l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z" }) });
}
function ZoomInIcon() {
  return /* @__PURE__ */ jsx("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: /* @__PURE__ */ jsx("path", { d: "M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z" }) });
}
function ZoomOutIcon() {
  return /* @__PURE__ */ jsx("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: /* @__PURE__ */ jsx("path", { d: "M2.75 7.25h10.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5Z" }) });
}
function EditIcon() {
  return /* @__PURE__ */ jsx("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: /* @__PURE__ */ jsx("path", { d: "M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm.176 4.823L9.75 4.81l-6.286 6.287a.253.253 0 0 0-.064.108l-.558 1.953 1.953-.558a.253.253 0 0 0 .108-.064Zm1.238-3.763a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354Z" }) });
}
function OpenExternalIcon() {
  return /* @__PURE__ */ jsx("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: /* @__PURE__ */ jsx("path", { d: "M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2Zm6.854-1h4.146a.25.25 0 0 1 .25.25v4.146a.25.25 0 0 1-.427.177L13.03 4.03 9.28 7.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.75-3.75-1.543-1.543A.25.25 0 0 1 10.604 1Z" }) });
}
function EyeIcon() {
  return /* @__PURE__ */ jsx(Eye, { size: 12 });
}
function EyeClosedIcon() {
  return /* @__PURE__ */ jsx(EyeOff, { size: 12 });
}
function CodeIcon() {
  return /* @__PURE__ */ jsx(Code, { size: 12 });
}
function UnwrapIcon() {
  return /* @__PURE__ */ jsx(Minimize2, { size: 12 });
}
function ImageIcon() {
  return /* @__PURE__ */ jsx(Image$1, { size: 12 });
}
function CopyIcon() {
  return /* @__PURE__ */ jsxs("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx("path", { d: "M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z" }),
    /* @__PURE__ */ jsx("path", { d: "M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" })
  ] });
}
function MoreIcon() {
  return /* @__PURE__ */ jsx("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: /* @__PURE__ */ jsx("path", { d: "M8 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM1.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm13 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" }) });
}
function LinkIcon() {
  return /* @__PURE__ */ jsx("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: /* @__PURE__ */ jsx("path", { d: "m7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 1.998 1.998 0 0 0 2.83 0l2.5-2.5a2.002 2.002 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042Zm-4.69 9.64a1.998 1.998 0 0 0 2.83 0l1.25-1.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-1.25 1.25a3.5 3.5 0 1 1-4.95-4.95l2.5-2.5a3.5 3.5 0 0 1 4.95 0 .751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018 1.998 1.998 0 0 0-2.83 0l-2.5 2.5a1.998 1.998 0 0 0 0 2.83Z" }) });
}
function ChevronDownIcon() {
  return /* @__PURE__ */ jsx("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: /* @__PURE__ */ jsx("path", { d: "M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z" }) });
}
function DownloadIcon() {
  return /* @__PURE__ */ jsxs("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx("path", { d: "M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Z" }),
    /* @__PURE__ */ jsx("path", { d: "M7.25 7.689V2a.75.75 0 0 1 1.5 0v5.689l1.97-1.969a.749.749 0 1 1 1.06 1.06l-3.25 3.25a.749.749 0 0 1-1.06 0L4.22 6.78a.749.749 0 1 1 1.06-1.06Z" })
  ] });
}
function ExpandIcon() {
  return /* @__PURE__ */ jsx(Maximize, { size: 12 });
}
function CollapseIcon() {
  return /* @__PURE__ */ jsx(Minimize, { size: 12 });
}
function SyncIcon() {
  return /* @__PURE__ */ jsx("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: /* @__PURE__ */ jsx("path", { d: "M1.705 8.005a.75.75 0 0 1 .834.656 5.5 5.5 0 0 0 9.592 2.97l-1.204-1.204a.25.25 0 0 1 .177-.427h3.646a.25.25 0 0 1 .25.25v3.646a.25.25 0 0 1-.427.177l-1.38-1.38A7.002 7.002 0 0 1 1.05 8.84a.75.75 0 0 1 .656-.834ZM8 2.5a5.487 5.487 0 0 0-4.131 1.869l1.204 1.204A.25.25 0 0 1 4.896 6H1.25A.25.25 0 0 1 1 5.75V2.104a.25.25 0 0 1 .427-.177l1.38 1.38A7.002 7.002 0 0 1 14.95 7.16a.75.75 0 0 1-1.49.178A5.5 5.5 0 0 0 8 2.5Z" }) });
}
function UnfoldIcon() {
  return /* @__PURE__ */ jsx(UnfoldVertical, { size: 12 });
}
function FoldIcon() {
  return /* @__PURE__ */ jsx(FoldVertical, { size: 12 });
}
function ColumnsIcon() {
  return /* @__PURE__ */ jsxs("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx("path", { d: "M12 3v18" }),
    /* @__PURE__ */ jsx("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" })
  ] });
}
function CheckMarkIcon() {
  return /* @__PURE__ */ jsx(Check, { size: 12 });
}
function BroadcastIcon() {
  return /* @__PURE__ */ jsx(Radio, { size: 12 });
}
function MirrorIcon() {
  return /* @__PURE__ */ jsx(Columns2, { size: 12 });
}
function TypographyIcon() {
  return /* @__PURE__ */ jsx(Type, { size: 12 });
}
function CropIcon() {
  return /* @__PURE__ */ jsx("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: /* @__PURE__ */ jsx("path", { d: "M3.75 1a.75.75 0 0 1 .75.75V3.5h7a1.75 1.75 0 0 1 1.75 1.75v7h1.75a.75.75 0 0 1 0 1.5H13.25v1.5a.75.75 0 0 1-1.5 0v-1.5h-7A1.75 1.75 0 0 1 3 12.5v-7H1.25a.75.75 0 0 1 0-1.5H3V1.75A.75.75 0 0 1 3.75 1ZM4.5 5.25v7c0 .138.112.25.25.25h7V5.25a.25.25 0 0 0-.25-.25h-7Z" }) });
}
function CameraIcon() {
  return /* @__PURE__ */ jsx("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: /* @__PURE__ */ jsx("path", { d: "M3.25 3.5h1.568l.783-1.174A.75.75 0 0 1 6.232 2h3.536a.75.75 0 0 1 .624.326L11.182 3.5H12.75A1.75 1.75 0 0 1 14.5 5.25v7A1.75 1.75 0 0 1 12.75 14h-9.5A1.75 1.75 0 0 1 1.5 12.25v-7A1.75 1.75 0 0 1 3.25 3.5ZM3 5.25v7a.25.25 0 0 0 .25.25h9.5a.25.25 0 0 0 .25-.25v-7a.25.25 0 0 0-.25-.25h-2a.75.75 0 0 1-.624-.326L9.342 3.5H6.658L5.874 4.674A.75.75 0 0 1 5.25 5h-2a.25.25 0 0 0-.25.25ZM8 6.5a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5Z" }) });
}
const ICON_REGISTRY = {
  "trash": DeleteIcon,
  "zoom-in": ZoomInIcon,
  "zoom-out": ZoomOutIcon,
  "edit": EditIcon,
  "open-external": OpenExternalIcon,
  "eye": EyeIcon,
  "eye-closed": EyeClosedIcon,
  "code": CodeIcon,
  "unwrap": UnwrapIcon,
  "image": ImageIcon,
  "copy": CopyIcon,
  "link": LinkIcon,
  "more": MoreIcon,
  "chevron-down": ChevronDownIcon,
  "download": DownloadIcon,
  "expand": ExpandIcon,
  "collapse": CollapseIcon,
  "sync": SyncIcon,
  "unfold": UnfoldIcon,
  "fold": FoldIcon,
  "columns": ColumnsIcon,
  "broadcast": BroadcastIcon,
  "chat": () => /* @__PURE__ */ jsx(MessagesSquare, { size: 12 }),
  "crown": () => /* @__PURE__ */ jsxs("svg", { width: 12, height: 12, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx("path", { d: "m2 5 5 5 5-7 5 7 5-5-3 14H5L2 5Z" }),
    /* @__PURE__ */ jsx("path", { d: "M5 22h14" })
  ] }),
  "send": () => /* @__PURE__ */ jsx(Mail, { size: 12 }),
  "check": CheckMarkIcon,
  "crop": CropIcon,
  "camera": CameraIcon,
  "mirror": MirrorIcon,
  "typography": TypographyIcon,
  "view-grid": ViewGridIcon,
  "iconoir/computer": FrameDeviceIcon,
  "primer/sun": FrameThemeIcon,
  "iconoir/arrow-separate": () => /* @__PURE__ */ jsx(Icon, { name: "iconoir/arrow-separate", size: 12 })
};
const bar = "_bar_vjqkj_3";
const widgetIcon = "_widgetIcon_vjqkj_18";
const label = "_label_vjqkj_28";
const actionBtn = "_actionBtn_vjqkj_38";
const leaderCrown = "_leaderCrown_vjqkj_61";
const styles$1 = {
  bar,
  widgetIcon,
  label,
  actionBtn,
  leaderCrown
};
function isNamedIcon(str) {
  return str && /^[a-z0-9/-]+$/i.test(str);
}
function resolveFeatureDisplay(feature, getState) {
  let Icon2 = ICON_REGISTRY[feature.icon];
  let label2 = feature.label || feature.action;
  if (feature.toggle && getState) {
    const isActive = getState(feature.toggle.stateKey);
    if (isActive) {
      if (feature.toggle.activeIcon) Icon2 = ICON_REGISTRY[feature.toggle.activeIcon] || Icon2;
      if (feature.toggle.activeLabel) label2 = feature.toggle.activeLabel;
    }
  }
  return { Icon: Icon2, label: label2 };
}
function ExpandedPaneTopBar({ label: label2, widgetType, widgetProps, showClose, onClose, actions, features, getState, onAction }) {
  const resolvedActions = typeof actions === "function" ? actions() : actions;
  const meta = widgetType ? getWidgetMeta(widgetType) : null;
  const iconName = meta?.icon || null;
  const showLeaderCrown = (widgetType === "agent" || widgetType === "agent-chat") && widgetProps?.role === "leader";
  return /* @__PURE__ */ jsxs("div", { className: styles$1.bar, children: [
    iconName && /* @__PURE__ */ jsx("span", { className: styles$1.widgetIcon, "aria-hidden": "true", children: isNamedIcon(iconName) ? /* @__PURE__ */ jsx(Icon, { name: iconName, size: 12 }) : iconName }),
    /* @__PURE__ */ jsx("span", { className: styles$1.label, children: label2 }),
    showLeaderCrown && /* @__PURE__ */ jsx("span", { className: styles$1.leaderCrown, "aria-label": "Squad leader", children: /* @__PURE__ */ jsx(Icon, { name: "iconoir/crown", size: 12, color: "#AE843B" }) }),
    features?.map((feature) => {
      const { Icon: Icon2, label: featureLabel } = resolveFeatureDisplay(feature, getState);
      return /* @__PURE__ */ jsx(TooltipAdapter, { text: featureLabel, direction: "s", children: /* @__PURE__ */ jsx(
        "button",
        {
          className: styles$1.actionBtn,
          onClick: () => onAction?.(feature.action),
          "aria-label": featureLabel,
          children: Icon2 ? /* @__PURE__ */ jsx(Icon2, {}) : featureLabel
        }
      ) }, feature.id);
    }),
    resolvedActions?.map((action, i) => /* @__PURE__ */ jsx(TooltipAdapter, { text: action.label || action.ariaLabel || "Action", direction: "s", children: /* @__PURE__ */ jsx(
      "button",
      {
        className: styles$1.actionBtn,
        onClick: action.onClick,
        "aria-label": action.ariaLabel || action.label,
        children: action.icon || action.label
      }
    ) }, i)),
    showClose && /* @__PURE__ */ jsx(TooltipAdapter, { text: "Close fullscreen", direction: "s", children: /* @__PURE__ */ jsx("button", { className: styles$1.actionBtn, onClick: onClose, "aria-label": "Close expanded view", autoFocus: true, children: /* @__PURE__ */ jsx(Minimize, { size: 12 }) }) })
  ] });
}
const transitionStatus = "_transitionStatus_1imjp_3";
const backdrop = "_backdrop_1imjp_18";
const modalContainer = "_modalContainer_1imjp_36";
const modalBody = "_modalBody_1imjp_59";
const fullContainer = "_fullContainer_1imjp_67";
const immersive = "_immersive_1imjp_80";
const immersiveClosing = "_immersiveClosing_1imjp_84";
const immersiveCloseBtn = "_immersiveCloseBtn_1imjp_88";
const singleFull = "_singleFull_1imjp_117";
const grid = "_grid_1imjp_125";
const pane = "_pane_1imjp_134";
const column = "_column_1imjp_145";
const paneContent = "_paneContent_1imjp_160";
const divider = "_divider_1imjp_169";
const rowDivider = "_rowDivider_1imjp_203";
const styles = {
  transitionStatus,
  backdrop,
  modalContainer,
  modalBody,
  fullContainer,
  immersive,
  immersiveClosing,
  immersiveCloseBtn,
  singleFull,
  grid,
  pane,
  column,
  paneContent,
  divider,
  rowDivider
};
async function preparePaneTransition(panes) {
  const results = await Promise.allSettled(panes.filter((pane2) => typeof pane2.beforeDetach === "function").map((pane2) => Promise.resolve().then(() => pane2.beforeDetach())));
  const releases = results.filter((result) => result.status === "fulfilled" && typeof result.value === "function").map((result) => result.value);
  const release = () => {
    for (const unlock of releases) {
      try {
        unlock();
      } catch {
      }
    }
  };
  const failure = results.find((result) => result.status === "rejected");
  if (failure) {
    release();
    throw failure.reason;
  }
  return release;
}
function paneLayoutNeedsPreparation(previous, next) {
  if (!previous.flat().some((pane2) => typeof pane2.beforeDetach === "function")) return false;
  const identities = (layout) => JSON.stringify(layout.map((column2) => column2.map((pane2) => [pane2.id, pane2.kind])));
  return identities(previous) !== identities(next);
}
const ownerGuards = /* @__PURE__ */ new Map();
const listeners = /* @__PURE__ */ new Set();
const notify = () => {
  for (const listener of listeners) listener();
};
const subscribePaneGuards = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const hasPaneGuard = (ownerId) => Boolean(ownerGuards.get(ownerId)?.size);
function registerPaneGuard(ownerId, prepare) {
  if (!ownerId) throw new Error("A native expanded pane requires its exact owning widget ID.");
  const guards = ownerGuards.get(ownerId) || /* @__PURE__ */ new Set();
  guards.add(prepare);
  ownerGuards.set(ownerId, guards);
  notify();
  return () => {
    guards.delete(prepare);
    if (!guards.size) ownerGuards.delete(ownerId);
    notify();
  };
}
function prepareOwnerPaneTransition(ownerId) {
  return preparePaneTransition([...ownerGuards.get(ownerId) || []].map((beforeDetach) => ({ beforeDetach })));
}
const MIN_PANE_WIDTH_PX = 120;
const MIN_PANE_HEIGHT_PX = 80;
function readCanvasThemePortalProps() {
  if (typeof document === "undefined") return { attrs: {}, style: {} };
  const scroll = document.querySelector("[data-storyboard-canvas-scroll]");
  if (!scroll) return { attrs: {}, style: {} };
  const attrs = {};
  for (const name of ["data-color-mode", "data-light-theme", "data-dark-theme", "data-sb-canvas-theme"]) {
    const v = scroll.getAttribute(name);
    if (v) attrs[name] = v;
  }
  const style = {};
  const inline = scroll.style;
  for (let i = 0; i < inline.length; i++) {
    const prop = inline[i];
    if (prop.startsWith("--")) style[prop] = inline.getPropertyValue(prop);
  }
  return { attrs, style };
}
function ExpandedPane({ initialPanes, initialLayout, variant = "modal", closing: closingProp = false, onClose, ownerId }) {
  const [closingInternal, setClosingInternal] = useState(false);
  const isClosing = closingProp || closingInternal;
  const closedRef = useRef(false);
  const commitClose = useCallback(() => {
    if (variant === "immersive") {
      setClosingInternal(true);
    } else {
      onClose();
    }
  }, [variant, onClose]);
  useEffect(() => {
    if (!isClosing) return;
    closedRef.current = false;
    const timer = setTimeout(() => {
      if (!closedRef.current) {
        closedRef.current = true;
        onClose();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [isClosing, onClose]);
  const [layout, setLayout] = useState(() => {
    if (initialLayout) return initialLayout;
    if (initialPanes) return initialPanes.map((p) => [p]);
    return [];
  });
  const [pendingLayout, setPendingLayout] = useState(null);
  const [transitionError, setTransitionError] = useState("");
  const [preparing, setPreparing] = useState(false);
  const closePending = useRef(false);
  const prevInitialLayoutRef = useRef(initialLayout);
  if (initialLayout && initialLayout !== prevInitialLayoutRef.current) {
    prevInitialLayoutRef.current = initialLayout;
    if (paneLayoutNeedsPreparation(layout, initialLayout)) setPendingLayout({ next: initialLayout });
    else {
      setPendingLayout(null);
      setLayout(initialLayout);
    }
  }
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const handler = () => forceUpdate((n) => n + 1);
    document.addEventListener("storyboard:expanded-pane:refresh", handler);
    return () => document.removeEventListener("storyboard:expanded-pane:refresh", handler);
  }, []);
  const allPanes = useMemo(() => layout.flat(), [layout]);
  useLayoutEffect(() => {
    if (!ownerId || !allPanes.some((pane2) => typeof pane2.beforeDetach === "function")) return;
    return registerPaneGuard(ownerId, async () => {
      setPreparing(true);
      setTransitionError("");
      try {
        return await preparePaneTransition(allPanes);
      } catch (error) {
        setTransitionError(String(error?.message || "The conversation draft could not be saved. Reconnect and retry.").slice(0, 500));
        throw error;
      } finally {
        setPreparing(false);
      }
    });
  }, [ownerId, allPanes]);
  const handleClose = useCallback(() => {
    if (closePending.current) return;
    if (ownerId && hasPaneGuard(ownerId)) {
      commitClose();
      return;
    }
    if (!allPanes.some((pane2) => typeof pane2.beforeDetach === "function")) {
      commitClose();
      return;
    }
    closePending.current = true;
    setPreparing(true);
    setTransitionError("");
    void preparePaneTransition(allPanes).then((release) => {
      try {
        flushSync(commitClose);
      } finally {
        release();
      }
    }).catch((error) => setTransitionError(String(error?.message || "The conversation draft could not be saved. Reconnect and retry closing.").slice(0, 500))).finally(() => {
      closePending.current = false;
      setPreparing(false);
    });
  }, [allPanes, commitClose, ownerId]);
  useEffect(() => {
    if (!pendingLayout) return;
    let cancelled = false;
    setPreparing(true);
    setTransitionError("");
    void preparePaneTransition(allPanes).then((release) => {
      try {
        if (!cancelled) {
          for (const pane2 of allPanes) {
            if (typeof pane2.beforeDetach !== "function") continue;
            detachRefs.current.get(pane2.id)?.();
            detachRefs.current.delete(pane2.id);
          }
          flushSync(() => {
            setLayout(pendingLayout.next);
            setPendingLayout(null);
            setPreparing(false);
          });
        }
      } finally {
        release();
      }
    }).catch((error) => {
      if (!cancelled) setTransitionError(String(error?.message || "The conversation draft could not be saved. Retry the layout change.").slice(0, 500));
    }).finally(() => {
      if (!cancelled) setPreparing(false);
    });
    return () => {
      cancelled = true;
    };
  }, [pendingLayout, allPanes]);
  const transitionStatus2 = (preparing || transitionError) && /* @__PURE__ */ jsxs("div", { className: styles.transitionStatus, role: transitionError ? "alert" : "status", children: [
    transitionError || "Saving the conversation draft before changing this view…",
    pendingLayout && transitionError && !preparing && /* @__PURE__ */ jsx("button", { type: "button", onClick: () => setPendingLayout({ next: pendingLayout.next }), children: "Retry layout change" })
  ] });
  const [columnSizes, setColumnSizes] = useState(() => layout.map(() => "1fr"));
  const [rowRatios, setRowRatios] = useState(
    () => layout.map((col) => col.map(() => 1))
  );
  const [, setActivePaneId] = useState(null);
  const containerRefs = useRef(/* @__PURE__ */ new Map());
  const detachRefs = useRef(/* @__PURE__ */ new Map());
  const observerRefs = useRef(/* @__PURE__ */ new Map());
  const totalPanes = allPanes.length;
  const isSplit = totalPanes >= 2;
  useLayoutEffect(() => {
    const detaches = detachRefs.current;
    for (const pane2 of allPanes) {
      if (pane2.kind !== "external") continue;
      const container = containerRefs.current.get(pane2.id);
      if (!container) continue;
      if (detachRefs.current.has(pane2.id)) continue;
      const detach = pane2.attach(container);
      detachRefs.current.set(pane2.id, detach);
    }
    return () => {
      for (const [, detach] of detaches) {
        detach?.();
      }
      detaches.clear();
    };
  }, []);
  useLayoutEffect(() => {
    const currentIds = new Set(allPanes.map((p) => p.id));
    for (const [id, detach] of detachRefs.current) {
      if (!currentIds.has(id)) {
        detach?.();
        detachRefs.current.delete(id);
        observerRefs.current.get(id)?.disconnect();
        observerRefs.current.delete(id);
      }
    }
    for (const pane2 of allPanes) {
      if (pane2.kind !== "external") continue;
      if (detachRefs.current.has(pane2.id)) continue;
      const container = containerRefs.current.get(pane2.id);
      if (!container) continue;
      const detach = pane2.attach(container);
      detachRefs.current.set(pane2.id, detach);
    }
  });
  useEffect(() => {
    const observers = observerRefs.current;
    for (const pane2 of allPanes) {
      if (pane2.kind !== "external" || !pane2.onResize) continue;
      if (observerRefs.current.has(pane2.id)) continue;
      const container = containerRefs.current.get(pane2.id);
      if (!container) continue;
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          pane2.onResize(entry.contentRect);
        }
      });
      ro.observe(container);
      observerRefs.current.set(pane2.id, ro);
    }
    return () => {
      for (const ro of observers.values()) {
        ro.disconnect();
      }
      observers.clear();
    };
  }, [allPanes]);
  const getContainerRef = useCallback((paneId) => (el) => {
    if (el) {
      containerRefs.current.set(paneId, el);
    } else {
      containerRefs.current.delete(paneId);
    }
  }, []);
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        handleClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [handleClose]);
  const dragState = useRef(null);
  const activeDividerCleanupRef = useRef(null);
  const startDividerDrag = useCallback((state, handleMove) => {
    activeDividerCleanupRef.current?.();
    dragState.current = state;
    const releaseIframeLock = acquireIframePointerLock(document);
    let finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", finish);
      document.removeEventListener("pointercancel", finish);
      window.removeEventListener("blur", finish);
      if (activeDividerCleanupRef.current === finish) {
        activeDividerCleanupRef.current = null;
        dragState.current = null;
      }
      releaseIframeLock();
    }
    activeDividerCleanupRef.current = finish;
    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", finish);
    document.addEventListener("pointercancel", finish);
    window.addEventListener("blur", finish);
  }, []);
  useEffect(() => () => activeDividerCleanupRef.current?.(), []);
  useEffect(() => {
    if (isClosing) activeDividerCleanupRef.current?.();
  }, [isClosing]);
  const handleColumnDividerPointerDown = useCallback((e, dividerIndex) => {
    e.preventDefault();
    const gridEl = e.target.closest(`.${styles.grid}`);
    if (!gridEl) return;
    const currentCols = Array.from(gridEl.children).filter((el) => !el.classList.contains(styles.divider)).map((el) => el.getBoundingClientRect().width);
    const state = {
      kind: "column",
      dividerIndex,
      startX: e.clientX,
      startWidths: currentCols
    };
    function handleMove(ev) {
      if (!dragState.current || dragState.current.kind !== "column") return;
      const { dividerIndex: di, startX, startWidths } = dragState.current;
      const dx = ev.clientX - startX;
      const leftW = Math.max(MIN_PANE_WIDTH_PX, startWidths[di] + dx);
      const rightW = Math.max(MIN_PANE_WIDTH_PX, startWidths[di + 1] - dx);
      const newWidths = [...startWidths];
      newWidths[di] = leftW;
      newWidths[di + 1] = rightW;
      const total = newWidths.reduce((a, b) => a + b, 0);
      setColumnSizes(newWidths.map((w) => `${(w / total * layout.length).toFixed(3)}fr`));
    }
    startDividerDrag(state, handleMove);
  }, [layout.length, startDividerDrag]);
  const handleRowDividerPointerDown = useCallback((e, colIndex) => {
    e.preventDefault();
    const columnEl = e.target.closest(`.${styles.column}`);
    if (!columnEl) return;
    const paneEls = Array.from(columnEl.children).filter(
      (el) => !el.classList.contains(styles.rowDivider)
    );
    const startHeights = paneEls.map((el) => el.getBoundingClientRect().height);
    const state = {
      kind: "row",
      colIndex,
      startY: e.clientY,
      startHeights
    };
    function handleMove(ev) {
      if (!dragState.current || dragState.current.kind !== "row") return;
      const { colIndex: ci, startY, startHeights: sh } = dragState.current;
      const dy = ev.clientY - startY;
      const topH = Math.max(MIN_PANE_HEIGHT_PX, sh[0] + dy);
      const bottomH = Math.max(MIN_PANE_HEIGHT_PX, sh[1] - dy);
      const total = topH + bottomH;
      setRowRatios((prev) => {
        const next = [...prev];
        next[ci] = [topH / total, bottomH / total];
        return next;
      });
    }
    startDividerDrag(state, handleMove);
  }, [startDividerDrag]);
  const gridTemplateColumns = useMemo(() => {
    if (layout.length < 2) return void 0;
    const parts = [];
    for (let i = 0; i < columnSizes.length; i++) {
      if (i > 0) parts.push("0px");
      parts.push(columnSizes[i]);
    }
    return parts.join(" ");
  }, [layout.length, columnSizes]);
  function renderPaneContent(pane2) {
    if (pane2.kind === "react") {
      return /* @__PURE__ */ jsx(
        "div",
        {
          ref: getContainerRef(pane2.id),
          className: styles.paneContent,
          onPointerDown: () => setActivePaneId(pane2.id),
          children: pane2.render()
        }
      );
    }
    return /* @__PURE__ */ jsx(
      "div",
      {
        ref: getContainerRef(pane2.id),
        className: styles.paneContent,
        onPointerDown: () => setActivePaneId(pane2.id)
      }
    );
  }
  function renderColumn(column2, colIndex, isLastCol) {
    if (column2.length === 1) {
      const pane2 = column2[0];
      return /* @__PURE__ */ jsxs("div", { className: styles.pane, children: [
        /* @__PURE__ */ jsx(
          ExpandedPaneTopBar,
          {
            label: pane2.label,
            widgetType: pane2.widgetType,
            widgetProps: pane2.widgetProps,
            actions: pane2.actions,
            features: pane2.features,
            getState: pane2.getState,
            onAction: pane2.onAction,
            showClose: isLastCol,
            onClose: handleClose
          }
        ),
        renderPaneContent(pane2)
      ] }, pane2.id);
    }
    const ratios = rowRatios[colIndex] || column2.map(() => 1);
    return /* @__PURE__ */ jsx("div", { className: styles.column, children: column2.map((pane2, rowIdx) => /* @__PURE__ */ jsxs(
      PaneWithRowDivider,
      {
        pane: pane2,
        flex: ratios[rowIdx] ?? 1,
        isLast: rowIdx === column2.length - 1,
        colIndex,
        onRowDividerPointerDown: handleRowDividerPointerDown,
        children: [
          /* @__PURE__ */ jsx(
            ExpandedPaneTopBar,
            {
              label: pane2.label,
              widgetType: pane2.widgetType,
              widgetProps: pane2.widgetProps,
              actions: pane2.actions,
              features: pane2.features,
              getState: pane2.getState,
              onAction: pane2.onAction,
              showClose: isLastCol && rowIdx === 0,
              onClose: handleClose
            }
          ),
          renderPaneContent(pane2)
        ]
      },
      pane2.id
    )) }, `col-${colIndex}`);
  }
  const [themePortalProps, setThemePortalProps] = useState(() => readCanvasThemePortalProps());
  useEffect(() => {
    function refresh() {
      setThemePortalProps(readCanvasThemePortalProps());
    }
    document.addEventListener("storyboard:theme:changed", refresh);
    return () => document.removeEventListener("storyboard:theme:changed", refresh);
  }, []);
  if (!isSplit && variant === "modal") {
    const pane2 = allPanes[0];
    if (!pane2) return null;
    return createPortal(
      /* @__PURE__ */ jsx(
        "div",
        {
          className: styles.backdrop,
          onClick: handleClose,
          onPointerDown: (e) => e.stopPropagation(),
          onKeyDown: (e) => e.stopPropagation(),
          onWheel: (e) => e.stopPropagation(),
          ...themePortalProps.attrs,
          style: themePortalProps.style,
          children: /* @__PURE__ */ jsxs("div", { className: styles.modalContainer, onClick: (e) => e.stopPropagation(), children: [
            transitionStatus2,
            /* @__PURE__ */ jsx(
              ExpandedPaneTopBar,
              {
                label: pane2.label,
                widgetType: pane2.widgetType,
                widgetProps: pane2.widgetProps,
                actions: pane2.actions,
                features: pane2.features,
                getState: pane2.getState,
                onAction: pane2.onAction,
                showClose: true,
                onClose: handleClose
              }
            ),
            /* @__PURE__ */ jsx("div", { className: styles.modalBody, children: renderPaneContent(pane2) })
          ] })
        }
      ),
      document.body
    );
  }
  if (!isSplit && variant === "immersive") {
    const pane2 = allPanes[0];
    if (!pane2) return null;
    return createPortal(
      /* @__PURE__ */ jsxs(
        "div",
        {
          className: `${styles.fullContainer} ${styles.immersive} ${isClosing ? styles.immersiveClosing : ""}`,
          onPointerDown: (e) => e.stopPropagation(),
          onKeyDown: (e) => e.stopPropagation(),
          onWheel: (e) => e.stopPropagation(),
          onAnimationEnd: () => {
            if (isClosing && !closedRef.current) {
              closedRef.current = true;
              onClose();
            }
          },
          ...themePortalProps.attrs,
          style: themePortalProps.style,
          children: [
            transitionStatus2,
            /* @__PURE__ */ jsx(
              "button",
              {
                className: styles.immersiveCloseBtn,
                onClick: handleClose,
                "aria-label": "Exit immersive mode",
                children: /* @__PURE__ */ jsx(Minimize, { size: 16 })
              }
            ),
            /* @__PURE__ */ jsx("div", { className: styles.singleFull, children: renderPaneContent(pane2) })
          ]
        }
      ),
      document.body
    );
  }
  return createPortal(
    /* @__PURE__ */ jsxs(
      "div",
      {
        className: styles.fullContainer,
        onPointerDown: (e) => e.stopPropagation(),
        onKeyDown: (e) => e.stopPropagation(),
        onWheel: (e) => e.stopPropagation(),
        ...themePortalProps.attrs,
        style: themePortalProps.style,
        children: [
          transitionStatus2,
          isSplit ? /* @__PURE__ */ jsx(
            "div",
            {
              className: styles.grid,
              style: { gridTemplateColumns },
              children: layout.map((column2, colIdx) => {
                const isLastCol = colIdx === layout.length - 1;
                return /* @__PURE__ */ jsx(
                  ColumnWithDivider,
                  {
                    colIndex: colIdx,
                    isLast: isLastCol,
                    onDividerPointerDown: handleColumnDividerPointerDown,
                    children: renderColumn(column2, colIdx, isLastCol)
                  },
                  `col-${colIdx}`
                );
              })
            }
          ) : /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(
              ExpandedPaneTopBar,
              {
                label: allPanes[0]?.label,
                widgetType: allPanes[0]?.widgetType,
                widgetProps: allPanes[0]?.widgetProps,
                actions: allPanes[0]?.actions,
                features: allPanes[0]?.features,
                getState: allPanes[0]?.getState,
                onAction: allPanes[0]?.onAction,
                showClose: true,
                onClose: handleClose
              }
            ),
            /* @__PURE__ */ jsx("div", { className: styles.singleFull, children: renderPaneContent(allPanes[0]) })
          ] })
        ]
      }
    ),
    document.body
  );
}
function ColumnWithDivider({ colIndex, isLast, onDividerPointerDown, children }) {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    children,
    !isLast && /* @__PURE__ */ jsx(
      "div",
      {
        className: styles.divider,
        onPointerDown: (e) => onDividerPointerDown(e, colIndex),
        role: "separator",
        "aria-orientation": "vertical"
      }
    )
  ] });
}
function PaneWithRowDivider({ flex, isLast, colIndex, onRowDividerPointerDown, children }) {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("div", { className: styles.pane, style: { flex }, children }),
    !isLast && /* @__PURE__ */ jsx(
      "div",
      {
        className: styles.rowDivider,
        onPointerDown: (e) => onRowDividerPointerDown(e, colIndex),
        role: "separator",
        "aria-orientation": "horizontal"
      }
    )
  ] });
}
const DocumentContext = createContext(null);
const EMPTY_ARTIFACTS = [];
const EMPTY_CONTENTS = {};
const EMPTY_CONTENT_PATHS = [];
function Unavailable({ children }) {
  return /* @__PURE__ */ jsx("p", { role: "status", className: documentCss.unavailable, children });
}
class DocumentBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidUpdate(previous) {
    if (this.state.error && previous.source !== this.props.source) this.setState({ error: null });
  }
  render() {
    return this.state.error ? /* @__PURE__ */ jsxs(Unavailable, { children: [
      "Document rendering failed: ",
      this.state.error.message
    ] }) : this.props.children;
  }
}
function AssetImage({ src = "", alt = "", ...props }) {
  const context = useContext(DocumentContext);
  const resolved = context?.resolveAsset?.(src, { basePath: context.artifact?.folderPath, mode: context.mode });
  return resolved?.available && resolved.url ? /* @__PURE__ */ jsx("img", { ...props, src: resolved.url, alt, loading: "lazy" }) : /* @__PURE__ */ jsxs(Unavailable, { children: [
    "Image unavailable: ",
    src
  ] });
}
function Image(props) {
  return /* @__PURE__ */ jsx("figure", { children: /* @__PURE__ */ jsx(AssetImage, { ...props }) });
}
function EmbedActions({ url, label: label2, onExpand }) {
  const [notice, setNotice] = useState("");
  const navigation = useContext(UNSAFE_NavigationContext);
  const destination = new URL(url, window.location.href);
  const openUrl = destination.pathname.includes("/prototypes.html/") ? resolvePrototypeFrameUrl(destination.href, destination.href) : destination.href;
  const openInside = navigation && new URL(openUrl).origin === window.location.origin;
  return /* @__PURE__ */ jsxs("div", { className: documentCss.embedActions, children: [
    /* @__PURE__ */ jsxs(Button, { type: "button", onClick: () => {
      if (onExpand() === false) setNotice("Preview is not ready to expand. Try again after it loads.");
    }, variant: "outline", size: "sm", className: documentCss.embedAction, "aria-label": `Expand ${label2}`, children: [
      /* @__PURE__ */ jsx(Maximize2, { size: 14, "aria-hidden": "true" }),
      "Expand"
    ] }),
    /* @__PURE__ */ jsxs(Button, { href: openUrl, target: openInside ? void 0 : "_blank", rel: openInside ? void 0 : "noopener noreferrer", variant: "ghost", size: "sm", className: documentCss.embedAction, "aria-label": `Open ${label2}`, onClick: (event) => {
      if (!openInside || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const target = new URL(openUrl);
      navigation.navigator.push(`${target.pathname}${target.search}${target.hash}`);
    }, children: [
      /* @__PURE__ */ jsx(ExternalLink, { size: 14, "aria-hidden": "true" }),
      "Open"
    ] }),
    /* @__PURE__ */ jsxs(Button, { type: "button", variant: "ghost", size: "sm", className: documentCss.embedAction, onClick: async () => {
      try {
        const absolute = new URL(url, window.location.href).href;
        setNotice(await copyCanvasText(absolute, "URL") ? "URL copied." : "Could not copy URL.");
      } catch {
        setNotice("Could not copy URL.");
      }
    }, children: [
      /* @__PURE__ */ jsx(Copy, { size: 14, "aria-hidden": "true" }),
      "Copy URL"
    ] }),
    notice && /* @__PURE__ */ jsx("span", { className: documentCss.copyNotice, role: "status", children: notice })
  ] });
}
function widgetDestination(type, props, context) {
  const kind = type === "site-frame" ? "site" : type === "prototype" ? "prototype" : null;
  if (kind && props.artifactId) {
    const resolved = context?.resolveArtifact?.(props.artifactId, { kind, viewId: props.viewId, mode: context.mode });
    return resolved?.available ? resolved.url || "" : "";
  }
  let base = context?.base || globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/";
  if (base === "./") base = window.location.pathname.replace(/\/docs\/[^/]*\/?$/, "/");
  const prefix = base.replace(/\/+$/, "");
  let source = "";
  if (type === "prototype") source = props.src || "";
  else if (type === "site-frame" && props.siteId) {
    try {
      return context?.mode === "static" ? props.published?.productionUrl || props.published?.url || "" : siteViewerPath(base, props.siteId, props.route || "");
    } catch {
      return "";
    }
  } else if (type === "story" || type === "component-set") {
    const story = getStoryData(props.storyId);
    if (!story) return "";
    source = storyFrameRoute(story, props.storyId, props, type === "component-set");
    const parsed = new URL(source, "http://document.invalid");
    parsed.searchParams.delete("_sb_embed");
    parsed.searchParams.delete("_sb_theme_target");
    source = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } else if (["figma-embed", "codepen-embed", "link-preview"].includes(type)) source = props.url || "";
  if (typeof source !== "string" || !source || source.startsWith("//") || source.includes("\\")) return "";
  if (/^https?:\/\//i.test(source)) return source;
  if (/^[a-z][a-z\d+.-]*:/i.test(source)) return "";
  return prefix && (source === prefix || source.startsWith(`${prefix}/`)) ? source : `${prefix}/${source.replace(/^\/+/, "")}`;
}
function ArtifactEmbed({ artifactId, viewId, kind, title }) {
  const context = useContext(DocumentContext);
  const [expanded, setExpanded] = useState(false);
  const inline = useRef(null);
  const frame = useRef(null);
  const occurrence = useId();
  const resolved = context?.resolveArtifact?.(artifactId, { kind, viewId, mode: context.mode });
  const label2 = title || `${kind} ${artifactId}${viewId ? ` ${viewId}` : ""}`;
  const layout = useMemo(() => [[kind === "site" ? {
    id: occurrence,
    label: label2,
    widgetType: "site-frame",
    kind: "react",
    render: () => /* @__PURE__ */ jsx("iframe", { className: documentCss.expandedFrame, title: label2, src: resolved?.url })
  } : {
    id: occurrence,
    label: label2,
    widgetType: "prototype",
    kind: "external",
    attach: (container) => {
      const element = frame.current, origin = inline.current;
      if (!element || !origin) return void 0;
      const oldStyle = element.getAttribute("style");
      if (container.moveBefore && element.isConnected) container.moveBefore(element, null);
      else container.appendChild(element);
      element.style.height = "100%";
      return () => {
        if (origin.moveBefore && element.isConnected && origin.isConnected) origin.moveBefore(element, null);
        else origin.appendChild(element);
        if (oldStyle === null) element.removeAttribute("style");
        else element.setAttribute("style", oldStyle);
      };
    }
  }]], [kind, occurrence, label2, resolved?.url]);
  if (!resolved?.available || !resolved.url) return /* @__PURE__ */ jsx(Unavailable, { children: resolved?.diagnostics?.[0]?.message || `${kind} unavailable: ${artifactId || "missing artifactId"}` });
  return /* @__PURE__ */ jsxs("figure", { className: documentCss.embed, "data-artifact-id": artifactId, "data-view-id": viewId, children: [
    /* @__PURE__ */ jsx("div", { ref: inline, className: documentCss.previewSurface, children: kind === "site" ? resolved.screenshot ? /* @__PURE__ */ jsx("img", { src: resolved.screenshot, alt: title || artifactId }) : /* @__PURE__ */ jsxs(Unavailable, { children: [
      "Site screenshot unavailable: ",
      artifactId
    ] }) : /* @__PURE__ */ jsx("iframe", { ref: frame, title: label2, src: resolved.url, loading: "lazy" }) }),
    /* @__PURE__ */ jsx("figcaption", { children: /* @__PURE__ */ jsx(EmbedActions, { url: resolved.url, label: title || artifactId, onExpand: () => setExpanded(true) }) }),
    expanded && /* @__PURE__ */ jsx(ExpandedPane, { initialLayout: layout, variant: "modal", onClose: () => setExpanded(false) })
  ] });
}
function Prototype(props) {
  return /* @__PURE__ */ jsx(ArtifactEmbed, { ...props, kind: "prototype" });
}
function Site(props) {
  return /* @__PURE__ */ jsx(ArtifactEmbed, { ...props, kind: "site" });
}
function CanvasWidget({ type, props = {}, id }) {
  const context = useContext(DocumentContext);
  const destination = widgetDestination(type, props, context);
  const actionRef = useRef(null);
  return /* @__PURE__ */ jsxs("div", { className: documentCss.widgetEmbed, children: [
    /* @__PURE__ */ jsx(WidgetSurface, { actionRef, type, props, id, surface: "document", context, onUpdate: context?.onUpdateWidget }),
    destination && /* @__PURE__ */ jsx(EmbedActions, { url: destination, label: props.title || props.label || props.artifactId || props.storyId || props.siteId || type, onExpand: () => {
      if (!actionRef.current?.handleAction) return false;
      actionRef.current.handleAction("expand-single");
      return true;
    } }, destination)
  ] });
}
function DocumentProvider({
  artifact,
  artifacts = EMPTY_ARTIFACTS,
  contents = EMPTY_CONTENTS,
  contentPathStack = EMPTY_CONTENT_PATHS,
  mode = "local",
  base = globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ || "/",
  resolveArtifact,
  resolveAsset,
  children
}) {
  const renderFileContent = useCallback((filePath) => {
    if (typeof filePath !== "string" || contentPathStack.includes(filePath)) return null;
    const entry = Object.hasOwn(contents, filePath) ? contents[filePath] : null;
    const matches = artifacts.filter((item) => item.path === filePath);
    if (!entry?.Content || matches.length !== 1 || matches[0].available === false) return null;
    return /* @__PURE__ */ jsx(
      DocumentContent,
      {
        Content: entry.Content,
        artifact: matches[0],
        artifacts,
        contents,
        contentPathStack: [...contentPathStack, filePath],
        mode,
        base,
        resolveArtifact,
        resolveAsset,
        source: entry.source || "",
        diagnostics: entry.diagnostics || []
      }
    );
  }, [artifacts, contents, contentPathStack, mode, base, resolveArtifact, resolveAsset]);
  const value = useMemo(() => ({
    artifact,
    artifacts,
    contents,
    mode,
    base,
    resolveArtifact,
    resolveAsset,
    renderFileContent
  }), [artifact, artifacts, contents, mode, base, resolveArtifact, resolveAsset, renderFileContent]);
  return /* @__PURE__ */ jsx(DocumentContext.Provider, { value, children });
}
function DocumentContent({ Content, children, source = "", components = {}, ...context }) {
  return /* @__PURE__ */ jsx(DocumentBoundary, { source, children: /* @__PURE__ */ jsx(DocumentProvider, { ...context, children: Content ? /* @__PURE__ */ jsx(Content, { components: { img: AssetImage, Image, Prototype, Site, CanvasWidget, ...components } }) : children }) }, context.artifact?.id);
}
function Document({
  Content,
  artifact,
  artifacts = EMPTY_ARTIFACTS,
  contents = EMPTY_CONTENTS,
  mode = "local",
  base,
  resolveArtifact,
  resolveAsset,
  source = "",
  diagnostics = []
}) {
  const referenceDiagnostics = (Array.isArray(artifact?.metadata?.references) ? artifact.metadata.references : []).flatMap((id) => {
    const matches = artifacts.filter((item) => item.id === id);
    return matches.length !== 1 || matches[0].available === false ? [{ code: "UNAVAILABLE_DOCUMENT_REFERENCE", message: `Declared reference ${id} is missing, ambiguous or unavailable.` }] : [];
  });
  const allDiagnostics = [...artifact?.diagnostics || [], ...diagnostics, ...referenceDiagnostics];
  return /* @__PURE__ */ jsxs("article", { className: documentCss.document, "data-document-id": artifact?.id, "data-render-mode": mode, children: [
    /* @__PURE__ */ jsx("header", { children: /* @__PURE__ */ jsx("h1", { children: artifact?.title || "Document unavailable" }) }),
    allDiagnostics.length > 0 && /* @__PURE__ */ jsx("section", { "aria-label": "Document diagnostics", role: "status", children: /* @__PURE__ */ jsx("ul", { children: allDiagnostics.map((item, i) => /* @__PURE__ */ jsxs("li", { children: [
      /* @__PURE__ */ jsx("code", { children: item.code }),
      " ",
      item.path,
      item.line ? `:${item.line}` : "",
      " ",
      item.message
    ] }, i)) }) }),
    Content && artifact?.available !== false ? /* @__PURE__ */ jsx(
      DocumentContent,
      {
        Content,
        artifact,
        artifacts,
        contents,
        contentPathStack: artifact?.path ? [artifact.path] : EMPTY_CONTENT_PATHS,
        mode,
        base,
        resolveArtifact,
        resolveAsset,
        source
      }
    ) : /* @__PURE__ */ jsx(Unavailable, { children: "This document is unavailable." })
  ] });
}
export {
  AssetImage as A,
  CanvasWidget as C,
  DocumentContent as D,
  ExpandedPane as E,
  Image as I,
  Prototype as P,
  Site as S,
  Tooltip as T,
  TooltipTrigger as a,
  TooltipContent as b,
  DocumentContext as c,
  documentCss as d,
  Document as e,
  buildPrototypePickerEntries as f,
  getWidgetSurfaceCatalog as g,
  embedRoutePath as h,
  stripEmbedRoute as i,
  resolveLivePrototypeRefreshTarget as j,
  copyCanvasText as k,
  Icon as l,
  storyFrameRoute as m,
  copyCanvasImage as n,
  subscribePaneGuards as o,
  hasPaneGuard as p,
  prepareOwnerPaneTransition as q,
  resolvePrototypeFrameUrl as r,
  samePrototypeFrameLocation as s,
  observeSiteFrameRoute as t,
  siteViewerPath as u,
  DocumentBoundary as v,
  DocumentProvider as w
};
