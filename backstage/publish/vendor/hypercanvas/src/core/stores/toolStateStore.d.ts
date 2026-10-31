/**
 * Tool State Store — runtime state management for toolbar tools.
 *
 * Each tool declared in toolbar.config.json can be in one of five states:
 *   active    — Normal, clickable (default)
 *   inactive  — Visible but unclickable, disabled-looking (also for errors)
 *   hidden    — Invisible but shortcuts still work, tool is loaded
 *   dimmed    — Visible but dimmed opacity, still clickable
 *   disabled  — Completely removed, not loaded on FE
 *
 * Tools default to "active" unless:
 *   1. Config declares a "state" property
 *   2. The tool lacks `prod: true` and the environment is not local dev → "disabled"
 *
 * State can be changed at runtime by application code via setToolbarToolState().
 * Framework-agnostic (zero npm dependencies).
 */
/** All valid tool states. */
export declare const TOOL_STATES: Readonly<{
    readonly ACTIVE: "active";
    readonly INACTIVE: "inactive";
    readonly HIDDEN: "hidden";
    readonly DIMMED: "dimmed";
    readonly DISABLED: "disabled";
}>;
/**
 * Seed tool states from toolbar.config.json's `tools` object.
 * Called once at app startup.
 *
 * @param {object} toolsConfig - The `tools` object from toolbar.config.json
 *   (keys are tool IDs, values are tool config objects)
 * @param {{ isLocalDev?: boolean }} [options]
 */
export declare function initToolbarToolStates(toolsConfig: unknown, options?: {
    isLocalDev?: boolean;
}): void;
/**
 * Set state for a tool at runtime.
 * Validates that the state is one of the 5 valid values.
 *
 * @param {string} id    Tool id
 * @param {string} state One of: active, inactive, hidden, dimmed, disabled
 */
export declare function setToolbarToolState(id: string, state: string): void;
/**
 * Get the current state for a tool.
 * Returns "active" for unknown tool IDs (safe default).
 *
 * @param {string} id Tool id
 * @returns {string}
 */
export declare function getToolbarToolState(id: string): string;
/**
 * Returns whether the tool is dev-only (lacks `prod: true` in config).
 * Returns false for unknown IDs.
 *
 * @param {string} id Tool id
 * @returns {boolean}
 */
export declare function isToolbarToolLocalOnly(id: string): boolean;
/**
 * Subscribe to tool state changes. Compatible with useSyncExternalStore.
 *
 * @param {Function} callback
 * @returns {Function} Unsubscribe
 */
export declare function subscribeToToolbarToolStates(callback: () => void): () => boolean;
/**
 * Snapshot for useSyncExternalStore.
 *
 * @returns {string}
 */
export declare function getToolbarToolStatesSnapshot(): string;
/** Reset all state. Only for tests. */
export declare function _resetToolbarToolStates(): void;
