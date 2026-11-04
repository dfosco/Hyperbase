import { deepMerge } from "./core-0.js";
let _baseConfig = {};
let _prototypeOverrides = {};
let _mergedConfig = {};
const _listeners = /* @__PURE__ */ new Set();
let _snapshotVersion = 0;
function initConfig(config = {}) {
  _baseConfig = config || {};
  _prototypeOverrides = {};
  _recompute();
}
function getConfig(domain) {
  const config = domain ? _mergedConfig[domain] || {} : _mergedConfig;
  return config;
}
function setOverrides(domain, overrides) {
  if (!overrides) return;
  _prototypeOverrides[domain] = overrides;
  _recompute();
}
function clearOverrides(domain) {
  if (!_prototypeOverrides[domain]) return;
  delete _prototypeOverrides[domain];
  _recompute();
}
function clearAllOverrides() {
  if (Object.keys(_prototypeOverrides).length === 0) return;
  _prototypeOverrides = {};
  _recompute();
}
function subscribeToConfig(callback) {
  _listeners.add(callback);
  callback(_mergedConfig);
  return () => _listeners.delete(callback);
}
function getConfigSnapshot() {
  return String(_snapshotVersion);
}
function _recompute() {
  if (Object.keys(_prototypeOverrides).length === 0) {
    _mergedConfig = _baseConfig;
  } else {
    const result = { ..._baseConfig };
    for (const [domain, overrides] of Object.entries(_prototypeOverrides)) {
      result[domain] = result[domain] ? deepMerge(result[domain], overrides) : overrides;
    }
    _mergedConfig = result;
  }
  _snapshotVersion++;
  for (const cb of _listeners) {
    try {
      cb(_mergedConfig);
    } catch (err) {
      console.error("[storyboard] Error in config subscriber:", err);
    }
  }
}
function _resetConfig() {
  _baseConfig = {};
  _prototypeOverrides = {};
  _mergedConfig = {};
  _listeners.clear();
  _snapshotVersion = 0;
}
export {
  _resetConfig,
  clearAllOverrides,
  clearOverrides,
  getConfig,
  getConfigSnapshot,
  initConfig,
  setOverrides,
  subscribeToConfig
};
