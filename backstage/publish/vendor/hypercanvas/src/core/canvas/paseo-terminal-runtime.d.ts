import type { PaseoConnectionOptions } from './paseo-runtime-client.js';
type UnknownRecord = Record<string, unknown>;
type TerminalState = UnknownRecord & {
    status?: string;
    reason?: string;
};
type TerminalInfo = {
    id: string;
    name: string;
    workspaceId: string;
    cwd: string;
};
type TerminalBinding = {
    sessionId: string;
    workspaceId: string;
    terminalId: string;
    cwd: string;
    terminalCwd?: string;
    running: boolean;
    status: string;
    cols: number;
    rows: number;
    expiresAtMs: number | null;
    sequence: number;
    verified?: boolean;
};
type PublicTerminalBinding = Pick<TerminalBinding, 'sessionId' | 'workspaceId' | 'terminalId' | 'running' | 'status' | 'cols' | 'rows' | 'expiresAtMs' | 'verified'> & {
    reused: boolean;
};
type TerminalCallbacks = {
    onClose?: (event: {
        closedByClient: boolean;
    }) => void;
    onEvent?: (event: TerminalStreamOutput) => void;
    onError?: (error: unknown) => void;
    [key: string]: unknown;
};
type TerminalStreamOutput = UnknownRecord & {
    event: string;
};
type TerminalChannel = {
    binding: TerminalBinding;
    subscribers: Map<string, {
        clientId: string;
        callbacks: TerminalCallbacks;
        close: () => void;
    }>;
    subscribed: boolean;
    subscribing: Promise<void> | null;
    generation: number;
};
type TerminalWorkspace = {
    id?: string;
    workspaceDirectory?: string;
    directory?: string;
    current: () => {
        workspaceDirectory?: string;
        directory?: string;
    } | null | undefined;
    refresh: () => Promise<unknown>;
};
type TerminalStreamEvent = {
    terminalId: string;
    type: 'output' | 'restore';
    data: Uint8Array | number[] | string;
} | {
    terminalId: string;
    type: 'snapshot';
    state: UnknownRecord;
} | {
    terminalId: string;
    type: string;
    [key: string]: unknown;
};
type TerminalDaemon = {
    connect?: () => Promise<void>;
    close?: () => Promise<void> | void;
    getConnectionState?: () => TerminalState | null | undefined;
    getDiagnostics?: () => {
        state?: TerminalState;
        lastError?: string | null;
        server?: unknown;
        reconnect?: unknown;
    };
    listTerminals: (cwd: string, requestId?: undefined, options?: {
        workspaceId?: string;
    }) => Promise<{
        terminals: TerminalInfo[];
    }>;
    createTerminal: (cwd: string, name: string, requestId?: undefined, options?: UnknownRecord) => Promise<{
        terminal?: TerminalInfo;
        error?: string | null;
    }>;
    killTerminal: (terminalId: string) => Promise<unknown>;
    sendTerminalInput: (terminalId: string, input: UnknownRecord) => unknown;
    captureTerminal: (terminalId: string, options: {
        stripAnsi: boolean;
    }) => Promise<{
        lines?: unknown[];
    }>;
    subscribeTerminal: (terminalId: string, options: UnknownRecord) => Promise<{
        error?: string | null;
    }>;
    unsubscribeTerminal: (terminalId: string) => Promise<unknown>;
    onTerminalStreamEvent: (listener: (event: TerminalStreamEvent) => void) => () => void;
    subscribeRawMessages: (listener: (message: unknown) => void) => () => void;
    subscribeConnectionStatus?: (listener: (state: TerminalState) => void) => () => void;
};
type TerminalConnection = {
    client: {
        workspaces: {
            open: (input: {
                cwd: string;
            }) => Promise<{
                id?: string;
                workspaceDirectory?: string;
            }>;
            ref: (id: string) => TerminalWorkspace;
        };
    };
    daemon: TerminalDaemon;
    close?: () => Promise<void> | void;
    getConnectionState?: () => TerminalState | null | undefined;
    getDiagnostics?: () => {
        state?: TerminalState;
        lastError?: string | null;
        server?: unknown;
        reconnect?: unknown;
    };
};
type RuntimeOptions = PaseoConnectionOptions & {
    projectRoot?: string;
    env?: NodeJS.ProcessEnv;
    connectionFactory?: (options: PaseoConnectionOptions) => Promise<TerminalConnection>;
    connection?: TerminalConnection;
};
type StreamCallbacks = TerminalCallbacks & {
    clientId?: string;
    sessionId?: string;
    readOnly?: boolean;
    restore?: boolean;
    restoreScrollbackLines?: number;
    afterSequence?: number;
};
type TerminalRuntimeErrorOptions = {
    operation?: string | null;
    code?: string;
    cause?: unknown;
};
export declare class PaseoTerminalRuntimeError extends Error {
    operation: string | null;
    code: string;
    constructor(message: string, { operation, code, cause }?: TerminalRuntimeErrorOptions);
}
export declare class PaseoTerminalRuntime {
    #private;
    projectRoot: string;
    env: NodeJS.ProcessEnv;
    connectionOptions: PaseoConnectionOptions;
    connectionFactory: NonNullable<RuntimeOptions['connectionFactory']>;
    connection: TerminalConnection | null;
    bindings: Map<string, TerminalBinding>;
    channels: Map<string, TerminalChannel>;
    streamUnsubscribe: (() => void) | null;
    rawUnsubscribe: (() => void) | null;
    connectionStateUnsubscribe: (() => void) | null;
    renderSnapshotToAnsi: ((state: unknown) => string | null | undefined) | null;
    constructor(projectRoot: unknown, options?: RuntimeOptions);
    start(): Promise<this>;
    health(): Promise<{
        engine: string;
        connected: boolean;
        state: TerminalState;
        recoveryState: "unknown" | "ready" | "stopped" | "idle" | "disconnected" | "reconnecting";
        lastError: string | null;
        server: {} | null;
        reconnect: {} | null;
    }>;
    create(payload: unknown): Promise<PublicTerminalBinding>;
    list(): Promise<{
        sessions: PublicTerminalBinding[];
    }>;
    exists(sessionId: unknown): Promise<{
        exists: boolean;
    }>;
    get(sessionId: unknown): Promise<PublicTerminalBinding>;
    writeBytes(sessionId: unknown, bytes?: unknown, clientId?: string): Promise<{
        written: number;
    }>;
    resize(sessionId: unknown, cols?: unknown, rows?: unknown, clientId?: string): Promise<{
        cols: number;
        rows: number;
    }>;
    snapshot(sessionId: unknown): Promise<{
        sessionId: unknown;
        cols: number;
        rows: number;
        screen: string;
        text: string;
        sequence: number;
    }>;
    unsubscribe(sessionId: unknown, clientId?: string): Promise<{
        unsubscribed: true;
    }>;
    detach(sessionId: unknown, expiresAtMs?: number | null): Promise<PublicTerminalBinding>;
    setExpiry(sessionId: unknown, expiresAtMs: number | null): Promise<PublicTerminalBinding>;
    terminate(sessionId: unknown): Promise<{
        terminated: boolean;
    }>;
    cleanup(statuses?: unknown): Promise<{
        removed: number;
        remaining: number;
    }>;
    shutdown(): Promise<{
        shutdown: true;
    }>;
    subscribe(sessionId: unknown, options?: StreamCallbacks): Promise<{
        initial: {
            generation: number;
            sequence: number;
        };
        close: () => void;
    }>;
}
export declare const PaseoTerminalRuntimeClient: typeof PaseoTerminalRuntime;
export declare function initPaseoTerminalRuntime(projectRoot: string, options?: RuntimeOptions): Promise<PaseoTerminalRuntime>;
export declare function getPaseoTerminalRuntime(): PaseoTerminalRuntime;
export declare function resetPaseoTerminalRuntimeForTests(): Promise<void>;
export {};
