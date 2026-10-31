/**
 * Toolbar Config Store — reactive toolbar configuration with layered overrides.
 *
 * Override priority (highest wins):
 *   core (toolbar.config.json) → custom (client repo) → prototype → user (future)
 *
 * Framework-agnostic (zero npm dependencies).
 */
type ToolbarConfig = Record<string, unknown>;
type ToolbarConfigListener = (config: ToolbarConfig) => void;
/**
 * Set the base toolbar config (core defaults merged with client overrides).
 * Called once at app startup by mountStoryboardCore.
 *
 */
export declare function initToolbarConfig(config: ToolbarConfig): void;
/**
 * Set toolbar overrides for the active prototype.
 * Called on route change when entering a prototype that has a toolbar.config.json.
 *
 */
export declare function setPrototypeToolbarConfig(config: ToolbarConfig | null): void;
/**
 * Clear prototype overrides (e.g. when navigating to viewfinder or a
 * prototype without its own toolbar.config.json).
 */
export declare function clearPrototypeToolbarConfig(): void;
/**
 * Get the current merged toolbar config.
 *
 */
export declare function getToolbarConfig(): ToolbarConfig;
/**
 * Subscribe to toolbar config changes. Compatible with external stores.
 *
 */
export declare function subscribeToToolbarConfig(callback: ToolbarConfigListener): () => boolean;
/**
 * Snapshot for useSyncExternalStore.
 *
 */
export declare function getToolbarConfigSnapshot(): string;
/**
 * Store client-repo toolbar overrides from a root toolbar.config.json.
 * Called from the generated virtual module at import time.
 *
 */
export declare function setClientToolbarOverrides(config: ToolbarConfig | null): void;
/**
 * Consume and clear pending client overrides.
 * Called once by mountStoryboardCore during toolbar config init.
 *
 */
export declare function consumeClientToolbarOverrides(): ToolbarConfig | null;
export declare function _resetToolbarConfig(): void;
export {};
