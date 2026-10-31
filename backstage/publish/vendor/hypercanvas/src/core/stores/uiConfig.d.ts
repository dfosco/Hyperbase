/**
 * UI Config — project-level overrides for storyboard chrome visibility.
 *
 * Client repos use the "ui" key in storyboard.config.json to hide
 * specific menus, toolbar items, or workspace nav entries.
 *
 *   {
 *     "ui": {
 *       "hide": [
 *         "docs",                 // CoreUIBar menu key
 *         "comments",             // CoreUIBar menu key
 *         "workspace:components", // workspace sidebar nav id
 *         "branch-bar"            // top branch/dev bar
 *       ]
 *     }
 *   }
 *
 * Convention: namespaced keys (`<surface>:<id>`) are recommended for new
 * surfaces to avoid collisions. Existing CoreUIBar menus use bare keys
 * for back-compat.
 *
 * Framework-agnostic (zero npm dependencies).
 */
/**
 * Initialize UI config from storyboard.config.json's "ui" key.
 * Called by the Vite data plugin's generated virtual module.
 *
 * @param {{ hide?: string[] }} [config]
 */
export declare function initUIConfig(config?: {
    hide?: unknown;
}): void;
/**
 * Check whether a specific menu is hidden by project config.
 *
 * @param {string} key  Menu key (e.g. 'docs', 'inspector', 'create', 'comments', 'command')
 * @returns {boolean}
 */
export declare function isMenuHidden(key: string): boolean;
/**
 * Get the full set of hidden item keys.
 *
 * @returns {string[]}
 */
export declare function getHiddenItems(): string[];
/**
 * Additively register hidden item keys (without clobbering existing entries).
 * Used by `applyCustomerMode` to fold `customerMode.tools.hide` and
 * `customerMode.branchBar` into the same Set that `isMenuHidden` consults.
 *
 * @param {string[]} keys
 */
export declare function addHiddenItems(keys: string[]): void;
/**
 * Reset all internal state. Only for use in tests.
 */
export declare function _resetUIConfig(): void;
