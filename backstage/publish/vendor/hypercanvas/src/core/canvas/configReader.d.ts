type ConfigObject = Record<string, unknown>;
/**
 * Read the merged terminal + agents + hotPool config for a project root.
 *
 * @param {string} [root] - Project root, defaults to `process.cwd()`.
 * @param {string} [fallbackRoot] - Application root used beneath project overrides.
 * @returns {{ terminal: object, agents: object, showAgentsInAddMenu: boolean|undefined, hotPool: object }}
 */
export declare function readTerminalConfigMerged(root?: string, fallbackRoot?: string): {
    terminal: ConfigObject;
    agents: ConfigObject;
    showAgentsInAddMenu: unknown;
    hotPool: ConfigObject;
};
/**
 * Convenience: just the agents map.
 */
export declare function readAgentsConfig(root?: string, fallbackRoot?: string): ConfigObject;
/**
 * Convenience: just the terminal-widget settings.
 */
export declare function readTerminalSettings(root?: string, fallbackRoot?: string): ConfigObject;
/**
 * Convenience: just the hotPool config.
 */
export declare function readHotPoolConfig(root?: string, fallbackRoot?: string): ConfigObject;
export {};
