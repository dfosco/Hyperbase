import * as statefullyCore from "@dfosco/statefully/core";
import { o as isHideMode, s as removeShadow, q as removeParam, u as setShadow, t as setParam, m as getShadow, l as getParam, e as getAllShadows, g as getAllParams } from "./hideMode-DxxH-PW9.js";
import { g as getHashSnapshot, s as subscribeToHash } from "./hashSubscribe-Bi9R_rI0.js";
import { b as getStorageSnapshot, s as subscribeToStorage } from "./localStorage-DulkrQ4k.js";
import { getPrototypeKnobs } from "../core-1.js";
import { r as resolveNotebookView } from "./notebookView-DgDXRwmz.js";
const noStorage = Object.freeze({
  get length() {
    return 0;
  },
  key() {
    return null;
  },
  getItem() {
    return null;
  },
  setItem() {
  },
  removeItem() {
  },
  clear() {
  }
});
function requireFunction(runtime, name) {
  if (typeof runtime?.[name] !== "function") {
    throw new TypeError(`The installed Statefully runtime must expose ${name}().`);
  }
  return runtime[name];
}
function resolveTargetWindow(target) {
  if (!target) return null;
  try {
    if ("contentWindow" in target) {
      return target.contentWindow?.location ? target.contentWindow : null;
    }
    return target.location && typeof target.addEventListener === "function" ? target : null;
  } catch {
    return null;
  }
}
function providerDefinitions(definitions, route, buildLegacyKnobKey) {
  if (!Array.isArray(definitions)) return [];
  return definitions.map((definition) => {
    if (!definition || typeof definition !== "object") return definition;
    const authored = definition;
    const aliases = authored.aliases ?? authored.legacyIds ?? [];
    const ids = [authored.id, ...Array.isArray(aliases) ? aliases : [aliases]];
    const scopes = [
      authored.scope === void 0 ? route : authored.scope,
      ...Array.isArray(authored.scopeAliases) ? authored.scopeAliases : authored.scopeAliases == null ? [] : [authored.scopeAliases]
    ];
    const legacyKeys = new Set(Array.isArray(authored.legacyKeys) ? authored.legacyKeys : authored.legacyKeys ? [authored.legacyKeys] : []);
    for (const scope of scopes) {
      for (const id of ids) {
        if (typeof id !== "string" || !id) continue;
        legacyKeys.add(buildLegacyKnobKey(id, scope === void 0 ? {} : { route: scope }));
      }
    }
    return {
      ...authored,
      ...authored.type === "text" ? { type: "string" } : {},
      legacyKeys: [...legacyKeys]
    };
  });
}
function createHostSession() {
  function subscribe(listener) {
    const unsubscribeHash2 = subscribeToHash(listener);
    const unsubscribeStorage = subscribeToStorage(listener);
    return () => {
      unsubscribeHash2();
      unsubscribeStorage();
    };
  }
  function getSnapshot() {
    return JSON.stringify([getHashSnapshot(), isHideMode(), getStorageSnapshot()]);
  }
  const readAllParams = () => isHideMode() ? getAllShadows() : getAllParams();
  function writeParam(key, value) {
    const serialized = String(value);
    if (isHideMode()) {
      setShadow(key, serialized);
      return;
    }
    setParam(key, serialized);
    setShadow(key, serialized);
  }
  function deleteParam(key) {
    if (isHideMode()) {
      removeShadow(key);
      return;
    }
    removeParam(key);
    removeShadow(key);
  }
  return Object.freeze({
    getParam(key) {
      return isHideMode() ? getShadow(key) : getParam(key);
    },
    getAllParams: readAllParams,
    replaceParams(values = {}) {
      const next = Object.entries(values).filter(([, value]) => value !== null && value !== void 0);
      const keep = new Set(next.map(([key]) => key));
      for (const key of Object.keys(readAllParams())) if (!keep.has(key)) deleteParam(key);
      for (const [key, value] of next) writeParam(key, String(value));
    },
    setParam(key, value) {
      const serialized = String(value);
      if (isHideMode()) {
        setShadow(key, serialized);
        return;
      }
      setParam(key, serialized);
      setShadow(key, serialized);
    },
    removeParam(key) {
      if (isHideMode()) {
        removeShadow(key);
        return;
      }
      removeParam(key);
      removeShadow(key);
    },
    subscribe,
    getSnapshot
  });
}
function createHypercanvasKnobRuntime(definitions = [], { target = null, route, statefully = statefullyCore } = {}) {
  const createKnobStore = requireFunction(statefully, "createKnobStore");
  const buildKnobKey = requireFunction(statefully, "buildKnobKey");
  const buildLegacyKnobKey = requireFunction(statefully, "buildLegacyKnobKey");
  const coerce = requireFunction(statefully, "coerce");
  const targetWindow = resolveTargetWindow(target);
  if (target && !targetWindow) {
    throw new TypeError("The knob target must be a same-origin Window or iframe element.");
  }
  const ownsSession = Boolean(targetWindow && targetWindow !== window);
  const session = ownsSession ? requireFunction(statefully, "createSessionStore")({
    targetWindow,
    storage: noStorage,
    namespace: "hypercanvas-knobs"
  }) : createHostSession();
  const options = { session };
  if (route !== void 0) options.route = route;
  const presentationStore = createKnobStore(definitions);
  const flattenedDefinitions = presentationStore.listKnobs();
  const store = createKnobStore(providerDefinitions(flattenedDefinitions, route, buildLegacyKnobKey), options);
  const typedStore = store;
  function selectedScope(definition) {
    if (Object.hasOwn(definition ?? {}, "scope") && definition.scope !== void 0) {
      return definition.scope;
    }
    return route;
  }
  function withScope(method, definition, args = []) {
    const scope = selectedScope(definition);
    const operation = method;
    return scope === void 0 ? operation(definition.id, ...args) : operation(definition.id, ...args, scope);
  }
  function getKey(definition) {
    const scope = selectedScope(definition);
    return buildKnobKey(definition.id, scope === void 0 ? {} : { route: scope });
  }
  function rawKeys(definition, canonicalKey) {
    const providerDefinition = typedStore.listKnobs().find(
      (candidate) => candidate?.id === definition?.id && candidate.scope === selectedScope(definition)
    );
    const legacyKeys = providerDefinition?.legacyKeys;
    const declared = typeof legacyKeys === "string" ? [legacyKeys] : Array.isArray(legacyKeys) ? legacyKeys.filter((key) => typeof key === "string") : [];
    return [canonicalKey, ...declared.filter((key) => key !== canonicalKey)];
  }
  function read(definition, fallback = definition?.default) {
    const key = getKey(definition);
    let rawValue = null;
    for (const candidate of rawKeys(definition, key)) {
      rawValue = session.getParam(candidate);
      if (rawValue != null) break;
    }
    const value = withScope(typedStore.getKnob, definition, [fallback]);
    const type = definition?.type === "text" ? "string" : definition?.type;
    const validationDefinition = { ...definition };
    delete validationDefinition.min;
    delete validationDefinition.max;
    const coercedValue = rawValue == null ? void 0 : coerce(rawValue, type, void 0, validationDefinition);
    return {
      key,
      rawValue,
      value,
      coercedValue,
      errorValue: rawValue == null ? void 0 : coercedValue,
      hasOverride: rawValue != null || value !== fallback
    };
  }
  function set(definition, value) {
    withScope(typedStore.setKnob, definition, [value]);
  }
  function clear(definition) {
    withScope(typedStore.clearKnob, definition);
  }
  function reset() {
    const scopes = /* @__PURE__ */ new Map();
    for (const definition of store.listKnobs()) {
      if (!definition || definition.type === "object") continue;
      const scope = selectedScope(definition);
      const key = scope === void 0 ? "implicit" : JSON.stringify(scope);
      scopes.set(key, scope);
    }
    if (scopes.size === 0) {
      typedStore.reset();
      return;
    }
    for (const [key, scope] of scopes) {
      if (key === "implicit") typedStore.reset();
      else typedStore.reset(scope);
    }
  }
  const subscribe = session.subscribe?.bind(session) ?? (() => () => {
  });
  const getSnapshot = session.getSnapshot?.bind(session) ?? (() => "");
  return Object.freeze({
    store,
    listKnobs: () => flattenedDefinitions.map((definition) => ({ ...definition })),
    session,
    targetWindow,
    subscribe,
    getSnapshot,
    read,
    set,
    clear,
    reset,
    dispose() {
      if (ownsSession) session.dispose?.();
    }
  });
}
function detectCurrentPrototypeRoute(basePath = "/", pathname = typeof window === "undefined" ? "/" : window.location.pathname) {
  let path = pathname;
  const base = basePath.replace(/\/+$/, "");
  if (base && path.startsWith(base)) path = path.slice(base.length);
  path = path.replace(/\/+$/, "") || "/";
  const segments = path.split("/").filter(Boolean);
  const branchSegment = segments[0]?.startsWith("branch--") ? segments[0] : null;
  let protoIdx = branchSegment ? 1 : 0;
  if (segments[protoIdx] === "prototypes.html") protoIdx += 1;
  const prototypeName = segments[protoIdx] || null;
  const routeSegments = prototypeName ? segments.slice(protoIdx + 1) : [];
  const route = routeSegments.length > 0 ? `/${routeSegments.join("/")}` : void 0;
  return { prototypeName, route, path };
}
const KNOBS_PANEL_OPEN_KEY = "knobsPanelOpen";
function isKnobsPanelOpen() {
  return getParam(KNOBS_PANEL_OPEN_KEY) === "1";
}
const DEFAULT_KNOB_COLOR = "#0969da";
const HEX_PATTERN = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function resolveKnobColor(def) {
  const raw = record(def?.knobMeta)?.color;
  if (typeof raw !== "string") return DEFAULT_KNOB_COLOR;
  const trimmed = raw.trim();
  return HEX_PATTERN.test(trimmed) ? trimmed : DEFAULT_KNOB_COLOR;
}
function humanizeKnobId(id) {
  const last = id.split(".").pop() ?? id;
  return last.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().replace(/^./, (char) => char.toUpperCase());
}
function knobLabelFor(def) {
  if (!def) return "";
  return def.label || humanizeKnobId(def.id);
}
function isKnobHighlightEnabled(def) {
  return record(def?.knobMeta)?.highlight === true;
}
let installed = false;
let mutationObserver = null;
let unsubscribeHash = null;
let unsubscribeNav = null;
let viewObserver = null;
let cachedBasePath = "/";
const HTML_ATTR = "data-sb-knobs-active";
const URL_PARAM = "sb_knobs";
const ATTR_HIGHLIGHT = "data-knob-highlight";
const ATTR_LABEL = "data-knob-label";
const CSS_VAR_COLOR = "--sb-knob-color";
function highlightHost() {
  try {
    if (window.frameElement?.hasAttribute("data-hypercanvas-content")) return window.parent;
  } catch {
  }
  return window;
}
function isHighlightActive() {
  if (typeof window === "undefined") return false;
  try {
    const view = resolveNotebookView(highlightHost().location.search);
    if (view.mode === "removed" && !view.showTools) return false;
  } catch {
  }
  if (isKnobsPanelOpen()) return true;
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get(URL_PARAM) === "1";
  } catch {
    return false;
  }
}
function clearMarkedElements(doc = document) {
  doc.querySelectorAll(`[${ATTR_HIGHLIGHT}]`).forEach((el) => {
    el.removeAttribute(ATTR_HIGHLIGHT);
    el.removeAttribute(ATTR_LABEL);
    el.style.removeProperty(CSS_VAR_COLOR);
  });
}
function paint() {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  if (!isHighlightActive()) {
    if (html.hasAttribute(HTML_ATTR)) html.removeAttribute(HTML_ATTR);
    clearMarkedElements();
    return;
  }
  html.setAttribute(HTML_ATTR, "");
  const { prototypeName, route } = detectCurrentPrototypeRoute(cachedBasePath);
  if (!prototypeName) {
    clearMarkedElements();
    return;
  }
  const knobs = getPrototypeKnobs(prototypeName);
  if (!knobs || knobs.length === 0) {
    clearMarkedElements();
    return;
  }
  const createKnobStore = statefullyCore.createKnobStore;
  if (typeof createKnobStore !== "function") {
    clearMarkedElements();
    return;
  }
  const store = createKnobStore(knobs, route === void 0 ? {} : { route });
  const byId = /* @__PURE__ */ new Map();
  for (const def of knobs) {
    if (!def || typeof def.id !== "string") continue;
    const resolved = store.resolve(def.id);
    if (resolved) byId.set(def.id, resolved);
  }
  const seen = /* @__PURE__ */ new Set();
  document.querySelectorAll("[data-knob-id]").forEach((el) => {
    if (el.closest("[data-knobs-panel], [data-knobs-widget]")) return;
    const id = el.getAttribute("data-knob-id");
    if (!id) return;
    const def = byId.get(id);
    if (!def || !isKnobHighlightEnabled(def)) {
      el.removeAttribute(ATTR_HIGHLIGHT);
      el.removeAttribute(ATTR_LABEL);
      el.style.removeProperty(CSS_VAR_COLOR);
      return;
    }
    seen.add(el);
    el.style.setProperty(CSS_VAR_COLOR, resolveKnobColor(def));
    el.setAttribute(ATTR_HIGHLIGHT, "");
    el.setAttribute(ATTR_LABEL, knobLabelFor(def));
  });
  document.querySelectorAll(`[${ATTR_HIGHLIGHT}]`).forEach((el) => {
    if (seen.has(el)) return;
    el.removeAttribute(ATTR_HIGHLIGHT);
    el.removeAttribute(ATTR_LABEL);
    el.style.removeProperty(CSS_VAR_COLOR);
  });
}
let scheduled = false;
function schedulePaint() {
  if (scheduled) return;
  scheduled = true;
  const flush = () => {
    scheduled = false;
    paint();
  };
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(flush);
  } else {
    flush();
  }
}
function subscribeToNavigation(callback) {
  if (typeof window === "undefined") return () => {
  };
  const originalPush = history.pushState;
  const originalReplace = history.replaceState;
  function patchedPush(...args) {
    const result = originalPush.apply(this, args);
    callback();
    return result;
  }
  function patchedReplace(...args) {
    const result = originalReplace.apply(this, args);
    callback();
    return result;
  }
  history.pushState = patchedPush;
  history.replaceState = patchedReplace;
  window.addEventListener("popstate", callback);
  return () => {
    window.removeEventListener("popstate", callback);
    if (history.pushState === patchedPush) history.pushState = originalPush;
    if (history.replaceState === patchedReplace) history.replaceState = originalReplace;
  };
}
function installKnobsHighlight(options = {}) {
  if (installed || typeof document === "undefined") return;
  installed = true;
  cachedBasePath = options.basePath || "/";
  schedulePaint();
  unsubscribeHash = subscribeToHash(schedulePaint);
  unsubscribeNav = subscribeToNavigation(schedulePaint);
  try {
    viewObserver = new MutationObserver(schedulePaint);
    viewObserver.observe(highlightHost().document.documentElement, {
      attributes: true,
      attributeFilter: ["data-notebook-view", "data-notebook-tools"]
    });
  } catch {
  }
  function isIgnorableMutationTarget(node) {
    if (!(node instanceof Element)) return false;
    return Boolean(
      node.closest("[data-knobs-panel], [data-knobs-widget], [data-base-ui-portal], [data-radix-portal]")
    );
  }
  mutationObserver = new MutationObserver((mutations) => {
    if (!isHighlightActive()) return;
    for (const m of mutations) {
      if (!isIgnorableMutationTarget(m.target)) {
        schedulePaint();
        return;
      }
    }
  });
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}
function uninstallKnobsHighlight() {
  if (!installed) return;
  installed = false;
  if (unsubscribeHash) unsubscribeHash();
  if (unsubscribeNav) unsubscribeNav();
  if (mutationObserver) mutationObserver.disconnect();
  viewObserver?.disconnect();
  viewObserver = null;
  unsubscribeHash = null;
  unsubscribeNav = null;
  mutationObserver = null;
  if (typeof document !== "undefined") {
    document.documentElement.removeAttribute(HTML_ATTR);
    clearMarkedElements();
  }
}
export {
  DEFAULT_KNOB_COLOR as D,
  isKnobHighlightEnabled as a,
  createHypercanvasKnobRuntime as c,
  detectCurrentPrototypeRoute as d,
  installKnobsHighlight as i,
  resolveKnobColor as r,
  uninstallKnobsHighlight as u
};
