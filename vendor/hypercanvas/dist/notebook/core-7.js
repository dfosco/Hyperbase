import { deepMerge } from "./core-0.js";
let _baseConfig = {};
let _prototypeConfig = null;
let _mergedConfig = {};
const _listeners = /* @__PURE__ */ new Set();
let _clientOverrides = null;
let _snapshotVersion = 0;
function initToolbarConfig(config) {
  _baseConfig = config;
  _prototypeConfig = null;
  _recompute();
}
function setPrototypeToolbarConfig(config) {
  _prototypeConfig = config || null;
  _recompute();
}
function clearPrototypeToolbarConfig() {
  if (_prototypeConfig === null) return;
  _prototypeConfig = null;
  _recompute();
}
function getToolbarConfig() {
  return _mergedConfig;
}
function subscribeToToolbarConfig(callback) {
  _listeners.add(callback);
  callback(_mergedConfig);
  return () => _listeners.delete(callback);
}
function getToolbarConfigSnapshot() {
  return String(_snapshotVersion);
}
function _recompute() {
  _mergedConfig = _prototypeConfig ? deepMerge(_baseConfig, _prototypeConfig) : _baseConfig;
  _snapshotVersion++;
  for (const cb of _listeners) {
    try {
      cb(_mergedConfig);
    } catch (err) {
      console.error("[storyboard] Error in toolbar config subscriber:", err);
    }
  }
}
function setClientToolbarOverrides(config) {
  _clientOverrides = config;
}
function consumeClientToolbarOverrides() {
  const overrides = _clientOverrides;
  _clientOverrides = null;
  return overrides;
}
function _resetToolbarConfig() {
  _baseConfig = {};
  _prototypeConfig = null;
  _clientOverrides = null;
  _mergedConfig = {};
  _listeners.clear();
  _snapshotVersion = 0;
}
export {
  _resetToolbarConfig,
  clearPrototypeToolbarConfig,
  consumeClientToolbarOverrides,
  getToolbarConfig,
  getToolbarConfigSnapshot,
  initToolbarConfig,
  setClientToolbarOverrides,
  setPrototypeToolbarConfig,
  subscribeToToolbarConfig
};
