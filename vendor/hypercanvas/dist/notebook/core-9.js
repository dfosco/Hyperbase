import { subscribeToConfig, getConfig, getConfigSnapshot } from "./core-2.js";
import { t as themeHueVariables, c as configDefaults } from "./chunks/configSchema-Bw-N4Op6.js";
const THEME_STORAGE_KEY = "sb-color-scheme";
const SYNC_STORAGE_KEY = "sb-theme-sync";
const SYNC_DEFAULTS_VERSION_KEY = "sb-theme-sync-defaults-version";
const SYNC_DEFAULTS_VERSION = "1";
function markSyncDefaultsCurrent() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SYNC_DEFAULTS_VERSION_KEY, SYNC_DEFAULTS_VERSION);
  } catch {
  }
}
const LEGACY_SURFACE_ATTR = {
  content: "data-sb-theme",
  toolbar: "data-sb-toolbar-theme",
  codeBoxes: "data-sb-code-theme"
};
function asRecord(value) {
  return value !== null && typeof value === "object" ? value : {};
}
function readStoredTheme(themesCfg, initialPaint = false) {
  const config = asRecord(themesCfg);
  let stored = null;
  try {
    if (typeof localStorage !== "undefined") stored = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
  }
  const selected = stored || config.default || "system";
  if (typeof window === "undefined" || window.top !== window) return selected;
  const boot = window;
  const native = boot.__HYPERCANVAS_NATIVE_APPEARANCE__;
  if (!initialPaint && boot.__HYPERCANVAS_THEME_STORE_READY__ || native !== "light" && native !== "dark" || selected === "system") return selected;
  const themes = asRecord(config.themes);
  const mode = (id) => {
    const attr = asRecord(asRecord(themes[id]).attrs)["data-color-mode"];
    if (attr === "light" || attr === "dark") return attr;
    return id.startsWith("dark") ? "dark" : id.startsWith("light") ? "light" : null;
  };
  if (!mode(selected) || mode(selected) === native) return selected;
  return Object.keys(themes).find((id) => mode(id) === native) || selected;
}
function readStoredSync(themesCfg) {
  const config = asRecord(themesCfg);
  const surfaces = config.surfaces || {};
  const defaults = {};
  for (const [id, def] of Object.entries(surfaces)) defaults[id] = !!def.sync;
  if (typeof localStorage === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(SYNC_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    const out = { ...defaults };
    for (const id of Object.keys(surfaces)) {
      if (typeof parsed[id] === "boolean") out[id] = parsed[id];
    }
    if (surfaces.content && typeof parsed.content !== "boolean" && typeof parsed.prototype === "boolean") out.content = parsed.prototype;
    const needsMigration = localStorage.getItem(SYNC_DEFAULTS_VERSION_KEY) !== SYNC_DEFAULTS_VERSION;
    if (needsMigration && surfaces.toolbar?.sync === true && parsed.toolbar === false) {
      out.toolbar = true;
      localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(out));
    }
    if (needsMigration) localStorage.setItem(SYNC_DEFAULTS_VERSION_KEY, SYNC_DEFAULTS_VERSION);
    return out;
  } catch {
    return defaults;
  }
}
function resolveTheme(themeId) {
  if (themeId !== "system") return themeId;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function computeBySurface(themesCfg, globalResolved, syncMap) {
  const out = {};
  const config = asRecord(themesCfg);
  const surfaces = config.surfaces || {};
  for (const id of Object.keys(surfaces)) {
    out[id] = syncMap[id] ? globalResolved : "light";
  }
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const target = params.get("_sb_theme_target");
    const authoredTheme = params.get("theme");
    const transportTheme = params.get("_sb_canvas_theme");
    const themes = asRecord(config.themes);
    if (authoredTheme && Object.hasOwn(surfaces, "content") && (authoredTheme === "system" || Object.hasOwn(themes, authoredTheme))) {
      out.content = authoredTheme === "system" ? resolveTheme("system") : authoredTheme;
    } else if (params.has("_sb_embed") && target && Object.hasOwn(surfaces, target) && transportTheme && Object.hasOwn(themes, transportTheme)) {
      out[target] = transportTheme;
    }
  }
  return out;
}
function applyThemeToDom(themesCfg, bySurface) {
  if (typeof document === "undefined") return;
  const config = asRecord(themesCfg);
  const themes = config.themes || {};
  const root = document.documentElement;
  for (const [property, value] of Object.entries(themeHueVariables(config))) {
    if (root.style.getPropertyValue(property) !== value) root.style.setProperty(property, value);
  }
  for (const [surfaceId, resolved] of Object.entries(bySurface)) {
    const perSurfaceAttr = `data-sb-${surfaceId.toLowerCase()}-theme`;
    const themeDef = themes[resolved] || {};
    const companion = themeDef.attrs || {};
    const elements = document.querySelectorAll(`[data-sb-surface="${surfaceId}"]`);
    elements.forEach((el) => {
      if (el.getAttribute(perSurfaceAttr) !== resolved) {
        el.setAttribute(perSurfaceAttr, resolved);
      }
      for (const [k, v] of Object.entries(companion)) {
        if (el.getAttribute(k) !== v) el.setAttribute(k, v);
      }
    });
    const legacyAttr = LEGACY_SURFACE_ATTR[surfaceId];
    if (legacyAttr && root.getAttribute(legacyAttr) !== resolved) {
      root.setAttribute(legacyAttr, resolved);
    }
  }
  const prototypeResolved = bySurface.prototype;
  if (prototypeResolved && themes[prototypeResolved]) {
    const companion = themes[prototypeResolved].attrs || {};
    for (const [k, v] of Object.entries(companion)) {
      if (root.getAttribute(k) !== v) root.setAttribute(k, v);
    }
  }
}
let writeDesktopAppearance = null;
function setThemeHostCapabilities({ setAppearanceMode = null } = {}) {
  writeDesktopAppearance = setAppearanceMode;
}
function writable(initial) {
  let value = initial;
  const subs = /* @__PURE__ */ new Set();
  return {
    set(v) {
      value = v;
      subs.forEach((fn) => fn(value));
    },
    subscribe(run) {
      subs.add(run);
      run(value);
      return () => {
        subs.delete(run);
      };
    }
  };
}
function isThemeConfig(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function themesConfig() {
  const fromStore = getConfig("theming");
  if (isThemeConfig(fromStore) && (fromStore.surfaces || fromStore.themes)) return fromStore;
  const defaults = configDefaults;
  const defaultTheming = defaults.theming;
  return isThemeConfig(defaultTheming) ? defaultTheming : {};
}
function readUrlTheme() {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("theme");
  const registry = themesConfig().themes;
  return value && (value === "system" || isRecord(registry) && Object.hasOwn(registry, value)) ? value : null;
}
let _current = readEffectiveUrlTheme() || readStoredTheme(themesConfig());
let _pendingDesktopAppearance = null;
let _syncTargets = readStoredSync(themesConfig());
function snapshot(theme) {
  return { theme, resolved: resolveTheme(theme) };
}
const _store = writable(snapshot(_current));
const _syncStore = writable(_syncTargets);
function _applyToDOM(theme, resolved) {
  if (typeof window !== "undefined") {
    const boot = window;
    if (getConfigSnapshot() === "0" && (boot.__HYPERCANVAS_DESKTOP_APPEARANCE__ || boot.__HYPERCANVAS_NATIVE_APPEARANCE__)) return;
    if (getConfigSnapshot() !== "0") {
      boot.__HYPERCANVAS_THEME_STORE_READY__ = true;
      document.documentElement.style.removeProperty("color-scheme");
    }
  }
  const cfg = themesConfig();
  const bySurface = computeBySurface(cfg, resolved, _syncTargets);
  applyThemeToDom(cfg, bySurface);
}
function _dispatchEvent(theme, resolved) {
  if (typeof document === "undefined") return;
  const cfg = themesConfig();
  const bySurface = computeBySurface(cfg, resolved, _syncTargets);
  document.dispatchEvent(new CustomEvent("storyboard:theme:changed", {
    detail: {
      theme,
      resolved,
      bySurface,
      // Legacy mirror — keep until consumers migrate.
      prototypeTheme: bySurface.prototype,
      prototypeResolved: bySurface.prototype,
      toolbarResolved: bySurface.toolbar,
      codeResolved: bySurface.codeBoxes,
      canvasResolved: bySurface.canvas
    }
  }));
}
let _observerInstalled = false;
function _installSurfaceObserver() {
  if (_observerInstalled) return;
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;
  if (!document.body) {
    document.addEventListener("DOMContentLoaded", _installSurfaceObserver, { once: true });
    return;
  }
  _observerInstalled = true;
  const reapply = () => _applyToDOM(_current, resolveTheme(_current));
  const observer = new MutationObserver((mutations) => {
    let needsReapply = false;
    for (const m of mutations) {
      if (m.type === "attributes" && m.attributeName === "data-sb-surface") {
        needsReapply = true;
        break;
      }
      if (m.type === "childList") {
        for (const node of m.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.hasAttribute("data-sb-surface") || node.querySelector?.("[data-sb-surface]")) {
            needsReapply = true;
            break;
          }
        }
        if (needsReapply) break;
      }
    }
    if (needsReapply) reapply();
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-sb-surface"]
  });
}
subscribeToConfig(() => {
  const cfg = themesConfig();
  _syncTargets = readStoredSync(cfg);
  _syncStore.set(_syncTargets);
  const authoredTheme = readUrlTheme();
  const urlTheme = authoredTheme || readEffectiveUrlTheme();
  if (urlTheme) {
    _current = urlTheme;
    _pendingDesktopAppearance = null;
  }
  if (_pendingDesktopAppearance && getConfigSnapshot() !== "0") {
    const mode = _pendingDesktopAppearance;
    _pendingDesktopAppearance = null;
    applyDesktopAppearance(mode);
    return;
  }
  const state = snapshot(_current);
  _store.set(state);
  _applyToDOM(_current, state.resolved);
  _dispatchEvent(_current, state.resolved);
});
function getTheme() {
  return _current;
}
function appearanceModeForTheme(value) {
  if (value === "system") return "system";
  const registry = themesConfig().themes;
  const theme = isRecord(registry) ? registry[value] : null;
  const attrs = isRecord(theme) && isRecord(theme.attrs) ? theme.attrs : null;
  const mode = attrs?.["data-color-mode"];
  return mode === "light" || mode === "dark" ? mode : null;
}
function isManagedFrame() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const target = params.get("_sb_theme_target");
  const surfaces = themesConfig().surfaces;
  return params.has("_sb_embed") && !!target && isRecord(surfaces) && Object.hasOwn(surfaces, target);
}
function readEffectiveUrlTheme() {
  const authored = readUrlTheme();
  if (authored) return authored;
  if (!isManagedFrame() || typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("_sb_canvas_theme");
  const registry = themesConfig().themes;
  return value && isRecord(registry) && Object.hasOwn(registry, value) ? value : null;
}
function writeFrameThemeToUrl(value) {
  if (typeof window === "undefined") return;
  if (!isManagedFrame() && !new URLSearchParams(window.location.search).has("theme")) return;
  const url = new URL(window.location.href);
  url.searchParams.set("theme", value);
  url.searchParams.set("_sb_canvas_theme", value);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}
function applyEmbeddedFrameTheme(value, inheritedTheme) {
  const registry = themesConfig().themes;
  const inherit = value === "inherit";
  const nextInherited = inheritedTheme && isRecord(registry) && Object.hasOwn(registry, inheritedTheme) ? inheritedTheme : readStoredTheme(themesConfig());
  if (!isRecord(registry) || !inherit && value !== "system" && !Object.hasOwn(registry, value) || !isManagedFrame()) return false;
  const url = new URL(window.location.href);
  if (inherit) url.searchParams.delete("theme");
  else url.searchParams.set("theme", value);
  url.searchParams.set("_sb_canvas_theme", inherit ? nextInherited : value);
  const next = inherit ? nextInherited : value;
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  _current = next;
  const state = snapshot(next);
  _store.set(state);
  _applyToDOM(next, state.resolved);
  _dispatchEvent(next, state.resolved);
  return true;
}
function syncEmbeddedFrameTheme(value) {
  const registry = themesConfig().themes;
  if (!isRecord(registry) || value !== "system" && !Object.hasOwn(registry, value) || !isManagedFrame()) return false;
  if (readUrlTheme()) return false;
  const url = new URL(window.location.href);
  url.searchParams.set("_sb_canvas_theme", value);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  _current = value;
  const state = snapshot(value);
  _store.set(state);
  _applyToDOM(value, state.resolved);
  _dispatchEvent(value, state.resolved);
  return true;
}
function applyTheme(value, persistDesktop) {
  const managedFrame = isManagedFrame();
  writeFrameThemeToUrl(value);
  _current = value;
  if (!managedFrame && typeof localStorage !== "undefined") {
    if (value === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, value);
  }
  const state = snapshot(value);
  _store.set(state);
  _applyToDOM(value, state.resolved);
  _dispatchEvent(value, state.resolved);
  if (persistDesktop && !managedFrame) {
    const mode = appearanceModeForTheme(value);
    const bridge = typeof window === "undefined" ? null : window.mygo;
    if (mode && typeof bridge?.call === "function" && writeDesktopAppearance) {
      void writeDesktopAppearance(mode).catch((error) => {
        console.warn("Could not persist the Hypercanvas desktop appearance preference.", error);
      });
    }
  }
}
function setTheme(value) {
  applyTheme(value, true);
}
function applyDesktopAppearance(mode) {
  if (getConfigSnapshot() === "0") {
    _pendingDesktopAppearance = mode;
    return false;
  }
  if (readEffectiveUrlTheme()) {
    _pendingDesktopAppearance = null;
    return true;
  }
  if (mode === "system") {
    applyTheme("system", false);
    return true;
  }
  const registry = themesConfig().themes;
  if (!isRecord(registry)) return false;
  const currentMode = appearanceModeForTheme(_current);
  const selected = currentMode === mode ? _current : Object.entries(registry).find(([, theme]) => {
    const attrs = isRecord(theme) && isRecord(theme.attrs) ? theme.attrs : null;
    return attrs?.["data-color-mode"] === mode;
  })?.[0] || null;
  if (!selected) return false;
  applyTheme(selected, false);
  return true;
}
const themeState = { subscribe: _store.subscribe };
function getSurfaceSync() {
  return { ..._syncTargets };
}
function setSurfaceSync(surfaceId, value) {
  _syncTargets = { ..._syncTargets, [surfaceId]: value };
  _syncStore.set(_syncTargets);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(_syncTargets));
    markSyncDefaultsCurrent();
  }
  const state = snapshot(_current);
  _applyToDOM(_current, state.resolved);
  _dispatchEvent(_current, state.resolved);
}
const surfaceSyncState = { subscribe: _syncStore.subscribe };
function getResolvedFor(surfaceId) {
  const resolved = resolveTheme(_current);
  return computeBySurface(themesConfig(), resolved, _syncTargets)[surfaceId] || "light";
}
const THEMES = new Proxy([], {
  get(_target, prop) {
    const configuredThemes = themesConfig().themes;
    const themes = isRecord(configuredThemes) ? configuredThemes : {};
    const list = Object.entries(themes).map(([value2, definition]) => ({
      value: value2,
      name: isRecord(definition) && typeof definition.label === "string" && definition.label ? definition.label : value2
    }));
    if (!list.some((t) => t.value === "system")) {
      list.unshift({ name: "System", value: "system" });
    }
    const value = Reflect.get(list, prop, list);
    return typeof value === "function" ? value.bind(list) : value;
  }
});
function getThemeSyncTargets() {
  return getSurfaceSync();
}
function setThemeSyncTarget(target, value) {
  setSurfaceSync(String(target), value);
}
const themeSyncState = {
  subscribe(run) {
    return _syncStore.subscribe((v) => run(v));
  }
};
if (typeof window !== "undefined") {
  const historyWithObserver = window.history;
  if (!historyWithObserver.__hypercanvasThemeUrlObserver) {
    for (const method of ["pushState", "replaceState"]) {
      const original = window.history[method];
      window.history[method] = function(...args) {
        const result = original.apply(this, args);
        window.dispatchEvent(new Event("storyboard:url-state-changed"));
        return result;
      };
    }
    historyWithObserver.__hypercanvasThemeUrlObserver = true;
  }
  const syncThemeFromUrl = () => {
    const next = readEffectiveUrlTheme() || readStoredTheme(themesConfig());
    if (next === _current) return;
    _current = next;
    const state = snapshot(next);
    _store.set(state);
    _applyToDOM(next, state.resolved);
    _dispatchEvent(next, state.resolved);
  };
  window.addEventListener("storyboard:url-state-changed", syncThemeFromUrl);
  window.addEventListener("popstate", syncThemeFromUrl);
  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || !isRecord(event.data) || typeof event.data.theme !== "string") return;
    if (event.data.type === "storyboard:embed:set-theme") {
      applyEmbeddedFrameTheme(event.data.theme, typeof event.data.inheritedTheme === "string" ? event.data.inheritedTheme : void 0);
    }
    if (event.data.type === "storyboard:embed:sync-theme") syncEmbeddedFrameTheme(event.data.theme);
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (_current !== "system") return;
    const state = snapshot("system");
    _store.set(state);
    _applyToDOM("system", state.resolved);
    _dispatchEvent("system", state.resolved);
  });
  window.addEventListener("storage", (e) => {
    if (e.storageArea !== localStorage) return;
    if (e.key === THEME_STORAGE_KEY || e.key === null) {
      const next = readEffectiveUrlTheme() || readStoredTheme(themesConfig());
      _current = next;
      const state = snapshot(next);
      _store.set(state);
      _applyToDOM(next, state.resolved);
      _dispatchEvent(next, state.resolved);
    } else if (e.key === SYNC_STORAGE_KEY) {
      _syncTargets = readStoredSync(themesConfig());
      _syncStore.set(_syncTargets);
      const state = snapshot(_current);
      _applyToDOM(_current, state.resolved);
      _dispatchEvent(_current, state.resolved);
    }
  });
}
if (typeof window !== "undefined") {
  let appearanceSequence = -1;
  const receive = (incoming) => {
    if (!isRecord(incoming) || incoming.schemaVersion !== 1 || !Number.isSafeInteger(incoming.sequence) || Number(incoming.sequence) < 0 || Number(incoming.sequence) <= appearanceSequence || !["system", "light", "dark"].includes(String(incoming.mode)) || !["light", "dark"].includes(String(incoming.resolved))) return;
    appearanceSequence = Number(incoming.sequence);
    applyDesktopAppearance(incoming.mode);
  };
  receive(window.__HYPERCANVAS_DESKTOP_APPEARANCE__);
  window.addEventListener("hypercanvas:desktop-appearance", (event) => receive(event.detail));
}
_installSurfaceObserver();
_applyToDOM(_current, resolveTheme(_current));
export {
  THEMES,
  applyDesktopAppearance,
  applyEmbeddedFrameTheme,
  getResolvedFor,
  getSurfaceSync,
  getTheme,
  getThemeSyncTargets,
  setSurfaceSync,
  setTheme,
  setThemeHostCapabilities,
  setThemeSyncTarget,
  surfaceSyncState,
  themeState,
  themeSyncState
};
