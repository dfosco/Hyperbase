import { Buffer } from 'node:buffer';
import process from 'node:process';
const REQUEST_DIAGNOSTIC_FLAG = 'HYPERCANVAS_E2E_REQUEST_DIAGNOSTICS';
const REQUEST_DIAGNOSTIC_ID_HEADER = 'x-hypercanvas-e2e-request-id';
const unavailableApiResponse = {
    code: 'HYPERCANVAS_API_UNAVAILABLE',
    error: 'The local Hypercanvas API service is unavailable. Check Notebook diagnostics for details.',
};
const requestDiagnosticsEnabled = process.env[REQUEST_DIAGNOSTIC_FLAG] === '1';
function diagnosticMetadata(request) {
    return request.__hypercanvasE2ERequestDiagnostic;
}
function diagnosticPathname(url) {
    if (!url)
        return '/';
    try {
        return new URL(url, 'http://hypercanvas.local').pathname;
    }
    catch {
        return url.split('?')[0] || '/';
    }
}
function emitApiDiagnostic(event, request, details = {}) {
    if (!requestDiagnosticsEnabled)
        return;
    const metadata = diagnosticMetadata(request);
    if (!metadata)
        return;
    try {
        process.stderr.write(`${JSON.stringify({
            source: 'hypercanvas-e2e-request-diagnostics',
            event,
            pid: process.pid,
            requestId: metadata.requestId,
            method: metadata.method,
            pathname: metadata.pathname,
            boundary: metadata.boundary ?? 'vite',
            monotonicMs: Number(process.hrtime.bigint()) / 1e6,
            elapsedMs: Number(process.hrtime.bigint() - metadata.startedAtNs) / 1e6,
            ...details,
        })}\n`);
    }
    catch { /* diagnostic output must not affect request handling */ }
}
/** Restore an ID passed only across the opt-in local embedded-service proxy. */
export function attachEmbeddedApiRequestDiagnostics(request, response) {
    if (!requestDiagnosticsEnabled)
        return;
    const apiRequest = request;
    const headerValue = apiRequest.headers[REQUEST_DIAGNOSTIC_ID_HEADER];
    const requestIdValue = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    delete apiRequest.headers[REQUEST_DIAGNOSTIC_ID_HEADER];
    for (let index = apiRequest.rawHeaders.length - 2; index >= 0; index -= 2) {
        if (apiRequest.rawHeaders[index]?.toLowerCase() === REQUEST_DIAGNOSTIC_ID_HEADER) {
            apiRequest.rawHeaders.splice(index, 2);
        }
    }
    if (typeof requestIdValue !== 'string' || !/^\d+$/.test(requestIdValue))
        return;
    const requestId = Number(requestIdValue);
    if (!Number.isSafeInteger(requestId) || requestId < 1)
        return;
    apiRequest.__hypercanvasE2ERequestDiagnostic = {
        requestId,
        method: apiRequest.method || 'GET',
        pathname: diagnosticPathname(apiRequest.url),
        startedAtNs: process.hrtime.bigint(),
        boundary: 'embedded',
    };
    emitApiDiagnostic('embedded-service-http-receipt', apiRequest);
    response.once('finish', () => emitApiDiagnostic('embedded-service-response-finish', apiRequest, {
        statusCode: response.statusCode,
    }));
    response.once('close', () => {
        if (!response.writableFinished)
            emitApiDiagnostic('embedded-service-response-close', apiRequest);
    });
}
export const API_PREFIX = '/_hypercanvas/';
/** Legacy mount point kept working across the Storyboard → Hypercanvas rename. */
export const LEGACY_API_PREFIX = '/_hypercanvas/';
/** Normalize a legacy `/_hypercanvas/...` URL onto the primary prefix. */
export function normalizeLegacyApiUrl(url) {
    if (typeof url !== 'string')
        return url;
    if (url.startsWith(LEGACY_API_PREFIX))
        return API_PREFIX + url.slice(LEGACY_API_PREFIX.length);
    // Base-prefixed form (`/branch--x/_hypercanvas/...`): rewrite the mount
    // point where it appears after the base path.
    const index = url.indexOf(LEGACY_API_PREFIX);
    if (index > 0) {
        return url.slice(0, index) + API_PREFIX + url.slice(index + LEGACY_API_PREFIX.length);
    }
    return url;
}
export const DEFAULT_MAX_JSON_BODY_BYTES = 64 * 1024;
function bodyError(code, status, message) {
    return Object.assign(new Error(message), { code, status });
}
export function parseJsonBody(req, { maxBytes = DEFAULT_MAX_JSON_BODY_BYTES } = {}) {
    return new Promise((resolve, reject) => {
        const declaredLength = Number(req.headers?.['content-length'] || 0);
        if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
            req.resume?.();
            reject(bodyError('REQUEST_BODY_TOO_LARGE', 413, 'JSON request body is too large'));
            return;
        }
        const chunks = [];
        let bytes = 0;
        let settled = false;
        const fail = (error) => {
            if (settled)
                return;
            settled = true;
            reject(error);
        };
        req.on('data', (chunk) => {
            if (settled)
                return;
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            bytes += buffer.length;
            if (bytes > maxBytes) {
                fail(bodyError('REQUEST_BODY_TOO_LARGE', 413, 'JSON request body is too large'));
                return;
            }
            chunks.push(buffer);
        });
        req.on('end', () => {
            if (settled)
                return;
            settled = true;
            if (!chunks.length) {
                resolve({});
                return;
            }
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
            }
            catch {
                reject(bodyError('INVALID_JSON', 400, 'Invalid JSON body'));
            }
        });
        req.on('error', (error) => fail(error));
    });
}
function stripBase(url, base) {
    const baseNoTrail = String(base || '/').replace(/\/$/, '');
    if (!baseNoTrail)
        return url;
    if (url === baseNoTrail)
        return '/';
    return url.startsWith(`${baseNoTrail}/`) ? url.slice(baseNoTrail.length) : url;
}
/**
 * Assemble the API route surface once for either Vite or the standalone
 * Hypercanvas server. Keeping this small object as the shared boundary avoids
 * making route handlers know which HTTP server owns them.
 */
