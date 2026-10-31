/**
 * localStorage utilities for persistent storyboard overrides.
 *
 * Mirrors the session.js (URL hash) API but persists values in localStorage.
 *
 * **Per-app namespacing (closes server-state RCA hypothesis H7).**
 * All keys are prefixed with `storyboard:${devDomain}:${branch}:` derived
 * from `import.meta.env.BASE_URL`. Two repos sharing `storyboard.localhost`
 * (or a single repo with multiple branches open in tabs) can no longer leak
 * history snapshots, hide-mode state, or pending-navigation tokens across
 * apps.
 *
 * On first access we run a one-shot migration that drops legacy
 * `storyboard:*` keys whose stored route doesn't match the current
 * BASE_URL — this prevents stale history from being restored into the
 * wrong app after the upgrade.
 *
 * Reactivity:
 * - Cross-tab: native "storage" event (fires in other tabs automatically)
 * - Intra-tab: custom "storyboard-storage" event on window (the native
 *   "storage" event does NOT fire in the tab that made the change)
 */
/**
 * Public so tests and migration tooling can introspect the namespace
 * without recomputing it. Format: `storyboard:${devDomain}:${branch}:`.
 */
export declare const STORAGE_PREFIX: string;
/**
 * Read a single value from localStorage.
 * @param {string} key - Unprefixed key (e.g. "settings.theme")
 * @returns {string|null}
 */
export declare function getLocal(key: string): string | null;
/**
 * Write a single value to localStorage and notify listeners.
 * @param {string} key - Unprefixed key
 * @param {string} value
 */
export declare function setLocal(key: string, value: unknown): void;
/**
 * Remove a single key from localStorage and notify listeners.
 * @param {string} key - Unprefixed key
 */
export declare function removeLocal(key: string): void;
/**
 * Return all storyboard-prefixed localStorage entries as a plain object.
 * Keys are returned WITHOUT the prefix.
 * @returns {Record<string, string|null>}
 */
export declare function getAllLocal(): Record<string, string | null>;
/**
 * Subscribe to localStorage changes (both cross-tab and intra-tab).
 * Compatible with useSyncExternalStore.
 * @param {function} callback
 * @returns {function} unsubscribe
 */
export declare function subscribeToStorage(callback: () => void): () => void;
/**
 * Snapshot of all storyboard localStorage entries as a serialized string.
 * Used by useSyncExternalStore to detect changes.
 * Cached — invalidated on writes and storage events.
 * @returns {string}
 */
export declare function getStorageSnapshot(): string;
/** Fire a custom event so intra-tab listeners re-render. */
export declare function notifyChange(): void;
