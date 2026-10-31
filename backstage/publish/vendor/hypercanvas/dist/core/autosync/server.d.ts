/**
 * Autosync Server — automatic commit + push watcher.
 *
 * Dev-server middleware that provides git automation:
 * - List branches (excluding main/master)
 * - Enable/disable autosync per scope (canvas/prototype)
 * - Direct commit + push on the current branch (scoped files only)
 * - Push watcher: every 30s runs enabled scopes in relay sequence
 * - Persists state to the runtime dir (autosync.json) to survive server restarts
 * - Pauses on branch change, resumes when user returns to target branch
 *
 * Routes (mounted at /_hypercanvas/autosync/):
 *   GET    /branches — list local git branches (excludes main/master)
 *   GET    /status   — current state (branch, enabled scopes, last sync/errors)
 *   POST   /enable   — enable autosync for a scope on a branch
 *   POST   /disable  — disable autosync for a scope (or all scopes)
 *   POST   /sync     — trigger a single sync cycle manually
 */
export type AutosyncScope = 'canvas' | 'prototype';
type ScopeValues<T> = Record<AutosyncScope, T>;
export type PersistedAutosyncState = {
    targetBranch: string;
    originalBranch: string | null;
    previousActiveBranch: string | null;
    pausedOnBranchChange: boolean;
    lastSyncTime: string | null;
    lastSyncByScope: ScopeValues<string | null>;
    enabledScopes: ScopeValues<boolean>;
};
export type BusyStatus = {
    busy: true;
    reason: string;
} | {
    busy: false;
};
export type AutosyncHandler = (request: unknown, response: unknown, context: unknown) => Promise<void>;
type SendJson = (response: unknown, status: number, payload: unknown) => void;
export type AutosyncHandlerOptions = {
    root: string;
    sendJson: SendJson;
};
/**
 * Load persisted autosync state from disk. Returns null on missing/corrupt files.
 */
export declare function loadPersistedState(root: string): PersistedAutosyncState | null;
/**
 * Persist current autosync state to disk (atomic write via tmp + rename).
 */
export declare function persistState(root: string): void;
/**
 * Remove persisted state file (on explicit full disable).
 */
export declare function clearPersistedState(root: string): void;
/**
 * Reconcile branch state — pause on drift, resume on return.
 * Called at server startup and on each scheduler tick.
 * Returns true if autosync is active (not paused), false if paused.
 */
export declare function reconcileBranch(root: string): boolean;
/**
 * Check if the repo is in a state where autosync should defer.
 * Returns { busy: true, reason } if unsafe, { busy: false } otherwise.
 */
export declare function isRepoBusy(root: string): BusyStatus;
export declare function normalizeAutosyncScope(scope: unknown): AutosyncScope;
export declare function matchesAutosyncScope(scope: unknown, filePath: unknown): boolean;
export declare function filterFilesForAutosyncScope(scope: unknown, files: readonly string[] | null | undefined): string[];
export declare function isRetryablePushError(message: unknown): boolean;
export declare function createAutosyncHandler({ root, sendJson }: AutosyncHandlerOptions): AutosyncHandler;
export {};
