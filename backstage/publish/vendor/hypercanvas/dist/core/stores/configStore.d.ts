/**
 * Unified Config Store — single source of truth for all storyboard configuration.
 *
 * Replaces the scattered init/store pattern with one reactive config object.
 * Domain-specific stores (toolbarConfigStore, canvasConfig, etc.) become thin
 * wrappers that delegate here — zero consumer changes needed.
 *
 * Override priority (lowest → highest):
 *   core defaults → widgets → paste → toolbar → commandPalette → storyboard.config.json → prototype
 *
 * Framework-agnostic (zero npm dependencies).
 */
type ConfigObject = Record<string, unknown>;
type ConfigListener = (config: ConfigObject) => void;
/**
 * Seed the unified config with the pre-merged config object.
 * Called once at app startup (from the virtual module or mountStoryboardCore).
 *
 * @param {object} config - The unified config with all domains
 */
export declare function initConfig(config?: unknown): void;
/**
 * Get the full merged config or a specific domain slice.
 *
 * @param {string} [domain] - Optional domain key (e.g. 'toolbar', 'canvas')
 * @returns {object}
 */
export declare function getConfig<Domain extends string | undefined = undefined>(domain?: Domain): Domain extends string ? unknown : ConfigObject;
/**
 * Set overrides for a specific domain from a prototype-local config file.
 * Called on route change when entering a prototype with local config.
 *
 * @param {string} domain - Config domain (e.g. 'toolbar', 'widgets')
 * @param {object} overrides - Prototype-level overrides to deep-merge
 */
export declare function setOverrides(domain: string, overrides: unknown): void;
/**
 * Clear overrides for a specific domain.
 *
 * @param {string} domain
 */
export declare function clearOverrides(domain: string): void;
/**
 * Clear all prototype overrides (e.g. when leaving a prototype).
 */
export declare function clearAllOverrides(): void;
/**
 * Subscribe to config changes. Compatible with external stores.
 *
 * @param {Function} callback - Called with the full merged config
 * @returns {Function} Unsubscribe
 */
export declare function subscribeToConfig(callback: ConfigListener): () => boolean;
/**
 * Snapshot version for useSyncExternalStore.
 *
 * @returns {string}
 */
export declare function getConfigSnapshot(): string;
export declare function _resetConfig(): void;
export {};
