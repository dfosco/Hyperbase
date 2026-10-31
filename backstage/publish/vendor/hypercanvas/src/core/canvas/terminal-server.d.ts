import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { TerminalTerminationContext } from './terminal-runtime.js';
type AgentConfig = {
    startupCommand: string;
    postStartup?: string | null;
    readinessSignal?: string | null;
    sessionIdEnv?: string | null;
    [key: string]: unknown;
};
type HotPoolRef = {
    has(poolId: string): boolean;
    acquire(poolId: string): {
        id: string;
        runtimeSessionId: string;
    } | null;
    consume(poolId: string, sessionId: string): void;
    release(poolId: string, sessionId: string): void;
    getCapturedSessionId(poolId: string, sessionId: string): string | null;
    clearCapturedSessionId(poolId: string, sessionId: string): void;
};
export declare function isAgentConfig(value: unknown): value is AgentConfig;
export declare function outputBytes(event: unknown): Uint8Array;
export declare function resolveStoryboardCli(moduleUrl?: string): string | null;
export declare function createCliCommandResolver(resolveCommand: () => string | null): () => string | null;
declare function legacySnapshotDir(canvasId: string): string;
export declare function notifyTerminalContext(widgetId: string, state: unknown): void;
/** Launch ownership belongs to the idempotent PTY create, never delayed input. */
export declare function terminalStartupArgs(shell: string, command: string): string[];
/** Repaint the retained emulator's screen without appending or clearing history. */
export declare function retainedTerminalScreen(snapshot: {
    screen?: string;
    ansi?: string;
}): string;
export declare function activateTerminalAgent({ widgetId, canvasId, branch, agentId }: {
    widgetId: string;
    canvasId?: string;
    branch?: string;
    agentId?: string | null;
}): Promise<{
    sessionId: string;
    agentId: string;
}>;
export declare function orphanTerminalSession(widgetId: string): Promise<void>;
export declare function setupTerminalServer(httpServer: HttpServer, base?: string, branch?: string, hotPoolManager?: HotPoolRef | null, runtimeReady?: Promise<unknown> | null, root?: string | null, resolveWorkspaceId?: ((root: string) => Promise<string | null>) | null): void;
export declare function isAllowedTerminalOrigin(request: IncomingMessage): boolean;
export declare function isTransientTerminalError(error: unknown): boolean;
export declare function killTerminalSession(sessionId: string, context?: TerminalTerminationContext): Promise<unknown>;
export { legacySnapshotDir as terminalSnapshotDir };
export declare function readTerminalBuffer(widgetId: string, { maxLength }?: {
    maxLength?: number;
}): Record<string, unknown> | null;
export declare function readTerminalSnapshot(widgetId: string, canvasId: string | null): unknown | null;
