/**
 * GitHub account connection through the real `gh` CLI.
 *
 * - Auth preflight: an already-authenticated `gh` is reused and no login runs.
 * - Otherwise one owned `gh auth login --web` (or `gh auth refresh` when only
 *   permissions are missing) runs per Core process. It is cancelable, bounded
 *   by a time limit, and its device code / browser prompts are captured for
 *   the Publish UI. Hypercanvas never reads, stores or logs a GitHub token and
 *   registers no OAuth app: GitHub's own `gh` client performs the browser flow.
 * - Auth/status reads are cached and short-lived so fast UI polling never
 *   spawns repeated remote `gh api user` calls.
 */
import type { GhCliState } from './ghExecutable.js';
export declare const GITHUB_HOST = "github.com";
/** Scopes publishing needs: repository access and permission to push workflow files. */
export declare const REQUIRED_SCOPES: readonly string[];
export type GitCredentialsState = 'configured' | 'missing' | 'unknown';
export interface GitHubAuthState {
    available: boolean;
    authenticated: boolean;
    account: string | null;
    hint?: string | null;
    /** Set when GitHub could not be reached, so authentication is unknown. */
    offline?: boolean;
    /** Token scopes reported by `gh auth status`, or null when gh did not report them. */
    scopes: string[] | null;
    missingScopes: string[];
    gitCredentials: GitCredentialsState;
    cli: GhCliState;
    checkedAt: string;
}
export type LoginKind = 'login' | 'refresh';
export type LoginStatus = 'starting' | 'awaiting_browser' | 'verifying' | 'succeeded' | 'failed' | 'cancelled';
export type LoginFailure = 'denied' | 'expired' | 'timeout' | 'permission' | 'unavailable' | 'environment_token' | 'verification' | 'error';
export interface GitHubLoginSnapshot {
    id: string;
    kind: LoginKind;
    status: LoginStatus;
    reason: LoginFailure | null;
    /** One-time device code to enter on GitHub, captured from gh. */
    code: string | null;
    verificationUri: string | null;
    /** True when gh could not open the default browser; the user opens `verificationUri` manually. */
    browserOpenFailed: boolean;
    message: string;
    account: string | null;
    startedAt: string;
    updatedAt: string;
    expiresAt: string;
    /** Redacted, bounded gh output for the collapsed technical view. */
    output: string[];
}
export declare function invalidateGitHubAuthCache(): void;
declare function parseScopes(output: string): string[] | null;
/** Cached auth state. A fresh `gh` probe runs at most once per TTL unless forced. */
export declare function getGitHubAuthState({ force }?: {
    force?: boolean;
}): GitHubAuthState;
/**
 * Configure Git to authenticate pushes through gh, only when it is not already
 * configured. Runs after a login Hypercanvas performed; never replaces other helpers.
 */
export declare function ensureGitCredentials(): GitCredentialsState;
declare function classifyFailure(output: string): LoginFailure;
/** Public login state for a notebook. Another notebook's active session is reported as blocking, not exposed. */
export declare function getGitHubLogin(notebookRoot: string): {
    login: GitHubLoginSnapshot | null;
    blocked: boolean;
};
export interface StartLoginResult {
    /** True when gh was already authenticated with the needed permissions, so no login ran. */
    skipped: boolean;
    reused: boolean;
    auth: GitHubAuthState;
    login: GitHubLoginSnapshot | null;
}
/** Start (or join) the browser sign-in. Skips entirely when gh is already authenticated. */
export declare function startGitHubLogin({ notebookRoot }: {
    notebookRoot: string;
}): StartLoginResult;
/** Cancel the owned sign-in. A stale or foreign session id never cancels the current one. */
export declare function cancelGitHubLogin({ notebookRoot, sessionId }: {
    notebookRoot: string;
    sessionId: unknown;
}): GitHubLoginSnapshot | null;
/** Drop cached state and re-probe now. */
export declare function recheckGitHub(): GitHubAuthState;
export declare const __test: {
    settings: {
        loginTimeoutMs: number;
        killGraceMs: number;
    };
    reset(): void;
    parseScopes: typeof parseScopes;
    classifyFailure: typeof classifyFailure;
};
export {};
