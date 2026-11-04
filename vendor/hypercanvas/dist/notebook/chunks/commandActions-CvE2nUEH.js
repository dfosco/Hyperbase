let _config = { actions: {} };
const _handlers = /* @__PURE__ */ new Map();
const _listeners = /* @__PURE__ */ new Set();
let _snapshotVersion = 0;
function initCommandActions(config) {
  _config = { ...config };
  _notify();
}
function registerCommandAction(id, handler) {
  _handlers.set(id, handler);
  _notify();
}
function unregisterCommandAction(id) {
  _handlers.delete(id);
  _notify();
}
let _dynamicActions = [];
function setDynamicActions(group, actions, handlers = {}) {
  _dynamicActions = _dynamicActions.filter((a) => a._group !== group);
  for (const action of actions) {
    _dynamicActions.push({ ...action, type: action.type || "default", _group: group });
  }
  for (const [id, handler] of Object.entries(handlers)) {
    _handlers.set(id, handler);
  }
  _notify();
}
function clearDynamicActions(group) {
  const removed = _dynamicActions.filter((a) => a._group === group);
  _dynamicActions = _dynamicActions.filter((a) => a._group !== group);
  for (const a of removed) {
    _handlers.delete(a.id);
  }
  _notify();
}
let _basePath = "/";
function setRoutingBasePath(basePath) {
  _basePath = basePath || "/";
}
function isExcludedByRoute(item) {
  const patterns = item.excludeRoutes;
  if (!patterns || !Array.isArray(patterns) || patterns.length === 0) return false;
  if (typeof window === "undefined") return false;
  let pathname = window.location.pathname;
  const base = _basePath.replace(/\/+$/, "");
  if (base && pathname.startsWith(base)) {
    pathname = pathname.slice(base.length) || "/";
  }
  return patterns.some((pattern) => new RegExp(pattern).test(pathname));
}
function actionVisibleInMode(action, mode) {
  if (isExcludedByRoute(action)) return false;
  const modes = action.modes;
  if (!modes) return true;
  return modes.includes("*") || modes.includes(mode);
}
function getActionsForMode(mode) {
  const configActions = Array.isArray(_config.actions) ? _config.actions : [];
  const filtered = configActions.filter((a) => actionVisibleInMode(a, mode));
  const dynamic = _dynamicActions.filter((a) => actionVisibleInMode(a, mode));
  const footerIndex = filtered.findIndex((a) => a.type === "footer");
  let all;
  if (footerIndex >= 0 && dynamic.length > 0) {
    all = [
      ...filtered.slice(0, footerIndex),
      ...dynamic,
      ...filtered.slice(footerIndex)
    ];
  } else {
    all = [...filtered, ...dynamic];
  }
  return all.flatMap((a) => {
    if (typeof a.id !== "string" || typeof a.label !== "string") return [];
    const handler = _handlers.get(a.id);
    const isToggle = a.type === "toggle";
    const actionHandler = handler;
    const active = isToggle && actionHandler?.getState ? actionHandler.getState() : false;
    return [{
      id: a.id,
      label: a.label,
      type: a.type || "default",
      url: a.url || null,
      toolKey: a.toolKey || null,
      disabled: a.disabled === true,
      localOnly: a.localOnly || false,
      hideFromCommandPaletteSearch: a.hideFromCommandPaletteSearch || false,
      hideFromCommandMenu: a.hideFromCommandMenu || false,
      handler,
      active
    }];
  });
}
function executeAction(id) {
  const definitions = [...Array.isArray(_config.actions) ? _config.actions : [], ..._dynamicActions];
  const action = definitions.find((action2) => action2.id === id);
  if (action?.disabled) return;
  const handler = _handlers.get(id);
  if (!handler) return;
  if (typeof handler === "function") {
    handler();
  } else if (handler.execute) {
    handler.execute();
  }
  _notify();
}
function getActionChildren(id) {
  const handler = _handlers.get(id);
  const actionHandler = handler;
  if (!actionHandler?.getChildren) return [];
  return actionHandler.getChildren();
}
function hasChildrenProvider(id) {
  const handler = _handlers.get(id);
  return !!handler?.getChildren;
}
function subscribeToCommandActions(callback) {
  _listeners.add(callback);
  return () => _listeners.delete(callback);
}
function getCommandActionsSnapshot() {
  return String(_snapshotVersion);
}
function _notify() {
  _snapshotVersion++;
  for (const cb of _listeners) {
    try {
      cb();
    } catch (err) {
      console.error("[storyboard] Error in command action subscriber:", err);
    }
  }
}
export {
  getActionsForMode as a,
  getCommandActionsSnapshot as b,
  clearDynamicActions as c,
  isExcludedByRoute as d,
  executeAction as e,
  setRoutingBasePath as f,
  getActionChildren as g,
  hasChildrenProvider as h,
  initCommandActions as i,
  subscribeToCommandActions as j,
  registerCommandAction as r,
  setDynamicActions as s,
  unregisterCommandAction as u
};
