/**
 * Publishing store — the client controller for GitHub Pages publishing.
 *
 * One shared snapshot feeds the toolbar Publish control and the side panel so
 * both show the same connection, repository and operation state. Every action
 * calls an existing Core publishing route (/status, /repository, /publish,
 * /retry, /github/*). Capabilities that the Core service does not provide yet
 * are named in UNAVAILABLE_CAPABILITIES and rendered as explicit limits, never
 * as simulated successful operations. GitHub account connection uses the
 * /github routes: the real `gh` browser sign-in is owned by Core and mirrored
 * here as `login`.
 */
export declare const STATUS_POLL_MS = 1200;
export declare const UNAVAILABLE_CAPABILITIES: Readonly<{
    sourcePush: "Pushing source without publishing isn’t available yet. Publishing pushes the whole notebook and starts the website together.";
}>;
export declare const publishingEnabled: () => boolean;
export type PublishingPhase = 'loading' | 'unavailable' | 'connecting' | 'signin' | 'running' | 'failed' | 'repository' | 'ready' | 'published';
export type LoginStatus = 'starting' | 'awaiting_browser' | 'verifying' | 'succeeded' | 'failed' | 'cancelled';
export interface PublishingRepository {
    owner: string;
    name: string;
    visibility: string;
    branch: string;
}
export interface PublishingBinding {
    mode?: string;
    repository?: PublishingRepository | null;
}
export interface PublishingStep {
    name: string;
    status: string;
}
export interface PublishingOperation {
    id?: string;
    kind?: string;
    status: string;
    steps?: PublishingStep[];
    output?: string[];
    error?: {
        message: string;
        hint?: string | null;
    } | null;
    result?: {
        pagesUrl?: string;
        repoUrl?: string;
        runUrl?: string;
        warnings?: {
            widgetId?: string;
            message: string;
        }[];
    } | null;
}
export interface GitHubCliState {
    status: 'ready' | 'installing' | 'failed' | 'missing';
    retryable?: boolean;
    error?: string | null;
    hint?: string | null;
}
export interface GitHubAuth {
    available?: boolean;
    authenticated?: boolean;
    account?: string | null;
    hint?: string | null;
    offline?: boolean;
    missingScopes?: string[];
    cli?: GitHubCliState | null;
}
export interface GitHubLogin {
    id: string;
    kind?: string;
    status: LoginStatus;
    reason?: string | null;
    code?: string | null;
    verificationUri?: string | null;
    browserOpenFailed?: boolean;
    message?: string;
    output: string[];
}
export interface PublishingError {
    message: string;
    hint: string | null;
    code?: string | null;
}
export interface PublishingSnapshot {
    auth: GitHubAuth | null;
    bindings: PublishingBinding[];
    operation: PublishingOperation | null;
    error: PublishingError | null;
    busy: string | null;
    login: GitHubLogin | null;
}
export interface PublishingView {
    phase: PublishingPhase;
    repository: PublishingRepository | null;
    account: string | null;
    operation: PublishingOperation | null;
    error: PublishingError | null;
    busy: string | null;
    hint: string | null;
    login: GitHubLogin | null;
    cli: GitHubCliState | null;
    needsPermission: boolean;
    offline: boolean;
}
type JsonObject = Record<string, unknown>;
type RequestOptions = {
    body?: JsonObject;
    method?: string;
    fetchImpl?: typeof fetch;
};
type Listener = (snapshot: PublishingSnapshot) => void;
/** Core publishing request. Errors carry the Core `code`, `message` and `hint`. */
export declare function requestPublishing(path: string, { body, method, fetchImpl }?: RequestOptions): Promise<JsonObject>;
/**
 * Derive the single GitHub Pages view model from the store snapshot.
 *
 * Phases: loading | unavailable | connecting | signin | running | failed |
 * repository | ready | published. `unavailable` covers a missing, installing or
 * failed GitHub CLI (`cli` says which); `connecting` is an active browser
 * sign-in (`login` carries the real code); `signin` also covers an
 * authenticated account that still needs a permission (`needsPermission`).
 * `repository` is the bound `{ owner, name, visibility, branch }` from the
 * default-mode binding, or null before setup.
 */
export declare function deriveGitHubPublishingView(snapshot: Partial<PublishingSnapshot>): PublishingView;
export declare function getPublishingSnapshot(): PublishingSnapshot;
export declare function subscribePublishing(listener: Listener): () => void;
/**
 * Reload /status. Concurrent callers share one request; disabled publishing
 * never fetches. `fresh` is for reads after a mutation: a request already in
 * flight may predate the mutation, so it is awaited and then repeated.
 */
export declare function refreshPublishing({ fresh }?: {
    fresh?: boolean;
}): Promise<PublishingSnapshot>;
/**
 * Keep status polling while at least one visible surface needs it. The first
 * retainer starts one poll loop; the last release stops it.
 */
export declare function retainPublishing(): () => void;
/**
 * Connect GitHub: reuse the signed-in `gh` account, or start the owned browser
 * sign-in. A second call while a sign-in is active joins it instead of starting another.
 */
export declare function connectGitHub(): Promise<boolean>;
/** Cancel the active sign-in. A stale session id is rejected by Core and the state is reloaded. */
export declare function cancelGitHubConnection(): Promise<boolean>;
/** Drop cached GitHub state and check again (after installing gh, changing accounts, or going online). */
export declare function recheckGitHubConnection(): Promise<boolean>;
/** Ask the desktop app to retry setting up the GitHub CLI after a failed or interrupted setup. */
export declare function retryGitHubCliSetup(): Promise<boolean>;
/** Create or connect the notebook's GitHub repository. Does not push. */
export declare function connectPublishingRepository({ repositoryMode, owner, name, visibility }: {
    repositoryMode: 'create' | 'connect';
    owner: string;
    name: string;
    visibility?: string;
}): Promise<boolean>;
/** Push the whole notebook and configure GitHub Pages for the bound repository. */
export declare function publishWebsite(): Promise<boolean>;
/** Resume a paused or failed publish operation from its recorded request. */
export declare function retryPublishingOperation(operationId: string): Promise<boolean>;
/** Test helper: restore the initial snapshot and drop listeners and timers. */
export declare function _resetPublishingStore(): void;
export {};
