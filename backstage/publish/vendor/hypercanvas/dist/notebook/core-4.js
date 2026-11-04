let _plugins = {};
function initPlugins(config) {
  _plugins = { ...config };
}
function isPluginEnabled(name) {
  if (name in _plugins) return Boolean(_plugins[name]);
  return true;
}
function getPluginsConfig() {
  return { ..._plugins };
}
export {
  getPluginsConfig,
  initPlugins,
  isPluginEnabled
};
