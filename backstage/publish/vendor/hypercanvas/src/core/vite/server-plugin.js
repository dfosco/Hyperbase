/**
 * Storyboard Server Plugin — core dev-server infrastructure.
 *
 * Always-on Vite plugin that mounts a middleware backbone at `/_hypercanvas/`.
 * Reads `storyboard.config.json` for workshop features and plugin config.
 * Workshop API routes are wired directly; plugins register via the registry.
 *
 * Usage in vite.config.js:
 *   import storyboardServer from '@dfosco/hypercanvas/vite/server'
 *   storyboardServer()  // reads storyboard.config.json, no args needed
 */
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { legacySessionEnv as legacyEnv } from '../envCompat.js';
import http from 'node:http';
import { Buffer } from 'node:buffer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseJsonc } from 'jsonc-parser';
import { getConfig } from '../stores/configSchema.js';
import { resolveAppConfigPath, resolveConfigFileCandidates, resolveConfigFilePath } from '../configFile.js';
import { getServerWidgetDefinition, initServerWidgets } from '../canvas/customWidgets.js';
import { createDevLogger, setDevLogger } from '../logger/devLogger.js';
import { installReloadGuard } from './reload-guard.js';
import { serverFeatures as workshopFeatures } from '../workshop/features/registry-server.js';
import { docsHandler, collectFiles } from './docs-handler.js';
import { createCanvasHandler } from '../canvas/server.js';
import { setupSelectedWidgets } from '../canvas/selectedWidgets.js';
import { readAgentsConfig, readHotPoolConfig } from '../canvas/configReader.js';
import { HotPoolManager } from '../canvas/hot-pool.js';
import { setOnHotPoolConfigChange } from '../../internals/vite/data-plugin.js';
import { createAutosyncHandler } from '../autosync/server.js';
import { setupTerminalServer } from '../canvas/terminal-server.js';
import { getPaseoTerminalRuntime, initPaseoTerminalRuntime } from '../canvas/paseo-terminal-runtime.js';
import { listSessions, detachSession, killSession, orphanSession, bulkCleanup, getSessionStats, reconcileRegistry } from '../canvas/terminal-registry.js';
import { execSync as cpExecSync } from 'node:child_process';
import { list as listRunningServers, register as registerServer, unregister as unregisterServer, generateId as generateServerId, findByWorktree } from '../worktree/serverRegistry.js';
import { detectWorktreeName, listWorktrees, worktreeDir } from '../worktree/port.js';
import { desktopUrl, readDesktopStartupIdentity, encodeViteDesktopEvent, isAllowedRequestOrigin, preflightDesktopDocument } from '../cli/devContract.js';
import { initBus, subscribeAll } from '../messaging/bus.js';
import { JsonlAdapter } from '../messaging/storage/jsonl-adapter.js';
import { createMessagingRoutes } from '../messaging/routes.js';
import { createArtifactRoutes } from '../artifact/routes.js';
import { createPaseoAgentsHandler } from '../canvas/paseo-agents-routes.js';
import { disposePaseoAgentRuntime } from '../canvas/paseo-agent-runtime.js';
import { getPaseoConnectionState } from '../canvas/paseo-runtime-client.js';
import { confirmNotebookPaseoBinding, getNotebookPaseoBinding, invalidateNotebookPaseoBinding } from '../canvas/paseo-notebook-binding.js';
import { createFileHandler, validateNotebookPath } from '../file/server.js';
import { resolveNotebookPath, resolveNotebookRuntimePath } from '../notebook/runtime.js';
import { notebookContentPath } from '../notebook/layout.js';
import { prepareNotebookDependencies } from '../notebook/dependencies.node.js';
import { buildArtifactManifest, resolveManifestEnv } from '../data/artifactManifest.js';
import { readOptionalGitValue } from '../data/gitMetadata.js';
import { buildDataDiscovery } from '../../internals/vite/data-plugin.js';
import { createRouteSetup } from './api-router.js';
import { createHypercanvasService } from '../server/hypercanvas-service.js';
import { createApiGate } from './api-router.js';
import { createHostToolsHandler } from '../host-tools/server.js';
import { preflightHostTools } from '../host-tools/preflight.js';
import { createPublishingHandler } from '../notebook/publishing-routes.js';
import { createNotebookNavigationRoutes } from '../notebook/navigation-routes.js';
import { createSiteRoutes } from '../site/routes.js';
import { adaptPaseoTerminalRuntime } from '../site/runtime.js';
import { resolveSiteDevelopmentUrl } from '../site/contract.js';
import { createNotebookDependencySetup, runNotebookInstallInPaseo } from '../notebook/dependencySetup.js';
import { SiteStore } from '../site/site.js';
import { createFrameSnapshotCapture, closeFrameSnapshotBrowser } from '../canvas/frameSnapshotCapture.js';
import { createFrameSnapshotRoutes } from '../canvas/frameSnapshotRoutes.js';
import { createWorkspaceServiceRegistry, createWorkspaceServiceRoutes } from '../server/workspace-services.js';
import { createSystemRoutes } from '../system/routes.js';
import { createFilesystemGrants } from '../system/filesystem-grants.js';
import { createDiagnosticsHandler, readDesktopDiagnosticIncidents, readRecentDiagnosticLogs, redactDiagnosticText } from '../server/diagnostics.js';
import { createBrowserSession } from '../server/browser-session.js';
import { INTERNAL_RELAUNCH_PATH, INTERNAL_REGISTER_PATH } from '../server/instance-proxy.js';
import { createPaseoServerEnvironment, withoutRuntimeCredentials } from '../runtimeEnvironment.js';
/** Notebook runtime instances already wired to binding revalidation (Vite restarts re-run configureServer). */
const bindingHookedRuntimes = new WeakSet();
const notebookDependencySetups = new WeakMap();
/**
 * Send a JSON response.
 */
