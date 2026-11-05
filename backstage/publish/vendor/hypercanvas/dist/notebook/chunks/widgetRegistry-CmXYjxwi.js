let _registry = /* @__PURE__ */ new Map();
const _listeners = /* @__PURE__ */ new Set();
let _snapshotVersion = 0;
function initWidgetRegistry(map) {
  _registry = /* @__PURE__ */ new Map();
  if (map && typeof map === "object") {
    for (const [type, def] of Object.entries(map)) {
      if (def && typeof def === "object") {
        _registry.set(type, def);
      }
    }
  }
  _notify();
}
function registerWidget(type, definition) {
  if (!type || typeof type !== "string") {
    throw new Error("[storyboard] registerWidget: type must be a non-empty string");
  }
  if (!definition || typeof definition !== "object") {
    throw new Error(`[storyboard] registerWidget("${type}"): definition must be an object`);
  }
  _registry.set(type, definition);
  _notify();
}
function unregisterWidget(type) {
  if (_registry.delete(type)) _notify();
}
function getWidgetDefinition(type) {
  return _registry.get(type) || null;
}
function getAllWidgetDefinitions() {
  return Object.fromEntries(_registry);
}
function subscribeToWidgetRegistry(callback) {
  _listeners.add(callback);
  return () => _listeners.delete(callback);
}
function getWidgetRegistrySnapshot() {
  return String(_snapshotVersion);
}
function _notify() {
  _snapshotVersion++;
  for (const cb of _listeners) {
    try {
      cb();
    } catch (err) {
      console.error("[storyboard] Error in widgetRegistry subscriber:", err);
    }
  }
}
export {
  getWidgetDefinition as a,
  getAllWidgetDefinitions as b,
  getWidgetRegistrySnapshot as g,
  initWidgetRegistry as i,
  registerWidget as r,
  subscribeToWidgetRegistry as s,
  unregisterWidget as u
};
