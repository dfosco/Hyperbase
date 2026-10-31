/**
 * Recent Artifacts — localStorage-backed recents for the workspace and
 * command palette. Routes are derived at read time from the live data index.
 * Writes are surfaced through a synthetic `storage` event for same-tab readers.
 */
export interface RecentEntry {
    type: string;
    key: string;
    label: string;
}
/** Push an artifact to the top, deduplicate by type and key, and cap storage. */
export declare function trackRecent(type: string, key: string, label: string): void;
/** Get recently visited artifacts, newest first. */
export declare function getRecent(): RecentEntry[];
/** Clear all recent artifacts. Useful for testing. */
export declare function clearRecent(): void;
/** Subscribe to same-tab and cross-tab changes. */
export declare function subscribeToRecent(callback: () => void): () => void;
/** Return the stable raw JSON snapshot consumed by `useSyncExternalStore`. */
export declare function getRecentSnapshot(): string;
