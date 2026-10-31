import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import type { Readable } from 'node:stream';
import type { PaseoTerminalRuntime } from '../canvas/paseo-terminal-runtime.js';
interface SiteRecord {
    id: string;
    title?: string;
    [key: string]: unknown;
}
interface SiteBinding {
    id?: string;
    source?: string | null;
    status?: string | null;
    root?: string | null;
    workspaceId?: string | null;
    serviceName?: string | null;
    scriptName?: string | null;
    startCommand?: string | null;
    developmentBaseUrl?: string | null;
    developmentBaseUrlSource?: string | null;
    terminalSessionId?: string | null;
    legacyPid?: number | string | null;
    pid?: number | null;
    revision?: number;
    env?: Record<string, unknown>;
    [key: string]: unknown;
}
interface SiteLegacyState {
    pid?: number | string | null;
    status?: string | null;
}
interface SiteRuntimeStore {
    root?: string | null;
    migrateLegacy?: () => unknown | Promise<unknown>;
    list?: () => SiteRecord[];
    get: (id: string) => SiteRecord | null;
    getBinding: (id: string) => SiteBinding | null;
    getLegacyRuntimeState?: (id: string) => SiteLegacyState | null;
    clearLegacyRuntimeState?: (id: string) => void;
    upsertBinding: (id: string, updates: Record<string, unknown>) => SiteBinding;
}
type SiteHealth = {
    reachable: true;
    ok: boolean;
    status: number;
} | {
    reachable: false;
    error: string;
};
interface SiteLog {
    stream: 'stdout' | 'stderr' | 'terminal';
    message: string;
    timestamp: string;
}
interface PortListener {
    pid: number | string;
    port: number;
    command?: string;
}
interface InspectedProcess {
    cwd: string | null;
}
interface DiscoveryResult {
    state: 'current' | 'matched' | 'ambiguous' | 'none';
    baseUrl?: string | null;
    candidate?: PortListener & InspectedProcess & SiteHealth & {
        baseUrl: string;
    };
    candidates: Array<PortListener & InspectedProcess & SiteHealth & {
        baseUrl: string;
    }>;
}
interface PtySubscriptionCallbacks {
    clientId: string;
    onOutput: (event: {
        bytes?: Uint8Array;
    }) => void;
    onGap: (event: {
        snapshot?: {
            text?: string;
            screen?: string;
        };
    }) => void;
    onError: (error: Error) => void;
    onExit: () => void;
}
export interface SitePtyRuntime {
    create: (options: {
        sessionId: string;
        cwd: string;
        workspaceId: string;
        program: string;
        args: string[];
        env: Record<string, string | undefined>;
    }) => Promise<{
        terminalId?: string;
    }>;
    subscribe?: (sessionId: string, callbacks: PtySubscriptionCallbacks) => Promise<{
        close?: () => void;
    } | undefined>;
    snapshot?: (sessionId: string) => Promise<{
        text?: string;
        screen?: string;
    } | undefined>;
    exists?: (sessionId: string) => Promise<{
        exists?: boolean;
    } | undefined>;
    terminate: (options: {
        sessionId: string;
        workspaceId?: string | null;
        cwd?: string | null;
    }) => Promise<{
        terminated?: boolean;
    } | undefined>;
}
export interface SiteWorkspaceScripts {
    startWorkspaceScriptWithStatus: (workspaceId: string, scriptName: string) => Promise<{
        pid?: number | null;
    }>;
    stopWorkspaceScript: (workspaceId: string, scriptName: string) => Promise<unknown>;
}
export declare function adaptPaseoTerminalRuntime(runtime: PaseoTerminalRuntime): SitePtyRuntime;
interface SiteRuntimeOptions {
    fetch?: typeof globalThis.fetch;
    probe?: (baseUrl: string, options?: {
        fetch?: typeof globalThis.fetch;
        timeoutMs?: number;
    }) => Promise<SiteHealth>;
    spawnProcess?: typeof spawn;
    ptyRuntime?: SitePtyRuntime | Promise<SitePtyRuntime | null> | null;
    requirePtyRuntime?: boolean;
    reconcileOnStart?: boolean;
    workspaceScripts?: SiteWorkspaceScripts | (() => SiteWorkspaceScripts | Promise<SiteWorkspaceScripts>) | null;
    serviceResolver?: ((workspaceId: string, serviceName: string) => Promise<string | null | undefined>) | null;
    resolveNotebookWorkspaceId?: (() => Promise<string | null | undefined>) | null;
    onSiteError?: ((id: string, error: unknown) => void) | null;
    listListeningPorts?: (options: {
        timeoutMs: number;
    }) => Promise<PortListener[]>;
    inspectProcess?: (pid: number | string, options: {
        timeoutMs: number;
    }) => Promise<InspectedProcess | null>;
    killProcess?: (pid: number, signal: NodeJS.Signals) => void;
}
interface SiteChild {
    pid?: number | null | undefined;
    killed?: boolean;
    kill?: (signal?: NodeJS.Signals) => unknown;
    once?: ChildProcess['once'];
    stdout?: Readable | null;
    stderr?: Readable | null;
    pty?: SitePtyRuntime;
    sessionId?: string;
    workspaceId?: string | null;
    cwd?: string;
    terminalId?: string | null;
    terminalSubscription?: {
        close?: () => void;
    } | undefined;
    workspaceScripts?: SiteWorkspaceScripts;
    scriptName?: string;
    siteStartToken?: symbol;
}
interface DiscoveryOptions {
    root?: string;
    previousBaseUrl?: string | null;
    requireOwnedListener?: boolean;
    timeoutMs?: number;
    listListeningPorts?: (options: {
        timeoutMs: number;
    }) => Promise<PortListener[]>;
    inspectProcess?: (pid: number | string, options: {
        timeoutMs: number;
    }) => Promise<InspectedProcess | null>;
    probe?: SiteRuntimeOptions['probe'];
    fetch?: typeof globalThis.fetch;
}
interface SiteStartOptions {
    confirmed?: boolean;
    timeoutMs?: number;
}
interface SiteTimeoutOptions {
    timeoutMs?: number;
}
interface SiteStopOptions {
    forceTerminal?: boolean;
    preserveExternalListeners?: boolean;
}
interface SiteDiscoverOptions extends Omit<DiscoveryOptions, 'root' | 'previousBaseUrl' | 'probe' | 'fetch'> {
    respectManual?: boolean;
}
interface RebindOptions {
    workspaceId?: unknown;
    developmentBaseUrl?: unknown;
}
interface ProbeOptions {
    fetch?: typeof globalThis.fetch;
    timeoutMs?: number;
}
export declare function createSiteProcessEnvironment(parentEnvironment?: NodeJS.ProcessEnv, siteEnvironment?: unknown): Record<string, string | undefined>;
export declare class SiteRuntime {
    private readonly store;
    private readonly fetch;
    private readonly probe;
    private readonly spawnProcess;
    private readonly ptyRuntime;
    private readonly requirePtyRuntime;
    private readonly reconcileOnStart;
    private readonly workspaceScripts;
    private readonly serviceResolver;
    private readonly resolveNotebookWorkspaceId;
    private readonly onSiteError;
    private readonly listListeningPorts;
    private readonly inspectProcess;
    private readonly killProcess;
    readonly processes: Map<string, SiteChild>;
    private readonly states;
    private readonly logs;
    private readonly startTokens;
    private readonly startPromises;
    readonly ready: Promise<void>;
    constructor(store: SiteRuntimeStore, { fetch, probe, spawnProcess, ptyRuntime, requirePtyRuntime, reconcileOnStart, workspaceScripts, serviceResolver, resolveNotebookWorkspaceId, onSiteError, listListeningPorts, inspectProcess, killProcess }?: SiteRuntimeOptions);
    reconcilePersistedSites(): Promise<void>;
    status(id: string): (SiteBinding & {
        running: boolean;
        sessionOwnership: 'paseo' | 'adopted' | null;
        logs: SiteLog[];
    }) | null;
    getLogs(id: string): SiteLog[];
    resolveRoot(id: string): string;
    /** Confirmed starts are deduped: an in-flight start is shared with new callers. */
    start(id: string, { confirmed, timeoutMs }?: SiteStartOptions): Promise<SiteBinding>;
    performStart(id: string, { timeoutMs }?: SiteTimeoutOptions): Promise<SiteBinding>;
    assertStartActive(id: string, startToken: symbol): void;
    reportSiteError(id: string, error: unknown): void;
    stop(id: string, { forceTerminal, preserveExternalListeners }?: SiteStopOptions): Promise<SiteBinding | null>;
    restart(id: string, options?: SiteStartOptions): Promise<SiteBinding>;
    stopSiteListeners(siteRoot: string): Promise<void>;
    terminatePersistedTerminal(binding: SiteBinding, siteRoot: string): Promise<boolean>;
    discover(id: string, { timeoutMs, respectManual, ...options }?: SiteDiscoverOptions): Promise<DiscoveryResult>;
    close(): Promise<void>;
    appendLog(id: string, stream: 'stdout' | 'stderr', data: unknown): void;
    appendTerminalOutput(id: string, data: unknown): void;
}
export declare function probeSite(baseUrl: string, { fetch, timeoutMs }?: ProbeOptions): Promise<SiteHealth>;
export declare function rebindSite(store: SiteRuntimeStore, id: string, { workspaceId, developmentBaseUrl }: RebindOptions, { probe, fetch }?: {
    probe?: SiteRuntimeOptions['probe'];
    fetch?: typeof globalThis.fetch;
}): Promise<SiteBinding>;
export declare function discoverSiteServer({ root, previousBaseUrl, requireOwnedListener, timeoutMs, listListeningPorts, inspectProcess, probe, fetch }?: DiscoveryOptions): Promise<DiscoveryResult>;
export {};
