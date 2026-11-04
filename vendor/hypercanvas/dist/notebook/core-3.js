import { a as getLocal, r as removeLocal, c as setLocal, g as getAllLocal } from "./chunks/localStorage-DulkrQ4k.js";
const __vite_import_meta_env__ = {};
const FLAG_PREFIX = "flag.";
const BODY_CLASS_PREFIX = "sb-ff-";
const STARTUP_ONLY_FLAGS = /* @__PURE__ */ new Set(["usePaseoApp", "hyperAgentInterface"]);
const LIVE_SOURCE_DEFAULT = __vite_import_meta_env__?.VITE_HYPERCANVAS_LIVE_SOURCE === "1";
const RELOAD_NOTICE_DEFAULT = globalThis.__HYPERCANVAS_NOTEBOOK_PREVIEW__ === true;
const LIFECYCLE_DEBUG_PANEL_DEFAULT = RELOAD_NOTICE_DEFAULT;
const BUILD_CHANNEL = globalThis.__HYPERCANVAS_NOTEBOOK_PREVIEW__ === true ? "dev" : "prod";
const BUILTIN_DEFAULTS = {
  "canvas-auto-reload": LIVE_SOURCE_DEFAULT,
  "configuration-auto-reload": LIVE_SOURCE_DEFAULT,
  "prototype-auto-reload": LIVE_SOURCE_DEFAULT,
  "document-reload-notice": RELOAD_NOTICE_DEFAULT,
  "lifecycle-debug-panel": LIFECYCLE_DEBUG_PANEL_DEFAULT,
  "frame-lifecycle-overlay": RELOAD_NOTICE_DEFAULT,
  "agents-ready": false,
  // Side panel sub-pages name themselves after the top nav title and keep its tabs; false restores the previous sub-header row.
  "sidepanel-subpage-breadcrumb": true,
  "notebook-sidebar-search": true,
  "notebook-home-creation-hero": false,
  "notebook-branch-banner": false,
  // Experimental application UI only; Core/CLI publishing remains available.
  "notebook-publishing": false,
  "notebook-sidebar-organization-toggle": false,
  "notebook-folder-drop": false,
  // Experimental canvas widgets — hidden from creation surfaces until enabled.
  "prompt-widget": false,
  "agent-chat-widget": false
};
let _defaults = {};
function syncFlagBodyClasses() {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.hcBuildChannel = BUILD_CHANNEL;
  for (const key of Object.keys(_defaults)) {
    const cls = BODY_CLASS_PREFIX + key;
    if (getFlag(key)) {
      document.body.classList.add(cls);
    } else {
      document.body.classList.remove(cls);
    }
  }
  window.dispatchEvent(new Event("hypercanvas-feature-flags-updated"));
}
function initFeatureFlags(defaults = {}) {
  _defaults = Object.fromEntries(Object.entries({ ...BUILTIN_DEFAULTS, ...defaults }).filter(([key]) => !STARTUP_ONLY_FLAGS.has(key)));
  for (const key of STARTUP_ONLY_FLAGS) {
    if (getLocal(FLAG_PREFIX + key) !== null) removeLocal(FLAG_PREFIX + key);
  }
  for (const [key, value] of Object.entries(_defaults)) {
    if (key === "document-reload-notice" || key === "lifecycle-debug-panel" || key === "frame-lifecycle-overlay") continue;
    if (getLocal(FLAG_PREFIX + key) === null) {
      setLocal(FLAG_PREFIX + key, String(value));
    }
  }
  syncFlagBodyClasses();
}
function getFlag(key) {
  if (STARTUP_ONLY_FLAGS.has(key)) return false;
  const localVal = getLocal(FLAG_PREFIX + key);
  if (localVal !== null) return localVal === "true";
  return _defaults[key] ?? BUILTIN_DEFAULTS[key] ?? false;
}
function setFlag(key, value) {
  if (STARTUP_ONLY_FLAGS.has(key)) return;
  setLocal(FLAG_PREFIX + key, String(value));
  syncFlagBodyClasses();
}
function toggleFlag(key) {
  setFlag(key, !getFlag(key));
}
function getAllFlags() {
  const allKeys = /* @__PURE__ */ new Set([...Object.keys(BUILTIN_DEFAULTS), ...Object.keys(_defaults)]);
  const result = {};
  for (const key of allKeys) {
    result[key] = {
      default: _defaults[key] ?? BUILTIN_DEFAULTS[key] ?? false,
      current: getFlag(key)
    };
  }
  return result;
}
function resetFlags() {
  const allLocal = getAllLocal();
  for (const localKey of Object.keys(allLocal)) {
    if (localKey.startsWith(FLAG_PREFIX)) {
      removeLocal(localKey);
    }
  }
  syncFlagBodyClasses();
}
function getFlagKeys() {
  return [.../* @__PURE__ */ new Set([...Object.keys(BUILTIN_DEFAULTS), ...Object.keys(_defaults)])];
}
export {
  getAllFlags,
  getFlag,
  getFlagKeys,
  initFeatureFlags,
  resetFlags,
  setFlag,
  syncFlagBodyClasses,
  toggleFlag
};
