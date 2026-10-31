/**
 * GitHub CLI executable resolution and provisioning handoff.
 *
 * The MyGo (Go) bootstrap discovers a usable existing `gh` or installs an
 * app-managed official CLI, then hands the exact executable to Core:
 *
 *   HYPERCANVAS_GH_PATH      exact `gh` executable discovered/installed by Go
 *   HYPERCANVAS_GH_HANDOFF   JSON file Go keeps current while it provisions
 *                            (`<handoff>.retry` is how Core asks Go to retry)
 *
 * Without the desktop bootstrap (CLI, dev server) Core falls back to `gh` on
 * PATH. Core never installs the CLI itself and never reads GitHub tokens.
 */
export type GhCliStatus = 'ready' | 'installing' | 'failed' | 'missing';
export type GhCliSource = 'environment' | 'existing' | 'managed' | 'path';
export interface GhCliState {
    status: GhCliStatus;
    source: GhCliSource | 'none';
    path: string | null;
    version: string | null;
    error: string | null;
    hint: string | null;
    /** True when the desktop bootstrap owns provisioning and can be asked to retry. */
    retryable: boolean;
}
/** Resolve the `gh` executable Core must run: Go's exact path, the handoff, then PATH. */
export declare function resolveGhExecutable(): string;
/** Provisioning/discovery state for the Publish UI, API and CLI. */
export declare function ghCliState(): GhCliState;
/**
 * Ask the desktop bootstrap to retry provisioning. Unavailable outside the
 * desktop app, where the user must install `gh` themselves.
 */
export declare function requestGhCliRetry(): GhCliState;
