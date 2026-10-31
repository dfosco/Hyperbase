/**
 * Canvas Config — project-level overrides for canvas behavior.
 *
 * Client repos use the "canvas" key in hypercanvas.config.json to customize
 * canvas paste rules and other canvas-level settings.
 *
 *   {
 *     "canvas": {
 *       "pasteRules": [
 *         { "pattern": "youtube\\.com/watch", "type": "link-preview", "props": { "url": "$url" } }
 *       ]
 *     }
 *   }
 *
 * Framework-agnostic (zero npm dependencies).
 */
/** Nudge ranges use screen pixels; the final overlap offset uses canvas pixels. */
export const AUTO_PLACE_DEFAULTS = Object.freeze({
    overlap: Object.freeze({
        'overlap-nudge-trigger': 80,
        'overlap-nudge-offset': 0,
        'overlap-place-stationary': false,
        'overlap-place-multiselection': true,
    }),
    align: Object.freeze({
        'top-edge-nudge-offset': 80,
        'left-edge-nudge-offset': 80,
    }),
});
let _pasteRules = [];
let _terminal = {};
let _agents = {};
let _zoom = { min: 10, max: 250, step: 10 };
let _production = { move: false, resize: false, editMarkdown: false, editSticky: false };
let _autoPlace = normalizeCanvasAutoPlace(undefined);
let _canvasOverrides = {};
function record(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value
        : undefined;
}
/** Normalize a raw config layer before merging, preserving valid inherited settings. */
export function normalizeCanvasAutoPlace(value, fallback = AUTO_PLACE_DEFAULTS) {
    const source = record(value);
    const overlap = record(source?.overlap);
    const align = record(source?.align);
    // Nested settings win over legacy flat keys, including invalid nested values
    // (which inherit their fallback rather than resurrecting a legacy sibling).
    const setting = (section, key) => section && Object.hasOwn(section, key) ? section[key] : source?.[key];
    const number = (value, defaultValue) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : defaultValue;
    const boolean = (value, defaultValue) => typeof value === 'boolean' ? value : defaultValue;
    return {
        overlap: {
            'overlap-nudge-trigger': number(setting(overlap, 'overlap-nudge-trigger'), fallback.overlap['overlap-nudge-trigger']),
            'overlap-nudge-offset': number(setting(overlap, 'overlap-nudge-offset'), fallback.overlap['overlap-nudge-offset']),
            'overlap-place-stationary': boolean(setting(overlap, 'overlap-place-stationary'), fallback.overlap['overlap-place-stationary']),
            'overlap-place-multiselection': boolean(setting(overlap, 'overlap-place-multiselection'), fallback.overlap['overlap-place-multiselection']),
        },
        align: {
            'top-edge-nudge-offset': number(setting(align, 'top-edge-nudge-offset'), fallback.align['top-edge-nudge-offset']),
            'left-edge-nudge-offset': number(setting(align, 'left-edge-nudge-offset'), fallback.align['left-edge-nudge-offset']),
        },
    };
}
// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
/**
 * Initialize canvas config from hypercanvas.config.json's "canvas" key.
 * Called by mountStoryboardCore.
 *
 * @param {{ pasteRules?: object[], terminal?: object, agents?: object, zoom?: object, production?: object, autoPlace?: object, overrides?: object }} [config]
 */
export function initCanvasConfig(config = {}) {
    _pasteRules = Array.isArray(config.pasteRules) ? config.pasteRules : [];
    _terminal = config.terminal && typeof config.terminal === 'object' ? config.terminal : {};
    _agents = config.agents && typeof config.agents === 'object' ? config.agents : {};
    const zoom = config.zoom && typeof config.zoom === 'object' ? config.zoom : null;
    _zoom = zoom
        ? { min: zoom.min ?? 10, max: zoom.max ?? 250, step: zoom.step ?? 10 }
        : { min: 10, max: 250, step: 10 };
    const prod = config.production && typeof config.production === 'object' ? config.production : {};
    _production = {
        move: prod.move === true,
        resize: prod.resize === true,
        editMarkdown: prod.editMarkdown === true,
        editSticky: prod.editSticky === true,
    };
    _autoPlace = normalizeCanvasAutoPlace(config.autoPlace);
    _canvasOverrides = record(config.overrides) ?? {};
}
/**
 * Resolve auto-place settings: canvas override → notebook → internal defaults.
 * Invalid values inherit the next valid value. Zero disables edge alignment or
 * proximity placement; actual overlaps still resolve when overlap placement
 * applies. A zero overlap offset allows touching edges, never intersection.
 * The returned object is safe for callers to modify.
 */
