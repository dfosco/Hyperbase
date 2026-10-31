/**
 * Verified Notebook→Paseo binding.
 *
 * Session features (agent chat, terminal PTY, managed Sites) must only report
 * "ready" once the active Notebook is bound to a confirmed Paseo server AND a
 * workspace on that server. A binding is confirmed when:
 *
 *   1. the shared connection reports a daemon `serverId` (identity of the
 *      Paseo host the user's sessions will live in), and
 *   2. `ensurePaseoWorkspaceForRoot` resolved a workspace ID for the Notebook
 *      root on that daemon.
 *
 * Registration failures are recorded — never silently swallowed — and exposed
 * through `getNotebookPaseoBinding()` so diagnostics can surface actionable
 * guidance. When the daemon identity changes (Core fell back to a private
 * daemon, or the reused daemon restarted as a different server), the cached
 * workspace ID is discarded and re-resolved so an ID from one Paseo server is
 * never reused against another.
 */
type BindingState = 'idle' | 'pending' | 'confirmed' | 'stale' | 'failed';
type DaemonOwnership = 'owned' | 'reused' | 'unknown';
interface BindingFailure {
    message: string;
    code: string | null;
    at: string;
}
interface BindingSnapshot {
    state: BindingState;
    root?: string;
    serverId?: string;
    workspaceId?: string;
    workspaceDirectory?: string | null;
    ownership?: DaemonOwnership;
    registeredAt?: string;
    revalidatedAt?: string | null;
    lastError: BindingFailure | null;
}
interface ConfirmOptions {
    connectionOptions?: Record<string, unknown>;
}
export declare const BINDING_STATES: readonly string[];
/** Daemon ownership reported by Core's daemon lifecycle: reused | owned | unknown. */
export declare function paseoDaemonOwnership(env?: Record<string, string | undefined>): DaemonOwnership;
/**
 * Confirm (or revalidate) the binding for a Notebook root. Idempotent for an
 * unchanged daemon; re-resolves the workspace when the daemon identity or the
 * root changes. Concurrent calls for the same root share one confirmation.
 */
export declare function confirmNotebookPaseoBinding(root: string, options?: ConfirmOptions): Promise<BindingSnapshot>;
/** Snapshot of the current binding for diagnostics. Never throws. */
export declare function getNotebookPaseoBinding(): BindingSnapshot;
/** Clear the binding so the next confirmation re-resolves from scratch. */
export declare function invalidateNotebookPaseoBinding(): void;
export declare function resetNotebookPaseoBindingForTests(): Promise<void>;
export {};
