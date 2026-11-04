let _hiddenItems = /* @__PURE__ */ new Set();
function initUIConfig(config = {}) {
  _hiddenItems = new Set(Array.isArray(config.hide) ? config.hide : []);
}
function isMenuHidden(key) {
  return _hiddenItems.has(key);
}
function getHiddenItems() {
  return Array.from(_hiddenItems);
}
function addHiddenItems(keys) {
  if (!Array.isArray(keys)) return;
  for (const key of keys) {
    if (typeof key === "string" && key) _hiddenItems.add(key);
  }
}
function _resetUIConfig() {
  _hiddenItems = /* @__PURE__ */ new Set();
}
export {
  _resetUIConfig,
  addHiddenItems,
  getHiddenItems,
  initUIConfig,
  isMenuHidden
};
