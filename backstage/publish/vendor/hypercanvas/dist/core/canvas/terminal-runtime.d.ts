import { getPaseoTerminalRuntime } from './paseo-terminal-runtime.js';
type Runtime = ReturnType<typeof getPaseoTerminalRuntime>;
type SubscriptionHandle = Awaited<ReturnType<Runtime['subscribe']>>;
type RuntimeSession = Awaited<ReturnType<Runtime['list']>>['sessions'][number];
type LifecycleOperation<T = unknown> = () => T | Promise<T>;
type TerminalSessionOptions = {
    runtimeSessionId?: string;
    program?: string;
    args?: string[];
    cwd?: string;
    workspaceId?: string;
    env?: NodeJS.ProcessEnv;
    cols?: number;
    rows?: number;
    rollbackOnError?: boolean;
};
type TerminalSubscriptionOptions = {
    clientId?: string;
    readOnly?: boolean;
    afterSequence?: number;
    restore?: boolean;
    restoreScrollbackLines?: number;
    onEvent?: (event: unknown) => void;
    onOutput?: (event: unknown) => void;
    onGap?: (event: unknown) => void;
    onLifecycle?: (event: unknown) => void;
    onConflict?: (event: unknown) => void;
    onExit?: (event: unknown) => void;
    onError?: (error: unknown) => void;
    onClose?: (event: {
        closedByClient: boolean;
    }) => void;
};
type TextSubmitOptions = {
    submit?: boolean;
    paste?: boolean;
    canWrite?: () => boolean;
};
export type TerminalTerminationContext = {
    workspaceId?: string | null;
    cwd?: string;
};
export declare function registerRuntimeSession(sessionId: string, runtimeSessionId?: string): string;
export declare function unregisterRuntimeSession(sessionId: string): void;
export declare function resolveRuntimeSessionId(sessionId: string): string;
/** Canvas names can change or be absent before a widget's first launch. */
export declare function terminalWidgetStartupKey(root: string, widgetId: string): string;
export declare function withTerminalStartup<T>(key: string, operation: LifecycleOperation<T>): Promise<T>;
export declare function createTerminalSession(sessionId: string, options: TerminalSessionOptions): Promise<unknown>;
/** Discover/adopt an existing PTY after Core restart; never launch or roll back. */
export declare function attachExistingTerminalSession(sessionId: string, options: Pick<TerminalSessionOptions, 'runtimeSessionId' | 'workspaceId' | 'cwd'>): Promise<unknown>;
export declare function terminalSessionExists(sessionId: string): Promise<boolean>;
export declare function getTerminalSession(sessionId: string): ReturnType<Runtime['get']>;
export declare function listRuntimeSessions(): Promise<RuntimeSession[]>;
export declare function snapshotTerminalSession(sessionId: string): ReturnType<Runtime['snapshot']>;
export declare function subscribeTerminalSession(sessionId: string, options?: TerminalSubscriptionOptions): Promise<SubscriptionHandle & {
    clientId: string;
    runtimeSessionId: string;
}>;
export declare function writeTerminalBytes(sessionId: string, bytes: Uint8Array): Promise<{
    written: number;
}>;
export declare function writeTerminalText(sessionId: string, text: string, { submit }?: {
    submit?: boolean;
}): Promise<{
    written: number;
}>;
export declare class TerminalSubmissionError extends Error {
    code: string;
    statusCode: number;
    constructor(message: string, { code, statusCode }?: {
        code?: string;
        statusCode?: number;
    });
}
export declare function expandTerminalKeyTokens(keys: unknown): string;
/**
 * Submit text to a live terminal session. `accepted` means the PTY runtime
 * accepted the bytes; it does not mean the foreground program processed them.
 */
export declare function submitTerminalText(sessionId: unknown, text: unknown, { submit, paste, canWrite }?: TextSubmitOptions): Promise<{
    accepted: true;
    written: number;
    submitted: boolean;
}>;
export declare function submitTerminalKeys(sessionId: unknown, keys: unknown, options?: TextSubmitOptions): ReturnType<typeof submitTerminalText>;
export declare function resizeTerminalSession(sessionId: string, cols: number, rows: number): Promise<{
    cols: number;
    rows: number;
}>;
export declare function detachTerminalSession(sessionId: string, expiresAtMs?: number | null): Promise<unknown>;
export declare function terminateTerminalSession(sessionId: string, context?: TerminalTerminationContext): Promise<{
    terminated: boolean;
}>;
export declare function cleanupRuntimeSessions(statuses?: unknown): ReturnType<Runtime['cleanup']>;
export declare function resetTerminalRuntimeForTests(): void;
export {};
