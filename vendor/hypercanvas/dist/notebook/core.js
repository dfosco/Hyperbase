import { deepMerge, findRecord, flowExists, getCanvasData, getFlowsForPrototype, getFolderMetadata, getPrototypeMetadata, getStoryData, init, listCanvases, listFlows, listFolders, listPrototypes, listScenes, listStories, loadFlow, loadObject, loadRecord, loadScene, resolveFlowName, resolveObjectName, resolveRecordName, sceneExists } from "./core-0.js";
import { d, g, s } from "./chunks/dotPath-CXf9dtnn.js";
import { a, c, b, d as d2, g as g2, e, f, h, i, j, k, l, m, n, o, p, r, q, s as s2, t, u, v, w } from "./chunks/hideMode-DxxH-PW9.js";
import { s as subscribeToStorage } from "./chunks/localStorage-DulkrQ4k.js";
import { g as g3, a as a2, b as b2, n as n2, r as r2, c as c2 } from "./chunks/localStorage-DulkrQ4k.js";
import { g as g4, i as i2, a as a3, b as b3, s as s3 } from "./chunks/sbNavigate-B3XfDwJj.js";
import { g as g5, s as s4 } from "./chunks/hashSubscribe-Bi9R_rI0.js";
import { i as i3, s as s5, a as a4, b as b4 } from "./chunks/bodyClasses-BfDW4I72.js";
import { activateMode, deactivateMode, emit, getCurrentMode, getLockedMode, getModeSnapshot, getRegisteredModes, getToolState, getToolsForMode, getToolsSnapshot, initModesConfig, initTools, isModeSwitcherVisible, isModesEnabled, off, on, registerMode, setToolAction, setToolState, subscribeToMode, subscribeToTools, syncModeClasses, unregisterMode } from "./core-8.js";
import { a as a5, b as b5, g as g6, c as c3, h as h2, r as r3, d as d3 } from "./chunks/viewfinder-D-4ZTzXo.js";
import { getFlag } from "./core-3.js";
import { getAllFlags, getFlagKeys, initFeatureFlags, resetFlags, setFlag, syncFlagBodyClasses, toggleFlag } from "./core-3.js";
import * as statefullyCore from "@dfosco/statefully/core";
import { flattenKnobs, getComponentKnobs, getPrototypeKnobs, initKnobs, resolveKnobDef } from "./core-1.js";
import { D, c as c4, d as d4, i as i4, a as a6, r as r4, u as u2 } from "./chunks/highlight-BdnfQn3S.js";
import { c as c5, e as e2, g as g7, a as a7, b as b6, h as h3, i as i5, d as d5, r as r5, s as s6, f as f2, j as j2, u as u3 } from "./chunks/commandActions-CvE2nUEH.js";
import { getPluginsConfig, initPlugins, isPluginEnabled } from "./core-4.js";
import { addHiddenItems, getHiddenItems, initUIConfig, isMenuHidden } from "./core-5.js";
import { clearPrototypeToolbarConfig, consumeClientToolbarOverrides, getToolbarConfig, getToolbarConfigSnapshot, initToolbarConfig, setClientToolbarOverrides, setPrototypeToolbarConfig, subscribeToToolbarConfig } from "./core-7.js";
import { c as canUseNotebookAuthoringTools } from "./chunks/notebookCapabilities-C3HcelTI.js";
import { A, g as g8, a as a8, b as b7, c as c6, d as d6, e as e3, i as i6, f as f3, h as h4 } from "./chunks/canvasConfig-JhY60Ge2.js";
import { getConfig } from "./core-2.js";
import { clearAllOverrides, clearOverrides, getConfigSnapshot, initConfig, setOverrides, subscribeToConfig } from "./core-2.js";
import { getCustomerModeConfig, getCustomerModeHomepage, initCustomerModeConfig, isCustomerHidingAllTools, isCustomerHidingBranchBar, isCustomerHidingCommandPalette, isCustomerHidingHomepage, isCustomerMode, isCustomerToolHidden, resolveHomepageTarget } from "./core-6.js";
import { b as b8, a as a9, g as g9, i as i7, r as r6, s as s7, u as u4 } from "./chunks/widgetRegistry-CmXYjxwi.js";
import { THEMES, getResolvedFor, getSurfaceSync, getTheme, getThemeSyncTargets, setSurfaceSync, setTheme, setThemeSyncTarget, surfaceSyncState, themeState, themeSyncState } from "./core-9.js";
import { I, I as I2 } from "./chunks/Icon-I4lR4N0q.js";
import { r as resolveSiteUrl, a as normalizeSiteRoute, n as normalizeSiteId } from "./chunks/contract-Tm25L5gq.js";
import { b as b9 } from "./chunks/contract-Tm25L5gq.js";
function buildKnobKey(id, options) {
  if (typeof statefullyCore.buildKnobKey !== "function") {
    throw new TypeError("The installed Statefully runtime must expose buildKnobKey().");
  }
  return statefullyCore.buildKnobKey(id, options);
}
function buildLegacyKnobKey(id, options) {
  if (typeof statefullyCore.buildLegacyKnobKey !== "function") {
    throw new TypeError("The installed Statefully runtime must expose buildLegacyKnobKey().");
  }
  return statefullyCore.buildLegacyKnobKey(id, options);
}
function coerceByType(rawValue, definition = {}) {
  if (typeof statefullyCore.coerce !== "function") {
    throw new TypeError("The installed Statefully runtime must expose coerce().");
  }
  const type = definition.type === "text" ? "string" : definition.type;
  return statefullyCore.coerce(rawValue, type, void 0, definition);
}
function requireFunction(name) {
  const value = statefullyCore[name];
  if (typeof value !== "function") {
    throw new TypeError(`The installed Statefully runtime must expose ${name}().`);
  }
  return value;
}
function setKnobValue(id, value, options) {
  requireFunction("setKnobValue")(id, value, options);
}
function clearKnobValue(id, options) {
  requireFunction("clearKnobValue")(id, options);
}
function serializeKnobValue(value, definition) {
  return requireFunction("serializeKnobValue")(value, definition);
}
let _toolConfigs = {};
const _modules = /* @__PURE__ */ new Map();
const _components = /* @__PURE__ */ new Map();
const _guardResults = /* @__PURE__ */ new Map();
const _listeners$3 = /* @__PURE__ */ new Set();
let _snapshotVersion$3 = 0;
function initToolRegistry(config) {
  if (config.tools) {
    _toolConfigs = { ...config.tools };
  }
  _notify$4();
}
function registerToolModule(id, mod) {
  _modules.set(id, mod);
  _notify$4();
}
function setToolComponent(id, component) {
  _components.set(id, component);
  _notify$4();
}
function setToolGuardResult(id, result) {
  _guardResults.set(id, result);
  _notify$4();
}
function getToolComponent(id) {
  return _components.get(id) || null;
}
function getToolModule(id) {
  return _modules.get(id) || null;
}
function getToolsForToolbar(toolbar, mode, options = {}) {
  const { isLocalDev = false } = options;
  const results = [];
  for (const [id, config] of Object.entries(_toolConfigs)) {
    if (config.disabled) continue;
    if ((config.surface || config.toolbar) !== toolbar) continue;
    if (!config.prod && !isLocalDev) continue;
    if (!isToolVisibleInMode(config, mode)) continue;
    if (_guardResults.has(id) && !_guardResults.get(id)) continue;
    results.push({
      id,
      config,
      module: _modules.get(id) || null,
      component: _components.get(id) || null
    });
  }
  return results;
}
function getToolConfig(id) {
  return _toolConfigs[id] || null;
}
function getAllToolConfigs() {
  return { ..._toolConfigs };
}
function isToolVisibleInMode(config, mode) {
  const modes = config.modes;
  if (!modes) return true;
  return modes.includes("*") || modes.includes(mode);
}
function subscribeToToolRegistry(callback) {
  _listeners$3.add(callback);
  return () => _listeners$3.delete(callback);
}
function getToolRegistrySnapshot() {
  return String(_snapshotVersion$3);
}
function _notify$4() {
  _snapshotVersion$3++;
  for (const cb of _listeners$3) {
    try {
      cb();
    } catch (err) {
      console.error("[storyboard] Error in tool registry subscriber:", err);
    }
  }
}
const TOOL_STATES = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
  HIDDEN: "hidden",
  DIMMED: "dimmed",
  DISABLED: "disabled"
});
const VALID_STATES = new Set(Object.values(TOOL_STATES));
function isToolState(state) {
  return VALID_STATES.has(state);
}
let _states = /* @__PURE__ */ new Map();
let _publishingTools = /* @__PURE__ */ new Set(["publish", "publish-command"]);
let _authoringPanelTools = /* @__PURE__ */ new Set();
let _publishingEnabled = getFlag("notebook-publishing");
let _devOnlyFlags = /* @__PURE__ */ new Map();
const _listeners$2 = /* @__PURE__ */ new Set();
let _snapshotVersion$2 = 0;
function initToolbarToolStates(toolsConfig, options = {}) {
  const { isLocalDev = false } = options;
  _states = /* @__PURE__ */ new Map();
  _devOnlyFlags = /* @__PURE__ */ new Map();
  _publishingTools = /* @__PURE__ */ new Set(["publish", "publish-command"]);
  _authoringPanelTools = /* @__PURE__ */ new Set();
  if (!toolsConfig || typeof toolsConfig !== "object") {
    _notify$3();
    return;
  }
  for (const [id, rawTool] of Object.entries(toolsConfig)) {
    const tool = rawTool;
    if (tool.handler === "core:publish") _publishingTools.add(id);
    if (tool.surface === "sidepanel" || tool.render === "sidepanel" || tool.sidepanel || ["core:publish", "core:agents-ready", "core:canvas-agents"].includes(String(tool.handler))) _authoringPanelTools.add(id);
    const isDevOnly = !tool.prod || tool.localOnly === true;
    _devOnlyFlags.set(id, isDevOnly);
    if (isDevOnly && !isLocalDev) {
      _states.set(id, TOOL_STATES.DISABLED);
    } else if (tool.disabled === true) {
      _states.set(id, TOOL_STATES.DISABLED);
    } else {
      const state = tool.state || TOOL_STATES.ACTIVE;
      _states.set(id, state);
    }
  }
  _notify$3();
}
function setToolbarToolState(id, state) {
  if (!isToolState(state)) {
    console.warn(`[storyboard] Invalid tool state "${state}" for tool "${id}". Valid states: ${[...VALID_STATES].join(", ")}`);
    return;
  }
  _states.set(id, state);
  _notify$3();
}
function getToolbarToolState(id) {
  if (!canUseNotebookAuthoringTools() && _authoringPanelTools.has(id)) return TOOL_STATES.DISABLED;
  const state = _states.get(id) || TOOL_STATES.ACTIVE;
  if (state !== TOOL_STATES.DISABLED && _publishingTools.has(id) && !getFlag("notebook-publishing")) return TOOL_STATES.HIDDEN;
  return state;
}
function isToolbarToolLocalOnly(id) {
  return _devOnlyFlags.get(id) || false;
}
function subscribeToToolbarToolStates(callback) {
  _publishingEnabled = getFlag("notebook-publishing");
  _listeners$2.add(callback);
  const unsubscribeFlags = subscribeToStorage(() => {
    const enabled = getFlag("notebook-publishing");
    if (enabled !== _publishingEnabled) {
      _publishingEnabled = enabled;
      _notify$3();
    }
  });
  return () => {
    unsubscribeFlags();
    return _listeners$2.delete(callback);
  };
}
function getToolbarToolStatesSnapshot() {
  return String(_snapshotVersion$2);
}
function _notify$3() {
  _snapshotVersion$2++;
  for (const cb of _listeners$2) {
    try {
      cb();
    } catch (err) {
      console.error("[storyboard] Error in tool state subscriber:", err);
    }
  }
}
let _config$1 = null;
function initCommentsConfig(rawConfig, options = {}) {
  if (!rawConfig || !rawConfig.comments) {
    _config$1 = null;
    return;
  }
  const c7 = rawConfig.comments;
  const r7 = rawConfig.repository;
  _config$1 = {
    repo: {
      owner: r7?.owner ?? "",
      name: r7?.name ?? ""
    },
    discussions: {
      category: c7.discussions?.category ?? "Storyboard Comments"
    },
    basePath: options.basePath ?? "/"
  };
}
function getCommentsConfig() {
  return _config$1;
}
function isCommentsEnabled() {
  return _config$1 !== null && _config$1.repo.owner !== "" && _config$1.repo.name !== "";
}
let _config = { sections: [] };
function initCommandPaletteConfig(config = {}) {
  _config = { sections: [], ...config };
}
function getCommandPaletteConfig() {
  if (_config.sections.length === 0) {
    const uc = getConfig("commandPalette");
    if ((uc.sections?.length ?? 0) > 0) {
      _config = { sections: [], ...uc };
    }
  }
  return _config;
}
let _overrides = /* @__PURE__ */ new Map();
const _listeners$1 = /* @__PURE__ */ new Set();
let _snapshotVersion$1 = 0;
function initPresentation(map) {
  _overrides = /* @__PURE__ */ new Map();
  if (map && typeof map === "object") {
    for (const [id, override] of Object.entries(map)) {
      if (override && typeof override === "object") {
        _overrides.set(id, override);
      }
    }
  }
  _notify$2();
}
function setPresentation(id, override) {
  if (override == null) {
    _overrides.delete(id);
  } else if (typeof override === "object") {
    _overrides.set(id, override);
  }
  _notify$2();
}
function getPresentation(id) {
  return _overrides.get(id) || null;
}
function subscribeToPresentation(callback) {
  _listeners$1.add(callback);
  return () => _listeners$1.delete(callback);
}
function getPresentationSnapshot() {
  return String(_snapshotVersion$1);
}
function _notify$2() {
  _snapshotVersion$1++;
  for (const cb of _listeners$1) {
    try {
      cb();
    } catch (err) {
      console.error("[storyboard] Error in presentation subscriber:", err);
    }
  }
}
const VALID_AXES = /* @__PURE__ */ new Set(["both", "vertical", "horizontal", "none"]);
const VALID_ZOOM_ORIGINS = /* @__PURE__ */ new Set(["center", "top-left"]);
const VALID_SURFACE_SIZES = /* @__PURE__ */ new Set(["auto", "viewport"]);
const _defaults = {
  scrollAxis: "both",
  zoomGestures: true,
  zoomOrigin: "center",
  surface: { width: "auto", height: "auto" }
};
let _state = {
  ..._defaults,
  surface: { ..._defaults.surface }
};
const _listeners = /* @__PURE__ */ new Set();
let _snapshotVersion = 0;
function _applySurfaceAttrs() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (_state.surface.width === "viewport") {
    root.dataset.canvasSurfaceWidth = "viewport";
  } else {
    delete root.dataset.canvasSurfaceWidth;
  }
  if (_state.surface.height === "viewport") {
    root.dataset.canvasSurfaceHeight = "viewport";
  } else {
    delete root.dataset.canvasSurfaceHeight;
  }
}
function _readSurfaceFromConfig(input) {
  if (!input || typeof input !== "object") return null;
  const surface = input;
  const next = {};
  if (typeof surface.width === "string" && VALID_SURFACE_SIZES.has(surface.width)) {
    next.width = surface.width;
  }
  if (typeof surface.height === "string" && VALID_SURFACE_SIZES.has(surface.height)) {
    next.height = surface.height;
  }
  return Object.keys(next).length ? next : null;
}
function initCanvasInteraction(config) {
  _state = {
    ..._defaults,
    surface: { ..._defaults.surface }
  };
  if (config && typeof config === "object") {
    if (typeof config.scrollAxis === "string" && VALID_AXES.has(config.scrollAxis)) {
      _state.scrollAxis = config.scrollAxis;
    }
    if (typeof config.zoomGestures === "boolean") {
      _state.zoomGestures = config.zoomGestures;
    }
    if (typeof config.zoomOrigin === "string" && VALID_ZOOM_ORIGINS.has(config.zoomOrigin)) {
      _state.zoomOrigin = config.zoomOrigin;
    }
    const surfaceUpdate = _readSurfaceFromConfig(config.surface);
    if (surfaceUpdate) {
      _state.surface = { ..._state.surface, ...surfaceUpdate };
    }
  }
  _applySurfaceAttrs();
  _notify$1();
}
function setCanvasInteraction(partial) {
  if (!partial || typeof partial !== "object") return;
  let changed = false;
  if (typeof partial.scrollAxis === "string" && VALID_AXES.has(partial.scrollAxis) && partial.scrollAxis !== _state.scrollAxis) {
    _state.scrollAxis = partial.scrollAxis;
    changed = true;
  }
  if (typeof partial.zoomGestures === "boolean" && partial.zoomGestures !== _state.zoomGestures) {
    _state.zoomGestures = partial.zoomGestures;
    changed = true;
  }
  if (typeof partial.zoomOrigin === "string" && VALID_ZOOM_ORIGINS.has(partial.zoomOrigin) && partial.zoomOrigin !== _state.zoomOrigin) {
    _state.zoomOrigin = partial.zoomOrigin;
    changed = true;
  }
  const surfaceUpdate = _readSurfaceFromConfig(partial.surface);
  if (surfaceUpdate) {
    const merged = { ..._state.surface, ...surfaceUpdate };
    if (merged.width !== _state.surface.width || merged.height !== _state.surface.height) {
      _state.surface = merged;
      _applySurfaceAttrs();
      changed = true;
    }
  }
  if (changed) _notify$1();
}
function getCanvasInteraction() {
  return _state;
}
function subscribeToCanvasInteraction(callback) {
  _listeners.add(callback);
  return () => _listeners.delete(callback);
}
function getCanvasInteractionSnapshot() {
  return String(_snapshotVersion);
}
function _notify$1() {
  _snapshotVersion++;
  for (const cb of _listeners) {
    try {
      cb();
    } catch (err) {
      console.error("[storyboard] Error in canvas-interaction subscriber:", err);
    }
  }
}
const STORAGE_KEY = "storyboard:recent-artifacts";
const MAX_ITEMS = 30;
const CHANGE_EVENT = "storyboard-recent-artifacts-changed";
function isRecentEntry(value) {
  return typeof value === "object" && value !== null && typeof Reflect.get(value, "type") === "string" && typeof Reflect.get(value, "key") === "string" && typeof Reflect.get(value, "label") === "string";
}
function trackRecent(type, key, label) {
  if (!type || !key) return;
  const entries = _read();
  const deduped = entries.filter((entry) => !(entry.type === type && entry.key === key));
  deduped.unshift({ type, key, label: label || key });
  _write(deduped.slice(0, MAX_ITEMS));
}
function getRecent() {
  return _read();
}
function clearRecent() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    _notify();
  } catch {
  }
}
function subscribeToRecent(callback) {
  if (typeof window === "undefined") return () => {
  };
  const onStorage = (event) => {
    if (!event || !event.key || event.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}
function getRecentSnapshot() {
  try {
    return localStorage.getItem(STORAGE_KEY) || "[]";
  } catch {
    return "[]";
  }
}
function _read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRecentEntry) : [];
  } catch {
    return [];
  }
}
function _write(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    _notify();
  } catch {
  }
}
function _notify() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
  }
}
const SCORE_PREFIX = 100;
const SCORE_WORD_BOUNDARY = 75;
const SCORE_SUBSTRING = 50;
const SCORE_FUZZY = 25;
function scoreMatch(text, query) {
  if (!query) return 0;
  if (!text) return -1;
  const lower = text.toLowerCase();
  const qLen = query.length;
  const tLen = lower.length;
  if (lower.startsWith(query)) return SCORE_PREFIX + (1 - qLen / tLen) * 10;
  const boundaryIdx = findWordBoundaryMatch(lower, query);
  if (boundaryIdx >= 0) return SCORE_WORD_BOUNDARY + (1 - boundaryIdx / tLen) * 10;
  const subIdx = lower.indexOf(query);
  if (subIdx >= 0) return SCORE_SUBSTRING + (1 - subIdx / tLen) * 10;
  return fuzzyScore(lower, query);
}
function findWordBoundaryMatch(text, query) {
  const boundaries = /[\s/\-_.]/;
  for (let i8 = 1; i8 <= text.length - query.length; i8++) {
    if (boundaries.test(text[i8 - 1]) && text.startsWith(query, i8)) return i8;
  }
  return -1;
}
function fuzzyScore(text, query) {
  let qi = 0;
  let totalGap = 0;
  let lastMatch = -1;
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (text[ti] === query[qi]) {
      if (lastMatch >= 0) totalGap += ti - lastMatch - 1;
      lastMatch = ti;
      qi++;
    }
  }
  if (qi < query.length) return -1;
  const gapPenalty = Math.min(totalGap * 2, 20);
  return SCORE_FUZZY - gapPenalty;
}
function normalizeSiteReference(value = {}) {
  return {
    siteId: normalizeSiteId(value.siteId),
    route: normalizeSiteRoute(value.route),
    ...value.title ? { title: String(value.title) } : {},
    ...value.width ? { width: positive(value.width, 800) } : {},
    ...value.height ? { height: positive(value.height, 600) } : {}
  };
}
function siteCaptureKey(reference, { bindingRevision = 0, theme = "light" } = {}) {
  const normalized = normalizeSiteReference(reference);
  return stableHash(JSON.stringify({ ...normalized, bindingRevision, theme }));
}
function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0").repeat(3).slice(0, 24);
}
function createPublishedSiteFrame(reference, { productionBaseUrl, snapshotUrl, bindingRevision = 0, theme = "light" } = {}) {
  const normalized = normalizeSiteReference(reference);
  const openUrl = resolveSiteUrl(productionBaseUrl, normalized.siteId, normalized.route);
  return {
    ...normalized,
    openUrl,
    snapshotUrl: snapshotUrl ?? null,
    captureKey: siteCaptureKey(normalized, { bindingRevision, theme }),
    mode: snapshotUrl ? "snapshot" : "unavailable"
  };
}
function positive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback;
}
function renderPublishedSiteFrame(frame) {
  const title = escapeHtml(frame?.title || frame?.siteId || "Site");
  if (!frame?.snapshotUrl) return `<article class="site-frame site-frame--unavailable"><strong>${title}</strong><p>Preview unavailable.</p><a href="${escapeHtml(frame?.openUrl || "#")}">Open site</a></article>`;
  return `<figure class="site-frame"><a href="${escapeHtml(frame.openUrl || "#")}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(frame.snapshotUrl)}" alt="${title}" loading="lazy"></a><figcaption>${title}</figcaption></figure>`;
}
function buildPublishedSiteManifest(references = [], options = {}) {
  return references.map((reference) => {
    const selected = options[normalizeSiteIdForLookup(reference.siteId)];
    return createPublishedSiteFrame(reference, selected ?? options);
  });
}
function normalizeSiteIdForLookup(siteId) {
  return String(siteId ?? "");
}
function escapeHtml(value) {
  const escaped = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(value ?? "").replace(/[&<>"']/g, (character) => escaped[character] ?? character);
}
export {
  A as AUTO_PLACE_DEFAULTS,
  D as DEFAULT_KNOB_COLOR,
  I as Icon,
  I2 as IconDefault,
  THEMES,
  TOOL_STATES,
  a as activateHideMode,
  activateMode,
  addHiddenItems,
  a5 as appendTokens,
  buildKnobKey,
  buildLegacyKnobKey,
  b5 as buildPrototypeIndex,
  buildPublishedSiteManifest,
  c as canRedo,
  b as canUndo,
  clearAllOverrides,
  c5 as clearDynamicActions,
  clearKnobValue,
  clearOverrides,
  clearPrototypeToolbarConfig,
  clearRecent,
  coerceByType,
  consumeClientToolbarOverrides,
  c4 as createHypercanvasKnobRuntime,
  createPublishedSiteFrame,
  d2 as deactivateHideMode,
  deactivateMode,
  d as deepClone,
  deepMerge,
  d4 as detectCurrentPrototypeRoute,
  emit,
  e2 as executeAction,
  findRecord,
  flattenKnobs,
  flowExists,
  g7 as getActionChildren,
  a7 as getActionsForMode,
  g8 as getAgentsConfig,
  getAllFlags,
  g3 as getAllLocal,
  g2 as getAllParams,
  e as getAllShadows,
  getAllToolConfigs,
  b8 as getAllWidgetDefinitions,
  g as getByPath,
  getCanvasData,
  getCanvasInteraction,
  getCanvasInteractionSnapshot,
  a8 as getCanvasProduction,
  b7 as getCanvasZoom,
  b6 as getCommandActionsSnapshot,
  getCommandPaletteConfig,
  getCommentsConfig,
  getComponentKnobs,
  getConfig,
  getConfigSnapshot,
  f as getCurrentIndex,
  getCurrentMode,
  h as getCurrentRoute,
  i as getCurrentSnapshot,
  getCustomerModeConfig,
  getCustomerModeHomepage,
  getFlag,
  getFlagKeys,
  g6 as getFlowMeta,
  getFlowsForPrototype,
  getFolderMetadata,
  g5 as getHashSnapshot,
  getHiddenItems,
  a2 as getLocal,
  getLockedMode,
  getModeSnapshot,
  g4 as getNavigationRouter,
  j as getNextIndex,
  k as getOverrideHistory,
  l as getParam,
  c6 as getPasteRules,
  getPluginsConfig,
  getPresentation,
  getPresentationSnapshot,
  getPrototypeKnobs,
  getPrototypeMetadata,
  getRecent,
  getRecentSnapshot,
  getRegisteredModes,
  getResolvedFor,
  c3 as getSceneMeta,
  m as getShadow,
  b2 as getStorageSnapshot,
  getStoryData,
  getSurfaceSync,
  d6 as getTerminalConfig,
  e3 as getTerminalDimensions,
  getTheme,
  getThemeSyncTargets,
  getToolComponent,
  getToolConfig,
  getToolModule,
  getToolRegistrySnapshot,
  getToolState,
  getToolbarConfig,
  getToolbarConfigSnapshot,
  getToolbarToolState,
  getToolbarToolStatesSnapshot,
  getToolsForMode,
  getToolsForToolbar,
  getToolsSnapshot,
  a9 as getWidgetDefinition,
  g9 as getWidgetRegistrySnapshot,
  h3 as hasChildrenProvider,
  h2 as hash,
  init,
  i6 as initCanvasConfig,
  initCanvasInteraction,
  i5 as initCommandActions,
  initCommandPaletteConfig,
  initCommentsConfig,
  initConfig,
  initCustomerModeConfig,
  initFeatureFlags,
  initKnobs,
  initModesConfig,
  initPlugins,
  initPresentation,
  initToolRegistry,
  initToolbarConfig,
  initToolbarToolStates,
  initTools,
  initUIConfig,
  i7 as initWidgetRegistry,
  i3 as installBodyClassSync,
  i2 as installHideParamListener,
  n as installHistorySync,
  i4 as installKnobsHighlight,
  a3 as interceptHideParams,
  f3 as isCanvasProductionEnabled,
  isCommentsEnabled,
  isCustomerHidingAllTools,
  isCustomerHidingBranchBar,
  isCustomerHidingCommandPalette,
  isCustomerHidingHomepage,
  isCustomerMode,
  isCustomerToolHidden,
  d5 as isExcludedByRoute,
  o as isHideMode,
  a6 as isKnobHighlightEnabled,
  isMenuHidden,
  isModeSwitcherVisible,
  isModesEnabled,
  isPluginEnabled,
  h4 as isTerminalResizable,
  isToolbarToolLocalOnly,
  listCanvases,
  listFlows,
  listFolders,
  listPrototypes,
  listScenes,
  listStories,
  loadFlow,
  loadObject,
  loadRecord,
  loadScene,
  normalizeSiteId,
  normalizeSiteReference,
  normalizeSiteRoute,
  b9 as normalizeSiteUrl,
  n2 as notifyChange,
  off,
  on,
  p as pushSnapshot,
  r as redo,
  r5 as registerCommandAction,
  registerMode,
  registerToolModule,
  r6 as registerWidget,
  r2 as removeLocal,
  q as removeParam,
  s2 as removeShadow,
  renderPublishedSiteFrame,
  resetFlags,
  resolveFlowName,
  r3 as resolveFlowRoute,
  resolveHomepageTarget,
  r4 as resolveKnobColor,
  resolveKnobDef,
  resolveObjectName,
  resolveRecordName,
  d3 as resolveSceneRoute,
  resolveSiteUrl,
  b3 as sbNavigate,
  sceneExists,
  scoreMatch,
  serializeKnobValue,
  s as setByPath,
  setCanvasInteraction,
  setClientToolbarOverrides,
  s6 as setDynamicActions,
  setFlag,
  s5 as setFlowClass,
  setKnobValue,
  c2 as setLocal,
  s3 as setNavigationRouter,
  setOverrides,
  t as setParam,
  setPresentation,
  setPrototypeToolbarConfig,
  f2 as setRoutingBasePath,
  a4 as setSceneClass,
  u as setShadow,
  setSurfaceSync,
  setTheme,
  setThemeSyncTarget,
  setToolAction,
  setToolComponent,
  setToolGuardResult,
  setToolState,
  setToolbarToolState,
  siteCaptureKey,
  subscribeToCanvasInteraction,
  j2 as subscribeToCommandActions,
  subscribeToConfig,
  s4 as subscribeToHash,
  subscribeToMode,
  subscribeToPresentation,
  subscribeToRecent,
  subscribeToStorage,
  subscribeToToolRegistry,
  subscribeToToolbarConfig,
  subscribeToToolbarToolStates,
  subscribeToTools,
  s7 as subscribeToWidgetRegistry,
  surfaceSyncState,
  syncFlagBodyClasses,
  v as syncHashToHistory,
  syncModeClasses,
  b4 as syncOverrideClasses,
  themeState,
  themeSyncState,
  toggleFlag,
  trackRecent,
  w as undo,
  u2 as uninstallKnobsHighlight,
  u3 as unregisterCommandAction,
  unregisterMode,
  u4 as unregisterWidget
};
