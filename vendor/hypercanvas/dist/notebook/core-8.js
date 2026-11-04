const _modes = /* @__PURE__ */ new Map();
const _listeners = /* @__PURE__ */ new Set();
const _eventListeners = /* @__PURE__ */ new Map();
const DEFAULT_MODE = "prototype";
let _modesEnabled = false;
let _lockedMode = null;
const _tools = /* @__PURE__ */ new Map();
const _toolState = /* @__PURE__ */ new Map();
const _toolActions = /* @__PURE__ */ new Map();
const _toolListeners = /* @__PURE__ */ new Set();
function registerMode(name, config = {}) {
  if (_modes.has(name)) {
    console.warn(`[storyboard] Mode "${name}" is already registered — overwriting.`);
  }
  _modes.set(name, { name, label: config.label ?? name, ...config });
  _notify();
}
function unregisterMode(name) {
  if (name === DEFAULT_MODE) {
    console.warn(`[storyboard] Cannot unregister the default mode "${DEFAULT_MODE}".`);
    return;
  }
  const mode = _modes.get(name);
  if (!mode) return;
  if (getCurrentMode() === name) {
    deactivateMode();
  }
  _modes.delete(name);
  _notify();
}
function getRegisteredModes() {
  return Array.from(_modes.values());
}
function getCurrentMode() {
  if (_lockedMode && _modes.has(_lockedMode)) return _lockedMode;
  if (typeof window === "undefined") return DEFAULT_MODE;
  const url = new URL(window.location.href);
  const param = url.searchParams.get("mode");
  if (param && _modes.has(param)) return param;
  return DEFAULT_MODE;
}
function activateMode(name, options) {
  if (_lockedMode) {
    console.warn(`[storyboard] Modes are locked to "${_lockedMode}" — ignoring switch to "${name}".`);
    return;
  }
  if (!_modes.has(name)) {
    console.warn(`[storyboard] Mode "${name}" is not registered.`);
    return;
  }
  const prev = getCurrentMode();
  if (prev === name) return;
  const prevMode = _modes.get(prev);
  _removeModeClasses(prevMode);
  if (prevMode?.onDeactivate) prevMode.onDeactivate();
  emit("mode:deactivate", prev);
  const url = new URL(window.location.href);
  if (name === DEFAULT_MODE) {
    url.searchParams.delete("mode");
  } else {
    url.searchParams.set("mode", name);
  }
  window.history.replaceState(null, "", url.toString());
  const newMode = _modes.get(name);
  _applyModeClasses(newMode);
  if (newMode?.onActivate) newMode.onActivate(options);
  emit("mode:activate", name, options);
  emit("mode:change", prev, name);
  _notify();
}
function deactivateMode() {
  activateMode(DEFAULT_MODE);
}
function subscribeToMode(callback) {
  _listeners.add(callback);
  const onPopState = () => {
    _notify();
  };
  window.addEventListener("popstate", onPopState);
  return () => {
    _listeners.delete(callback);
    window.removeEventListener("popstate", onPopState);
  };
}
function getModeSnapshot() {
  const mode = getCurrentMode();
  const names = Array.from(_modes.keys()).join(",");
  return `${mode}|${names}`;
}
function on(event, callback) {
  if (!_eventListeners.has(event)) {
    _eventListeners.set(event, /* @__PURE__ */ new Set());
  }
  _eventListeners.get(event).add(callback);
}
function off(event, callback) {
  const listeners = _eventListeners.get(event);
  if (listeners) listeners.delete(callback);
}
function emit(event, ...args) {
  const listeners = _eventListeners.get(event);
  if (!listeners) return;
  for (const cb of listeners) {
    try {
      cb(...args);
    } catch (err) {
      console.error(`[storyboard] Error in "${event}" listener:`, err);
    }
  }
}
function _getModeClasses(mode) {
  if (!mode) return [];
  const classes = [`storyboard-mode-${mode.name}`];
  if (mode.className) {
    const extra = Array.isArray(mode.className) ? mode.className : mode.className.split(/\s+/);
    classes.push(...extra.filter(Boolean));
  }
  return classes;
}
function _applyModeClasses(mode) {
  if (typeof document === "undefined") return;
  const classes = _getModeClasses(mode);
  if (classes.length) document.documentElement.classList.add(...classes);
}
function _removeModeClasses(mode) {
  if (typeof document === "undefined") return;
  const classes = _getModeClasses(mode);
  if (classes.length) document.documentElement.classList.remove(...classes);
}
function syncModeClasses() {
  const name = getCurrentMode();
  const mode = _modes.get(name);
  if (mode) _applyModeClasses(mode);
}
function _notify() {
  for (const cb of _listeners) {
    try {
      cb();
    } catch (err) {
      console.error("[storyboard] Error in mode subscriber:", err);
    }
  }
}
function initModesConfig(config = {}) {
  _modesEnabled = config.enabled !== false;
  _lockedMode = typeof config.locked === "string" ? config.locked : null;
}
function isModesEnabled() {
  return _modesEnabled;
}
function getLockedMode() {
  return _lockedMode;
}
function isModeSwitcherVisible() {
  return _modesEnabled && !_lockedMode;
}
const DEFAULT_TOOL_STATE = Object.freeze({
  enabled: true,
  active: false,
  busy: false,
  hidden: false,
  badge: null
});
function initTools(config = {}) {
  for (const [modeKey, rawTools] of Object.entries(config)) {
    const tools = rawTools;
    if (!Array.isArray(tools)) continue;
    for (const rawTool of tools) {
      const tool = rawTool;
      if (!tool.id) continue;
      const existing = _tools.get(tool.id);
      if (existing) {
        if (!existing.modes.includes(modeKey)) {
          existing.modes.push(modeKey);
        }
      } else {
        _tools.set(tool.id, {
          id: tool.id,
          label: tool.label ?? tool.id,
          group: tool.group ?? "tools",
          icon: tool.icon ?? null,
          order: tool.order ?? 100,
          modes: [modeKey]
        });
        _toolState.set(tool.id, { ...DEFAULT_TOOL_STATE });
      }
    }
  }
  _notifyTools();
}
function setToolAction(id, action) {
  if (!_tools.has(id)) {
    console.warn(`[storyboard] Tool "${id}" is not declared in modes.config.json.`);
    return;
  }
  _toolActions.set(id, action);
  _notifyTools();
}
function setToolState(id, state = {}) {
  if (!_tools.has(id)) {
    console.warn(`[storyboard] Tool "${id}" is not declared in modes.config.json.`);
    return;
  }
  const current = _toolState.get(id) ?? { ...DEFAULT_TOOL_STATE };
  _toolState.set(id, { ...current, ...state });
  _notifyTools();
}
function getToolState(id) {
  return _toolState.get(id) ?? null;
}
function getToolsForMode(modeName) {
  const result = [];
  for (const [id, tool] of _tools) {
    if (!tool.modes.includes(modeName) && !tool.modes.includes("*")) continue;
    const state = _toolState.get(id) ?? { ...DEFAULT_TOOL_STATE };
    if (state.hidden) continue;
    result.push({
      ...tool,
      state,
      action: _toolActions.get(id) ?? null
    });
  }
  const groupOrder = { tools: 0, dev: 1 };
  result.sort((a, b) => {
    const ga = groupOrder[a.group] ?? 0;
    const gb = groupOrder[b.group] ?? 0;
    if (ga !== gb) return ga - gb;
    return (a.order ?? 100) - (b.order ?? 100);
  });
  return result;
}
function subscribeToTools(callback) {
  _toolListeners.add(callback);
  return () => _toolListeners.delete(callback);
}
function getToolsSnapshot() {
  const entries = [];
  for (const [id, state] of _toolState) {
    const hasAction = _toolActions.has(id) ? "1" : "0";
    entries.push(`${id}:${state.enabled}:${state.active}:${state.busy}:${state.hidden}:${state.badge}:${hasAction}`);
  }
  return entries.join("|");
}
function _notifyTools() {
  for (const cb of _toolListeners) {
    try {
      cb();
    } catch (err) {
      console.error("[storyboard] Error in tool subscriber:", err);
    }
  }
}
function _resetModes() {
  _modes.clear();
  _listeners.clear();
  _eventListeners.clear();
  _tools.clear();
  _toolState.clear();
  _toolActions.clear();
  _toolListeners.clear();
  _modesEnabled = false;
  _lockedMode = null;
}
export {
  _resetModes,
  activateMode,
  deactivateMode,
  emit,
  getCurrentMode,
  getLockedMode,
  getModeSnapshot,
  getRegisteredModes,
  getToolState,
  getToolsForMode,
  getToolsSnapshot,
  initModesConfig,
  initTools,
  isModeSwitcherVisible,
  isModesEnabled,
  off,
  on,
  registerMode,
  setToolAction,
  setToolState,
  subscribeToMode,
  subscribeToTools,
  syncModeClasses,
  unregisterMode
};
