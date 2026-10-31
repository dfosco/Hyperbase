/**
 * Design Modes — mode registry, switching, and cross-plugin event bus.
 *
 * Framework-agnostic (zero npm dependencies).
 * State is stored in the ?mode= URL search param so it's shareable and bookmarkable.
 */
export interface ModeConfig extends Record<string, unknown> {
    label?: string;
    icon?: string;
    className?: string | string[];
    onActivate?: (options?: unknown) => void;
    onDeactivate?: () => void;
    tools?: unknown[];
    devTools?: unknown[];
}
export interface ModeDefinition extends ModeConfig {
    name: string;
    label: string;
}
export interface ModeEventPayloads {
    'mode:deactivate': [previousMode: string];
    'mode:activate': [mode: string, options?: unknown];
    'mode:change': [previousMode: string, nextMode: string];
}
type ModeEventName = keyof ModeEventPayloads;
type EventArgs<Event extends string> = Event extends ModeEventName ? ModeEventPayloads[Event] : unknown[];
type EventCallback<Event extends string> = Event extends ModeEventName ? (...args: EventArgs<Event>) => void : (...args: never[]) => void;
export interface ModeToolDefinition extends Record<string, unknown> {
    id: string;
    label?: string;
    group?: string;
    icon?: string | null;
    order?: number;
}
export interface ModeToolState extends Record<string, unknown> {
    enabled: boolean;
    active: boolean;
    busy: boolean;
    hidden: boolean;
    badge: string | number | null;
}
export type ModeToolStateUpdate = Partial<ModeToolState> & Record<string, unknown>;
export type ModeToolAction = () => unknown;
interface RegisteredModeTool extends ModeToolDefinition {
    id: string;
    label: string;
    group: string;
    icon: string | null;
    order: number;
    modes: string[];
}
export interface ResolvedModeTool extends RegisteredModeTool {
    state: ModeToolState;
    action: ModeToolAction | null;
}
/**
 * Register a mode plugin.
 *
 * @param {string} name   Unique mode identifier (e.g. 'prototype', 'present')
 * @param {object} config Mode configuration
 * @param {string} config.label  Human-readable label for UI
 * @param {string} [config.icon] Icon name (Octicon, Feather, or custom)
 * @param {string|string[]} [config.className] Extra class(es) applied to <html> when active
 * @param {Function} [config.onActivate]   Called when mode becomes active
 * @param {Function} [config.onDeactivate] Called when leaving this mode
 * @param {Array}  [config.tools]    Tool definitions for the tools toolbar
 * @param {Array}  [config.devTools] Tool definitions for the dev toolbar
 */
export declare function registerMode(name: string, config?: ModeConfig): void;
/**
 * Remove a previously registered mode.
 */
export declare function unregisterMode(name: string): void;
/**
 * Get all registered modes in insertion order.
 *
 * @returns {Array<{ name: string, label: string, icon?: string }>}
 */
export declare function getRegisteredModes(): ModeDefinition[];
/**
 * Read the active mode from the ?mode= URL search param.
 * Falls back to DEFAULT_MODE when the param is absent or unrecognised.
 */
export declare function getCurrentMode(): string;
/**
 * Switch to a registered mode.
 * Calls onDeactivate on the previous mode and onActivate on the new one.
 *
 * @param {string} name    Mode to activate
 * @param {object} [options] Passed through to onActivate
 */
export declare function activateMode(name: string, options?: unknown): void;
/**
 * Return to the default mode.
 */
export declare function deactivateMode(): void;
/**
 * Subscribe to mode changes. Compatible with React's useSyncExternalStore.
 *
 * @param {Function} callback Called whenever the mode or registry changes
 * @returns {Function} Unsubscribe function
 */
export declare function subscribeToMode(callback: () => void): () => void;
/**
 * Snapshot for useSyncExternalStore.
 * Returns a serialised string that changes when mode or registry changes.
 */
export declare function getModeSnapshot(): string;
/**
 * Listen for an event.
 *
 * @param {string} event   Event name (e.g. 'mode:change', 'room:create')
 * @param {Function} callback
 */
