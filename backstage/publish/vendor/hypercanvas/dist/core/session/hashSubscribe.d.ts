/**
 * Shared helpers for subscribing to URL hash changes in React hooks.
 */
/**
 * Subscribe to hash changes so React re-renders when the hash updates.
 * Compatible with useSyncExternalStore.
 */
export declare function subscribeToHash(callback: () => void): () => void;
/**
 * Snapshot of the full hash string for useSyncExternalStore.
 */
export declare function getHashSnapshot(): string;
