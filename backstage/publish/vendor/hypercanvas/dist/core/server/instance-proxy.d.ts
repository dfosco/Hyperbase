/**
 * Single-instance Hypercanvas proxy.
 *
 * One loopback listener on the selected proxy port is the global instance
 * claim: the socket bind itself proves ownership, so a crashed Core leaves no
 * stale claim behind. The proxy forwards HTTP and WebSocket upgrades to the
 * existing dynamic backends (Vite child for UI/HMR/terminals, standalone
 * Hypercanvas API server for its socket path) and serves two proxy-owned
 * endpoints used by duplicate launches:
 *
 *   GET  /_hypercanvas/instance  → { app, pid, version, url, notebook }
 *   POST /_hypercanvas/relaunch  → { url, token } (loopback callers only)
 */
import http from 'node:http';
import { type DiagnosticIncident } from './diagnostics/contract.js';
export declare const INSTANCE_PATH = "/_hypercanvas/instance";
export declare const RELAUNCH_PATH = "/_hypercanvas/relaunch";
export declare const INTERNAL_PREFIX = "/_hypercanvas-internal/";
export declare const INTERNAL_REGISTER_PATH = "/_hypercanvas-internal/upstreams";
export declare const INTERNAL_RELAUNCH_PATH = "/_hypercanvas-internal/relaunch";
export declare const DEFAULT_INSTANCE_PORT = 1234;
export declare const INSTANCE_HOSTNAME = "hypercanvas.localhost";
export interface UpstreamInput {
    host?: string;
    port?: number;
}
interface ProxyOptions {
    port?: number;
    host?: string | null;
    instanceInfo?: Record<string, unknown>;
    issueRelaunchToken?: (() => unknown | Promise<unknown>) | null;
    registrationToken?: string | null;
    onDiagnostic?: ((incident: DiagnosticIncident) => void) | null;
    offlineRecoveryClientPath?: string;
}
export declare class InstancePortOccupiedError extends Error {
    readonly code: string;
    readonly port: number;
    readonly host: string;
    constructor(port: number, host: string);
}
export declare function embedOfflineRecoveryClient(html: string, source: string | null): {
    html: string;
    contentSecurityPolicy: string;
};
/**
 * Acquire the instance proxy on the requested port.
 *
 * Dual loopback bind: the claim covers IPv4 (127.0.0.1) and IPv6 (::1)
 * loopback together. `hypercanvas.localhost` resolves to ::1 on machines
 * with IPv6 loopback, so an IPv4-only bind would refuse hostname-based
 * clients (including Node fetch). An explicit `host` binds single-stack.
 * If any stack reports EADDRINUSE the whole claim is occupied — partial
 * binds are closed before reporting so probes never hit our own socket.
 * An explicit `host` binds single-stack (tests and single-stack hosts).
 *
 * The proxy lives in the Core supervisor process while the Vite child owns
 * the browser session and backends, so two proxy-owned endpoints bridge the
 * process boundary over loopback:
 *
 *   POST /_hypercanvas-internal/upstreams — the Vite child registers its
 *     dynamic backend ports ({ vitePort, viteHost, apiPort, apiWsPath, notebook }).
 *   POST /_hypercanvas/relaunch — without an issueRelaunchToken issuer, the
 *     proxy forwards to the child's /_hypercanvas-internal/relaunch so the
 *     token is minted by the browser-session owner.
 *
 * @param {object} options
 * @param {number} [options.port] — port to bind (0 = ephemeral, for tests/e2e)
 * @param {string} [options.host] — single-stack bind host (default: dual loopback)
 * @param {object} [options.instanceInfo] — served from GET /_hypercanvas/instance
 * @param {function} [options.issueRelaunchToken] — () => token|string|Promise, for POST /_hypercanvas/relaunch
 */
export declare function acquireInstanceProxy({ port, host, instanceInfo, issueRelaunchToken, registrationToken, onDiagnostic, offlineRecoveryClientPath, }?: ProxyOptions): Promise<{
    servers: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>[];
    server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse> | undefined;
    host: string;
    port: number;
    setDefaultUpstream(upstream: UpstreamInput | null): void;
    setWsUpstream(path: string, upstream: UpstreamInput | null): void;
    removeWsUpstream(path: string): void;
    setInstanceInfo(patch: Record<string, unknown>): void;
    close: () => Promise<void>;
}>;
export {};