export function getCanvasAutoPlace(canvasId) {
    const override = canvasId && Object.hasOwn(_canvasOverrides, canvasId)
        ? record(_canvasOverrides[canvasId])
        : undefined;
    return normalizeCanvasAutoPlace(override?.autoPlace, _autoPlace);
}
/**
 * Get the configured paste rules (raw config objects).
 *
 * @returns {object[]}
 */
export function getPasteRules() {
    return _pasteRules;
}
/**
 * Get terminal widget configuration.
 *
 * @returns {{ theme?: object, fontSize?: number, fontFamily?: string, prompt?: string }}
 */
export function getTerminalConfig() {
    return _terminal;
}
/**
 * Get agent configurations.
 *
 * @returns {object}
 */
export function getAgentsConfig() {
    return _agents;
}
/**
 * Get canvas zoom configuration (min, max, step).
 *
 * @returns {{ min: number, max: number, step: number }}
 */
export function getCanvasZoom() {
    return _zoom;
}
/**
 * Get the canvas production-affordance flags. Each flag opts into a
 * normally dev-only interaction in production builds (and `?prodMode`
 * simulation). Defaults are all `false`.
 *
 * @returns {{ move: boolean, resize: boolean, editMarkdown: boolean, editSticky: boolean }}
 */
export function getCanvasProduction() {
    return _production;
}
/**
 * Check whether a specific canvas-production affordance is enabled.
 *
 * @param {'move'|'resize'|'editMarkdown'|'editSticky'} feature
 * @returns {boolean}
 */
export function isCanvasProductionEnabled(feature) {
    return _production[feature] === true;
}
/**
 * Check if a terminal/agent widget should be resizable based on config.
 * Agent-level `resizable` overrides the base `terminal.resizable`.
 *
 * @param {string|null} [agentId] — agent ID to check for overrides
 * @returns {boolean}
 */
export function isTerminalResizable(agentId = null) {
    if (agentId) {
        const agentCfg = _agents[agentId];
        if (agentCfg && agentCfg.resizable !== undefined)
            return agentCfg.resizable;
    }
    return _terminal.resizable ?? false;
}
/**
 * Get effective default dimensions for a terminal/agent widget.
 * Cascade: agent config > terminal config > provided fallbacks.
 *
 * @param {string|null} [agentId] — agent ID to check for overrides
 * @param {{ width: number, height: number }} [fallback] — schema-level fallbacks
 * @returns {{ width: number, height: number }}
 */
export function getTerminalDimensions(agentId = null, fallback = { width: 800, height: 450 }) {
    const base = {
        width: _terminal.defaultWidth ?? fallback.width,
        height: _terminal.defaultHeight ?? fallback.height,
    };
    if (agentId) {
        const agentCfg = _agents[agentId];
        if (agentCfg) {
            return {
                width: agentCfg.defaultWidth ?? base.width,
                height: agentCfg.defaultHeight ?? base.height,
            };
        }
    }
    return base;
}
// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
/**
 * Reset all internal state. Only for use in tests.
 */
export function _resetCanvasConfig() {
    _pasteRules = [];
    _terminal = {};
    _agents = {};
    _zoom = { min: 10, max: 250, step: 10 };
    _production = { move: false, resize: false, editMarkdown: false, editSticky: false };
    _autoPlace = normalizeCanvasAutoPlace(undefined);
    _canvasOverrides = {};
}
