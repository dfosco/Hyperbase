import { resolveAppConfigPath } from '../configFile.js';
import { createServer } from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_INSTANCE_PORT } from '../server/instance-proxy.js';
export const DESKTOP_EVENT_PREFIX = '__HYPERCANVAS_DESKTOP_EVENT__';
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function errorProperty(error, property) {
    return error !== null && typeof error === 'object' && property in error
        ? error[property]
        : undefined;
}
function isPermissionError(error) {
    const code = errorProperty(error, 'code');
    return code === 'EPERM' || code === 'EACCES';
}
function configRecord(value) {
    return isRecord(value) ? value : {};
}
/**
 * macOS privacy protection (TCC) blocks Documents, Desktop, and Downloads for
 * apps the user has not approved, surfacing as EPERM/EACCES on open. Keep the
 * failure loud but tell the user how to approve the app.
 */
export function describeReadFailure(error) {
    const errorMessage = errorProperty(error, 'message');
    const message = String(errorMessage || error);
    if (!isPermissionError(error))
        return message;
    return `${message}. macOS blocked this folder: open System Settings → Privacy & Security → Files and Folders (or Full Disk Access), allow Hypercanvas, and relaunch the app.`;
}
export function createDesktopEvent(event, details = {}) {
    return {
        schemaVersion: 1,
        source: 'storyboard-dev',
        event,
        ...details,
    };
}
export function encodeDesktopEvent(event, details = {}) {
    return JSON.stringify(createDesktopEvent(event, details));
}
export function encodeViteDesktopEvent(event, details = {}) {
    return `${DESKTOP_EVENT_PREFIX}${encodeDesktopEvent(event, details)}`;
}
export function parseViteDesktopEvent(line) {
    const index = line.indexOf(DESKTOP_EVENT_PREFIX);
    if (index === -1)
        return null;
    try {
        const parsed = JSON.parse(line.slice(index + DESKTOP_EVENT_PREFIX.length));
        if (!isRecord(parsed))
            return null;
        const event = parsed;
        if (event?.schemaVersion !== 1 || event?.source !== 'storyboard-dev' || typeof event?.event !== 'string') {
            return null;
        }
        return event;
    }
    catch {
        return null;
    }
}
/** Prevent a disconnected desktop host from terminating the Vite process. */
export function ignoreBrokenPipeErrors(stream) {
    stream?.on?.('error', (error) => {
        if (errorProperty(error, 'code') !== 'EPIPE')
            throw error;
    });
}
export function desktopUrl(host, port, basePath = '/') {
    const base = basePath.startsWith('/') ? basePath : `/${basePath}`;
    return `http://${host}:${port}${base}`;
}
export const DESKTOP_PARENT_MILESTONES = ['runtime-prepared', 'daemon-ready', 'worker-started'];
export const DESKTOP_CHILD_MILESTONES = ['generation-started', 'upstreams-registered', 'dependencies-scanned', 'dependencies-ready', 'html-validated', 'entry-validated'];
/** Native owns these identities. A standalone CLI deliberately uses legacy transport. */
export function readDesktopStartupIdentity(env = process.env) {
    const attemptId = env.HYPERCANVAS_CORE_ATTEMPT_ID;
    const operationId = env.HYPERCANVAS_STARTUP_OPERATION_ID;
    if (attemptId === undefined && operationId === undefined)
        return null;
    const valid = (value) => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
    if (!valid(attemptId) || !valid(operationId))
        throw new Error('Invalid desktop startup identity');
    return { attemptId, operationId };
}
/** One supervisor assigns canonical generations; worker nonces never reach the host. */
export function createDesktopStartupProgress(identity, emit) {
    let parentPhase = 0;
    let generation = 0;
    let nonce;
    let childPhase = -1;
    let retired = false;
    const seen = new Set();
    return {
        completeParent(milestone) {
            if (!identity)
                return;
            if (DESKTOP_PARENT_MILESTONES[parentPhase] !== milestone)
                throw new Error('Invalid desktop startup progression');
            parentPhase++;
            emit({ ...identity, generation: 0, milestone });
        },
        forward(event) {
            if (!identity)
                return event.event === 'operation-progress' ? null : event;
            if (!['operation-progress', 'ready', 'error', 'stopped'].includes(event.event))
                return event;
            if (event.attemptId !== identity.attemptId || event.operationId !== identity.operationId || typeof event.generationId !== 'string')
                return null;
            const incoming = event.generationId;
            if (event.event === 'operation-progress' && event.milestone === 'generation-started') {
                if (generation === Number.MAX_SAFE_INTEGER || parentPhase !== DESKTOP_PARENT_MILESTONES.length || seen.has(incoming) || !/^[a-f0-9]{32}$/.test(incoming))
                    return null;
                seen.add(incoming);
                nonce = incoming;
                generation++;
                childPhase = 0;
                retired = false;
            }
            else {
                if (incoming !== nonce || retired)
                    return null;
                if (event.event === 'operation-progress') {
                    if (event.milestone === 'generation-retired')
                        retired = true;
                    else {
                        if (DESKTOP_CHILD_MILESTONES[childPhase + 1] !== event.milestone)
                            return null;
                        childPhase++;
                    }
                }
                else if (event.event === 'ready' && childPhase !== DESKTOP_CHILD_MILESTONES.length - 1)
                    return null;
            }
            const { generationId: _internalNonce, ...details } = event;
            return { ...details, ...identity, generation };
        },
    };
}
/** Listening is not readiness: exercise the document and its dynamic entry. */
export async function preflightDesktopDocument(url, { fetchDocument = fetch, timeoutMs = 20_000, prepare = async () => { }, signal: generationSignal, onValidated = () => { }, } = {}) {
    // Desktop lifecycle waits for real completion or generation retirement. The
    // native stalled-step watchdog is advisory; generic callers retain a timeout.
    const timeoutSignal = timeoutMs === null ? undefined : AbortSignal.timeout(timeoutMs);
    const signal = timeoutSignal && generationSignal ? AbortSignal.any([timeoutSignal, generationSignal]) : generationSignal || timeoutSignal || new AbortController().signal;
    let phase = 'dependency preparation';
    let validationMessage;
    const invalid = (message) => { validationMessage = message.replace(/^Workspace preflight (?:failed: )?/, ''); throw new Error(message); };
    const request = async (target, html) => {
        // These checks run again after worker restarts. Do not retain pooled idle
        // connections: a socket closed between checks can reset the next request
        // before it reaches the otherwise healthy instance proxy.
        phase = html ? 'HTML headers' : 'entry headers';
        signal.throwIfAborted();
        const response = await fetchDocument(target, { redirect: 'error', cache: 'no-store', headers: { Connection: 'close' }, signal });
        phase = html ? 'HTML body' : 'entry body';
        const body = await response.text();
        if (!response.ok || response.redirected)
            invalid(`Workspace preflight failed: HTTP ${response.status}`);
        if (html && (!/text\/html/i.test(response.headers.get('content-type') || '') || !/<(?:!doctype\s+html|html)[\s>]/i.test(body))) {
            invalid('Workspace preflight did not return an HTML document');
        }
        if (!html && !/(?:java|ecma)script/i.test(response.headers.get('content-type') || ''))
            invalid('Workspace preflight did not return a JavaScript entry');
        if (!body.trim())
            invalid('Workspace preflight returned an empty document or entry');
    };
    let abort;
    const aborted = new Promise((_resolve, reject) => {
        abort = () => reject(signal.reason);
        signal.addEventListener('abort', abort, { once: true });
    });
    try {
        if (timeoutMs !== null && timeoutMs <= 0)
            throw new DOMException('Startup deadline exhausted', 'TimeoutError');
        signal.throwIfAborted();
        await Promise.race([prepare(), aborted]);
        phase = 'HTML headers';
        const documentUrl = new URL(url);
        await Promise.race([request(documentUrl, true), aborted]);
        signal.throwIfAborted();
        onValidated('html-validated');
        await Promise.race([request(new URL('src/library/workspace-entry.jsx', documentUrl), false), aborted]);
        signal.throwIfAborted();
        onValidated('entry-validated');
    }
    catch (cause) {
        // Only fixed phases and our validation messages reach the existing outward
        // protocol. Preserve transport details in cause without copying URLs or
        // credentials from arbitrary exception messages into operational output.
        let reason = '';
        let detail = cause;
        const knownCodes = ['ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT'];
        for (let depth = 0; depth < 3 && !reason; depth++) {
            const name = errorProperty(detail, 'name');
            const code = errorProperty(detail, 'code');
            if (name === 'TimeoutError')
                reason = 'timeout';
            else if (name === 'AbortError')
                reason = 'aborted';
            else if (typeof code === 'string' && knownCodes.includes(code))
                reason = code;
            detail = errorProperty(detail, 'cause');
        }
        throw new Error(`Workspace preflight failed during ${phase}${reason ? ` (${reason})` : ''}${validationMessage ? `: ${validationMessage}` : ''}`, { cause });
    }
    finally {
        if (abort)
            signal.removeEventListener('abort', abort);
    }
}
export function selectEphemeralPort(host = '127.0.0.1') {
    return new Promise((resolve, reject) => {
        const server = createServer();
        server.unref();
        server.once('error', reject);
        server.listen(0, host, () => {
            const address = server.address();
            if (!address || typeof address === 'string') {
                server.close();
                reject(new Error('Could not resolve an ephemeral TCP port'));
                return;
            }
            server.close((error) => {
                if (error)
                    reject(error);
                else
                    resolve(address.port);
            });
        });
    });
}
/** Startup-only daemon policy. Notebook config wins over the launch config. */
export function readConfiguredUsePaseoApp({ cwd = process.cwd(), notebookRoot = process.env.HYPERCANVAS_NOTEBOOK_ROOT, warn = console.warn } = {}) {
    const roots = [...new Set([notebookRoot, cwd].filter((root) => Boolean(root)).map((root) => resolve(root)))];
    for (const root of roots) {
        const file = resolveAppConfigPath(root);
        if (!existsSync(file))
            continue;
        let config;
        try {
            config = configRecord(JSON.parse(readFileSync(file, 'utf8')));
        }
        catch (error) {
            // macOS privacy protection can block individual files (EPERM/EACCES).
            // The value is optional startup policy — run with defaults instead of dying.
            if (isPermissionError(error)) {
                warn(`[hypercanvas] Skipping unreadable ${file} (${errorProperty(error, 'code')}); using default startup policy.`);
                continue;
            }
            throw new Error(`Could not read ${file}: ${describeReadFailure(error)}`, { cause: error });
        }
        const featureFlags = configRecord(config.featureFlags);
        const value = featureFlags.usePaseoApp;
        if (value === undefined)
            continue;
        if (typeof value !== 'boolean') {
            throw new Error(`Invalid featureFlags.usePaseoApp in ${file}: expected a boolean`);
        }
        return value;
    }
    return true;
}
/** Read the preferred proxy port from the active Notebook, then the launch root. */
export function readConfiguredInstanceProxyPort({ cwd = process.cwd(), notebookRoot = process.env.HYPERCANVAS_NOTEBOOK_ROOT, warn = console.warn } = {}) {
    const roots = [...new Set([notebookRoot, cwd].filter((root) => Boolean(root)).map((root) => resolve(root)))];
    for (const root of roots) {
        const file = resolveAppConfigPath(root);
        if (!existsSync(file))
            continue;
        let config;
        try {
            config = configRecord(JSON.parse(readFileSync(file, 'utf8')));
        }
        catch (error) {
            if (isPermissionError(error)) {
                warn(`[hypercanvas] Skipping unreadable ${file} (${errorProperty(error, 'code')}); using the default proxy port.`);
                continue;
            }
            throw new Error(`Could not read ${file}: ${describeReadFailure(error)}`, { cause: error });
        }
        const hypercanvas = configRecord(config.hypercanvas);
        const port = hypercanvas.proxyPort;
        if (port === undefined)
            continue;
        if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
            throw new Error(`Invalid hypercanvas.proxyPort in ${file}: expected an integer from 1 to 65535`);
        }
        return port;
    }
    return null;
}
/** Preferred instance-proxy port. Null disables the proxy (legacy behavior). */
export function resolveInstanceProxyPort(env = process.env, configuredPort = DEFAULT_INSTANCE_PORT) {
    if (env.HYPERCANVAS_INSTANCE_PROXY === '0')
        return null;
    const raw = env.HYPERCANVAS_PROXY_PORT;
    if (raw === undefined || raw === '')
        return configuredPort;
    const port = Number(raw);
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new Error(`Invalid HYPERCANVAS_PROXY_PORT: ${raw}`);
    }
    return port;
}
export function isAllowedRequestOrigin(headers, { desktop = false, allowForwardedHttpsOrigin = false } = {}) {
    const host = Array.isArray(headers.host) ? headers.host[0] : headers.host;
    const originHeader = Array.isArray(headers.origin) ? headers.origin[0] : headers.origin;
    if (!host)
        return false;
    let loopbackHost = false;
    try {
        const hostname = new URL(`http://${host}`).hostname;
        loopbackHost = hostname === '127.0.0.1' || hostname === 'localhost' || hostname.endsWith('.localhost');
    }
    catch {
        return false;
    }
    if (desktop && !allowForwardedHttpsOrigin && !loopbackHost)
        return false;
    if (!originHeader)
        return true;
    try {
        const origin = new URL(originHeader);
        if (origin.host !== host)
            return false;
        if (origin.protocol === 'http:')
            return loopbackHost || !desktop;
        return desktop && allowForwardedHttpsOrigin && origin.protocol === 'https:';
    }
    catch {
        return false;
    }
}
