export declare const DEFAULT_PASEO_DAEMON_URL = "ws://127.0.0.1:6767/ws";
type ReconnectOptions = {
    enabled?: boolean;
    [key: string]: unknown;
};
export type PaseoConnectionOptions = {
    env?: NodeJS.ProcessEnv;
    url?: string;
    clientId?: string;
    appVersion?: string;
    password?: string;
    authHeader?: string;
    reconnect?: ReconnectOptions;
    connectTimeoutMs?: number;
    daemon?: PaseoDaemon;
    client?: PaseoClient;
};
type PaseoConfig = {
    url: string;
    clientId: string;
    clientType: 'cli';
    appVersion: string;
    password?: string;
    authHeader?: string;
    reconnect: ReconnectOptions;
    connectTimeoutMs?: number;
};
type PaseoWorkspace = {
    id?: string;
    workspaceDirectory?: string;
    directory?: string;
};
export type PaseoClient = {
    workspaces: {
        list?: (input: Record<string, never>) => Promise<unknown>;
        open: (input: {
            cwd: string;
        }) => Promise<PaseoWorkspace | null | undefined>;
    };
};
type ConnectionState = {
    status?: string;
    reason?: string | null;
    attempt?: number;
    [key: string]: unknown;
};
type PaseoDaemon = {
    connect: () => Promise<void>;
    close: () => Promise<void>;
    subscribeConnectionStatus?: (listener: (state: ConnectionState) => void) => unknown;
    getConnectionState?: () => ConnectionState | null | undefined;
    getLastServerInfoMessage?: () => {
        serverId?: string;
        version?: string;
    } | null | undefined;
    getLastLivenessRttMs?: () => number | null | undefined;
    lastError?: string | Error | null;
};
export type PaseoDiagnostics = {
    status: string;
    connected: boolean;
    state: ConnectionState;
    lastError: string | null;
    server: {
        serverId: string | null;
        version: string | null;
    } | null;
    reconnect: {
        enabled: boolean;
        attempt: number;
    };
    lastLivenessRttMs: number | null;
};
export type PaseoConnection = {
    client: PaseoClient;
    daemon: PaseoDaemon;
    getConnectionState: () => ConnectionState;
    getDiagnostics: () => PaseoDiagnostics;
    close: () => Promise<void>;
};
export declare function paseoConnectionConfig(options?: PaseoConnectionOptions): PaseoConfig;
export declare function createPaseoConnection(options?: PaseoConnectionOptions): Promise<PaseoConnection>;
export declare function getPaseoConnection(options?: PaseoConnectionOptions): Promise<PaseoConnection>;
/** Resolve the canonical Paseo workspace for a project root, opening it idempotently if needed. */
export declare function ensurePaseoWorkspaceForRoot(client: unknown, root: string): Promise<string>;
export declare function getPaseoConnectionState(): ConnectionState;
export declare function getPaseoConnectionDiagnostics(): PaseoDiagnostics;
export declare function classifyPaseoRecoveryState(state: ConnectionState | null | undefined): 'ready' | 'reconnecting' | 'disconnected' | 'stopped' | 'idle' | 'unknown';
export declare function resetPaseoConnectionForTests(): Promise<void>;
export {};