export declare function on<Event extends string>(event: Event, callback: EventCallback<Event>): void;
/**
 * Remove an event listener.
 */
export declare function off<Event extends string>(event: Event, callback: EventCallback<Event>): void;
/**
 * Emit an event to all registered listeners.
 *
 * @param {string} event Event name
 * @param {...*} args     Arguments forwarded to listeners
 */
export declare function emit<Event extends string>(event: Event, ...args: EventArgs<Event>): void;
/**
 * Apply classes for the current mode on first load.
 * Called automatically so the initial mode is reflected in the DOM.
 */
export declare function syncModeClasses(): void;
/**
 * Initialize modes configuration.
 * Called by the Vite data plugin's generated virtual module.
 * @param {{ enabled?: boolean, locked?: string }} [config]
 */
export declare function initModesConfig(config?: {
    enabled?: boolean;
    locked?: unknown;
}): void;
/**
 * Check whether modes UI is enabled.
 * When false, the app stays in prototype mode with no mode switcher.
 * @returns {boolean}
 */
export declare function isModesEnabled(): boolean;
/**
 * Get the locked mode name, or null if modes are not locked.
 * When locked, the mode switcher is hidden and activateMode() is a no-op.
 * @returns {string|null}
 */
export declare function getLockedMode(): string | null;
/**
 * Check whether the mode switcher UI should be visible.
 * Returns false when modes are disabled or locked to a specific mode.
 * @returns {boolean}
 */
export declare function isModeSwitcherVisible(): boolean;
/**
 * Seed the tool registry from modes.config.json.
 * Called by the Vite data plugin's generated virtual module.
 *
 * @param {Record<string, Array<{ id: string, label: string, group: string }>>} config
 *        Keys are mode names or '*' (all modes). Values are tool declarations.
 */
export declare function initTools(config?: unknown): void;
/**
 * Wire up a click handler for a declared tool.
 * Plugins call this to provide the action callback.
 *
 * @param {string} id       Tool id (must exist in registry)
 * @param {Function} action Click handler
 */
export declare function setToolAction(id: string, action: ModeToolAction): void;
/**
 * Update the runtime state of a tool.
 * Merges the update into existing state — only the provided keys change.
 *
 * @param {string} id    Tool id (must exist in registry)
 * @param {object} state Partial state update
 * @param {boolean} [state.enabled]  Whether the tool can be interacted with
 * @param {boolean} [state.active]   Whether the tool is currently "on" (highlighted)
 * @param {boolean} [state.busy]     Whether the tool is in use / unavailable
 * @param {boolean} [state.hidden]   Whether the tool should be hidden entirely
 * @param {string|number|null} [state.badge] Notification badge
 */
export declare function setToolState(id: string, state?: ModeToolStateUpdate): void;
/**
 * Get the current runtime state of a tool.
 *
 * @param {string} id Tool id
 * @returns {{ enabled: boolean, active: boolean, busy: boolean, hidden: boolean, badge: string|number|null } | null}
 */
export declare function getToolState(id: string): ModeToolState | null;
/**
 * Get all tools for a given mode, merged with '*' wildcard tools.
 * Returns tool declarations with their current state and action.
 * Sorted by group (tools first, dev second), then by order.
 *
 * @param {string} modeName
 * @returns {Array<{ id, label, group, icon, order, modes, state, action }>}
 */
export declare function getToolsForMode(modeName: string): ResolvedModeTool[];
/**
 * Subscribe to tool state/action changes.
 * Compatible with React's useSyncExternalStore.
 *
 * @param {Function} callback Called on any tool change
 * @returns {Function} Unsubscribe function
 */
export declare function subscribeToTools(callback: () => void): () => boolean;
/**
 * Snapshot for useSyncExternalStore.
 * Returns a serialised string that changes when tool state/actions change.
 */
export declare function getToolsSnapshot(): string;
/**
 * Reset all internal state. Only for use in tests.
 */
export declare function _resetModes(): void;
export {};
