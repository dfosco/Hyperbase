/**
 * Hide-mode + undo/redo override history.
 *
 * In normal mode, overrides live in the URL hash (#key=value).
 * In hide mode, overrides live in localStorage and the URL stays clean.
 *
 * The localStorage mirror stores three keys under storyboard:
 *
 *   historyState  → [[0, "/route", "params"], [1, "/other", "params"], ...]
 *                   Ordered chronologically: 0 = first state, 1, 2, 3…
 *                   Each entry is [position, route, paramString].
 *
 *   currentState  → index into historyState for the active snapshot
 *
 *   nextState     → index into historyState for redo target (null if none).
 *                   Cleared when the user creates a new state that doesn't
 *                   match previousState or nextState (i.e. a "branch").
 *
 * Undo moves currentState backward (currentState - 1 = previousState).
 * Redo moves currentState forward to nextState.
 * A fresh override write appends to historyState, advances currentState,
 * and clears nextState (forking the timeline).
 *
 * The hide flag is stored as: storyboard:__hide__
 */
type HistoryEntry = [index: number, route: string, params: string];
/**
 * Check whether hide mode is currently active.
 * @returns {boolean}
 */
export declare function isHideMode(): boolean;
/**
 * Activate hide mode:
 * 1. Snapshot current state into the history
 * 2. Set the hide flag
 * 3. Clear the URL hash and strip ?hide
 */
export declare function activateHideMode(): void;
/**
 * Deactivate hide mode:
 * 1. Restore current snapshot params → URL hash
 * 2. Remove hide flag
 * 3. Strip ?show from the URL
 * (History is never cleared)
 */
export declare function deactivateHideMode(): void;
/**
 * Push a new snapshot onto the history stack.
 *
 * Appends after currentState, advances currentState, and clears nextState
 * (forking the timeline — any redo future is discarded).
 *
 * @param {string} [paramString] - Override param string. Defaults to current hash.
 * @param {string} [route] - Route pathname. Defaults to current pathname.
 */
export declare function pushSnapshot(paramString?: string, route?: string): void;
/**
 * Undo: move currentState back by one. Sets nextState to the old current
 * so redo can return.
 * @returns {{ route: string, params: string }|null}
 */
export declare function undo(): {
    route: string;
    params: string;
} | null;
/**
 * Redo: move currentState forward to nextState.
 * @returns {{ route: string, params: string }|null}
 */
export declare function redo(): {
    route: string;
    params: string;
} | null;
/**
 * Get the full override history stack.
 * @returns {Array<[number, string, string]>} Array of [index, route, paramString]
 */
export declare function getOverrideHistory(): HistoryEntry[];
/**
 * Get the current state index.
 * @returns {number|null}
 */
export declare function getCurrentIndex(): number | null;
/**
 * Get the next state index (redo target).
 * @returns {number|null}
 */
export declare function getNextIndex(): number | null;
/**
 * Get the current snapshot's param string.
 * @returns {string|null}
 */
export declare function getCurrentSnapshot(): string | null;
/**
 * Get the current snapshot's route.
 * @returns {string|null}
 */
export declare function getCurrentRoute(): string | null;
/**
 * Check if undo is available.
 * @returns {boolean}
 */
export declare function canUndo(): boolean;
/**
 * Check if redo is available.
 * @returns {boolean}
 */
export declare function canRedo(): boolean;
/**
 * Read a single shadow value from the current snapshot.
 * @param {string} key - Dot-notation path
 * @returns {string|null}
 */
export declare function getShadow(key: string): string | null;
/**
 * Write a shadow value by pushing a new snapshot with the key updated.
 * @param {string} key
 * @param {string} value
 */
export declare function setShadow(key: string, value: unknown): void;
/**
 * Remove a shadow value by pushing a new snapshot without the key.
 * @param {string} key
 */
export declare function removeShadow(key: string): void;
/**
 * Return all shadow entries from the current snapshot as a plain object.
 * @returns {Record<string, string>}
 */
export declare function getAllShadows(): Record<string, string>;
/**
 * Sync localStorage currentState when the URL changes externally
 * (e.g. browser back/forward). Matches on route + params.
 *
 * - Adjacent move backward → treated as undo (sets nextState)
 * - Adjacent move forward to nextState → treated as redo (advances nextState)
 * - Non-adjacent jump → clears nextState and truncates history
 * - No match in history → pushes as new snapshot
 */
export declare function syncHashToHistory(): void;
/**
 * Install listeners that keep localStorage history in sync
 * with browser navigation. Call once at app startup.
 * Also records the initial page load as the first history entry.
 */
export declare function installHistorySync(): void;
export {};
