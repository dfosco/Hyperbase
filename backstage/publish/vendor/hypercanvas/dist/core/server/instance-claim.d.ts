/**
 * Global instance claim for Hypercanvas Core.
 *
 * The claim is the selected proxy socket itself (see instance-proxy.js):
 * binding it wins ownership, losing the bind means another process holds the
 * port. The holder is classified by probing the proxy-owned instance
 * endpoint — a running Hypercanvas answers, anything else is foreign.
 */
import http from 'node:http';
import type { DiagnosticIncident } from './diagnostics/contract.js';
interface InstancePayload {
    app?: string;
    pid?: number;
    version?: string | null;
    url?: string | null;
    notebook?: unknown;
    ready?: boolean;
    [key: string]: unknown;
}
interface ProbeOptions {
    port?: number;
    timeoutMs?: number;
}
interface ExistingOptions {
    port?: number;
    probeTimeoutMs?: number;
}
interface ClaimOptions {
    port: number;
    host?: string | null;
    probeTimeoutMs?: number;
    readinessTimeoutMs?: number;
    readinessPollIntervalMs?: number;
    instanceInfo?: Record<string, unknown>;
    issueRelaunchToken?: () => unknown | Promise<unknown> | null;
    registrationToken?: string | null;
    onDiagnostic?: ((incident: DiagnosticIncident) => void) | null;
}
interface RunningClaim {
    kind: 'running';
    url: string | null | undefined;
    token: string | null;
    instance: InstancePayload;
}
/**
 * Probe the instance endpoint without claiming, across loopback stacks.
 * Returns the Hypercanvas instance payload ({ app, pid, version, url,
 * notebook, ready }) or null when the port is closed, foreign, or silent.
 */
export declare function probeInstanceEndpoint({ port, timeoutMs }?: ProbeOptions): Promise<InstancePayload | null>;
/** Find an existing Hypercanvas instance, including one on a prior fallback port. */
export declare function findExistingInstance({ port, probeTimeoutMs }?: ExistingOptions): Promise<{
    port: number;
    instance: InstancePayload;
} | null>;
/**
 * Best-effort pid lookup for a listener (macOS lsof). Returns null when the
 * platform helper is unavailable — including under NODE_ENV=test so claim
 * tests stay deterministic.
 */
export declare function findListenerPid(port: number): Promise<number | null>;
/** Attempt to claim one specific port, preserving explicit conflict details. */
export declare function attemptInstanceClaim(options: ClaimOptions): Promise<RunningClaim | {
    kind: string;
    proxy: {
        servers: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>[];
        server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse> | undefined;
        host: string;
        port: number;
        setDefaultUpstream(upstream: import("./instance-proxy.js").UpstreamInput | null): void;
        setWsUpstream(path: string, upstream: import("./instance-proxy.js").UpstreamInput | null): void;
        removeWsUpstream(path: string): void;
        setInstanceInfo(patch: Record<string, unknown>): void;
        close: () => Promise<void>;
    };
    port?: never;
} | {
    kind: string;
    port: number;
    proxy?: never;
} | {
    kind: string;
    port: number;
    pid: number | null;
    detail: string;
}>;
/** Claim the first available port at or above `port`, skipping foreign listeners. */
export declare function attemptInstanceClaimWithFallback({ port, maxPort, ...options }: ClaimOptions & {
    maxPort?: number;
}): Promise<RunningClaim | {
    kind: string;
    proxy: {
        servers: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>[];
        server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse> | undefined;
        host: string;
        port: number;
        setDefaultUpstream(upstream: import("./instance-proxy.js").UpstreamInput | null): void;
        setWsUpstream(path: string, upstream: import("./instance-proxy.js").UpstreamInput | null): void;
        removeWsUpstream(path: string): void;
        setInstanceInfo(patch: Record<string, unknown>): void;
        close: () => Promise<void>;
    };
    port?: never;
} | {
    kind: string;
    port: number;
    proxy?: never;
} | {
    port: number;
    kind: string;
    proxy: {
        servers: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>[];
        server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse> | undefined;
        host: string;
        port: number;
        setDefaultUpstream(upstream: import("./instance-proxy.js").UpstreamInput | null): void;
        setWsUpstream(path: string, upstream: import("./instance-proxy.js").UpstreamInput | null): void;
        removeWsUpstream(path: string): void;
        setInstanceInfo(patch: Record<string, unknown>): void;
        close: () => Promise<void>;
    };
    detail?: never;
} | {
    kind: string;
    port: number;
    detail: string;
}>;
export {};
