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
type CanvasProductionFeature = 'move' | 'resize' | 'editMarkdown' | 'editSticky';
export interface CanvasAutoPlaceAlignConfig {
    'top-edge-nudge-offset': number;
    'left-edge-nudge-offset': number;
}
export interface CanvasAutoPlaceOverlapConfig {
    'overlap-nudge-trigger': number;
    'overlap-nudge-offset': number;
    'overlap-place-stationary': boolean;
    'overlap-place-multiselection': boolean;
}
export interface CanvasAutoPlaceConfig {
    overlap: CanvasAutoPlaceOverlapConfig;
    align: CanvasAutoPlaceAlignConfig;
}
export interface CanvasAutoPlaceInput extends Partial<CanvasAutoPlaceAlignConfig>, Partial<CanvasAutoPlaceOverlapConfig> {
    overlap?: Partial<CanvasAutoPlaceOverlapConfig>;
    align?: Partial<CanvasAutoPlaceAlignConfig>;
}
/** Nudge ranges use screen pixels; the final overlap offset uses canvas pixels. */
export declare const AUTO_PLACE_DEFAULTS: {
    readonly overlap: Readonly<CanvasAutoPlaceOverlapConfig>;
    readonly align: Readonly<CanvasAutoPlaceAlignConfig>;
};
interface ZoomConfig {
    min: number;
    max: number;
    step: number;
}
interface ProductionConfig {
    move: boolean;
    resize: boolean;
    editMarkdown: boolean;
    editSticky: boolean;
}
interface TerminalConfig {
    resizable?: boolean;
    defaultWidth?: number;
    defaultHeight?: number;
    theme?: object;
    fontSize?: number;
    fontFamily?: string;
    prompt?: string;
    [key: string]: unknown;
}
interface AgentConfig {
    resizable?: boolean;
    defaultWidth?: number;
    defaultHeight?: number;
    [key: string]: unknown;
}
interface CanvasConfigInput {
    pasteRules?: unknown;
    terminal?: unknown;
    agents?: unknown;
    zoom?: unknown;
    production?: unknown;
    autoPlace?: unknown;
    overrides?: unknown;
}
/** Normalize a raw config layer before merging, preserving valid inherited settings. */
export declare function normalizeCanvasAutoPlace(value: unknown, fallback?: typeof AUTO_PLACE_DEFAULTS): CanvasAutoPlaceConfig;
/**
 * Initialize canvas config from hypercanvas.config.json's "canvas" key.
 * Called by mountStoryboardCore.
 *
 * @param {{ pasteRules?: object[], terminal?: object, agents?: object, zoom?: object, production?: object, autoPlace?: object, overrides?: object }} [config]
 */
export declare function initCanvasConfig(config?: CanvasConfigInput): void;
/**
 * Resolve auto-place settings: canvas override → notebook → internal defaults.
 * Invalid values inherit the next valid value. Zero disables edge alignment or
 * proximity placement; actual overlaps still resolve when overlap placement
 * applies. A zero overlap offset allows touching edges, never intersection.
 * The returned object is safe for callers to modify.
 */
export declare function getCanvasAutoPlace(canvasId?: string | null): CanvasAutoPlaceConfig;
/**
 * Get the configured paste rules (raw config objects).
 *
 * @returns {object[]}
 */
export declare function getPasteRules(): object[];
/**
 * Get terminal widget configuration.
 *
 * @returns {{ theme?: object, fontSize?: number, fontFamily?: string, prompt?: string }}
 */
export declare function getTerminalConfig(): TerminalConfig;
/**
 * Get agent configurations.
 *
 * @returns {object}
 */
export declare function getAgentsConfig(): Record<string, AgentConfig>;
/**
 * Get canvas zoom configuration (min, max, step).
 *
 * @returns {{ min: number, max: number, step: number }}
 */
export declare function getCanvasZoom(): ZoomConfig;
/**
 * Get the canvas production-affordance flags. Each flag opts into a
 * normally dev-only interaction in production builds (and `?prodMode`
 * simulation). Defaults are all `false`.
 *
 * @returns {{ move: boolean, resize: boolean, editMarkdown: boolean, editSticky: boolean }}
 */
export declare function getCanvasProduction(): ProductionConfig;
/**
 * Check whether a specific canvas-production affordance is enabled.
 *
 * @param {'move'|'resize'|'editMarkdown'|'editSticky'} feature
 * @returns {boolean}
 */
export declare function isCanvasProductionEnabled(feature: CanvasProductionFeature): boolean;
/**
 * Check if a terminal/agent widget should be resizable based on config.
 * Agent-level `resizable` overrides the base `terminal.resizable`.
 *
 * @param {string|null} [agentId] — agent ID to check for overrides
 * @returns {boolean}
 */
export declare function isTerminalResizable(agentId?: null): boolean;
/**
 * Get effective default dimensions for a terminal/agent widget.
 * Cascade: agent config > terminal config > provided fallbacks.
 *
 * @param {string|null} [agentId] — agent ID to check for overrides
 * @param {{ width: number, height: number }} [fallback] — schema-level fallbacks
 * @returns {{ width: number, height: number }}
 */
export declare function getTerminalDimensions(agentId?: null, fallback?: {
    width: number;
    height: number;
}): {
    width: number;
    height: number;
};
/**
 * Reset all internal state. Only for use in tests.
 */
export declare function _resetCanvasConfig(): void;
export {};
