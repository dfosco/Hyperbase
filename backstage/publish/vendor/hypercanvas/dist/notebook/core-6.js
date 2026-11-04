const CANONICAL_DEFAULTS = Object.freeze({
  enabled: false,
  homepage: false,
  tools: "all",
  commandPalette: true,
  branchBar: true
});
let _config = makeConfig({});
function makeConfig(raw) {
  const input = raw && typeof raw === "object" ? raw : {};
  const out = {
    ...CANONICAL_DEFAULTS,
    hideChrome: false,
    hideHomepage: false,
    protoHomepage: "",
    canvasHomepage: ""
  };
  if (typeof input.enabled === "boolean") out.enabled = input.enabled;
  if (Object.prototype.hasOwnProperty.call(input, "homepage")) {
    out.homepage = normalizeHomepage(input.homepage);
  } else if (input.canvasHomepage) {
    out.homepage = String(input.canvasHomepage);
  } else if (input.protoHomepage) {
    out.homepage = String(input.protoHomepage);
  } else if (input.hideHomepage === true) {
    out.homepage = true;
  }
  if (Object.prototype.hasOwnProperty.call(input, "tools")) {
    out.tools = normalizeTools(input.tools);
  } else if (input.hideChrome === true) {
    out.tools = "none";
  }
  if (typeof input.commandPalette === "boolean") {
    out.commandPalette = input.commandPalette;
  } else if (input.hideChrome === true) {
    out.commandPalette = false;
  }
  if (typeof input.branchBar === "boolean") {
    out.branchBar = input.branchBar;
  } else if (input.hideChrome === true) {
    out.branchBar = false;
  }
  out.hideChrome = out.tools === "none" && !out.commandPalette && !out.branchBar;
  out.hideHomepage = out.homepage === true;
  out.protoHomepage = typeof out.homepage === "string" && !isCanvasShorthand(out.homepage) ? out.homepage : "";
  out.canvasHomepage = typeof out.homepage === "string" && isCanvasShorthand(out.homepage) ? out.homepage : "";
  warnOnConflicts(input);
  return out;
}
function normalizeHomepage(value) {
  if (value === true || value === false) return value;
  if (typeof value === "string") return value.trim();
  return false;
}
function normalizeTools(value) {
  if (value === "all" || value === "none") return value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const rule = value;
    const only = Array.isArray(rule.only) ? rule.only.filter((k) => typeof k === "string") : null;
    const hide = Array.isArray(rule.hide) ? rule.hide.filter((k) => typeof k === "string") : null;
    if (only && only.length > 0) return { only };
    if (hide && hide.length > 0) return { hide };
    return "all";
  }
  return "all";
}
function isCanvasShorthand(value) {
  if (typeof value !== "string") return false;
  if (value.startsWith("/")) return false;
  if (/^https?:\/\//i.test(value)) return false;
  return true;
}
function warnOnConflicts(input) {
  if (input.protoHomepage && input.canvasHomepage) {
    console.warn(
      "[storyboard] customerMode has both `protoHomepage` and `canvasHomepage` set. `canvasHomepage` takes precedence; ignoring `protoHomepage`. These keys are deprecated — use `homepage` instead."
    );
  }
  if (Object.prototype.hasOwnProperty.call(input, "homepage") && (input.canvasHomepage || input.protoHomepage || input.hideHomepage === true)) {
    console.warn(
      "[storyboard] customerMode has both `homepage` and legacy homepage keys set. `homepage` wins; legacy keys are ignored."
    );
  }
  if (Object.prototype.hasOwnProperty.call(input, "tools") && input.hideChrome === true) {
    console.warn(
      "[storyboard] customerMode has both `tools` and legacy `hideChrome` set. `tools` wins; `hideChrome` is ignored."
    );
  }
}
function initCustomerModeConfig(config) {
  _config = makeConfig(config);
}
function getCustomerModeConfig() {
  return _config;
}
function isCustomerMode() {
  return _config.enabled === true;
}
function getCustomerModeHomepage() {
  return _config.homepage;
}
function isCustomerHidingHomepage() {
  if (!_config.enabled) return false;
  return _config.homepage !== false;
}
function isCustomerHidingAllTools() {
  if (!_config.enabled) return false;
  return _config.tools === "none";
}
function isCustomerToolHidden(key) {
  if (!_config.enabled) return false;
  if (key === "command-palette" && _config.commandPalette === false) return true;
  const t = _config.tools;
  if (t === "all") return false;
  if (t === "none") return true;
  if (t && typeof t === "object") {
    const rule = t;
    if (Array.isArray(rule.only)) return !rule.only.includes(key);
    if (Array.isArray(rule.hide)) return rule.hide.includes(key);
  }
  return false;
}
function isCustomerHidingCommandPalette() {
  if (!_config.enabled) return false;
  return _config.commandPalette === false;
}
function isCustomerHidingBranchBar() {
  if (!_config.enabled) return false;
  return _config.branchBar === false;
}
function resolveHomepageTarget(homepage) {
  if (typeof homepage !== "string" || !homepage) return "";
  if (/^https?:\/\//i.test(homepage)) return homepage;
  if (homepage.startsWith("/")) return homepage;
  return `/canvas/${homepage}`;
}
function _resetCustomerModeConfig() {
  _config = makeConfig({});
}
export {
  _resetCustomerModeConfig,
  getCustomerModeConfig,
  getCustomerModeHomepage,
  initCustomerModeConfig,
  isCustomerHidingAllTools,
  isCustomerHidingBranchBar,
  isCustomerHidingCommandPalette,
  isCustomerHidingHomepage,
  isCustomerMode,
  isCustomerToolHidden,
  resolveHomepageTarget
};
