/**
 * Sync body classes for active feature flags.
 * Adds `sb-ff-{name}` for every flag that resolves to true,
 * removes it for every flag that resolves to false.
 */
export declare function syncFlagBodyClasses(): void;
/**
 * Initialize the feature flag system with config defaults.
 * Only writes a default to localStorage when no user override exists yet,
 * so toggled values survive across reloads.
 * @param {Record<string, boolean>} defaults - Flag key → default value
 */
export declare function initFeatureFlags(defaults?: Record<string, boolean>): void;
/**
 * Read a flag value. Priority: localStorage → config default.
 * @param {string} key - Flag key (without prefix)
 * @returns {boolean}
 */
export declare function getFlag(key: string): boolean;
/**
 * Set a flag value. Writes to localStorage for persistence.
 * @param {string} key - Flag key (without prefix)
 * @param {boolean} value
 */
export declare function setFlag(key: string, value: boolean): void;
/**
 * Toggle a flag. Reads current value, writes opposite to localStorage.
 * @param {string} key - Flag key (without prefix)
 */
export declare function toggleFlag(key: string): void;
/**
 * Get all flags with their default and current (resolved) values.
 * @returns {Record<string, { default: boolean, current: boolean }>}
 */
export declare function getAllFlags(): Record<string, {
    default: boolean;
    current: boolean;
}>;
/**
 * Reset all flags — removes localStorage overrides.
 * Flags revert to config defaults.
 */
export declare function resetFlags(): void;
/**
 * Get all registered flag keys.
 * @returns {string[]}
 */
export declare function getFlagKeys(): string[];
