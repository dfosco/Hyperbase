/**
 * Tool Registry — config-driven state management for toolbar tools.
 *
 * Every tool is declared in toolbar.config.json under the `tools` key.
 * Each tool specifies a `toolbar` target (command-toolbar, canvas-toolbar,
 * command-palette) and a `render` type (button, menu, sidepanel, submenu, link).
 *
 * Code modules register themselves via registerToolModule() to provide
 * component, handler, setup, and guard functions.
 *
 * Framework-agnostic (zero npm dependencies).
 */
export interface ToolConfig extends Record<string, unknown> {
    disabled?: boolean;
    toolbar?: string;
    prod?: boolean;
    modes?: string | string[];
}
export interface ToolModule extends Record<string, unknown> {
    component?: unknown;
    handler?: unknown;
    setup?: (...args: unknown[]) => unknown;
    guard?: (...args: unknown[]) => boolean | Promise<boolean>;
}
export interface ResolvedTool {
    id: string;
    config: ToolConfig;
    module: ToolModule | null;
    component: unknown | null;
}
/**
 * Seed the registry from toolbar config.
 * Called once at app startup.
 *
 * @param {object} config - The full toolbar config object
 */
export declare function initToolRegistry(config: {
    tools?: Record<string, ToolConfig>;
}): void;
/**
 * Register a code module for a declared tool.
 *
 * @param {string} id - Tool id (matches key in toolbar.config.json tools)
 * @param {object} mod
 * @param {Function} [mod.component] - () => import('../SomeComponent.jsx')
 * @param {object|Function} [mod.handler] - Command action handler
 * @param {Function} [mod.setup] - async (ctx) => void — called once at mount
 * @param {Function} [mod.guard] - async (ctx) => boolean — return false to hide
 */
export declare function registerToolModule(id: string, mod: ToolModule): void;
/**
 * Store a resolved component for a tool (after lazy loading).
 *
 * @param {string} id
 * @param {unknown} component
 */
export declare function setToolComponent(id: string, component: unknown): void;
/**
 * Store a guard result for a tool.
 *
 * @param {string} id
 * @param {boolean} result
 */
export declare function setToolGuardResult(id: string, result: boolean): void;
/**
 * Get the resolved component for a tool.
 *
 * @param {string} id
 * @returns {unknown|null}
 */
export declare function getToolComponent(id: string): unknown | null;
/**
 * Get the code module for a tool.
 *
 * @param {string} id
 * @returns {object|null}
 */
export declare function getToolModule(id: string): ToolModule | null;
/**
 * Get tools for a specific toolbar target, filtered by mode and visibility.
 *
 * @param {string} toolbar - "command-toolbar" | "canvas-toolbar" | "command-palette"
 * @param {string} mode - Current mode name
 * @param {object} [options]
 * @param {boolean} [options.isLocalDev] - Whether running in local dev
 * @returns {Array<{ id: string, config: object, module: object|null, component: unknown|null }>}
 */
export declare function getToolsForToolbar(toolbar: string, mode: string, options?: {
    isLocalDev?: boolean;
}): ResolvedTool[];
/**
 * Get the config for a specific tool.
 *
 * @param {string} id
 * @returns {object|null}
 */
export declare function getToolConfig(id: string): ToolConfig | null;
/**
 * Get all tool configs.
 *
 * @returns {Record<string, object>}
 */
export declare function getAllToolConfigs(): Record<string, ToolConfig>;
/**
 * Subscribe to registry changes. Compatible with useSyncExternalStore.
 *
 * @param {Function} callback
 * @returns {Function} Unsubscribe
 */
export declare function subscribeToToolRegistry(callback: () => void): () => boolean;
/**
 * Snapshot for useSyncExternalStore.
 *
 * @returns {string}
 */
export declare function getToolRegistrySnapshot(): string;
/** Reset all state. Only for tests. */
export declare function _resetToolRegistry(): void;
