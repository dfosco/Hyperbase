import type { EventEmitter } from 'node:events';
export declare const DESKTOP_EVENT_PREFIX = "__HYPERCANVAS_DESKTOP_EVENT__";
export interface DesktopEvent extends Record<string, unknown> {
    schemaVersion: 1;
    source: 'storyboard-dev';
    event: string;
}
interface ConfigRootsOptions {
    cwd?: string;
    notebookRoot?: string | null;
    warn?: (message: string) => void;
}
interface RequestOriginHeaders {
    host?: string | string[] | undefined;
    origin?: string | string[] | undefined;
}
interface RequestOriginOptions {
    desktop?: boolean;
    allowForwardedHttpsOrigin?: boolean;
}
/**
 * macOS privacy protection (TCC) blocks Documents, Desktop, and Downloads for
 * apps the user has not approved, surfacing as EPERM/EACCES on open. Keep the
 * failure loud but tell the user how to approve the app.
 */
export declare function describeReadFailure(error: unknown): string;
export declare function createDesktopEvent(event: string, details?: Record<string, unknown>): DesktopEvent;
export declare function encodeDesktopEvent(event: string, details?: Record<string, unknown>): string;
export declare function encodeViteDesktopEvent(event: string, details?: Record<string, unknown>): string;
export declare function parseViteDesktopEvent(line: string): DesktopEvent | null;
/** Prevent a disconnected desktop host from terminating the Vite process. */
export declare function ignoreBrokenPipeErrors(stream: Pick<EventEmitter, 'on'> | null | undefined): void;
export declare function desktopUrl(host: string, port: number, basePath?: string): string;
export interface DesktopStartupIdentity {
    attemptId: string;
    operationId: string;
}
export declare const DESKTOP_PARENT_MILESTONES: readonly ["runtime-prepared", "daemon-ready", "worker-started"];
export declare const DESKTOP_CHILD_MILESTONES: readonly ["generation-started", "upstreams-registered", "dependencies-scanned", "dependencies-ready", "html-validated", "entry-validated"];
/** Native owns these identities. A standalone CLI deliberately uses legacy transport. */
export declare function readDesktopStartupIdentity(env?: NodeJS.ProcessEnv): DesktopStartupIdentity | null;
/** One supervisor assigns canonical generations; worker nonces never reach the host. */
export declare function createDesktopStartupProgress(identity: DesktopStartupIdentity | null, emit: (details: Record<string, unknown>) => void): {
    completeParent(milestone: (typeof DESKTOP_PARENT_MILESTONES)[number]): void;
    forward(event: DesktopEvent): DesktopEvent | null;
};
/** Listening is not readiness: exercise the document and its dynamic entry. */
export declare function preflightDesktopDocument(url: string, { fetchDocument, timeoutMs, prepare, signal: generationSignal, onValidated, }?: {
    fetchDocument?: typeof fetch;
    timeoutMs?: number | null;
    prepare?: () => Promise<void>;
    signal?: AbortSignal;
    onValidated?: (milestone: 'html-validated' | 'entry-validated') => void;
}): Promise<void>;
export declare function selectEphemeralPort(host?: string): Promise<number>;
/** Startup-only daemon policy. Notebook config wins over the launch config. */
export declare function readConfiguredUsePaseoApp({ cwd, notebookRoot, warn }?: ConfigRootsOptions): boolean;
/** Read the preferred proxy port from the active Notebook, then the launch root. */
export declare function readConfiguredInstanceProxyPort({ cwd, notebookRoot, warn }?: ConfigRootsOptions): number | null;
/** Preferred instance-proxy port. Null disables the proxy (legacy behavior). */
export declare function resolveInstanceProxyPort(env?: NodeJS.ProcessEnv, configuredPort?: number): number | null;
export declare function isAllowedRequestOrigin(headers: RequestOriginHeaders, { desktop, allowForwardedHttpsOrigin }?: RequestOriginOptions): boolean;
export {};