function sendJson(res, status, data) {
    if (!isApiResponse(res)) {
        throw new TypeError('Expected an HTTP response');
    }
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function createStoryboardSourceRuntime(runtime) {
    if (!runtime)
        return null;
    return {
        status() {
            const current = runtime.status();
            const manifestId = current.notebook?.status === 'valid' ? current.notebook.manifest?.id : undefined;
            return {
                active: current.active,
                root: current.root,
                generation: current.generation,
                notebook: typeof manifestId === 'string' ? { manifest: { id: manifestId } } : null,
            };
        },
    };
}
function isApiResponse(value) {
    return isRecord(value) && typeof value.writeHead === 'function' && typeof value.end === 'function';
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function decodeAgentPoolConfig(value) {
    if (!isRecord(value))
        return {};
    const result = {};
    for (const [agentId, candidate] of Object.entries(value)) {
        if (!isRecord(candidate))
            continue;
        const agent = {};
        if (typeof candidate.default === 'boolean')
            agent.default = candidate.default;
        if (typeof candidate.startupCommand === 'string')
            agent.startupCommand = candidate.startupCommand;
        result[agentId] = agent;
    }
    return result;
}
function adaptSiteWorkspaceScripts(value) {
    if (isWorkspaceScriptRuntime(value)) {
        return {
            startWorkspaceScriptWithStatus: async (workspaceId, scriptName) => {
                const result = await value.startWorkspaceScriptWithStatus(workspaceId, scriptName);
                if (!isRecord(result) || (typeof result.pid !== 'number' && result.pid !== null))
                    return {};
                return { pid: result.pid };
            },
            stopWorkspaceScript: async (workspaceId, scriptName) => value.stopWorkspaceScript(workspaceId, scriptName),
        };
    }
    return {
        startWorkspaceScriptWithStatus: async () => { throw new Error('Paseo workspace scripts are unavailable'); },
        stopWorkspaceScript: async () => { throw new Error('Paseo workspace scripts are unavailable'); },
    };
}
function isWorkspaceScriptRuntime(value) {
    return isRecord(value)
        && typeof value.startWorkspaceScriptWithStatus === 'function'
        && typeof value.stopWorkspaceScript === 'function';
}
function isHmrPayload(value) {
    if (!isRecord(value) || typeof value.type !== 'string')
        return false;
    switch (value.type) {
        case 'custom': return typeof value.event === 'string';
        case 'update': return Array.isArray(value.updates);
        case 'full-reload': return value.path === undefined || typeof value.path === 'string';
        case 'prune': return Array.isArray(value.paths);
        case 'error': return isRecord(value.err);
        case 'connected':
        case 'ping': return true;
        default: return false;
    }
}
/**
 * Create a logging wrapper around sendJson.
 * Reads per-request route context from res.__sbLogCtx (set by middleware).
 */
function createLoggedSendJson(logger) {
    return function sendJsonLogged(res, status, data) {
        sendJson(res, status, data);
        if (status >= 400 && logger) {
            const ctx = isApiResponse(res) ? res.__sbLogCtx || {} : {};
            const record = isRecord(data) ? data : {};
            logger.logResponse({
                status,
                method: ctx.method || 'UNKNOWN',
                url: ctx.url || '',
                route: ctx.route || null,
                subRoute: ctx.subRoute || null,
                error: typeof record.error === 'string' ? record.error : null,
            });
        }
    };
}
let wrapperBrowserSession = null;
const coreSessionSecretKey = Symbol.for('hypercanvas.coreSessionSecret.v1');
const CORE_VERSION = (() => {
    try {
        return JSON.parse(fs.readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')).version || 'unknown';
    }
    catch {
        return 'unknown';
    }
})();
function coreSessionSecret() {
    const inherited = Reflect.get(globalThis, coreSessionSecretKey);
    if (typeof inherited === 'string' && inherited)
        return inherited;
    const secret = process.env.HYPERCANVAS_CORE_SESSION_SECRET;
    if (typeof secret !== 'string' || !secret)
        return null;
    Reflect.defineProperty(globalThis, coreSessionSecretKey, { value: secret, configurable: true });
    // The persistent Core supervisor owns this value. Do not pass it onward to
    // Site, agent, or other processes launched by the replaceable Vite worker.
    delete process.env.HYPERCANVAS_CORE_SESSION_SECRET;
    return secret;
}
/**
 * Read the application config from the project root and apply defaults
 * (primary `hypercanvas.config.json`, legacy fallback).
 */
function readConfig(root) {
    const configPath = resolveAppConfigPath(root);
    if (!fs.existsSync(configPath))
        return getConfig({});
    try {
        const raw = fs.readFileSync(configPath, 'utf-8');
        return getConfig(parseJsonc(raw) || {});
    }
    catch {
        return getConfig({});
    }
}
/**
 * Core storyboard server Vite plugin.
 */
// A Vite configuration owns its listeners and services for one HTTP generation.
export function createServerGenerationLifecycle(httpServer, processEvents = process) {
    let closed = false;
    const cancellation = new AbortController();
    const callbacks = [];
    const listeners = [];
    httpServer?.once('close', () => {
        closed = true;
        cancellation.abort();
        for (const { event, callback } of listeners.splice(0))
            processEvents.removeListener(event, callback);
        for (const callback of callbacks.splice(0))
            callback();
    });
    return {
        onClose(callback) {
            if (closed)
                callback();
            else
                callbacks.push(callback);
        },
        onProcess(event, callback) {
            if (closed)
                return;
            processEvents.on(event, callback);
            listeners.push({ event, callback });
        },
        get closed() { return closed; },
        signal: cancellation.signal,
    };
}
export async function completeServerGenerationRegistration({ generation, registerUpstreams, proxyRequired, prepare, ready, register, registrationFailed, }) {
    const registered = await registerUpstreams();
    if (generation.closed)
        return;
    if (proxyRequired && !registered) {
        registrationFailed();
        return;
    }
    await prepare();
    if (generation.closed)
        return;
    ready();
    register();
}
export default function storyboardServer({ notebookRuntime = null } = {}) {
    let root = '';
    let configRoot = '';
    let base = '/';
    let config = getConfig({});
    let isDev = false;
    // Route handler registry — plugins register here during setup
    const routeHandlers = new Map();
    const workspaceServices = createWorkspaceServiceRegistry();
    const filesystemGrants = createFilesystemGrants();
    const clientScripts = [];
    const wrapperMode = process.env.HYPERCANVAS_WRAPPER === '1';
    const browserSession = wrapperMode
        ? (wrapperBrowserSession ||= createBrowserSession({
            required: true,
            launchToken: process.env.HYPERCANVAS_LAUNCH_TOKEN || null,
            sessionSecret: coreSessionSecret(),
        }))
        : createBrowserSession();
    let browserSessionHandoffEnabled = false;
    const browserCoreMode = wrapperMode || Boolean(process.env.HYPERCANVAS_APP_STATE_DIR);
    if (wrapperMode)
        delete process.env.HYPERCANVAS_LAUNCH_TOKEN;
    // Load packaged favicon once and cache as data URI so every consumer
    // gets the storyboard brand favicon without shipping/copying any asset.
    let faviconDataUri = '';
    try {
        const faviconPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../assets/favicon.svg');
        const svg = fs.readFileSync(faviconPath, 'utf8');
        faviconDataUri = 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64');
    }
    catch { /* favicon missing — skip injection */ }
    return {
        name: 'storyboard-server',
        config() {
            return {
                optimizeDeps: {
                    include: [
                        'highlight.js/lib/core',
                        'highlight.js/lib/languages/javascript',
                        'highlight.js/lib/languages/typescript',
                        'highlight.js/lib/languages/xml',
                    ],
                },
                server: {
                    watch: {
                        // Never feed runtime-state directories to Vite's file watcher.
                        // These dirs are written to on sub-second cadence by terminals,
                        // canvas snapshots, agent state, etc. Letting them reach the
                        // watcher produces full-reload loops on any unguarded route.
                        // (server.watcher.unwatch() after the fact isn't enough — new
                        // files inside the dirs can still be re-added by chokidar.)
                        ignored: [
                            '**/.hypercanvas/**', '**/.storyboard/**',
                            '**/assets/canvas/images/**',
                            '**/assets/canvas/snapshots/**',
                            '**/assets/.hypercanvas-public/**', '**/assets/.storyboard-public/**',
                            '**/backstage/assets/canvas/images/**',
                            '**/backstage/assets/canvas/snapshots/**',
                            '**/backstage/assets/.hypercanvas-public/**', '**/backstage/assets/.storyboard-public/**',
                            // Generated GitHub Pages project: rewritten wholesale on every publish setup.
                            '**/backstage/publish/**',
                            '**/packages/mygo/.mygo/**',
                        ],
                    },
                },
            };
        },
        configResolved(viteConfig) {
            root = viteConfig.root;
            base = viteConfig.base || '/';
            configRoot = notebookRuntime?.status().root || root;
            config = readConfig(configRoot);
            browserSessionHandoffEnabled = wrapperMode && config.featureFlags?.browserSessionHandoff === true;
            browserSession.setRequired(browserSessionHandoffEnabled);
            isDev = viteConfig.command === 'serve';
            // Seed the server-side custom-widget registry from the consumer's
            // `storyboard.config.json.widgets` block. Consumer entries override
            // built-in widget metadata for collision detection, default sizes,
            // prompt-exec config, etc. Server-side does not load React components
            // — those are seeded in the browser via `mountStoryboardCore({ widgets })`.
            try {
                let widgetConfig = {};
                try {
                    const rawWidgets = fs.readFileSync(resolveConfigFilePath(configRoot, 'widgets.config.json'), 'utf8');
                    const parsed = parseJsonc(rawWidgets);
                    widgetConfig = isRecord(parsed) ? parsed : {};
                }
                catch { /* the package baseline remains the fallback */ }
                const customWidgets = isRecord(widgetConfig.widgets) ? widgetConfig.widgets : {};
                initServerWidgets({
                    ...(config?.widgets || {}),
                    ...customWidgets,
                });
            }
            catch (err) {
                console.warn('[storyboard] Failed to init custom widget registry:', errorMessage(err));
            }
        },
        configureServer(server) {
            const generation = createServerGenerationLifecycle(server.httpServer);
            const desktop = (process.env.HYPERCANVAS_DESKTOP ?? legacyEnv('STORYBOARD_DESKTOP')) === '1';
            const identity = desktop ? readDesktopStartupIdentity() : null;
            const generationDetails = identity ? { ...identity, generationId: randomBytes(16).toString('hex') } : {};
            const progress = (milestone) => {
                if (identity && (!generation.closed || milestone === 'generation-retired')) {
                    process.stdout.write(`${encodeViteDesktopEvent('operation-progress', { ...generationDetails, milestone })}\n`);
                }
            };
            progress('generation-started');
            generation.onClose(() => progress('generation-retired'));
            // Keep prototype serving in Vite, but host the Hypercanvas API on a
            // separate local HTTP server. The route map remains shared during this
            // migration so all existing route initialization stays in one place.
            let hypercanvasServer = null;
            let siteRoutes = null;
            server.__hypercanvasFilesystemGrants = filesystemGrants;
            server.middlewares.use(browserSession.bootstrapMiddleware({ base }));
            const requireNotebookRoot = () => notebookRuntime
                ? notebookRuntime.requireNotebookRoot()
                : configRoot;
            // Startup with no active Notebook (never opened, or the selected
            // folder was removed/renamed) must not abort the server: the SPA
            // boots and shows the blocking Notebook switcher instead. Bind
            // startup services to the config root; opening a Notebook restarts
            // the server, which re-runs this hook and rebinds to the real root.
            // Per-request handlers below still use requireNotebookRoot() so they
            // fail cleanly while no Notebook is active.
            const notebookRoot = notebookRuntime?.status().active
                ? requireNotebookRoot()
                : configRoot;
            const externalServerUrl = process.env.HYPERCANVAS_SERVER_URL || null;
            const standaloneEnabled = (process.env.HYPERCANVAS_STANDALONE_SERVER ?? legacyEnv('STORYBOARD_STANDALONE_SERVER')) !== '0' && !externalServerUrl;
            // Every session feature gates on a verified Notebook→Paseo binding: a
            // daemon server identity plus a workspace opened for this root on that
            // server. Failures are recorded by the binding module and surfaced in
            // diagnostics + recovery guidance instead of being swallowed.
            let notebookDependencySetup = null;
            let ptyRuntimeReady = Promise.resolve(null);
            const resolveWorkspaceForRoot = async (directory) => {
                if (notebookDependencySetup) {
                    const runtime = await ptyRuntimeReady;
                    if (runtime)
                        await notebookDependencySetup.wait(directory);
                }
                const confirmed = await confirmNotebookPaseoBinding(directory);
                if (typeof confirmed.workspaceId !== 'string' || !confirmed.workspaceId) {
                    throw new Error('Paseo did not confirm a workspace for this Notebook');
                }
                return confirmed.workspaceId;
            };
            const resolvePaseoWorkspaceId = async () => {
                if (notebookRuntime && !notebookRuntime.status().active) {
                    throw new Error('No active Notebook is available for Paseo workspace registration');
                }
                return resolveWorkspaceForRoot(requireNotebookRoot());
            };
            // Notebook switches revalidate the binding: the cached workspace belongs
            // to the previous Notebook root, so drop it and re-confirm for the new
            // one. Hook once per runtime instance — Vite restarts re-run this hook.
            if (typeof notebookRuntime?.subscribe === 'function' && !bindingHookedRuntimes.has(notebookRuntime)) {
                bindingHookedRuntimes.add(notebookRuntime);
                notebookRuntime.subscribe(({ current }) => {
                    invalidateNotebookPaseoBinding();
                    if (current) {
                        void ptyRuntimeReady.then(async (ptyRuntime) => {
                            if (!ptyRuntime || !notebookDependencySetup)
                                return;
                            await notebookDependencySetup.ensure(current.root);
                            return resolveWorkspaceForRoot(current.root);
                        }).catch((error) => {
                            console.warn(`[storyboard] Paseo workspace registration failed: ${error.message}`);
                        });
                    }
                });
            }
            const sendEvent = (payload) => {
                // Hypercanvas events use its own channel; Vite remains responsible
                // only for source-module HMR and Fast Refresh messages.
                if (isHmrPayload(payload) && !(payload.type === 'custom' && payload.event.startsWith('storyboard:'))) {
                    server.ws.send(payload);
                }
                hypercanvasServer?.broadcast(payload);
            };
            let apiRegistrationPromise = Promise.resolve(true);
            if (standaloneEnabled) {
                const activeHypercanvasServer = createHypercanvasService({
                    base,
                    routeHandlers,
                    eventSender: sendEvent,
                    authorizeRequest: browserSession.isAuthenticated,
                    authorizeWebSocket: browserSession.authorizeWebSocket,
                });
                hypercanvasServer = activeHypercanvasServer;
                apiRegistrationPromise = activeHypercanvasServer.listen(0, '127.0.0.1').then(() => {
                    const address = activeHypercanvasServer.server.address();
                    if (typeof address !== 'object' || !address)
                        return false;
                    void resolvePaseoWorkspaceId().then((workspaceId) => {
                        if (workspaceId) {
                            workspaceServices.register({ workspaceId, serviceName: 'hypercanvas', url: `http://127.0.0.1:${address.port}` });
                        }
                    }).catch((error) => {
                        console.warn(`[storyboard] Paseo workspace registration failed: ${error.message}`);
                    });
                    return postUpstreamRegistration({ apiPort: address.port, apiWsPath: activeHypercanvasServer.socketPath });
                }).catch((error) => {
                    console.warn(`[storyboard] Standalone Hypercanvas server unavailable; using Vite API fallback: ${error.message}`);
                    return false;
                });
                generation.onClose(() => { void hypercanvasServer?.close().catch(() => { }); void closeFrameSnapshotBrowser(); });
            }
            server.httpServer?.once('listening', async () => {
                const workspaceId = await resolvePaseoWorkspaceId().catch((error) => {
                    console.warn(`[storyboard] Paseo workspace registration failed: ${error.message}`);
                    return null;
                });
                const address = server.httpServer?.address();
                if (workspaceId && typeof address === 'object' && address) {
                    workspaceServices.register({ workspaceId, serviceName: 'prototype', url: `http://127.0.0.1:${address.port}${base}` });
                }
            });
            // --- Single-instance proxy registration (ADR-007) -------------------------
            // The Core supervisor claims its selected proxy port before spawning
            // this Vite child and passes its origin via HYPERCANVAS_PROXY_URL. Register
            // the dynamic backend ports here so the proxy can forward HTTP and
            // WebSocket upgrades; without the proxy env the helpers below no-op.
            const proxyOrigin = (process.env.HYPERCANVAS_PROXY_URL || '').replace(/\/$/, '');
            const proxyPort = (() => {
                try {
                    const proxyUrl = process.env.HYPERCANVAS_PROXY_URL;
                    if (!proxyUrl)
                        return null;
                    const parsed = Number(new URL(proxyUrl).port);
                    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
                }
                catch {
                    return null;
                }
            })();
            const proxyFallbackOrigin = proxyPort ? `http://127.0.0.1:${proxyPort}` : null;
            const notebookInfoPayload = () => {
                try {
                    const status = notebookRuntime?.status?.();
                    if (!status?.active)
                        return null;
                    return { title: status.notebook?.manifest?.title || null, root: status.root || null };
                }
                catch {
                    return null;
                }
            };
            const postUpstreamRegistration = (payload) => {
                if (!proxyPort)
                    return Promise.resolve(true);
                const body = JSON.stringify(payload);
                return new Promise((resolve) => {
                    let settled = false;
                    const finish = (success) => {
                        if (settled)
                            return;
                        settled = true;
                        resolve(success);
                    };
                    const request = http.request({
                        host: '127.0.0.1',
                        port: proxyPort,
                        path: INTERNAL_REGISTER_PATH,
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(body),
                            ...(process.env.HYPERCANVAS_PROXY_REGISTRATION_TOKEN
                                ? { Authorization: `Bearer ${process.env.HYPERCANVAS_PROXY_REGISTRATION_TOKEN}` }
                                : {}),
                        },
                        timeout: 2000,
                    }, (response) => {
                        response.resume();
                        response.once('end', () => finish(response.statusCode === 200));
                    });
                    request.once('timeout', () => request.destroy(new Error('Proxy registration timed out')));
                    request.once('error', () => finish(false));
                    request.end(body);
                });
            };
            // --- Custom URL printer ----------------------------------------------------
            // Vite calls server.printUrls() after its "ready in Xms" banner.
            // Override to suppress Vite's default "➜ Local:" block and let the
            // CLI render our own URL (and mascot) instead. Suppression is opt-in
            // via STORYBOARD_QUIET_VITE=1 — we set this from hypercanvas dev.js
            // when --verbose is OFF.
            if ((process.env.HYPERCANVAS_QUIET_VITE ?? legacyEnv('STORYBOARD_QUIET_VITE')) === '1') {
                const originalPrintUrls = server.printUrls?.bind(server);
                server.printUrls = () => {
                    // No-op: caller renders its own URL + mascot.
                    void originalPrintUrls;
                };
            }
            // The per-client document-reload policy leaves Vite module updates
            // available for React Fast Refresh.
            installReloadGuard(server);
            // Initialize dev logger for structured o11y logging
            const currentBranch = readOptionalGitValue(root, ['branch', '--show-current']);
            const logVerbose = config.featureFlags?.['dev-logs'] === true;
            const devDomain = config.repository?.name || null;
            const devLogger = createDevLogger({ root: notebookRoot, devDomain, branch: currentBranch, verbose: logVerbose });
            setDevLogger(devLogger); // make available to all server-side modules via devLog()
            const sendJsonLogged = createLoggedSendJson(devLogger);
            routeHandlers.set('workspace-services', createWorkspaceServiceRoutes({ registry: workspaceServices, sendJson: sendJsonLogged }));
            if ((process.env.HYPERCANVAS_DESKTOP ?? legacyEnv('STORYBOARD_DESKTOP')) === '1') {
                routeHandlers.set('desktop-ready', async (req, res, ctx) => {
                    if (ctx.method !== 'POST')
                        return sendJsonLogged(res, 405, { error: 'Method not allowed' });
                    if (ctx.body.mounted !== true)
                        return sendJsonLogged(res, 400, { error: 'Client is not mounted' });
                    const marker = process.env.HYPERCANVAS_SMOKE_RENDER_MARKER;
                    if (marker)
                        fs.writeFileSync(marker, `${JSON.stringify({ mounted: true, pid: process.pid })}\n`);
                    sendJsonLogged(res, 200, { ready: true });
                });
            }
            // Start or reconnect to the detached per-project PTY broker. Terminal
            // routes stay mounted when startup fails so clients receive diagnostics
            // instead of taking down unrelated Storyboard behavior.
            const notebookHasActiveRoot = !notebookRuntime || notebookRuntime.status().active;
            let ptyRuntimeFailure = null;
            let ptyRuntimeStatus = {
                engine: 'paseo',
                connected: false,
                status: (process.env.HYPERCANVAS_DISABLE_PTY_RUNTIME ?? legacyEnv('STORYBOARD_DISABLE_PTY_RUNTIME')) === '1' ? 'disabled' : 'starting',
            };
            ptyRuntimeReady = (process.env.HYPERCANVAS_DISABLE_PTY_RUNTIME ?? legacyEnv('STORYBOARD_DISABLE_PTY_RUNTIME')) === '1' || !notebookHasActiveRoot
                ? Promise.resolve(null)
                : initPaseoTerminalRuntime(notebookRoot).then(async (runtime) => {
                    const health = await runtime.health();
                    ptyRuntimeStatus = {
                        engine: 'paseo',
                        connected: health.connected === true,
                        status: typeof health.state?.status === 'string' ? health.state.status : 'unknown',
                    };
                    devLogger.logEvent('info', 'Hypercanvas PTY runtime ready', {
                        engine: health.engine,
                        connected: health.connected,
                        connectionState: health.state?.status || 'unknown',
                        recoveryState: health.recoveryState || 'unknown',
                        lastError: health.lastError || null,
                        serverId: isRecord(health.server) && typeof health.server.serverId === 'string' ? health.server.serverId : null,
                        serverVersion: isRecord(health.server) && typeof health.server.version === 'string' ? health.server.version : null,
                    });
                    return runtime;
                }).catch((err) => {
                    ptyRuntimeFailure = { code: isRecord(err) && typeof err.code === 'string' ? err.code : 'PTY_RUNTIME_ERROR', message: errorMessage(err) };
                    ptyRuntimeStatus = { engine: 'paseo', connected: false, status: 'error' };
                    devLogger.logEvent('error', 'Hypercanvas PTY runtime unavailable', {
                        error: errorMessage(err),
                        code: isRecord(err) && typeof err.code === 'string' ? err.code : null,
                    });
                    return null;
                });
            if (notebookRuntime) {
                let dependencyContext = notebookDependencySetups.get(notebookRuntime);
                if (!dependencyContext) {
                    dependencyContext = {
                        setup: createNotebookDependencySetup({
                            launch: (root, sessionId) => runNotebookInstallInPaseo(getPaseoTerminalRuntime(), root, sessionId),
                            onFailure: details => dependencyContext?.reportFailure?.(details),
                        }),
                    };
                    notebookDependencySetups.set(notebookRuntime, dependencyContext);
                }
                dependencyContext.reportFailure = ({ root, error, output }) => {
                    devLogger.logEvent('error', 'Notebook dependency installation failed', {
                        root,
                        error: error.message,
                        terminalOutput: output,
                        action: 'Review the background Paseo terminal output, fix the package or registry issue, then restart Core to retry.',
                    });
                };
                notebookDependencySetup = dependencyContext.setup;
                const activeRoot = notebookRuntime.status().root;
                if (activeRoot) {
                    void ptyRuntimeReady.then(async (ptyRuntime) => {
                        if (ptyRuntime)
                            await notebookDependencySetup?.ensure(activeRoot);
                    }).catch(() => { });
                }
            }
            // Listen for browser-side console errors forwarded via HMR
            server.hot.on('storyboard:client-error', (data) => {
                const text = (value) => value == null ? null : redactDiagnosticText(value).slice(0, 2000);
                devLogger.logEvent(data.level === 'warn' ? 'warn' : 'error', text(data.message) || 'Unknown browser error', {
                    source: 'browser',
                    url: text(data.url),
                    line: data.line || null,
                    col: data.col || null,
                    stack: text(data.stack),
                    route: text(typeof data.route === 'string' ? data.route.split(/[?#]/, 1)[0] : null),
                });
            });
            const workshopConfig = config.workshop || {};
            const enabledFeatures = workshopConfig.features || {};
            const workshopSetupConfig = Array.isArray(workshopConfig.partials)
                ? { partials: workshopConfig.partials }
                : {};
            // Wire workshop API routes — compose handlers from all enabled features
            const workshopHandlers = [];
            for (const [featureName, featureModule] of Object.entries(workshopFeatures)) {
                if (enabledFeatures[featureName] === false)
                    continue;
                if (featureModule.serverSetup) {
                    workshopHandlers.push(featureModule.serverSetup({ root: notebookRoot, sendJson: sendJsonLogged, workshopConfig: workshopSetupConfig }));
                }
            }
            if (workshopHandlers.length > 0) {
                routeHandlers.set('workshop', async (req, res, ctx) => {
                    for (const handler of workshopHandlers) {
                        await handler(req, res, { body: ctx.body, path: ctx.path, method: ctx.method });
                        if (res.writableEnded)
                            return;
                    }
                    sendJsonLogged(res, 404, { error: `Unknown workshop route: ${ctx.method} ${ctx.path}` });
                });
            }
            // Wire docs API routes (always enabled — serves README + source files)
            routeHandlers.set('docs', docsHandler({ root, sendJson: sendJsonLogged }));
            // Create shared hot pool manager (per-type pre-warmed sessions)
            const hotPoolConfig = readHotPoolConfig(notebookRoot, root);
            const agentsConfig = decodeAgentPoolConfig(readAgentsConfig(notebookRoot, root));
            const wsSend = (event) => sendEvent(event);
            const execution = getServerWidgetDefinition('prompt')?.execution;
            const promptConfig = isRecord(execution) ? execution.default : undefined;
            const promptAgentId = typeof promptConfig === 'string' ? promptConfig : null;
            const hotPool = new HotPoolManager({
                root: notebookRoot,
                config: hotPoolConfig,
                agentsConfig,
                promptAgentId,
                wsSend,
                workspaceIdResolver: async () => (await resolvePaseoWorkspaceId()) ?? null,
            });
            ptyRuntimeReady.then((runtime) => {
                if (!runtime)
                    return;
                hotPool.start().catch((err) => {
                    devLogger.logEvent('error', 'Hot pool failed to start', { error: err.message });
                });
            });
            // Reconfigure hot pool when settings dialog saves hotPool.* changes
            setOnHotPoolConfigChange(() => {
                hotPool.reconfigure(readHotPoolConfig(notebookRoot, root));
            });
            // Warm, unassigned sessions are disposable. Widget-owned broker sessions
            // deliberately survive ordinary Vite shutdown and reconnect on restart.
            const shutdownPool = () => { hotPool.stop(); };
            const shutdownDesktopRuntime = async () => {
                await siteRoutes?.close().catch(() => { });
                if ((process.env.HYPERCANVAS_DESKTOP ?? legacyEnv('STORYBOARD_DESKTOP')) !== '1')
                    return;
                await ptyRuntimeReady.then((runtime) => runtime?.shutdown()).catch(() => { });
            };
            generation.onProcess('SIGINT', shutdownPool);
            generation.onProcess('SIGTERM', shutdownPool);
            generation.onClose(shutdownPool);
            generation.onClose(disposePaseoAgentRuntime);
            generation.onClose(shutdownDesktopRuntime);
            // Canvas content belongs to the active Notebook, while the rest of this
            // server remains rooted in the immutable application shell. Resolve the
            // handler per root so switching does not leave CRUD pointed at the demo.
            const canvasHandlers = new Map();
            routeHandlers.set('canvas', async (...args) => {
                const notebookRoot = requireNotebookRoot();
                if (!canvasHandlers.has(notebookRoot)) {
                    canvasHandlers.set(notebookRoot, createCanvasHandler({
                        root: notebookRoot,
                        sendJson: sendJsonLogged,
                        resolveCanvasSourceExports: async (canvasFilePath, jsxReference) => {
                            const modulePath = path.resolve(path.dirname(canvasFilePath), jsxReference);
                            const relativePath = path.relative(notebookRoot, modulePath);
                            if (relativePath.startsWith('..') || path.isAbsolute(relativePath))
                                return null;
                            try {
                                const loaded = await server.ssrLoadModule(modulePath);
                                return Object.entries(loaded)
                                    .filter(([name, value]) => name !== 'default' && typeof value === 'function')
                                    .map(([name]) => name);
                            }
                            catch {
                                return null;
                            }
                        },
                        hotPool,
                        workspaceIdResolver: () => resolvePaseoWorkspaceId(),
                    }));
                }
                return canvasHandlers.get(notebookRoot)(...args);
            });
            // Selected widgets bridge — writes .selectedwidgets.json for Copilot context
            setupSelectedWidgets(server, notebookRoot);
            // Terminal WebSocket server — PTY backend for terminal canvas widgets
            if (server.httpServer && notebookHasActiveRoot) {
                const terminalHttpServer = server.httpServer;
                const branch = readOptionalGitValue(root, ['branch', '--show-current']) || 'unknown';
                setupTerminalServer(terminalHttpServer, base, branch, hotPool, ptyRuntimeReady, notebookRoot, () => resolvePaseoWorkspaceId());
                ptyRuntimeReady.then((runtime) => runtime && reconcileRegistry()).catch(() => { });
            }
            // Self-register in .storyboard/servers.json so sibling workflows
            // (cli helpers, BranchBar, agent terminals) can discover this Vite.
            // Registration happens once the HTTP server is actually listening so
            // the recorded port is the real one (handles strictPort fallbacks).
            if (server.httpServer) {
                const viteHttpServer = server.httpServer;
                const serverId = generateServerId();
                const worktreeName = detectWorktreeName();
                const onListening = async () => {
                    try {
                        const addr = viteHttpServer.address();
                        const port = typeof addr === 'object' && addr ? addr.port : null;
                        if (port) {
                            const host = (process.env.HYPERCANVAS_DESKTOP_HOST ?? legacyEnv('STORYBOARD_DESKTOP_HOST')) || '127.0.0.1';
                            const browserOrigin = `http://${host}:${port}`;
                            browserSession.registerBrowserOrigin(browserOrigin);
                            filesystemGrants.registerBrowserOrigin(browserOrigin);
                            if (proxyOrigin) {
                                browserSession.registerBrowserOrigin(proxyOrigin);
                                filesystemGrants.registerBrowserOrigin(proxyOrigin);
                            }
                            if (proxyFallbackOrigin) {
                                // Safari fallback for installations where *.localhost does
                                // not resolve as expected. It shares the proxy listener, so
                                // browser sessions and picker grants must trust this origin.
                                browserSession.registerBrowserOrigin(proxyFallbackOrigin);
                                filesystemGrants.registerBrowserOrigin(proxyFallbackOrigin);
                            }
                            // Register the address Vite actually bound (it may be IPv6
                            // ::1 when launched with --host localhost) so the proxy dials
                            // a reachable upstream instead of assuming IPv4 loopback.
                            const boundAddress = typeof addr === 'object' && addr && typeof addr.address === 'string'
                                ? addr.address
                                : '127.0.0.1';
                            const viteHost = boundAddress === '::' || boundAddress === '0.0.0.0' ? '127.0.0.1' : boundAddress;
                            await apiRegistrationPromise;
                            if (generation.closed)
                                return;
                            const activeHypercanvasServer = hypercanvasServer;
                            const apiAddress = activeHypercanvasServer?.server.address();
                            await completeServerGenerationRegistration({
                                generation,
                                registerUpstreams: () => postUpstreamRegistration({
                                    vitePort: port,
                                    viteHost,
                                    ...(typeof apiAddress === 'object' && apiAddress && activeHypercanvasServer
                                        ? { apiPort: apiAddress.port, apiWsPath: activeHypercanvasServer.socketPath }
                                        : {}),
                                    notebook: notebookInfoPayload(),
                                }),
                                proxyRequired: Boolean(proxyPort),
                                registrationFailed: () => {
                                    const message = 'Could not register Core with the Hypercanvas instance proxy';
                                    if ((process.env.HYPERCANVAS_DESKTOP ?? legacyEnv('STORYBOARD_DESKTOP')) === '1') {
                                        process.stdout.write(`${encodeViteDesktopEvent('error', { ...generationDetails, message })}\n`);
                                    }
                                    else
                                        console.error(`[storyboard] ${message}`);
                                },
                                prepare: async () => {
                                    if ((process.env.HYPERCANVAS_DESKTOP ?? legacyEnv('STORYBOARD_DESKTOP')) !== '1')
                                        return;
                                    progress('upstreams-registered');
                                    const viteBase = server.config.base || '/';
                                    const url = proxyOrigin ? `${proxyOrigin}${viteBase === '/' ? '/' : viteBase}` : desktopUrl(host, port, viteBase);
                                    await preflightDesktopDocument(url, { timeoutMs: null, signal: generation.signal, prepare: () => prepareNotebookDependencies(server, progress), onValidated: progress });
                                },
                                ready: () => {
                                    if ((process.env.HYPERCANVAS_DESKTOP ?? legacyEnv('STORYBOARD_DESKTOP')) !== '1')
                                        return;
                                    const viteBase = server.config.base || '/';
                                    const url = proxyOrigin ? `${proxyOrigin}${viteBase === '/' ? '/' : viteBase}` : desktopUrl(host, port, viteBase);
                                    process.stdout.write(`${encodeViteDesktopEvent('ready', {
                                        ...generationDetails,
                                        url,
                                        pid: process.pid,
                                        port,
                                        apiPort: typeof apiAddress === 'object' && apiAddress ? apiAddress.port : null,
                                        proxyPort,
                                        version: CORE_VERSION,
                                        nodePath: process.execPath,
                                        nodeVersion: process.version,
                                    })}\n`);
                                },
                                register: () => {
                                    // Discovery metadata must not invalidate document readiness.
                                    try {
                                        registerServer({ id: serverId, worktree: worktreeName, pid: process.pid, port }, root);
                                    }
                                    catch { /* best effort */ }
                                },
                            });
                        }
                    }
                    catch (error) {
                        if (generation.closed)
                            return;
                        if (proxyPort || (process.env.HYPERCANVAS_DESKTOP ?? legacyEnv('STORYBOARD_DESKTOP')) === '1') {
                            const message = `Could not prepare Core startup: ${errorMessage(error)}`;
                            if ((process.env.HYPERCANVAS_DESKTOP ?? legacyEnv('STORYBOARD_DESKTOP')) === '1') {
                                process.stdout.write(`${encodeViteDesktopEvent('error', { ...generationDetails, message })}\n`);
                            }
                            else {
                                console.error(`[storyboard] ${message}`);
                            }
                        }
                    }
                };
                if (server.httpServer.listening)
                    onListening();
                else
                    server.httpServer.once('listening', onListening);
                const unregister = () => {
                    try {
                        unregisterServer(serverId, root);
                    }
                    catch { /* */ }
                };
                generation.onClose(unregister);
                generation.onProcess('SIGINT', unregister);
                generation.onProcess('SIGTERM', unregister);
                generation.onProcess('exit', unregister);
            }
            // Ignore assets/canvas/ so image/snapshot writes don't trigger reloads
            server.watcher.unwatch(notebookContentPath(notebookRoot, 'assets', 'canvas', 'images'));
            server.watcher.unwatch(notebookContentPath(notebookRoot, 'assets', 'canvas', 'snapshots'));
            server.watcher.unwatch(notebookContentPath(notebookRoot, 'assets', '.storyboard-public', 'terminal-snapshots'));
            server.watcher.unwatch(notebookContentPath(notebookRoot, 'assets', '.hypercanvas-public', 'terminal-snapshots'));
            // The entire `.storyboard/` directory is gitignored runtime state
            // (terminal buffers + snapshots, bus messages, selectedwidgets,
            // logs, server registry). None of it should ever feed Vite's
            // watcher — active terminals especially write here on a sub-second
            // cadence, which previously produced full-reload loops on any
            // route without the canvas/prototype HMR guard.
            server.watcher.unwatch(path.join(notebookRoot, '.storyboard'));
            server.watcher.unwatch(path.join(notebookRoot, '.hypercanvas'));
            // Wire autosync API routes (always enabled — git automation for dev)
            routeHandlers.set('autosync', createAutosyncHandler({ root: notebookRoot, sendJson: sendJsonLogged }));
            // Wire messaging bus (shared event log for multi-agent communication)
            const messagingAdapter = new JsonlAdapter({ root: notebookRoot });
            messagingAdapter.initSync();
            initBus(messagingAdapter);
            const messagingRoutes = createMessagingRoutes({
                sendJson: sendJsonLogged,
                getSquadContext: async () => {
                    const root = requireNotebookRoot();
                    if (notebookRuntime && !notebookRuntime.status().active) {
                        throw new Error('No active Notebook is available for Squad operations');
                    }
                    const binding = await confirmNotebookPaseoBinding(root);
                    if (typeof binding.workspaceId !== 'string' || typeof binding.serverId !== 'string') {
                        throw new Error('Paseo did not confirm a daemon and workspace for this Notebook');
                    }
                    return { root, workspaceId: binding.workspaceId, daemonId: binding.serverId };
                },
                getSquadDeliveryOptions: async (_input) => {
                    const [{ submitTerminalText }, { findSessionIdForWidget }, { isManagedTerminalReady }] = await Promise.all([
                        import('../canvas/terminal-runtime.js'),
                        import('../canvas/terminal-registry.js'),
                        import('../canvas/live-terminal-coding-target.js'),
                    ]);
                    return {
                        submitTerminalText: (sessionId, text, options) => submitTerminalText(sessionId, text, options),
                        sessionFor: async (widgetId) => findSessionIdForWidget(widgetId),
                        isReady: (sessionId) => isManagedTerminalReady(requireNotebookRoot(), sessionId),
                        sendAgentMessage: async (agentId, text) => {
                            const { getPaseoAgentRuntime } = await import('../canvas/paseo-agent-runtime.js');
                            const runtime = await getPaseoAgentRuntime({ root: requireNotebookRoot() });
                            if (!runtime)
                                throw new Error('Paseo agent delivery is unavailable');
                            return runtime.sendMessage(agentId, text);
                        },
                    };
                },
            });
            routeHandlers.set('messages', (req, res, ctx) => messagingRoutes(req, res, {
                method: ctx.method,
                path: ctx.path,
                body: ctx.body,
            }));
            // Paseo agent chat API — same-origin proxy to the Paseo daemon.
            // Daemon credentials stay server-side; events forward via HMR custom event.
            const paseoAgentRoutes = createPaseoAgentsHandler({
                root: notebookRoot,
                sendJson: sendJsonLogged,
                wsSend,
                workspaceIdResolver: async () => {
                    if (notebookRuntime && !notebookRuntime.status().active) {
                        throw new Error('No active Notebook is available for Paseo workspace registration');
                    }
                    return resolveWorkspaceForRoot(requireNotebookRoot());
                },
            });
            routeHandlers.set('paseo-agents', (req, res, ctx) => paseoAgentRoutes({}, res, { body: ctx.body, path: ctx.path, method: ctx.method }));
            // File Widget API — read/write/list repo files
            const fileHandlers = new Map();
            routeHandlers.set('file', async (...args) => {
                const notebookRoot = requireNotebookRoot();
                const key = `notebook:${notebookRoot}`;
                if (!fileHandlers.has(key)) {
                    fileHandlers.set(key, createFileHandler({
                        root: notebookRoot,
                        sendJson: sendJsonLogged,
                        validatePath: validateNotebookPath,
                    }));
                }
                return fileHandlers.get(key)(...args);
            });
            // Notebook export and managed publishing API.
            routeHandlers.set('publishing', createPublishingHandler({
                root: notebookRoot,
                applicationRoot: root,
                getNotebookRoot: requireNotebookRoot,
                sendJson: sendJsonLogged,
            }));
            routeHandlers.set('notebook', createNotebookNavigationRoutes({
                runtime: notebookRuntime,
                sendJson: sendJsonLogged,
                eventSender: sendEvent,
            }));
            let storyboardSourceRoutes = null;
            routeHandlers.set('storyboards', async (...args) => {
                if (!storyboardSourceRoutes) {
                    const sourceEditorPath = '../storyboards/source-editor.js';
                    const componentRegistryPath = '../storyboards/component-registry.js';
                    const [sourceEditor, componentRegistryModule] = await Promise.all([
                        import(sourceEditorPath),
                        import(componentRegistryPath),
                    ]);
                    if (!isRecord(sourceEditor) || typeof sourceEditor.createStoryboardSourceRoutes !== 'function') {
                        throw new Error('Storyboard source routes are unavailable in this Core build');
                    }
                    const registrations = isRecord(componentRegistryModule)
                        ? componentRegistryModule.storyboardComponentRegistry
                        : null;
                    if (!isRecord(registrations))
                        throw new Error('Storyboard component registrations are unavailable');
                    const createRoutes = sourceEditor.createStoryboardSourceRoutes;
                    storyboardSourceRoutes = createRoutes({
                        runtime: createStoryboardSourceRuntime(notebookRuntime),
                        fallbackRoot: path.resolve(root, 'src'),
                        registrations,
                        resolvePath: resolveNotebookPath,
                        sendJson: sendJsonLogged,
                        eventSender: sendEvent,
                    });
                }
                return storyboardSourceRoutes(...args);
            });
            const siteRoot = notebookRoot;
            const activeSiteRoutes = createSiteRoutes({
                root: siteRoot,
                sendJson: sendJsonLogged,
                filesystemGrants,
                resolveNotebookWorkspaceId: resolvePaseoWorkspaceId,
                ptyRuntime: ptyRuntimeReady.then((runtime) => runtime ? adaptPaseoTerminalRuntime(runtime) : null),
                workspaceScripts: async () => adaptSiteWorkspaceScripts((await ptyRuntimeReady)?.connection?.daemon),
                eventSender: sendEvent,
                serviceResolver: async (workspaceId, serviceName) => {
                    const binding = workspaceServices.resolve(workspaceId, serviceName);
                    if (!binding) {
                        const error = new Error(`Workspace service not found: ${workspaceId}/${serviceName}`);
                        Object.assign(error, { code: 'SERVICE_NOT_FOUND' });
                        throw error;
                    }
                    return binding.url;
                },
            });
            siteRoutes = activeSiteRoutes;
            routeHandlers.set('site', activeSiteRoutes);
            // Persistent Frame snapshots: read/capture/capability routes shared by
            // Prototype and Site Frames. Snapshots live in Notebook-owned assets;
            // capture reuses one headless browser and never destroys prior images.
            const siteBindingForCapture = (siteId) => {
                const binding = new SiteStore(notebookRoot).getBinding(siteId);
                if (!binding?.developmentBaseUrl) {
                    throw Object.assign(new Error(`Site is not running: ${siteId}`), { code: 'SITE_NOT_RUNNING' });
                }
                return binding;
            };
            const frameSnapshots = createFrameSnapshotCapture({
                notebookRoot,
                eventSender: sendEvent,
                resolveSiteUrl: (siteId, route) => resolveSiteDevelopmentUrl(siteBindingForCapture(siteId).developmentBaseUrl, route),
            });
            const frameSnapshotRoutes = createFrameSnapshotRoutes({
                root: notebookRoot,
                sendJson: sendJsonLogged,
                capture: frameSnapshots,
                siteStore: new SiteStore(notebookRoot),
                eventSender: sendEvent,
            });
            routeHandlers.set('frame-snapshot', (req, res, ctx) => frameSnapshotRoutes({ url: req.url ?? '/' }, res, { body: ctx.body, path: ctx.path, method: ctx.method }));
            routeHandlers.set('diagnostics', createDiagnosticsHandler({
                sendJson: sendJsonLogged,
                getSnapshot: async () => {
                    const viteAddress = server.httpServer?.address();
                    const vitePort = typeof viteAddress === 'object' && viteAddress ? viteAddress.port : null;
                    const apiAddress = hypercanvasServer?.server.address();
                    const apiPort = typeof apiAddress === 'object' && apiAddress ? apiAddress.port : null;
                    const notebookStatus = notebookRuntime?.status?.() || { active: false, root: null, notebook: null };
                    let notebookAvailable = false;
                    try {
                        notebookAvailable = Boolean(notebookStatus.root && fs.statSync(notebookStatus.root).isDirectory());
                    }
                    catch { /* missing Notebook */ }
                    const preflight = await preflightHostTools().catch(() => null);
                    const hostTools = preflight ? {
                        status: preflight.status,
                        support: preflight.support,
                        baseline: preflight.baseline,
                        agents: preflight.agents,
                    } : { status: 'unavailable', baseline: null, agents: {} };
                    const connectionState = getPaseoConnectionState();
                    const paseoBinding = getNotebookPaseoBinding();
                    const paseo = {
                        startup: {
                            usePaseoApp: process.env.HYPERCANVAS_PASEO_USE_APP === undefined ? null : process.env.HYPERCANVAS_PASEO_USE_APP === '1',
                            reuseProbeFailure: process.env.HYPERCANVAS_PASEO_REUSE_FAILURE || null,
                            restartRequired: true,
                        },
                        connection: {
                            status: typeof connectionState?.status === 'string' ? connectionState.status : 'unknown',
                            connected: connectionState?.status === 'connected',
                        },
                        binding: paseoBinding,
                        terminal: {
                            ...ptyRuntimeStatus,
                            errorCode: ptyRuntimeFailure?.code || null,
                        },
                    };
                    const sites = (siteRoutes?.diagnostics() ?? []).filter(isRecord);
                    const terminals = listSessions().map(({ sessionId, name, branch, canvasId, widgetId, status }) => ({
                        sessionId, name, branch, canvasId, widgetId, status,
                    }));
                    const watched = server.watcher?.getWatched?.() || {};
                    const watchedDirectories = Object.entries(watched)
                        .filter(([, files]) => Array.isArray(files) && files.length > 0)
                        .map(([directory, files]) => ({ directory, fileCount: files.length }));
                    const recovery = [];
                    if (!notebookStatus.active || !notebookAvailable)
                        recovery.push('Open or rebind a Notebook in the Notebook switcher.');
                    if (paseoBinding.state === 'failed' && paseoBinding.lastError) {
                        recovery.push(`Paseo workspace registration failed: ${paseoBinding.lastError.message}. Verify the daemon is running and compatible, then restart Hypercanvas Core.`);
                    }
                    else if (paseoBinding.state === 'stale' || (notebookStatus.active && paseoBinding.state === 'idle')) {
                        recovery.push('Paseo workspace registration is pending. Sessions will confirm once the daemon reconnects.');
                    }
                    if (!paseo.terminal.connected)
                        recovery.push('Paseo PTY is unavailable. Check the daemon state, then restart Hypercanvas Core.');
                    if (hostTools.baseline?.status !== 'valid')
                        recovery.push('Review the Core Node/npm runtime diagnostics.');
                    const missingAgents = Object.entries(hostTools.agents || {}).filter(([, agent]) => !isRecord(agent) || agent.status !== 'installed').map(([id]) => id);
                    if (missingAgents.length)
                        recovery.push(`These agent CLIs were not found in the host environment: ${missingAgents.join(', ')}. Follow each publisher's setup instructions, then retry.`);
                    if (!recovery.length)
                        recovery.push('Core and runtime checks are healthy.');
                    return {
                        core: {
                            version: CORE_VERSION,
                            pid: process.pid,
                            uptimeSeconds: Math.floor(process.uptime()),
                            vitePort,
                            apiPort,
                            base,
                            mode: wrapperMode ? 'rust-wrapper' : 'browser-core',
                        },
                        node: { version: process.version, path: process.execPath },
                        paseo,
                        notebook: {
                            active: Boolean(notebookStatus.active),
                            available: notebookAvailable,
                            root: notebookStatus.root || null,
                            id: notebookStatus.notebook?.manifest?.id || null,
                            title: notebookStatus.notebook?.manifest?.title || null,
                        },
                        hostTools,
                        agents: hostTools.agents,
                        sites,
                        terminals,
                        processes: [
                            { kind: 'core', name: 'Hypercanvas Core', pid: process.pid, status: 'running' },
                            ...sites.filter((site) => typeof site.pid === 'number' && Number.isInteger(site.pid) && site.pid > 0).map((site) => ({
                                kind: 'site', name: typeof site.title === 'string' ? site.title : String(site.id || ''), pid: site.pid, status: site.status,
                            })),
                        ],
                        watches: {
                            directories: watchedDirectories.slice(0, 20),
                            totalDirectories: watchedDirectories.length,
                            totalFiles: watchedDirectories.reduce((sum, entry) => sum + entry.fileCount, 0),
                        },
                        logs: readRecentDiagnosticLogs(resolveNotebookRuntimePath(notebookRoot, 'logs')),
                        incidents: readDesktopDiagnosticIncidents(process.env.HYPERCANVAS_APP_STATE_DIR),
                        recovery,
                    };
                },
            }));
            // Artifact CRUD delegates Site deletion to the same runtime owner used
            // by the Site API so removing metadata cannot orphan its process.
            routeHandlers.set('artifact', createArtifactRoutes({
                root: notebookRoot,
                sendJson: sendJsonLogged,
                deleteSite: activeSiteRoutes.deleteSite,
            }));
            // Host tools expose a read-only preflight snapshot.
            routeHandlers.set('host-tools', createHostToolsHandler({
                preflight: preflightHostTools,
                sendJson: sendJsonLogged,
            }));
            const selectE2eDirectory = (process.env.HYPERCANVAS_E2E_PICKER ?? legacyEnv('STORYBOARD_E2E_PICKER')) === '1'
                ? async ({ purpose, e2eDirectory } = { purpose: 'notebook' }) => {
                    const configuredRoot = (process.env.HYPERCANVAS_E2E_PICKER_ROOT ?? legacyEnv('STORYBOARD_E2E_PICKER_ROOT'));
                    const requested = (typeof e2eDirectory === 'string' ? e2eDirectory : '') || legacyEnv(purpose === 'site' ? 'HYPERCANVAS_E2E_SITE_DIRECTORY' : 'HYPERCANVAS_E2E_NOTEBOOK_DIRECTORY');
                    if (!configuredRoot || !requested)
                        return null;
                    const allowedRoot = fs.realpathSync.native(path.resolve(configuredRoot));
                    const selectedRoot = fs.realpathSync.native(path.resolve(requested));
                    const relative = path.relative(allowedRoot, selectedRoot);
                    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
                        throw new Error('E2E picker selection must stay inside its fixture directory.');
                    }
                    if (!fs.statSync(selectedRoot).isDirectory())
                        throw new Error('E2E picker selection must be a directory.');
                    return selectedRoot;
                }
                : undefined;
            const selectE2eFile = (process.env.HYPERCANVAS_E2E_PICKER ?? legacyEnv('STORYBOARD_E2E_PICKER')) === '1'
                ? async () => {
                    const configuredRoot = (process.env.HYPERCANVAS_E2E_PICKER_ROOT ?? legacyEnv('STORYBOARD_E2E_PICKER_ROOT'));
                    const requested = (process.env.HYPERCANVAS_E2E_PICKER_FILE ?? legacyEnv('STORYBOARD_E2E_PICKER_FILE'));
                    if (!configuredRoot || !requested)
                        return null;
                    const allowedRoot = fs.realpathSync.native(path.resolve(configuredRoot));
                    const selectedFile = fs.realpathSync.native(path.resolve(requested));
                    const relative = path.relative(allowedRoot, selectedFile);
                    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
                        throw new Error('E2E picker selection must stay inside its fixture directory.');
                    }
                    if (!fs.statSync(selectedFile).isFile())
                        throw new Error('E2E picker selection must be a file.');
                    return selectedFile;
                }
                : undefined;
            const systemRoutes = createSystemRoutes({
                sendJson: sendJsonLogged,
                getNotebookRoot: requireNotebookRoot,
                eventSender: sendEvent,
                filesystemGrants,
                ...(selectE2eDirectory ? { selectDirectory: selectE2eDirectory } : {}),
                ...(selectE2eFile ? { selectFile: selectE2eFile } : {}),
            });
            routeHandlers.set('system', (req, res, ctx) => systemRoutes(req, res, ctx));
            // Push all bus events to browser clients via Vite HMR WebSocket
            subscribeAll((channel, event) => {
                sendEvent({
                    type: 'custom',
                    event: 'storyboard:message',
                    data: { channel, event },
                });
            });
            // Terminal sessions API — list, detach, kill sessions
            routeHandlers.set('terminal', async (req, res, ctx) => {
                // Strip query string and leading slash from path
                const rawPath = (ctx.path || '/').replace(/^\//, '');
                const subpath = rawPath.split('?')[0] ?? '';
                // GET /sessions — list all sessions (optional ?branch= filter)
                if (ctx.method === 'GET' && (subpath === 'sessions' || subpath === 'sessions/')) {
                    const url = new URL(req.url ?? '/', 'http://localhost');
                    const filterBranch = url.searchParams.get('branch') || null;
                    sendJsonLogged(res, 200, { sessions: listSessions(filterBranch) });
                    return;
                }
                // GET /sessions/stats — quick session counts by status
                if (ctx.method === 'GET' && subpath === 'sessions/stats') {
                    sendJsonLogged(res, 200, getSessionStats());
                    return;
                }
                // POST /sessions/cleanup — bulk remove sessions by status
                if (ctx.method === 'POST' && subpath === 'sessions/cleanup') {
                    try {
                        const { statuses } = ctx.body || {};
                        const allowed = new Set(['archived', 'background']);
                        if (!Array.isArray(statuses) || statuses.length === 0) {
                            sendJsonLogged(res, 400, { error: 'statuses must be a non-empty array' });
                            return;
                        }
                        const invalid = statuses.filter(s => !allowed.has(s));
                        if (invalid.length > 0) {
                            sendJsonLogged(res, 400, { error: `Invalid statuses: ${invalid.join(', ')}. Allowed: archived, background` });
                            return;
                        }
                        const result = await bulkCleanup({ statuses });
                        sendJsonLogged(res, 200, { success: true, ...result });
                    }
                    catch {
                        sendJsonLogged(res, 400, { error: 'Invalid JSON body' });
                    }
                    return;
                }
                // POST /sessions/:name/detach — detach a session
                const detachMatch = subpath.match(/^sessions\/(.+)\/detach$/);
                if (ctx.method === 'POST' && detachMatch) {
                    const sessionId = decodeURIComponent(detachMatch[1]);
                    const entry = detachSession(sessionId);
                    if (!entry) {
                        sendJsonLogged(res, 404, { error: 'Session not found' });
                        return;
                    }
                    sendJsonLogged(res, 200, { success: true, session: entry });
                    return;
                }
                // POST /sessions/:name/orphan — archive a session with grace timer
                const orphanMatch = subpath.match(/^sessions\/(.+)\/orphan$/);
                if (ctx.method === 'POST' && orphanMatch) {
                    const sessionId = decodeURIComponent(orphanMatch[1]);
                    orphanSession(sessionId);
                    sendJsonLogged(res, 200, { success: true });
                    return;
                }
                // DELETE /sessions/:name — kill a session immediately
                const deleteMatch = subpath.match(/^sessions\/(.+)$/);
                if (ctx.method === 'DELETE' && deleteMatch) {
                    const sessionId = decodeURIComponent(deleteMatch[1]);
                    await killSession(sessionId);
                    sendJsonLogged(res, 200, { success: true });
                    return;
                }
                // ── Hot Pool routes (/terminal/hot-pool/*) ──────────────
                // GET /hot-pool — pool status
                if (ctx.method === 'GET' && subpath === 'hot-pool') {
                    sendJsonLogged(res, 200, hotPool.status());
                    return;
                }
                // PUT /hot-pool — reconfigure pool
                if (ctx.method === 'PUT' && subpath === 'hot-pool') {
                    hotPool.reconfigure(ctx.body || {});
                    sendJsonLogged(res, 200, hotPool.status());
                    return;
                }
                // POST /hot-pool/acquire — acquire a warm session from a specific pool
                if (ctx.method === 'POST' && subpath === 'hot-pool/acquire') {
                    const poolId = typeof ctx.body.poolId === 'string' ? ctx.body.poolId : 'terminal';
                    const session = hotPool.acquire(poolId);
                    if (!session) {
                        sendJsonLogged(res, 200, { acquired: false, poolId, session: null });
                        return;
                    }
                    sendJsonLogged(res, 200, { acquired: true, poolId, session: { id: session.id, runtimeSessionId: session.runtimeSessionId, poolId: session.poolId } });
                    return;
                }
                sendJsonLogged(res, 404, { error: 'Not found' });
            });
            // Worktrees API — merge live registry with on-disk worktree list so the
            // BranchBar can show running siblings (with port + url) AND siblings
            // that exist but aren't running (so the UI can offer to spin them up).
            routeHandlers.set('worktrees', async (req, res) => {
                try {
                    const servers = listRunningServers(root);
                    const runningByName = new Map(servers.map(s => [s.worktree, s]));
                    const allNames = new Set(['main', ...listWorktrees(root)]);
                    for (const name of runningByName.keys())
                        allNames.add(name);
                    const branches = [];
                    for (const name of allNames) {
                        const srv = runningByName.get(name);
                        const isMain = name === 'main';
                        branches.push({
                            branch: name,
                            folder: isMain ? '' : `branch--${name}/`,
                            running: !!srv,
                            port: srv?.port ?? null,
                            url: srv ? `http://localhost:${srv.port}/storyboard/` : null,
                        });
                    }
                    // Main first, then alphabetical
                    branches.sort((a, b) => a.branch === 'main' ? -1 : b.branch === 'main' ? 1 : a.branch.localeCompare(b.branch));
                    sendJsonLogged(res, 200, branches);
                }
                catch {
                    sendJsonLogged(res, 200, []);
                }
            });
            // Switch-branch API — spawn a detached `hypercanvas dev` for the
            // requested worktree and wait until it self-registers, then return
            // its URL so the BranchBar can navigate directly.
            routeHandlers.set('switch-branch', async (req, res) => {
                const body = await new Promise((resolve) => {
                    let buf = '';
                    req.on('data', (c) => buf += c);
                    req.on('end', () => { try {
                        resolve(JSON.parse(buf || '{}'));
                    }
                    catch {
                        resolve({});
                    } });
                    req.on('error', () => resolve({}));
                });
                const branch = String(isRecord(body) ? body.branch || '' : '').trim();
                if (!branch) {
                    sendJsonLogged(res, 400, { error: 'Missing "branch"' });
                    return;
                }
                // Already running? Return immediately.
                const existing = findByWorktree(branch, root);
                if (existing.length > 0) {
                    const srv = existing[0];
                    sendJsonLogged(res, 200, { status: 'already_running', url: `http://localhost:${srv.port}/storyboard/`, port: srv.port, id: srv.id });
                    return;
                }
                // Resolve target cwd
                const cwd = branch === 'main' ? root : worktreeDir(branch, root);
                if (!fs.existsSync(path.resolve(cwd, '.git'))) {
                    sendJsonLogged(res, 404, { error: `Worktree "${branch}" does not exist` });
                    return;
                }
                // Detached spawn — exits independently of this Vite process.
                const { spawn } = await import('node:child_process');
                const npmBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
                try {
                    const child = spawn(npmBin, ['hypercanvas', 'dev'], {
                        cwd,
                        detached: true,
                        stdio: 'ignore',
                        // A branch dev server is another Core server, so it receives the
                        // resolved daemon settings but not the browser launch token.
                        env: createPaseoServerEnvironment(withoutRuntimeCredentials(process.env), {
                            ...(process.env.PASEO_DAEMON_URL ? { url: process.env.PASEO_DAEMON_URL } : {}),
                            ...(process.env.PASEO_DAEMON_PASSWORD ? { password: process.env.PASEO_DAEMON_PASSWORD } : {}),
                            ...(process.env.PASEO_DAEMON_AUTH_HEADER ? { authHeader: process.env.PASEO_DAEMON_AUTH_HEADER } : {}),
                        }),
                    });
                    child.unref();
                }
                catch (err) {
                    sendJsonLogged(res, 500, { error: `Spawn failed: ${errorMessage(err)}` });
                    return;
                }
                // Poll registry up to 30s.
                const start = Date.now();
                while (Date.now() - start < 30000) {
                    await new Promise(r => setTimeout(r, 500));
                    const matches = findByWorktree(branch, root);
                    if (matches.length > 0) {
                        const srv = matches[matches.length - 1];
                        sendJsonLogged(res, 200, { status: 'started', url: `http://localhost:${srv.port}/storyboard/`, port: srv.port, id: srv.id });
                        return;
                    }
                }
                sendJsonLogged(res, 504, { error: `Spawned but did not self-register within 30s` });
            });
            // Git user — return git config user name and GitHub login (via gh CLI)
            routeHandlers.set('git-user', async (req, res) => {
                const name = readOptionalGitValue(root, ['config', 'user.name']);
                let login = null;
                try {
                    const { execSync } = await import('node:child_process');
                    const status = execSync('gh auth status 2>&1', { cwd: root, encoding: 'utf8' });
                    const m = status.match(/Logged in to github\.com account (\S+)/) || status.match(/Logged in to github\.com as (\S+)/);
                    if (m)
                        login = m[1];
                }
                catch { /* gh not installed or not logged in */ }
                sendJsonLogged(res, 200, { name, login });
            });
            // Current branch — live read of HEAD via git. The BranchBar uses
            // this as the source of truth instead of parsing /branch--<name>/
            // out of the URL (which doesn't exist anymore).
            routeHandlers.set('current-branch', async (req, res) => {
                const branch = readOptionalGitValue(root, ['branch', '--show-current']);
                sendJsonLogged(res, 200, { branch });
            });
            // Per-branch artifact manifest parity route for local dev.
            routeHandlers.set('artifacts.json', async (req, res) => {
                try {
                    const discovery = buildDataDiscovery(requireNotebookRoot(), { includeDraft: true, contentOnly: true });
                    const env = resolveManifestEnv({ env: { ...process.env, basePath: base || '/' }, cwd: requireNotebookRoot() });
                    sendJsonLogged(res, 200, buildArtifactManifest({ discovery, env }));
                }
                catch (err) {
                    sendJsonLogged(res, 500, { error: errorMessage(err) || 'Failed to build artifacts manifest' });
                }
            });
            // Watch all config domains and tag their reloads so the configuration
            // guard remains independent from canvas UI and prototype policies.
            const configNames = [
                'hypercanvas.config.json',
                'storyboard.config.json',
                'toolbar.config.json',
                'commandpalette.config.json',
                'paste.config.json',
                'widgets.config.json',
                'terminal.config.json',
                'mascot.config.json',
            ];
            const configPaths = configNames.flatMap((filename) => [
                ...resolveConfigFileCandidates(notebookRoot, filename),
                path.resolve(root, 'packages/storyboard', filename),
            ]);
            configPaths.push(path.resolve(notebookRoot, 'config'), path.resolve(notebookRoot, 'backstage', 'config'));
            server.watcher.add(configPaths);
            server.watcher.on('change', (filePath) => {
                const resolved = path.resolve(filePath);
                if (configPaths.includes(resolved)) {
                    // Invalidate the cached JSON module so Vite re-reads from disk
                    const mods = server.moduleGraph.getModulesByFile(resolved);
                    if (mods)
                        for (const mod of mods) {
                            server.moduleGraph.invalidateModule(mod);
                        }
                    server.ws.send({ type: 'full-reload', path: resolved });
                }
            });
            // Workshop client UI is now mounted by mountStoryboardCore() via the
            // compiled UI bundle. No script injection needed.
            // Plugin registry for external plugins (future use).
            // Plugins call registerRoutes/registerClientScript in their setup().
            // const pluginCtx = { server, root, config, registerRoutes, registerClientScript }
            // Future: auto-discover and initialize plugins from pluginsConfig here
            // Mount the /_hypercanvas/ middleware router
            // Vite's dev server strips the base path from req.url for middleware,
            // but the base-redirect plugin may redirect bare URLs first.
            // We check both with and without base prefix.
            const apiSetup = createRouteSetup({
                base,
                routeHandlers,
                sendJson: sendJsonLogged,
                ws: server.ws,
                proxyUrl: externalServerUrl || (() => {
                    const address = hypercanvasServer?.server.address();
                    return typeof address === 'object' && address ? `http://127.0.0.1:${address.port}` : 'http://127.0.0.1:0';
                }),
                proxyAll: () => Boolean(externalServerUrl || hypercanvasServer?.server.listening),
            });
            server.middlewares.use((req, res, next) => {
                let url = req.url || '';
                const baseNoTrail = base.replace(/\/$/, '');
                if (baseNoTrail && url.startsWith(baseNoTrail))
                    url = url.slice(baseNoTrail.length) || '/';
                if ((url === '/_hypercanvas/ws-url' || url === '/_hypercanvas/ws-url') && hypercanvasServer?.server.listening) {
                    const address = hypercanvasServer.server.address();
                    const protocol = req.headers['x-forwarded-proto'] === 'https' ? 'wss' : 'ws';
                    if (typeof address === 'object' && address) {
                        // Behind the instance proxy the browser must stay same-origin:
                        // derive the WebSocket URL from the request Host instead of the
                        // dynamic backend port.
                        if (proxyOrigin && req.headers.host) {
                            return sendJsonLogged(res, 200, { url: `${protocol}://${req.headers.host}${hypercanvasServer.socketPath}` });
                        }
                        return sendJsonLogged(res, 200, { url: `${protocol}://127.0.0.1:${address.port}${hypercanvasServer.socketPath}` });
                    }
                }
                if (url === INTERNAL_RELAUNCH_PATH && req.method === 'POST') {
                    // Duplicate-launch handoff: the instance proxy forwards relaunch
                    // requests here so the token is minted by the browser-session
                    // owner. Loopback callers only — the proxy already gates this,
                    // and the check below covers direct local access.
                    const peer = req.socket?.remoteAddress;
                    if (peer !== '127.0.0.1' && peer !== '::1' && peer !== '::ffff:127.0.0.1') {
                        return sendJsonLogged(res, 403, { error: 'relaunch_loopback_only' });
                    }
                    const registrationToken = process.env.HYPERCANVAS_PROXY_REGISTRATION_TOKEN;
                    if (registrationToken && req.headers.authorization !== `Bearer ${registrationToken}`) {
                        return sendJsonLogged(res, 401, { error: 'internal_auth_required' });
                    }
                    req.resume();
                    req.on('end', () => {
                        const viteBase = server.config.base || '/';
                        const launchUrl = proxyOrigin ? `${proxyOrigin}${viteBase === '/' ? '/' : viteBase}` : null;
                        if (!launchUrl) {
                            return sendJsonLogged(res, 503, { error: 'relaunch_unavailable' });
                        }
                        return sendJsonLogged(res, 200, { url: launchUrl, token: browserSession.issueLaunchToken() });
                    });
                    return;
                }
                return next();
            });
            server.middlewares.use(siteRoutes.previewMiddleware({
                base,
                authorizeRequest: browserSession.isAuthenticated,
            }));
            server.middlewares.use(createApiGate({
                base,
                apiMiddleware: apiSetup.middleware,
                sendJson: sendJsonLogged,
                isAllowedOrigin: (headers, options) => isAllowedRequestOrigin(headers, {
                    ...options,
                    allowForwardedHttpsOrigin: wrapperMode && !browserSessionHandoffEnabled,
                }),
                isAuthorized: browserSession.isAuthenticated,
                desktop: (process.env.HYPERCANVAS_DESKTOP ?? legacyEnv('STORYBOARD_DESKTOP')) === '1',
                getNotebookRuntimeMiddleware: () => server.__hypercanvasNotebookRuntime,
            }));
        },
        transformIndexHtml() {
            const tags = [];
            if (browserCoreMode) {
                tags.push({
                    tag: 'script',
                    children: 'window.__HYPERCANVAS_CORE_MODE__=true',
                    injectTo: 'head',
                });
            }
            // Inject local dev flag only during dev server (not production builds)
            if (isDev) {
                tags.push({
                    tag: 'script',
                    children: 'window.__SB_LOCAL_DEV__=true',
                    injectTo: 'head',
                });
                // Inject dev domain name for branch bar display.
                // Sourced from config.repository.name, with the project directory
                // basename as a fallback so every repo gets a labelled bar even
                // before storyboard.config.json is filled in.
                // Use the main repo root (not cwd) so worktrees don't shadow the
                // project name with the worktree directory name (which often equals
                // the branch name).
                let projectRoot = process.cwd();
                try {
                    const commonDir = cpExecSync('git rev-parse --path-format=absolute --git-common-dir', {
                        cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
                    }).trim();
                    if (commonDir)
                        projectRoot = commonDir.replace(/\/?\.git\/?$/, '') || projectRoot;
                }
                catch { /* not a git repo — fall back to cwd */ }
                const devDomainLabel = config.repository?.name || path.basename(projectRoot);
                if (devDomainLabel) {
                    tags.push({
                        tag: 'script',
                        children: `window.__SB_DEV_DOMAIN__=${JSON.stringify(devDomainLabel)}`,
                        injectTo: 'head',
                    });
                }
                // Inject per-domain branch bar color (configurable via devDomainColor)
                if (config.devDomainColor) {
                    tags.push({
                        tag: 'script',
                        children: `window.__SB_DEV_DOMAIN_COLOR__=${JSON.stringify(config.devDomainColor)}`,
                        injectTo: 'head',
                    });
                }
                // Browser error bridge — forwards console.error/warn and uncaught
                // exceptions to the dev server via HMR for structured o11y logging
                tags.push({
                    tag: 'script',
                    attrs: { type: 'module' },
                    children: `
import { createHotContext as createHypercanvasHotContext } from ${JSON.stringify(`${base.replace(/\/$/, '')}/@vite/client`)};
(function() {
  var hot = import.meta.hot || createHypercanvasHotContext(${JSON.stringify(`${base.replace(/\/$/, '')}/__hypercanvas-client-errors`)});
  var MAX_LEN = 2000;
  // The context may be installed after the initial websocket connect event.
  // Vite queues sends during its initial connection; known disconnects must
  // drop diagnostics until reconnect rather than accumulate a retry queue.
  var connected = true;
  var sending = false;
  if (hot && typeof hot.on === 'function') {
    hot.on('vite:ws:disconnect', function() { connected = false; });
    hot.on('vite:ws:connect', function() { connected = true; });
  }
  function trunc(s) { return typeof s === 'string' && s.length > MAX_LEN ? s.slice(0, MAX_LEN) + '…' : s; }
  function route() { return trunc(location.pathname); }
  function send(level, msg, extra) {
    if (!connected || sending) return;
    sending = true;
    try { hot.send('storyboard:client-error', Object.assign({ level: level, message: trunc(msg), route: route() }, extra || {})); } catch {}
    finally { sending = false; }
  }
  // Patch console.error and console.warn
  ['error', 'warn'].forEach(function(level) {
    var orig = console[level];
    console[level] = function() {
      orig.apply(console, arguments);
      // HMRClient.send returns void and logs rejected transport sends later.
      // Forwarding that Vite logger output would retry the same failed channel
      // indefinitely, outside the synchronous try/catch above.
      if (typeof arguments[0] === 'string' && arguments[0].startsWith('[vite]')) return;
      var parts = [];
      for (var i = 0; i < arguments.length; i++) {
        try { parts.push(typeof arguments[i] === 'string' ? arguments[i] : JSON.stringify(arguments[i])); } catch { parts.push(String(arguments[i])); }
      }
      send(level, parts.join(' '));
    };
  });
  // Uncaught errors
  window.addEventListener('error', function(e) {
    send('error', e.message || 'Uncaught error', { url: e.filename, line: e.lineno, col: e.colno, stack: trunc(e.error && e.error.stack) });
  });
  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', function(e) {
    var msg = e.reason ? (e.reason.message || String(e.reason)) : 'Unhandled rejection';
    send('error', msg, { stack: trunc(e.reason && e.reason.stack) });
  });
})();
`.trim(),
                    injectTo: 'head',
                });
            }
            if (process.env.HYPERCANVAS_SMOKE_RENDER_MARKER) {
                const renderTimeoutMs = (Number(process.env.HYPERCANVAS_SMOKE_RENDER_TIMEOUT_SECS) || 120) * 1000;
                tags.push({
                    tag: 'script',
                    children: `
(function(){
  var observer;
  var interval;
  function stopWatching(){
    if (observer) observer.disconnect();
    if (interval) clearInterval(interval);
  }
  function reportMounted(){
    if (window.__HYPERCANVAS_CLIENT_MOUNTED__ !== true) return false;
    fetch('/_hypercanvas/desktop-ready', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mounted: true })
    }).catch(function(){});
    stopWatching();
    return true;
  }
  if (reportMounted()) return;
  observer = new MutationObserver(reportMounted);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  interval = setInterval(reportMounted, 1000);
  setTimeout(stopWatching, ${renderTimeoutMs + 15000});
})();
`.trim(),
                    injectTo: 'body',
                });
            }
            // Keep Vite's outdated dependency and dynamic-import recovery failures
            // pending for the registered document policy. This bootstrap can run
            // before the application context mounts, so it must never navigate.
            if (isDev) {
                tags.push({
                    tag: 'script',
                    children: `
(function(){
  var reloaded = false;
  var pendingKey = '__hypercanvas_reload_pending__';
  var basePath = ${JSON.stringify(base || '/')};
  function isWithinBase(){
    var base = String(basePath || '/').replace(/\\/+$/, '');
    if (!base) return true;
    var pathname = window.location.pathname;
    return pathname === base || pathname.indexOf(base + '/') === 0;
  }
  function maybeReload(reason){
    if (reloaded) return;
    if (!isWithinBase()) return;
    try { if (sessionStorage.getItem('__sb_outdated_reload__')) return; } catch (_) {}
    reloaded = true;
    var pending = { kind: 'recovery', reason: reason };
    try {
      sessionStorage.setItem(pendingKey, JSON.stringify(pending));
      sessionStorage.setItem('__sb_outdated_reload__', '1');
    } catch (_) {}
    window.dispatchEvent(new CustomEvent('storyboard:reload-pending', { detail: pending }));
    console.warn('[storyboard] Recovery is pending document policy authorization: ' + reason);
  }
  // Clear stale guard from previous successful loads.
  if (document.readyState === 'complete') {
    try { sessionStorage.removeItem('__sb_outdated_reload__'); } catch (_) {}
  } else {
    window.addEventListener('load', function(){
      setTimeout(function(){ try { sessionStorage.removeItem('__sb_outdated_reload__'); } catch (_) {} }, 2000);
    });
  }
  // Catch module load failures.
  window.addEventListener('error', function(e){
    var msg = (e && e.message) || '';
    if (/Outdated Optimize Dep|Failed to fetch dynamically imported module|Importing a module script failed|504/i.test(msg)) {
      maybeReload('outdated dep / dynamic import failure');
    }
  }, true);
  // Catch unhandled promise rejections from dynamic imports.
  window.addEventListener('unhandledrejection', function(e){
    var msg = (e && e.reason && (e.reason.message || String(e.reason))) || '';
    if (/Outdated Optimize Dep|Failed to fetch dynamically imported module|Importing a module script failed|504/i.test(msg)) {
      maybeReload('outdated dep / dynamic import failure');
    }
  });
})();
`.trim(),
                    injectTo: 'head',
                });
            }
            // Inject base path so the inspector UI can resolve static assets
            // (e.g. inspector.json) when deployed under a subpath
            tags.push({
                tag: 'script',
                children: `window.__HYPERCANVAS_BASE_PATH__=${JSON.stringify(base)}`,
                injectTo: 'head',
            });
            for (const src of clientScripts) {
                tags.push({
                    tag: 'script',
                    attrs: { type: 'module', src: base + src.replace(/^\//, '') },
                    injectTo: 'body',
                });
            }
            // Inject the storyboard brand favicon as a data URI. Appending to
            // head means it wins over any earlier <link rel="icon"> the consumer
            // declared (browsers use the last declaration).
            if (faviconDataUri) {
                tags.push({
                    tag: 'link',
                    attrs: { rel: 'icon', type: 'image/svg+xml', href: faviconDataUri },
                    injectTo: 'head',
                });
            }
            return tags;
        },
        // Build-time: emit a static JSON with source files so the inspector
        // works in deployed environments without the dev middleware.
        async generateBundle() {
            const srcDir = path.join(root, 'src');
            const prototypesDir = path.join(root, 'src', 'prototypes');
            // Collect file lists (prototypes for the files index, all src/ for sources)
            const [prototypeFiles, allSrcFiles] = await Promise.all([
                collectFiles(prototypesDir, root),
                collectFiles(srcDir, root),
            ]);
            // Read all source file contents
            const sources = {};
            await Promise.all(allSrcFiles.map(async (relPath) => {
                try {
                    sources[relPath] = await fs.promises.readFile(path.join(root, relPath), 'utf-8');
                }
                catch { /* skip unreadable files */ }
            }));
            // Resolve repo info (same logic as docs-handler)
            let repo = null;
            try {
                const remote = readOptionalGitValue(root, ['remote', 'get-url', 'origin']);
                if (!remote)
                    throw new Error('No origin remote is configured');
                const match = remote.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
                if (match)
                    repo = { owner: match[1], name: match[2] };
            }
            catch { /* no git or no remote */ }
            if (!repo) {
                const configPath = resolveAppConfigPath(root);
                try {
                    const raw = await fs.promises.readFile(configPath, 'utf-8');
                    const cfg = JSON.parse(raw);
                    if (cfg.repository?.owner && cfg.repository?.name) {
                        repo = { owner: cfg.repository.owner, name: cfg.repository.name };
                    }
                }
                catch { /* config not available */ }
            }
            this.emitFile({
                type: 'asset',
                fileName: '_hypercanvas/inspector.json',
                source: JSON.stringify({
                    files: prototypeFiles.sort(),
                    sources,
                    repo,
                }),
            });
            // Emit README as static JSON so the docs panel works in deployed builds.
            // Dev server serves this dynamically; production needs the static file.
            let readmeContent = null;
            for (const candidate of ['README.md', 'readme.md', 'Readme.md']) {
                try {
                    readmeContent = await fs.promises.readFile(path.join(root, candidate), 'utf-8');
                    break;
                }
                catch { /* try next */ }
            }
            if (readmeContent) {
                this.emitFile({
                    type: 'asset',
                    fileName: '_hypercanvas/docs/readme',
                    source: JSON.stringify({ content: readmeContent, path: 'README.md' }),
                });
            }
            // Emit repo info so the docs panel GitHub link works in deployed builds.
            if (repo) {
                this.emitFile({
                    type: 'asset',
                    fileName: '_hypercanvas/docs/repo',
                    source: JSON.stringify(repo),
                });
            }
            // Emit story sources JSON so the "show code" widget action works in
            // deployed builds. In dev, StoryWidget uses Vite's ?raw import; in prod
            // it fetches this static JSON instead.
            const storySources = {};
            const storyExts = ['.story.jsx', '.story.tsx', '.story.js', '.story.ts'];
            for (const relPath of allSrcFiles) {
                if (storyExts.some(ext => relPath.endsWith(ext))) {
                    storySources[relPath] = sources[relPath] || '';
                }
            }
            if (Object.keys(storySources).length > 0) {
                this.emitFile({
                    type: 'asset',
                    fileName: '_hypercanvas/stories/sources.json',
                    source: JSON.stringify(storySources),
                });
            }
            // Emit canvas images so they're available in deployed (static) builds.
            // Dev server serves these dynamically; production needs the static files.
            // Private images (prefixed with ~) are excluded from the build.
            for (const dir of [
                notebookContentPath(root, 'assets', 'canvas', 'images'),
                notebookContentPath(root, 'assets', 'canvas', 'snapshots'),
            ]) {
                try {
                    const imageFiles = await fs.promises.readdir(dir);
                    const subdir = dir.endsWith('snapshots') ? 'snapshots' : 'images';
                    for (const file of imageFiles) {
                        if (file.startsWith('~') || file.startsWith('.'))
                            continue;
                        try {
                            const data = await fs.promises.readFile(path.join(dir, file));
                            this.emitFile({
                                type: 'asset',
                                fileName: `_hypercanvas/canvas/${subdir}/${file}`,
                                source: data,
                            });
                        }
                        catch { /* skip unreadable files */ }
                    }
                }
                catch { /* directory doesn't exist */ }
            }
            // GitHub Pages uses Jekyll which ignores _-prefixed directories.
            // Emit .nojekyll to ensure _hypercanvas/ is served.
            this.emitFile({
                type: 'asset',
                fileName: '.nojekyll',
                source: '',
            });
            // Emit CNAME for GitHub Pages custom domain if configured.
            // Without this, deploy scripts that clean the gh-pages root will
            // delete the CNAME on every push, causing intermittent 404s.
            const customDomain = (config.customDomain || '').trim();
            if (customDomain && !customDomain.includes('/') && !customDomain.includes(':') && !customDomain.includes(' ')) {
                this.emitFile({
                    type: 'asset',
                    fileName: 'CNAME',
                    source: customDomain + '\n',
                });
            }
        },
    };
}
export { sendJson };
