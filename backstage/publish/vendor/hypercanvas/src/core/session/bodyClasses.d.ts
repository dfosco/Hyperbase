/**
 * Body class sync for overrides and scenes.
 *
 * Mirrors active overrides as `sb-{key}--{value}` classes on <body>
 * and the active scene as `sb-scene--{name}`.
 *
 * Works in both normal mode (URL hash) and hide mode (localStorage shadows).
 */
/**
 * Sync override classes on <body> with current hash/shadow state.
 * Diffs against existing classes to minimize DOM mutations.
 */
export declare function syncOverrideClasses(): void;
/**
 * Set the flow class on <body>. Removes any previous flow class.
 * @param {string} name - Flow name (e.g. "Dashboard")
 */
export declare function setFlowClass(name: string): void;
/** @deprecated Use setFlowClass() */
export declare const setSceneClass: typeof setFlowClass;
/**
 * Install listeners that keep body classes in sync with overrides.
 * Subscribes to both hashchange (normal mode) and storage (hide mode).
 * Runs an initial sync immediately.
 *
 * @returns {function} unsubscribe — removes all listeners
 */
export declare function installBodyClassSync(): () => void;
