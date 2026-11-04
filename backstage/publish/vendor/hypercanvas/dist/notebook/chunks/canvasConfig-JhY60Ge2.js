const AUTO_PLACE_DEFAULTS = Object.freeze({
  overlap: Object.freeze({
    "overlap-nudge-trigger": 80,
    "overlap-nudge-offset": 0,
    "overlap-place-stationary": false,
    "overlap-place-multiselection": true
  }),
  align: Object.freeze({
    "top-edge-nudge-offset": 80,
    "left-edge-nudge-offset": 80
  })
});
let _pasteRules = [];
let _terminal = {};
let _agents = {};
let _zoom = { min: 10, max: 250, step: 10 };
let _production = { move: false, resize: false, editMarkdown: false, editSticky: false };
normalizeCanvasAutoPlace(void 0);
function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function normalizeCanvasAutoPlace(value, fallback = AUTO_PLACE_DEFAULTS) {
  const source = record(value);
  const overlap = record(source?.overlap);
  const align = record(source?.align);
  const setting = (section, key) => section && Object.hasOwn(section, key) ? section[key] : source?.[key];
  const number = (value2, defaultValue) => typeof value2 === "number" && Number.isFinite(value2) && value2 >= 0 ? value2 : defaultValue;
  const boolean = (value2, defaultValue) => typeof value2 === "boolean" ? value2 : defaultValue;
  return {
    overlap: {
      "overlap-nudge-trigger": number(setting(overlap, "overlap-nudge-trigger"), fallback.overlap["overlap-nudge-trigger"]),
      "overlap-nudge-offset": number(setting(overlap, "overlap-nudge-offset"), fallback.overlap["overlap-nudge-offset"]),
      "overlap-place-stationary": boolean(setting(overlap, "overlap-place-stationary"), fallback.overlap["overlap-place-stationary"]),
      "overlap-place-multiselection": boolean(setting(overlap, "overlap-place-multiselection"), fallback.overlap["overlap-place-multiselection"])
    },
    align: {
      "top-edge-nudge-offset": number(setting(align, "top-edge-nudge-offset"), fallback.align["top-edge-nudge-offset"]),
      "left-edge-nudge-offset": number(setting(align, "left-edge-nudge-offset"), fallback.align["left-edge-nudge-offset"])
    }
  };
}
function initCanvasConfig(config = {}) {
  _pasteRules = Array.isArray(config.pasteRules) ? config.pasteRules : [];
  _terminal = config.terminal && typeof config.terminal === "object" ? config.terminal : {};
  _agents = config.agents && typeof config.agents === "object" ? config.agents : {};
  const zoom = config.zoom && typeof config.zoom === "object" ? config.zoom : null;
  _zoom = zoom ? { min: zoom.min ?? 10, max: zoom.max ?? 250, step: zoom.step ?? 10 } : { min: 10, max: 250, step: 10 };
  const prod = config.production && typeof config.production === "object" ? config.production : {};
  _production = {
    move: prod.move === true,
    resize: prod.resize === true,
    editMarkdown: prod.editMarkdown === true,
    editSticky: prod.editSticky === true
  };
  normalizeCanvasAutoPlace(config.autoPlace);
  record(config.overrides) ?? {};
}
function getPasteRules() {
  return _pasteRules;
}
function getTerminalConfig() {
  return _terminal;
}
function getAgentsConfig() {
  return _agents;
}
function getCanvasZoom() {
  return _zoom;
}
function getCanvasProduction() {
  return _production;
}
function isCanvasProductionEnabled(feature) {
  return _production[feature] === true;
}
function isTerminalResizable(agentId = null) {
  if (agentId) {
    const agentCfg = _agents[agentId];
    if (agentCfg && agentCfg.resizable !== void 0) return agentCfg.resizable;
  }
  return _terminal.resizable ?? false;
}
function getTerminalDimensions(agentId = null, fallback = { width: 800, height: 450 }) {
  const base = {
    width: _terminal.defaultWidth ?? fallback.width,
    height: _terminal.defaultHeight ?? fallback.height
  };
  if (agentId) {
    const agentCfg = _agents[agentId];
    if (agentCfg) {
      return {
        width: agentCfg.defaultWidth ?? base.width,
        height: agentCfg.defaultHeight ?? base.height
      };
    }
  }
  return base;
}
export {
  AUTO_PLACE_DEFAULTS as A,
  getCanvasProduction as a,
  getCanvasZoom as b,
  getPasteRules as c,
  getTerminalConfig as d,
  getTerminalDimensions as e,
  isCanvasProductionEnabled as f,
  getAgentsConfig as g,
  isTerminalResizable as h,
  initCanvasConfig as i
};