export function createRouteSetup(options = {}) {
    return {
        routeHandlers: options.routeHandlers || new Map(),
        middleware: createApiMiddleware(options),
    };
}
export function createApiMiddleware({ base = '/', routeHandlers, sendJson, ws, maxBodyBytes, proxyUrl = 'http://localhost:4100', proxyAll = false, } = {}) {
    const send = sendJson ?? ((response, status, body) => {
        if (!isServerResponse(response))
            throw new TypeError('Expected an HTTP response');
        response.writeHead(status, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(body));
    });
    const handlers = routeHandlers ?? new Map();
    return async function storyboardApiMiddleware(req, res, next) {
        if (!req.url)
            return next();
        // Legacy `/_hypercanvas/...` requests are answered on the primary
        // `/_hypercanvas/...` surface; the prefix is rewritten before routing.
        const normalizedUrl = normalizeLegacyApiUrl(req.url);
        if (typeof normalizedUrl === 'string' && normalizedUrl !== req.url) {
            req.url = normalizedUrl;
            req.originalLegacyUrl = true;
        }
        const url = stripBase(req.url, base);
        if (!url.startsWith(API_PREFIX))
            return next();
        const pathAfterPrefix = url.slice(API_PREFIX.length);
        // Route by path only — the query string belongs to the handler (e.g.
        // frame-snapshot reads carry their target params on the GET URL). Parsing
        // the prefix from the full URL used to miss every queried route and send
        // it to the fallback proxy, which 502s when no external server runs.
        const queryIndex = pathAfterPrefix.indexOf('?');
        const pathOnly = queryIndex >= 0 ? pathAfterPrefix.slice(0, queryIndex) : pathAfterPrefix;
        const slashIndex = pathOnly.indexOf('/');
        const prefix = slashIndex === -1 ? pathOnly : pathOnly.slice(0, slashIndex);
        const restPath = slashIndex === -1 ? '/' : pathAfterPrefix.slice(slashIndex);
        res.__sbLogCtx = { ...(req.method ? { method: req.method } : {}), url, route: prefix, subRoute: restPath };
        const handler = handlers.get(prefix);
        const shouldProxyAll = typeof proxyAll === 'function' ? proxyAll() : proxyAll;
        if (!handler || shouldProxyAll) {
            const metadata = requestDiagnosticsEnabled ? diagnosticMetadata(req) : undefined;
            const isEmbeddedProxyTarget = shouldProxyAll && typeof proxyUrl === 'function' && !process.env.HYPERCANVAS_SERVER_URL;
            const targetKind = isEmbeddedProxyTarget ? 'embedded' : shouldProxyAll ? 'external' : 'fallback';
            const proxyStartedAtNs = metadata ? process.hrtime.bigint() : null;
            if (proxyStartedAtNs !== null) {
                emitApiDiagnostic('proxy-decision', req, {
                    boundary: 'vite-proxy',
                    route: prefix,
                    handlerMatched: Boolean(handler),
                    proxyAll: shouldProxyAll,
                    targetKind,
                });
            }
            try {
                const proxyReq = await import('node:http');
                const resolvedProxyUrl = typeof proxyUrl === 'function' ? proxyUrl() : proxyUrl;
                const targetUrl = `${resolvedProxyUrl.replace(/\/$/, '')}${url}`;
                let targetOrigin = null;
                if (proxyStartedAtNs !== null) {
                    try {
                        targetOrigin = new URL(resolvedProxyUrl).origin;
                    }
                    catch { /* keep malformed target details out of diagnostics */ }
                    emitApiDiagnostic('proxy-target', req, {
                        boundary: 'vite-proxy',
                        targetKind,
                        targetOrigin,
                    });
                }
                const headers = isEmbeddedProxyTarget && proxyStartedAtNs !== null && metadata
                    ? { ...req.headers, [REQUEST_DIAGNOSTIC_ID_HEADER]: String(metadata.requestId) }
                    : req.headers;
                const proxy = proxyReq.default.request(targetUrl, { method: req.method, headers }, (proxyRes) => {
                    if (proxyStartedAtNs !== null) {
                        emitApiDiagnostic('proxy-upstream-response', req, {
                            boundary: 'vite-proxy',
                            targetKind,
                            statusCode: proxyRes.statusCode ?? 502,
                            proxyElapsedMs: Number(process.hrtime.bigint() - proxyStartedAtNs) / 1e6,
                        });
                        proxyRes.once('end', () => emitApiDiagnostic('proxy-upstream-complete', req, {
                            boundary: 'vite-proxy',
                            targetKind,
                            statusCode: proxyRes.statusCode ?? 502,
                            proxyElapsedMs: Number(process.hrtime.bigint() - proxyStartedAtNs) / 1e6,
                        }));
                        proxyRes.once('aborted', () => emitApiDiagnostic('proxy-upstream-error', req, {
                            boundary: 'vite-proxy',
                            targetKind,
                            error: 'aborted',
                        }));
                        proxyRes.once('error', (error) => emitApiDiagnostic('proxy-upstream-error', req, {
                            boundary: 'vite-proxy',
                            targetKind,
                            error: error.name,
                        }));
                    }
                    res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
                    proxyRes.pipe(res);
                });
                if (proxyStartedAtNs !== null) {
                    proxy.once('finish', () => emitApiDiagnostic('proxy-request-finish', req, {
                        boundary: 'vite-proxy',
                        targetKind,
                        proxyElapsedMs: Number(process.hrtime.bigint() - proxyStartedAtNs) / 1e6,
                    }));
                }
                proxy.on('error', (error) => {
                    if (proxyStartedAtNs !== null) {
                        emitApiDiagnostic('proxy-upstream-error', req, {
                            boundary: 'vite-proxy',
                            targetKind,
                            error: error.name,
                            proxyElapsedMs: Number(process.hrtime.bigint() - proxyStartedAtNs) / 1e6,
                        });
                    }
                    send(res, 502, unavailableApiResponse);
                });
                if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE')
                    req.pipe(proxy);
                else
                    proxy.end();
            }
            catch {
                if (proxyStartedAtNs !== null) {
                    emitApiDiagnostic('proxy-upstream-error', req, {
                        boundary: 'vite-proxy',
                        targetKind,
                        error: 'proxy setup failed',
                        proxyElapsedMs: Number(process.hrtime.bigint() - proxyStartedAtNs) / 1e6,
                    });
                }
                send(res, 502, unavailableApiResponse);
            }
            return;
        }
        const dispatchStartedAtNs = requestDiagnosticsEnabled ? process.hrtime.bigint() : null;
        if (dispatchStartedAtNs !== null) {
            emitApiDiagnostic('generic-route-dispatch-entry', req, { route: prefix, subRoute: diagnosticPathname(restPath) });
        }
        try {
            let body = {};
            if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') {
                const routeLimit = prefix === 'host-tools'
                    ? (maxBodyBytes ?? DEFAULT_MAX_JSON_BODY_BYTES)
                    : Number.POSITIVE_INFINITY;
                const parsed = await parseJsonBody(req, { maxBytes: routeLimit });
                if (isRecord(parsed))
                    body = parsed;
            }
            await handler(req, res, { body, path: restPath, method: req.method || 'GET', __viteWs: ws });
        }
        catch (error) {
            if (isApiBodyError(error)) {
                send(res, error.status, { error: error.message, code: error.code });
                return;
            }
            send(res, 500, { error: error instanceof Error ? error.message : 'Internal server error' });
        }
        finally {
            if (dispatchStartedAtNs !== null) {
                emitApiDiagnostic('generic-route-dispatch-exit', req, {
                    route: prefix,
                    subRoute: diagnosticPathname(restPath),
                    dispatchElapsedMs: Number(process.hrtime.bigint() - dispatchStartedAtNs) / 1e6,
                });
            }
        }
    };
}
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isServerResponse(value) {
    return isRecord(value) && typeof value.writeHead === 'function' && typeof value.end === 'function';
}
function isApiBodyError(error) {
    return error instanceof Error && 'code' in error && 'status' in error &&
        (error.code === 'INVALID_JSON' || error.code === 'REQUEST_BODY_TOO_LARGE') && typeof error.status === 'number';
}
export function createApiGate({ base = '/', apiMiddleware, sendJson, isAllowedOrigin, isAuthorized, desktop = false, getNotebookRuntimeMiddleware }) {
    return function apiGate(req, res, next) {
        // Normalize the legacy Storyboard mount point first so every check below
        // (origin guard, session guard, delegation, routing) sees one surface.
        if (typeof req.url === 'string')
            req.url = normalizeLegacyApiUrl(req.url);
        let url = req.url || '';
        const baseNoTrail = String(base).replace(/\/$/, '');
        if (baseNoTrail && url.startsWith(baseNoTrail))
            url = url.slice(baseNoTrail.length) || '/';
        if (requestDiagnosticsEnabled && url.startsWith(API_PREFIX)) {
            emitApiDiagnostic('api-gate-entry', req, { gatePathname: diagnosticPathname(url) });
        }
        const notebookRuntime = getNotebookRuntimeMiddleware?.();
        if (url.startsWith(API_PREFIX) && desktop && isAllowedOrigin && !isAllowedOrigin(req.headers, { desktop: true })) {
            return sendJson(res, 403, { error: 'Desktop API requests require the exact app origin' });
        }
        if (url.startsWith(API_PREFIX) && isAuthorized && !isAuthorized(req)) {
            return sendJson(res, 401, { error: { code: 'CORE_SESSION_REQUIRED', message: 'Launch Hypercanvas from its wrapper to access Core APIs.' } });
        }
        if (url.startsWith(`${API_PREFIX}notebook-runtime/`) && typeof notebookRuntime === 'function') {
            console.debug('[devlog][api-gate] delegating Notebook runtime request', { method: req.method, url });
            // connect strips the mount prefix for use(path, fn); replicating that
            // here since this delegation bypasses the connect stack. Keep the
            // leading slash on the remainder so handlers see `/status` etc.
            const originalUrl = req.url;
            req.url = url.slice(`${API_PREFIX}notebook-runtime`.length) || '/';
            return notebookRuntime(req, res, error => {
                req.url = originalUrl;
                next(error);
            });
        }
        return apiMiddleware(req, res, next);
    };
}
