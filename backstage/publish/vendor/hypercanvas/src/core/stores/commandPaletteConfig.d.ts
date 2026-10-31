/**
 * Command Palette Config — runtime store for commandPalette config.
 * Framework-agnostic (zero npm dependencies).
 */
type CommandPaletteConfig = Record<string, unknown> & {
    sections: unknown[];
};
/**
 * Initialize the command palette config.
 * @param {object} config - The commandPalette object from storyboard.config.json
 */
export declare function initCommandPaletteConfig(config?: Record<string, unknown>): void;
/**
 * Get the current command palette config.
 * Falls back to the unified config store if the legacy store wasn't initialized.
 * @returns {{ sections: Array }}
 */
export declare function getCommandPaletteConfig(): CommandPaletteConfig;
export {};
