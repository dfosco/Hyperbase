/**
 * Plugin configuration — enable/disable storyboard plugins.
 *
 * Plugins are enabled by default. The config is read from
 * storyboard.config.json under the "plugins" key and injected
 * at build time by the Vite data plugin.
 *
 * Example config:
 *   { "plugins": { "devtools": false } }
 */
type PluginConfig = Record<string, boolean>;
/**
 * Initialize plugin configuration.
 * Called by the Vite data plugin's generated virtual module.
 */
export declare function initPlugins(config: PluginConfig): void;
/**
 * Check whether a plugin is enabled.
 * Returns true by default if the plugin is not explicitly configured.
 */
export declare function isPluginEnabled(name: string): boolean;
/**
 * Get the full plugins config (for diagnostics / testing).
 */
export declare function getPluginsConfig(): PluginConfig;
export {};
