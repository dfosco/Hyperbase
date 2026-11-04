import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { lazy, useSyncExternalStore, useId, useRef, useState, useLayoutEffect, Suspense, createElement, Component, useCallback, useEffect, useMemo, createContext, useContext } from "react";
import { UNSAFE_NavigationContext } from "react-router-dom";
import { c as createLucideIcon, B as Button } from "./button-Bi0ciDEN.js";
import { getStoryData } from "../core-0.js";
import { n as normalizeSiteId, a as normalizeSiteRoute, s as siteRouteFromPreviewUrl } from "./contract-Tm25L5gq.js";
import { a as getWidgetDefinition, s as subscribeToWidgetRegistry, g as getWidgetRegistrySnapshot } from "./widgetRegistry-CmXYjxwi.js";
import { w as widgetTypesSnapshot, T as Tooltip, a as TooltipTrigger, b as TooltipContent, g as getWidgetMeta } from "./tooltip-content-CaxwY_7M.js";
import { flushSync, createPortal } from "react-dom";
import { c as createLucideIcon$1 } from "./createLucideIcon-CgZyRq_D.js";
import { a as acquireIframePointerLock } from "./iframePointerLock-CuQbsxGb.js";
import { I as Icon } from "./Icon-CY9OeunJ.js";
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
  "sticky-note": lazy(() => import("./StickyNote-D0k7sdyb.js")),
  markdown: lazy(() => import("./MarkdownBlock-DRLSDL1g.js").then((n) => n.M)),
  image: lazy(() => import("./MarkdownBlock-DRLSDL1g.js").then((n) => n.I)),
  "link-preview": lazy(() => import("./LinkPreview-C3NEgYWL.js")),
  prototype: lazy(() => import("./PrototypeEmbed-DPFcUP4b.js")),
  story: lazy(() => import("./StoryWidget-CX2cy4wN.js")),
  "component-set": lazy(() => import("./StorySetWidget-CIN0YLM-.js")),
  "figma-embed": lazy(() => import("./FigmaEmbed-C7yMXiMf.js")),
  "codepen-embed": lazy(() => import("./CodePenEmbed-CWCkFPvu.js")),
  "site-frame": lazy(() => import("./SiteFrame-r7uWCyzZ.js"))
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
  DocumentContext as a,
  Document as b,
  buildPrototypePickerEntries as c,
  documentCss as d,
  embedRoutePath as e,
  stripEmbedRoute as f,
  getWidgetSurfaceCatalog as g,
  resolveLivePrototypeRefreshTarget as h,
  copyCanvasText as i,
  storyFrameRoute as j,
  copyCanvasImage as k,
  subscribePaneGuards as l,
  hasPaneGuard as m,
  siteViewerPath as n,
  observeSiteFrameRoute as o,
  prepareOwnerPaneTransition as p,
  DocumentBoundary as q,
  resolvePrototypeFrameUrl as r,
  samePrototypeFrameLocation as s,
  DocumentProvider as t
};
