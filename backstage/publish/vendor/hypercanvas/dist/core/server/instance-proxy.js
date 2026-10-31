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
import net from 'node:net';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createDiagnosticIncident } from './diagnostics/contract.js';
import { renderDocumentFailure } from '../presentation/documentFailureRenderer.js';
import { readDesktopAppearanceMode, readDesktopRuntimeProjection } from './desktop-runtime-state.js';
export const INSTANCE_PATH = '/_hypercanvas/instance';
export const RELAUNCH_PATH = '/_hypercanvas/relaunch';
export const INTERNAL_PREFIX = '/_hypercanvas-internal/';
export const INTERNAL_REGISTER_PATH = '/_hypercanvas-internal/upstreams';
export const INTERNAL_RELAUNCH_PATH = '/_hypercanvas-internal/relaunch';
export const DEFAULT_INSTANCE_PORT = 1234;
export const INSTANCE_HOSTNAME = 'hypercanvas.localhost';
function errorCode(error) {
    return error instanceof Error && 'code' in error ? String(error.code) : undefined;
}
export class InstancePortOccupiedError extends Error {
    code;
    port;
    host;
    constructor(port, host) {
        super(`Instance port ${port} on ${host} is already bound`);
        this.name = 'InstancePortOccupiedError';
        this.code = 'EADDRINUSE';
        this.port = port;
        this.host = host;
    }
}
function sendJson(res, status, body) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify(body));
}
function isAcceptedHtml(accept) {
    return String(accept || '').split(',').some((part) => {
        const [mediaType = '', ...parameters] = part.trim().toLowerCase().split(';');
        if (mediaType.trim() !== 'text/html')
            return false;
        const quality = parameters.map((parameter) => parameter.trim()).find((parameter) => parameter.startsWith('q='));
        return !quality || Number(quality.slice(2)) > 0;
    });
}
const assetExtensions = new Set([
    '.avif', '.css', '.gif', '.ico', '.jpeg', '.jpg', '.js', '.json', '.map', '.mjs', '.mp3', '.mp4', '.png', '.svg', '.wasm', '.webm', '.webp', '.woff', '.woff2', '.xml',
]);
function normalizeOwnedBasePath(pathname, instanceUrl) {
    let basePath = '/';
    try {
        const configuredPath = instanceUrl ? new URL(instanceUrl).pathname : '/';
        if (configuredPath.startsWith('/'))
            basePath = configuredPath;
    }
    catch { /* invalid or absent instance URL uses the root path */ }
    if (basePath === '/' || basePath === '')
        return pathname;
    const baseRoot = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
    if (pathname === baseRoot)
        return '/';
    if (pathname.startsWith(basePath))
        return `/${pathname.slice(basePath.length)}`;
    return pathname;
}
function isEligibleFailureDocumentRequest(request, instanceUrl) {
    const method = String(request.method || '').toUpperCase();
    if ((method !== 'GET' && method !== 'HEAD') || !isAcceptedHtml(request.headers.accept))
        return false;
    const destination = String(request.headers['sec-fetch-dest'] || '').toLowerCase();
    if (destination && destination !== 'document' && destination !== 'iframe')
        return false;
    const pathname = normalizeOwnedBasePath(pathnameOf(request.url), instanceUrl);
    if (!pathname || pathname.startsWith('/_hypercanvas') || pathname.startsWith('/api/') || pathname === '/api'
        || pathname.startsWith('/@vite/') || pathname.startsWith('/@id/') || pathname.startsWith('/@fs/')
        || pathname.startsWith('/__vite') || pathname.startsWith('/node_modules/') || pathname.startsWith('/src/'))
        return false;
    if (assetExtensions.has(path.extname(pathname).toLowerCase()))
        return false;
    return true;
}
function neutralPendingDocument(appearance) {
    return `<!doctype html><html lang="en" data-hc-app-appearance="${appearance}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>Hypercanvas is checking its services</title><style>:root{color-scheme:light dark;font:16px system-ui,sans-serif;background:Canvas;color:CanvasText}:root[data-hc-app-appearance="light"]{color-scheme:light}:root[data-hc-app-appearance="dark"]{color-scheme:dark}body{min-height:100vh;box-sizing:border-box;margin:0;padding:48px 24px}main{max-width:640px;margin:auto}p{line-height:1.55;color:GrayText}</style></head><body><main><h1>Hypercanvas is checking its local services</h1><p role="status" aria-live="polite">The latest runtime status has not reached this page yet. Continue from the app window if it is still open, and check the status again when the local service responds.</p></main></body></html>`;
}
export function embedOfflineRecoveryClient(html, source) {
    const basePolicy = "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";
    if (!source)
        return { html, contentSecurityPolicy: `${basePolicy}; script-src 'none'` };
    const escapedSource = source.replace(/<\/script/gi, '<\\/script');
    const closeBody = /<\/body\s*>/i;
    if (!closeBody.test(html))
        return { html, contentSecurityPolicy: `${basePolicy}; script-src 'none'` };
    const digest = createHash('sha256').update(Buffer.from(escapedSource, 'utf8')).digest('base64');
    return {
        html: html.replace(closeBody, `<script>${escapedSource}</script></body>`),
        contentSecurityPolicy: `${basePolicy}; script-src 'sha256-${digest}'`,
    };
}
function readOfflineRecoveryClient(assetPath) {
    try {
        const stats = statSync(assetPath);
        if (!stats.isFile() || stats.size <= 0 || stats.size > 4 * 1024 * 1024)
            return null;
        return readFileSync(assetPath, 'utf8');
    }
    catch {
        return null;
    }
}
function defaultOfflineRecoveryClientPath() {
    try {
        return fileURLToPath(new URL('../presentation/offline-recovery-client.inline.js', import.meta.url));
    }
    catch {
        // Test transforms can replace import.meta.url with a non-file URL. The
        // production package always uses the file-relative path above.
        return path.resolve(process.cwd(), 'packages/storyboard/src/core/presentation/offline-recovery-client.inline.js');
    }
}
function sendFailureDocument(request, response, incident, offlineRecoveryClientPath, instanceUrl) {
    if (!isEligibleFailureDocumentRequest(request, instanceUrl))
        return false;
    const stateDirectory = process.env.HYPERCANVAS_APP_STATE_DIR?.trim() || '';
    const appearance = stateDirectory ? readDesktopAppearanceMode(stateDirectory) : 'system';
    const projection = readDesktopRuntimeProjection();
    const projectedIncident = projection?.snapshot.incident;
    const matchesActiveIncident = Boolean(incident && projectedIncident
        && projectedIncident.incidentId === incident.incidentId
        && projectedIncident.correlationId === incident.correlationId
        && projectedIncident.code === incident.code);
    let html = neutralPendingDocument(appearance);
    if (matchesActiveIncident && projection) {
        try {
            const rendered = renderDocumentFailure({
                method: String(request.method || ''),
                ...(typeof request.url === 'string' ? { url: request.url } : {}),
            }, projection.snapshot);
            if (rendered && typeof rendered.html === 'string') {
                html = rendered.html.replace('<html lang="en" data-hc-app-appearance="system">', `<html lang="en" data-hc-app-appearance="${appearance}">`);
            }
        }
        catch {
            // Renderer failures fall through to the static pending document.
        }
    }
    const embedded = embedOfflineRecoveryClient(html, readOfflineRecoveryClient(offlineRecoveryClientPath));
    const body = String(request.method || '').toUpperCase() === 'HEAD' ? undefined : embedded.html;
    response.writeHead(503, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': embedded.contentSecurityPolicy,
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'Content-Length': Buffer.byteLength(embedded.html),
    });
    response.end(body);
    return true;
}
function pathnameOf(url) {
    return String(url || '/').split('?')[0] || '';
}
function isLoopbackPeer(request) {
    const peer = request.socket?.remoteAddress;
    return peer === '127.0.0.1' || peer === '::1' || peer === '::ffff:127.0.0.1';
}
function proxyRequestHeaders(request) {
    const headers = { ...request.headers };
    // Host passes through unchanged so downstream Host-derived logic (ws-url,
    // origin gates) sees the fixed proxy origin. Record the loopback hop.
    if (!headers['x-forwarded-proto'])
        headers['x-forwarded-proto'] = 'http';
    const peer = request.socket?.remoteAddress;
    if (peer) {
        const prior = headers['x-forwarded-for'];
        headers['x-forwarded-for'] = prior ? `${prior}, ${peer}` : peer;
    }
    return headers;
}
function readJsonBody(request, maxBytes) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        request.on('data', (chunk) => {
            size += chunk.length;
            if (size > maxBytes) {
                request.destroy();
                reject(new Error('Body too large'));
                return;
            }
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        request.once('end', () => {
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
            }
            catch {
                reject(new Error('Invalid JSON body'));
            }
        });
        request.once('error', reject);
    });
}
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
export async function acquireInstanceProxy({ port = DEFAULT_INSTANCE_PORT, host = null, instanceInfo = {}, issueRelaunchToken = null, registrationToken = null, onDiagnostic = null, offlineRecoveryClientPath, } = {}) {
    const offlineClientPath = offlineRecoveryClientPath || defaultOfflineRecoveryClientPath();
    let info = { app: 'hypercanvas', pid: process.pid, version: null, url: null, notebook: null, ...instanceInfo };
    let defaultUpstream = null;
    const wsUpstreams = new Map();
    const sockets = new Set();
    const tunnels = new Set();
    let closed = false;
    let activeUpstreamIncident = null;
    let activeUpstreamIncidentSequenceFloor = null;
    let observedIncidentSequence = null;
    const emitDiagnostic = (incident) => {
        try {
            onDiagnostic?.(incident);
        }
        catch { /* reporting must not break proxy responses */ }
    };
    const clearUpstreamFailureAfterGoHealthy = () => {
        if (!activeUpstreamIncident)
            return;
        const snapshot = readDesktopRuntimeProjection()?.snapshot;
        if (!snapshot)
            return;
        const sameIncident = snapshot.incident?.incidentId === activeUpstreamIncident.incidentId
            && snapshot.incident.correlationId === activeUpstreamIncident.correlationId;
        if (sameIncident && snapshot.phase !== 'ready') {
            observedIncidentSequence = Math.max(observedIncidentSequence ?? 0, snapshot.sequence);
        }
        const acknowledgedSameIncident = snapshot.phase === 'recovered'
            && sameIncident;
        const healthyAfterIncident = snapshot.phase === 'ready' && snapshot.incident === null
            && ((activeUpstreamIncidentSequenceFloor !== null && snapshot.sequence > activeUpstreamIncidentSequenceFloor)
                || (observedIncidentSequence !== null && snapshot.sequence > observedIncidentSequence));
        if (acknowledgedSameIncident || healthyAfterIncident) {
            activeUpstreamIncident = null;
            activeUpstreamIncidentSequenceFloor = null;
            observedIncidentSequence = null;
        }
    };
    const reportUpstreamFailure = (error) => {
        clearUpstreamFailureAfterGoHealthy();
        if (activeUpstreamIncident)
            return;
        const code = errorCode(error);
        activeUpstreamIncident = createDiagnosticIncident('CORE_UPSTREAM_UNAVAILABLE', {
            details: {
                observedFailure: 'registered-upstream-forward-failed',
                upstreamErrorCode: code && /^[A-Z0-9_]{1,64}$/.test(code) ? code : 'unknown',
            },
            recovery: { state: 'recovering', attempt: 0, limit: 1, action: 'reload-page' },
        });
        activeUpstreamIncidentSequenceFloor = readDesktopRuntimeProjection()?.snapshot.sequence ?? null;
        observedIncidentSequence = null;
        emitDiagnostic(activeUpstreamIncident);
    };
    const normalizeUpstream = (upstream) => (upstream?.port ? { host: upstream.host || '127.0.0.1', port: upstream.port } : null);
    const applyUpstreamRegistration = (value) => {
        if (!value || typeof value !== 'object')
            throw new Error('Invalid registration payload');
        const payload = value;
        const validPort = (port) => Number.isInteger(port) && Number(port) > 0 && Number(port) <= 65535;
        const validHost = (host) => typeof host === 'string' && host.length > 0 && host.length <= 255;
        if (validPort(payload.vitePort)) {
            defaultUpstream = normalizeUpstream({
                host: validHost(payload.viteHost) ? payload.viteHost : '127.0.0.1',
                port: payload.vitePort,
            });
        }
        if (validPort(payload.apiPort) && typeof payload.apiWsPath === 'string' && payload.apiWsPath.startsWith('/')) {
            wsUpstreams.set(payload.apiWsPath, normalizeUpstream({
                host: validHost(payload.apiHost) ? payload.apiHost : '127.0.0.1',
                port: payload.apiPort,
            }));
        }
        if (payload.notebook !== undefined)
            info = { ...info, notebook: payload.notebook };
        if (payload.url)
            info = { ...info, url: String(payload.url) };
    };
    const forwardInternalJson = (path, payload, timeoutMs = 2000) => {
        if (!defaultUpstream)
            return Promise.reject(new Error('No default upstream attached'));
        const upstream = defaultUpstream;
        const body = JSON.stringify(payload);
        return new Promise((resolve, reject) => {
            const upstreamRequest = http.request({
                host: upstream.host,
                port: upstream.port,
                method: 'POST',
                path,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                    ...(registrationToken ? { Authorization: `Bearer ${registrationToken}` } : {}),
                },
                timeout: timeoutMs,
            }, (upstreamResponse) => {
                let text = '';
                upstreamResponse.setEncoding('utf8');
                upstreamResponse.on('data', (chunk) => { text += chunk; });
                upstreamResponse.on('end', () => {
                    try {
                        resolve(JSON.parse(text));
                    }
                    catch {
                        reject(new Error('Non-JSON internal response'));
                    }
                });
            });
            upstreamRequest.once('timeout', () => upstreamRequest.destroy(new Error('Internal forward timed out')));
            upstreamRequest.once('error', reject);
            upstreamRequest.end(body);
        });
    };
    const forwardHttp = (request, response) => {
        if (!defaultUpstream) {
            if (sendFailureDocument(request, response, null, offlineClientPath, info.url))
                return;
            sendJson(response, 503, { error: 'core_starting' });
            return;
        }
        const upstream = defaultUpstream;
        let clientAborted = false;
        const upstreamRequest = http.request({
            host: upstream.host,
            port: upstream.port,
            method: request.method,
            path: request.url,
            headers: proxyRequestHeaders(request),
        }, (upstreamResponse) => {
            upstreamResponse.once('end', clearUpstreamFailureAfterGoHealthy);
            response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
            upstreamResponse.pipe(response);
        });
        upstreamRequest.on('error', (error) => {
            if (!clientAborted)
                reportUpstreamFailure(error);
            if (!response.headersSent) {
                if (!sendFailureDocument(request, response, clientAborted ? null : activeUpstreamIncident, offlineClientPath, info.url)) {
                    sendJson(response, 503, { error: 'core_starting' });
                }
            }
            else
                response.destroy();
        });
        request.on('aborted', () => {
            clientAborted = true;
            upstreamRequest.destroy();
        });
        request.pipe(upstreamRequest);
    };
    const forwardUpgrade = (request, clientSocket, head) => {
        const pathname = pathnameOf(request.url);
        const upstream = wsUpstreams.get(pathname) || defaultUpstream;
        if (!upstream) {
            try {
                clientSocket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
            }
            catch { /* socket already gone */ }
            clientSocket.destroy();
            return;
        }
        const proxySocket = net.connect(upstream.port, upstream.host);
        tunnels.add(proxySocket);
        const teardown = () => {
            tunnels.delete(proxySocket);
            proxySocket.destroy();
            clientSocket.destroy();
        };
        proxySocket.once('error', teardown);
        clientSocket.once('error', teardown);
        // A destroyed half does not propagate through pipe() on its own; tear
        // down the pair so neither side leaks and server close() can complete.
        proxySocket.once('close', () => {
            tunnels.delete(proxySocket);
            clientSocket.destroy();
        });
        clientSocket.once('close', () => {
            tunnels.delete(proxySocket);
            proxySocket.destroy();
        });
        proxySocket.on('connect', () => {
            const rawHeaders = request.rawHeaders || [];
            let head_block = `${request.method} ${request.url} HTTP/${request.httpVersion}\r\n`;
            for (let index = 0; index + 1 < rawHeaders.length; index += 2) {
                head_block += `${rawHeaders[index]}: ${rawHeaders[index + 1]}\r\n`;
            }
            head_block += '\r\n';
            proxySocket.write(head_block);
            if (head?.length)
                proxySocket.write(head);
            clientSocket.pipe(proxySocket);
            proxySocket.pipe(clientSocket);
        });
    };
    const onRequest = (request, response) => {
        const pathname = pathnameOf(request.url);
        if (request.method === 'GET' && pathname === INSTANCE_PATH) {
            sendJson(response, 200, { ...info, ready: defaultUpstream !== null });
            return;
        }
        if (request.method === 'POST' && pathname === RELAUNCH_PATH) {
            if (!isLoopbackPeer(request)) {
                sendJson(response, 403, { error: 'relaunch_loopback_only' });
                return;
            }
            const origin = request.headers.origin;
            const fetchSite = request.headers['sec-fetch-site'];
            if ((origin && origin !== `http://${request.headers.host}`) || fetchSite === 'cross-site') {
                sendJson(response, 403, { error: 'relaunch_origin_not_allowed' });
                return;
            }
            request.resume();
            request.on('end', async () => {
                try {
                    if (issueRelaunchToken) {
                        const token = await issueRelaunchToken();
                        if (!token || !info.url) {
                            sendJson(response, 503, { error: 'relaunch_unavailable' });
                            return;
                        }
                        sendJson(response, 200, { url: info.url, token: String(token) });
                        return;
                    }
                    // The browser session lives in the Vite child: ask it to mint a
                    // relaunch token rather than minting one here that nothing honors.
                    const relaunched = await forwardInternalJson(INTERNAL_RELAUNCH_PATH, {});
                    if (relaunched?.url && relaunched?.token) {
                        sendJson(response, 200, { url: String(relaunched.url), token: String(relaunched.token) });
                    }
                    else {
                        sendJson(response, 503, { error: 'relaunch_unavailable' });
                    }
                }
                catch {
                    sendJson(response, 503, { error: 'relaunch_unavailable' });
                }
            });
            return;
        }
        if (pathname.startsWith(INTERNAL_PREFIX)) {
            if (!isLoopbackPeer(request)) {
                sendJson(response, 403, { error: 'internal_loopback_only' });
                return;
            }
            if (registrationToken && request.headers.authorization !== `Bearer ${registrationToken}`) {
                sendJson(response, 401, { error: 'internal_auth_required' });
                return;
            }
            if (request.method === 'POST' && pathname === INTERNAL_REGISTER_PATH) {
                readJsonBody(request, 65536).then((payload) => {
                    applyUpstreamRegistration(payload);
                    sendJson(response, 200, { ok: true });
                }).catch(() => sendJson(response, 400, { error: 'invalid_registration' }));
                return;
            }
            sendJson(response, 404, { error: 'unknown_internal_path' });
            return;
        }
        if (pathname === INSTANCE_PATH || pathname === RELAUNCH_PATH) {
            sendJson(response, 404, { error: 'unknown_instance_path' });
            return;
        }
        forwardHttp(request, response);
    };
    const trackServer = (server) => {
        server.on('upgrade', forwardUpgrade);
        server.on('clientError', (_error, socket) => socket.destroy());
        server.on('connection', (socket) => {
            sockets.add(socket);
            socket.once('close', () => sockets.delete(socket));
        });
    };
    const listenOnce = (server, listenPort, listenHost) => new Promise((resolve, reject) => {
        const onError = (error) => {
            server.off('listening', onListening);
            reject(error);
        };
        const onListening = () => {
            server.off('error', onError);
            resolve();
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(listenPort, listenHost);
    });
    const closeServers = (servers) => Promise.all(servers.map((server) => new Promise((resolve) => {
        if (!server.listening)
            return resolve();
        server.close(() => resolve());
    })));
    // Bind every loopback stack. A second acquire on any stack means the
    // claim is occupied: partial binds are closed before reporting so a
    // later probe never hits our own half-open socket.
    const bindHosts = host ? [host] : ['127.0.0.1', '::1'];
    const servers = [];
    let boundPort = port;
    let attempts = 0;
    for (;;) {
        attempts += 1;
        try {
            for (const bindHost of bindHosts) {
                const server = http.createServer(onRequest);
                trackServer(server);
                try {
                    await listenOnce(server, boundPort, bindHost);
                }
                catch (error) {
                    if (errorCode(error) === 'EADDRNOTAVAIL' && bindHost === '::1' && !host) {
                        // No IPv6 loopback on this machine: the IPv4 bind alone is the
                        // complete claim here. Drop the half-created server and continue.
                        server.removeAllListeners();
                        continue;
                    }
                    throw error;
                }
                servers.push(server);
                const address = server.address();
                if (typeof address === 'object' && address && boundPort === 0)
                    boundPort = address.port;
            }
            break;
        }
        catch (error) {
            await closeServers(servers);
            servers.length = 0;
            if (errorCode(error) === 'EADDRINUSE' && port === 0 && attempts < 5) {
                boundPort = 0;
                continue;
            }
            if (errorCode(error) === 'EADDRINUSE')
                throw new InstancePortOccupiedError(port, bindHosts.join(','));
            throw error;
        }
    }
    function close() {
        if (closed)
            return Promise.resolve();
        closed = true;
        for (const socket of tunnels)
            socket.destroy();
        tunnels.clear();
        for (const socket of sockets)
            socket.destroy();
        sockets.clear();
        return closeServers(servers).then(() => undefined);
    }
    return {
        servers,
        server: servers[0],
        host: host || 'loopback',
        port: boundPort,
        setDefaultUpstream(upstream) {
            defaultUpstream = normalizeUpstream(upstream);
        },
        setWsUpstream(path, upstream) {
            const normalized = normalizeUpstream(upstream);
            if (!normalized)
                wsUpstreams.delete(path);
            else
                wsUpstreams.set(path, normalized);
        },
        removeWsUpstream(path) {
            wsUpstreams.delete(path);
        },
        setInstanceInfo(patch) {
            info = { ...info, ...(patch || {}) };
        },
        close,
    };
}
