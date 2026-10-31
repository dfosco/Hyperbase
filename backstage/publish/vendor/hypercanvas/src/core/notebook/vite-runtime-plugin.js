import { createNotebookRuntime } from './runtime.js';
import { resolveNotebookManifestPath } from './notebook.js';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { isAtomicCanvasStagingFile } from '../canvas/writeGuard.js';
import { createFilesystemGrants } from '../system/filesystem-grants.js';
import { resolveNotebookStateDirectory } from './stateDirectory.js';
import { appConfigCandidates } from '../configFile.js';
import { createSiblingOrderChangeTracker } from './sibling-order.js';
import { FIRST_LOOK_PROTOTYPE_RUNTIME } from './first-look/contract.js';
import { discoverNotebookDependencies } from './dependencies.node.js';
const VIRTUAL_NOTEBOOK = 'virtual:hypercanvas-notebook';
const RESOLVED_VIRTUAL_NOTEBOOK = `\0${VIRTUAL_NOTEBOOK}`;
const RESOLVED_DATA_INDEX = '\0virtual:storyboard-data-index';
function devlog(message, details = {}) {
    console.debug('[devlog][notebook-runtime-plugin]', message, details);
}
function sendJson(response, status, body) {
    response.statusCode = status;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(body));
}
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
}
function encodedFsPath(value) {
    return path.resolve(value).split(path.sep).filter(Boolean).map(encodeURIComponent).join('/');
}
function rewritePrototypeEntryAssets(html, artifactRoot, entryPath, baseHref) {
    const entryDirectory = path.dirname(entryPath);
    let rewritten = html.replace(/(\b(?:src|href)\s*=\s*)(["'])([^"']+)\2/gi, (match, prefix, quote, value) => {
        if (/^(?:[a-z][a-z\d+.-]*:|\/|#|data:)/i.test(value))
            return match;
        const url = new URL(value, 'https://design-notebook.invalid/');
        let relative;
        try {
            relative = decodeURIComponent(value.split(/[?#]/, 1)[0]);
        }
        catch {
            return match;
        }
        if (relative.includes('\\'))
            return match;
        const asset = path.resolve(entryDirectory, relative);
        const inside = path.relative(artifactRoot, asset);
        if (inside === '..' || inside.startsWith(`..${path.sep}`) || path.isAbsolute(inside))
            return match;
        const fsUrl = `/@fs/${encodedFsPath(asset)}${url.search}${url.hash}`;
        return `${prefix}${quote}${fsUrl}${quote}`;
    });
    const baseTag = `<base href="${escapeHtml(baseHref)}">`;
    return /<head(?:\s[^>]*)?>/i.test(rewritten)
        ? rewritten.replace(/<head(?:\s[^>]*)?>/i, match => `${match}\n    ${baseTag}`)
        : `${baseTag}\n${rewritten}`;
}
function statefullyDiagnosticPage(title, diagnostics = [], status = 422) {
    const details = diagnostics.map(item => `<li><code>${escapeHtml(item.code || 'PROTOTYPE_UNAVAILABLE')}</code> ${escapeHtml(item.message || '')}</li>`).join('');
    return {
        status,
        html: `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body><main role="alert"><h1>${escapeHtml(title)}</h1><p>This portable prototype cannot be loaded by the current runtime.</p>${details ? `<ul>${details}</ul>` : ''}</main></body></html>`,
    };
}
function canonicalRoot(root) {
    const absolute = path.resolve(root);
    try {
        return fs.realpathSync.native(absolute);
    }
    catch {
        return absolute;
    }
}
async function waitForViteClientRequestsToSettle(server) {
    if (typeof server?.waitForRequestsIdle === 'function') {
        await server.waitForRequestsIdle();
    }
    const pendingRequests = server
        .environments?.client?._pendingRequests;
    if (!(pendingRequests instanceof Map))
        return;
    while (pendingRequests.size > 0) {
        const requests = Array.from(pendingRequests.values(), pending => pending?.request).filter(Boolean);
        if (requests.length === 0)
            return;
        await Promise.allSettled(requests);
    }
}
export function shouldReloadNotebookFile(file, watchedPaths) {
    if (isAtomicCanvasStagingFile(file))
        return false;
    if (String(file).endsWith('.canvas.jsonl'))
        return false;
    const separator = process.platform === 'win32' ? '\\' : '/';
    return watchedPaths.some(watchedPath => file === watchedPath || file.startsWith(`${watchedPath}${separator}`));
}
async function readBody(request) {
    let content = '';
    for await (const chunk of request)
        content += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    if (!content)
        return {};
    const value = JSON.parse(content);
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}
/**
 * Detect the active Notebook folder disappearing (deleted, moved, or renamed)
 * while the runtime keeps serving. When the folder vanishes, scan the old
 * parent directory once for a sibling folder whose manifest carries the same
 * stable notebook id — that recovers renames/moves within the same parent so
 * the client can offer to reopen it in place. Anything else is reported as
 * removed-or-renamed.
 */
export function createAvailabilityTracker() {
    let missing = null;
    return function availability(status) {
        if (!status.active || typeof status.root !== 'string')
            return { available: false, reason: 'no-notebook' };
        let exists = false;
        try {
            exists = fs.statSync(status.root).isDirectory();
        }
        catch {
            exists = false;
        }
        if (exists) {
            if (missing?.root === status.root)
                missing = null;
            return { available: true };
        }
        if (!missing || missing.root !== status.root) {
            missing = { root: status.root, reason: 'missing', movedTo: null };
            const id = status.notebook?.manifest?.id;
            const parent = path.dirname(status.root);
            if (id) {
                try {
                    for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
                        if (!entry.isDirectory() || entry.name === path.basename(status.root))
                            continue;
                        try {
                            const manifest = JSON.parse(fs.readFileSync(resolveNotebookManifestPath(path.join(parent, entry.name)), 'utf8'));
                            if (manifest !== null && typeof manifest === 'object'
                                && manifest.id === id) {
                                missing = { root: status.root, reason: 'moved', movedTo: path.join(parent, entry.name) };
                                break;
                            }
                        }
                        catch { /* not a Notebook manifest */ }
                    }
                }
                catch { /* the parent directory is gone too */ }
            }
        }
        return missing.movedTo
            ? { available: false, reason: 'moved', movedTo: missing.movedTo }
            : { available: false, reason: 'missing' };
    };
}
/**
 * Make one external content-only Notebook available to a stable Vite runtime.
 * The process itself never changes root, avoiding stale watchers and module
 * graphs caused by swapping a project-root symlink.
 */
export default function notebookRuntimePlugin({ initialRoot = process.env.HYPERCANVAS_NOTEBOOK_ROOT, runtime = createNotebookRuntime({ stateDirectory: resolveNotebookStateDirectory() }), filesystemGrants: suppliedFilesystemGrants = null, statefullyAdapter = null, } = {}) {
    let initialError = null;
    let server = null;
    let filesystemGrants = suppliedFilesystemGrants;
    let restartPending = false;
    let restartScheduled = false;
    const restartAttempts = [];
    const MAX_RESTARTS = 3;
    const RESTART_WINDOW_MS = 30_000;
    let watchedPaths = [];
    let siblingOrderConfigPaths = new Set();
    let siblingOrderTracker = createSiblingOrderChangeTracker(null);
    let allowedNotebookRoot = null;
    const availability = createAvailabilityTracker();
    function statefullyArtifacts(status) {
        return Array.isArray(status.notebook?.artifacts) ? status.notebook.artifacts : [];
    }
    function setStatefullyNotebook(status) {
        statefullyAdapter?.setNotebookRoot?.(status.root ?? null, statefullyArtifacts(status));
    }
    function updateNotebookWatcher() {
        const activeServer = server;
        if (!activeServer?.watcher)
            return;
        if (watchedPaths.length > 0)
            activeServer.watcher.unwatch(watchedPaths);
        const root = runtime.status().root;
        const artifacts = statefullyArtifacts(runtime.status());
        const stateRoots = root ? artifacts.flatMap(artifact => {
            const descriptorRuntime = artifact.runtime;
            if (artifact.portable !== true || artifact.kind !== 'prototype'
                || descriptorRuntime?.id !== '@dfosco/statefully' || descriptorRuntime?.version !== '0.2.1'
                || typeof artifact.folderPath !== 'string')
                return [];
            const stateRoot = path.join(root, ...artifact.folderPath.split('/'), 'state');
            try {
                return fs.statSync(stateRoot).isDirectory() ? [stateRoot] : [];
            }
            catch {
                return [];
            }
        }) : [];
        watchedPaths = [...new Set([...runtime.watchPaths(), ...stateRoots])];
        siblingOrderConfigPaths = new Set(root ? appConfigCandidates(root) : []);
        let initialConfig = null;
        for (const configPath of siblingOrderConfigPaths) {
            try {
                initialConfig = fs.readFileSync(configPath, 'utf8');
                break;
            }
            catch { /* try the legacy name */ }
        }
        siblingOrderTracker = createSiblingOrderChangeTracker(initialConfig);
        if (watchedPaths.length > 0)
            activeServer.watcher.add(watchedPaths);
    }
    function allowActiveNotebook() {
        const root = runtime.status().root;
        const allowed = server?.config?.server?.fs?.allow;
        if (!Array.isArray(allowed))
            return;
        if (allowedNotebookRoot) {
            const index = allowed.indexOf(allowedNotebookRoot);
            if (index >= 0)
                allowed.splice(index, 1);
        }
        allowedNotebookRoot = root;
        if (root && !allowed.includes(root))
            allowed.push(root);
    }
    if (initialRoot && !runtime.status().active) {
        try {
            runtime.open(initialRoot);
        }
        catch (error) {
            const record = error !== null && typeof error === 'object' ? error : {};
            // The persistent runtime must still start so its open/restart controls
            // can recover from a missing, moved, or malformed initial Notebook.
            initialError = {
                code: typeof record.code === 'string' ? record.code : 'NOTEBOOK_RUNTIME_ERROR',
                message: typeof record.message === 'string' ? record.message : String(error),
            };
        }
    }
    if (runtime.status().active)
        setStatefullyNotebook(runtime.status());
    function reload() {
        const activeServer = server;
        if (!activeServer)
            return;
        const module = activeServer.moduleGraph.getModuleById(RESOLVED_VIRTUAL_NOTEBOOK);
        if (module)
            activeServer.moduleGraph.invalidateModule(module);
        // The data index re-resolves HYPERCANVAS_NOTEBOOK_ROOT in load(), but
        // Vite serves its cached transform until the module is invalidated.
        const dataIndexModule = activeServer.moduleGraph.getModuleById(RESOLVED_DATA_INDEX);
        if (dataIndexModule)
            activeServer.moduleGraph.invalidateModule(dataIndexModule);
        // Same treatment for the data-plugin-hosted notebook prototype route map
        // used by the isolated prototypes.html iframe entry.
        const prototypeRoutesModule = activeServer.moduleGraph.getModuleById('virtual:storyboard-notebook-prototype-routes');
        if (prototypeRoutesModule)
            activeServer.moduleGraph.invalidateModule(prototypeRoutesModule);
        const documentsModule = activeServer.moduleGraph.getModuleById('\0virtual:hypercanvas-documents');
        if (documentsModule)
            activeServer.moduleGraph.invalidateModule(documentsModule);
        activeServer.__hypercanvasNotebookRoutesReload?.();
        // The unified document policy decides whether this incidental watcher
        // replacement is applied now or held for an explicit user action. Notebook
        // open/create/close use the separate restart-and-redirect path below.
        activeServer.ws.send({ type: 'full-reload' });
    }
    async function restart({ manual = false } = {}) {
        if (restartPending || !server)
            return;
        const now = Date.now();
        while (restartAttempts[0] !== undefined && restartAttempts[0] < now - RESTART_WINDOW_MS)
            restartAttempts.shift();
        if (manual)
            restartAttempts.length = 0;
        if (restartAttempts.length >= MAX_RESTARTS)
            return false;
        restartAttempts.push(now);
        restartPending = true;
        devlog('Vite restart started', { manual, attempt: restartAttempts.length });
        try {
            await waitForViteClientRequestsToSettle(server);
            await server.restart();
            devlog('Vite restart completed', { manual });
            return true;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            initialError = { code: 'NOTEBOOK_RUNTIME_RESTART_FAILED', message };
            const delay = [100, 500, 2000][restartAttempts.length] || 2000;
            devlog('Vite restart failed', { manual, delay, message });
            setTimeout(() => { void restart(); }, delay).unref?.();
            return false;
        }
        finally {
            restartPending = false;
        }
    }
    const plugin = {
        name: 'hypercanvas-notebook-runtime',
        async config(config) {
            const configuredAliases = config.resolve?.alias || [];
            const aliases = Array.isArray(configuredAliases) ? configuredAliases : Object.entries(configuredAliases).map(([find, replacement]) => ({ find, replacement }));
            const dependencies = await discoverNotebookDependencies({ notebookRoot: runtime.status().root, applicationRoot: config.root || process.cwd(), aliases });
            // Missing Notebook imports fail only when that document is requested.
            // Letting the global scanner resolve them aborts discovery of host deps.
            return { resolve: { alias: dependencies.aliases }, optimizeDeps: { include: dependencies.include, exclude: dependencies.missing, holdUntilCrawlEnd: false } };
        },
        resolveId(id) {
            if (id === VIRTUAL_NOTEBOOK)
                return RESOLVED_VIRTUAL_NOTEBOOK;
            const prefix = `${VIRTUAL_NOTEBOOK}/`;
            if (id.startsWith(prefix))
                return runtime.resolve(id.slice(prefix.length));
            return null;
        },
        load(id) {
            if (id !== RESOLVED_VIRTUAL_NOTEBOOK)
                return null;
            return `export default ${JSON.stringify(runtime.status())}`;
        },
        configureServer(nextServer) {
            const runtimeServer = nextServer;
            server = runtimeServer;
            filesystemGrants ||= runtimeServer.__hypercanvasFilesystemGrants || createFilesystemGrants();
            allowActiveNotebook();
            updateNotebookWatcher();
            // A portable document URL belongs to the selected Notebook, never the
            // application checkout. Reuse Vite's static/HTML pipeline after applying
            // the Notebook's realpath containment checks, including symlink escapes.
            runtimeServer.middlewares.use((request, response, next) => {
                const base = runtimeServer.config.base || '/';
                const prefix = `${base}notebook-assets/`;
                const url = request.url || '';
                const pathname = url.split('?')[0] || '';
                if (!pathname.startsWith(prefix))
                    return next();
                if (request.method !== 'GET' && request.method !== 'HEAD') {
                    response.statusCode = 405;
                    response.end();
                    return;
                }
                try {
                    const relative = decodeURIComponent(pathname.slice(prefix.length));
                    if (relative.includes('\\') || relative.split('/').some(segment => !segment || segment === '.' || segment === '..')) {
                        throw new Error('Invalid asset path.');
                    }
                    const assets = runtime.resolve('assets');
                    if (fs.lstatSync(assets).isSymbolicLink())
                        throw new Error('Invalid assets root.');
                    const file = runtime.resolve(`assets/${relative}`);
                    const contained = path.relative(fs.realpathSync(assets), fs.realpathSync(file));
                    if (contained === '..' || contained.startsWith(`..${path.sep}`) || path.isAbsolute(contained)
                        || !fs.statSync(file).isFile())
                        throw new Error('Asset is not a contained file.');
                    const query = url.slice(pathname.length);
                    request.url = `${base}@fs/${file.replaceAll('\\', '/').replace(/^\//, '').split('/').map(encodeURIComponent).join('/')}${query}`;
                    next();
                }
                catch {
                    response.statusCode = 404;
                    response.end('Notebook asset not found.');
                }
            });
            runtimeServer.middlewares.use(async (request, response, next) => {
                if (!request.url || (request.method !== 'GET' && request.method !== 'HEAD'))
                    return next();
                let url;
                try {
                    url = new URL(request.url, 'http://hypercanvas.local');
                }
                catch {
                    return next();
                }
                const configuredBase = runtimeServer.config.base || '/';
                const basePrefix = configuredBase.replace(/\/$/, '');
                const pathname = basePrefix && (url.pathname === basePrefix || url.pathname.startsWith(`${basePrefix}/`))
                    ? url.pathname.slice(basePrefix.length) || '/'
                    : url.pathname;
                const prefix = '/__notebook/prototypes/';
                if (!pathname.startsWith(prefix))
                    return next();
                const [encodedId, ...viewSegments] = pathname.slice(prefix.length).split('/');
                let artifactId;
                try {
                    artifactId = decodeURIComponent(encodedId || '');
                }
                catch {
                    artifactId = '';
                }
                if (!artifactId || artifactId.includes('/') || artifactId.includes('\\')) {
                    const page = statefullyDiagnosticPage('Invalid Prototype route', [{ code: 'INVALID_PROTOTYPE_ROUTE', message: 'The Prototype ID is not a valid path segment.' }], 404);
                    response.statusCode = page.status;
                    response.setHeader('Content-Type', 'text/html; charset=utf-8');
                    response.end(request.method === 'HEAD' ? undefined : page.html);
                    return;
                }
                const status = runtime.status();
                const matchingArtifacts = (status.notebook?.artifacts || []).filter(artifact => artifact.id === artifactId && artifact.kind === 'prototype' && artifact.portable === true);
                const [artifact] = matchingArtifacts;
                if (matchingArtifacts.length !== 1 || !artifact) {
                    const page = statefullyDiagnosticPage('Prototype not found', [{ code: 'PROTOTYPE_NOT_FOUND', message: `No unique portable Prototype has ID "${artifactId}" in the active Notebook.` }], 404);
                    response.statusCode = page.status;
                    response.setHeader('Content-Type', 'text/html; charset=utf-8');
                    response.end(request.method === 'HEAD' ? undefined : page.html);
                    return;
                }
                const diagnostics = Array.isArray(artifact.diagnostics) ? artifact.diagnostics : [];
                if (artifact.runtime?.id !== FIRST_LOOK_PROTOTYPE_RUNTIME.id || artifact.runtime?.version !== FIRST_LOOK_PROTOTYPE_RUNTIME.version) {
                    const page = statefullyDiagnosticPage(`Unsupported Prototype runtime: ${artifact.title || artifactId}`, [
                        { code: 'UNSUPPORTED_PROTOTYPE_RUNTIME', message: `Expected ${FIRST_LOOK_PROTOTYPE_RUNTIME.id}@${FIRST_LOOK_PROTOTYPE_RUNTIME.version}; found ${artifact.runtime?.id || 'unknown'}@${artifact.runtime?.version || 'unknown'}.` },
                    ]);
                    response.statusCode = page.status;
                    response.setHeader('Content-Type', 'text/html; charset=utf-8');
                    response.end(request.method === 'HEAD' ? undefined : page.html);
                    return;
                }
                if (!artifact.available || typeof artifact.entry !== 'string') {
                    const page = statefullyDiagnosticPage(`Prototype unavailable: ${artifact.title || artifactId}`, diagnostics);
                    response.statusCode = page.status;
                    response.setHeader('Content-Type', 'text/html; charset=utf-8');
                    response.end(request.method === 'HEAD' ? undefined : page.html);
                    return;
                }
                const notebookRoot = status.root;
                if (!notebookRoot)
                    return next();
                const artifactRoot = path.resolve(notebookRoot, ...String(artifact.folderPath).split('/'));
                const entryPath = path.resolve(artifactRoot, ...artifact.entry.split('/'));
                const relativeEntry = path.relative(artifactRoot, entryPath);
                if (relativeEntry === '..' || relativeEntry.startsWith(`..${path.sep}`) || path.isAbsolute(relativeEntry)) {
                    const page = statefullyDiagnosticPage(`Prototype unavailable: ${artifact.title || artifactId}`, [{ code: 'INVALID_PROTOTYPE_ENTRY', message: 'The entry path leaves its artifact directory.' }]);
                    response.statusCode = page.status;
                    response.setHeader('Content-Type', 'text/html; charset=utf-8');
                    response.end(request.method === 'HEAD' ? undefined : page.html);
                    return;
                }
                let html;
                try {
                    if (!fs.statSync(entryPath).isFile())
                        throw new Error('The entry is not a file.');
                    html = fs.readFileSync(entryPath, 'utf8');
                }
                catch (error) {
                    const page = statefullyDiagnosticPage(`Prototype unavailable: ${artifact.title || artifactId}`, [{ code: 'MISSING_PROTOTYPE_ENTRY', message: error instanceof Error ? error.message : String(error) }]);
                    response.statusCode = page.status;
                    response.setHeader('Content-Type', 'text/html; charset=utf-8');
                    response.end(request.method === 'HEAD' ? undefined : page.html);
                    return;
                }
                const baseHref = `${basePrefix}/__notebook/prototypes/${encodeURIComponent(artifactId)}/`;
                html = rewritePrototypeEntryAssets(html, artifactRoot, entryPath, baseHref);
                const transformed = await runtimeServer.transformIndexHtml(request.url, html);
                response.statusCode = 200;
                response.setHeader('Content-Type', 'text/html; charset=utf-8');
                response.setHeader('Cache-Control', 'no-store');
                response.end(request.method === 'HEAD' ? undefined : transformed);
                void viewSegments;
            });
            const reloadNotebook = (file = '') => {
                // Canvas state is updated in place by the data plugin's custom HMR
                // event. A competing full reload can arrive first and serve stale
                // catalog metadata, so reserve runtime reloads for Notebook structure
                // and configuration changes. Site project folders are external and
                // are not part of the Notebook watcher.
                if (!shouldReloadNotebookFile(file, watchedPaths))
                    return;
                if (siblingOrderConfigPaths.has(path.resolve(file))) {
                    let raw = null;
                    for (const configPath of siblingOrderConfigPaths) {
                        try {
                            raw = fs.readFileSync(configPath, 'utf8');
                            break;
                        }
                        catch { /* try the legacy name */ }
                    }
                    const classification = siblingOrderTracker.observe(raw);
                    if (classification === 'unchanged')
                        return;
                    if (classification === 'order-only') {
                        const status = runtime.status();
                        runtimeServer.ws.send({
                            type: 'custom',
                            event: 'storyboard:notebook-order-changed',
                            data: {
                                ...(status.notebook?.manifest?.id ? { notebookId: status.notebook.manifest.id } : {}),
                                ...(Number.isSafeInteger(status.generation) ? { generation: status.generation } : {}),
                            },
                        });
                        return;
                    }
                }
                if (/\.(flow|scene|object|record|prototype|component)\.(json|jsonc)$/i.test(file)) {
                    statefullyAdapter?.update?.();
                    return;
                }
                reload();
            };
            runtimeServer.watcher.on('add', reloadNotebook);
            // Leave ordinary code, MDX and stylesheet edits to Vite HMR instead of
            // broadcasting a competing full reload after React Fast Refresh.
            // Keep add/unlink and non-source configuration behavior unchanged.
            runtimeServer.watcher.on('change', (file) => {
                if (/\.(?:[cm]?[jt]sx?|mdx|css|scss|sass|less|styl|stylus|pcss|postcss)$/i.test(file))
                    return;
                reloadNotebook(file);
            });
            runtimeServer.watcher.on('unlink', reloadNotebook);
            runtimeServer.httpServer?.once('close', () => statefullyAdapter?.dispose?.());
            // The api-router (registered by the earlier storyboardServer plugin)
            // proxies every unknown /_hypercanvas/ prefix to a standalone server that
            // does not exist, which would 502 these routes before they get here.
            // Expose the handler so the api-router can delegate notebook-runtime
            // requests after its desktop origin guard.
            const notebookMiddleware = async (request, response, next) => {
                try {
                    if (request.method === 'GET' && request.url === '/status') {
                        const currentStatus = runtime.status();
                        sendJson(response, 200, {
                            ...currentStatus,
                            restarting: restartScheduled || restartPending,
                            error: initialError,
                            notice: currentStatus.active ? null : process.env.HYPERCANVAS_NOTEBOOK_NOTICE || null,
                            availability: availability(currentStatus),
                        });
                        return;
                    }
                    if (request.method === 'GET' && request.url === '/recent') {
                        sendJson(response, 200, { notebooks: runtime.recent() });
                        return;
                    }
                    if (request.method === 'POST' && request.url === '/forget') {
                        const { root } = await readBody(request);
                        if (typeof root !== 'string')
                            throw Object.assign(new Error('A Notebook root path is required.'), { code: 'INVALID_NOTEBOOK_ROOT' });
                        sendJson(response, 200, runtime.forget(root));
                        return;
                    }
                    if (request.method === 'POST' && request.url === '/open') {
                        const { root } = await readBody(request);
                        const grants = filesystemGrants;
                        if (!grants)
                            throw new Error('Notebook filesystem grants are unavailable.');
                        devlog('API open request', { root });
                        const existingRoots = [
                            runtime.status().root,
                            ...runtime.recent().filter(entry => entry.available).map(entry => entry.root),
                        ].filter((entry) => typeof entry === 'string' && entry.length > 0);
                        const grantRequest = { headers: request.headers };
                        const grantedRoot = grants.resolveDirectory(grantRequest, root, {
                            purpose: 'notebook',
                            allowedRoots: existingRoots,
                        });
                        const current = runtime.status();
                        if (current.active && current.root && canonicalRoot(current.root) === canonicalRoot(grantedRoot)) {
                            sendJson(response, 200, { ...current, restarting: false });
                            return;
                        }
                        const nextStatus = runtime.open(grantedRoot);
                        setStatefullyNotebook(nextStatus);
                        initialError = null;
                        process.env.HYPERCANVAS_NOTEBOOK_NOTICE = '';
                        process.env.HYPERCANVAS_NOTEBOOK_ROOT = nextStatus.root ?? '';
                        allowActiveNotebook();
                        updateNotebookWatcher();
                        const base = runtimeServer.config.base || '/';
                        restartScheduled = true;
                        sendJson(response, 200, { ...nextStatus, redirect: base, restarting: true });
                        // Stateful services capture Notebook-local stores and execution
                        // roots at startup. The client waits for this restart before it
                        // requests lazy workspace modules from the new Vite graph.
                        setTimeout(async () => {
                            try {
                                await restart({ manual: true });
                            }
                            finally {
                                restartScheduled = false;
                            }
                        }, 0).unref?.();
                        devlog('API open response', { root: nextStatus.root });
                        return;
                    }
                    if (request.method === 'POST' && request.url === '/create') {
                        const { root, title, id } = await readBody(request);
                        const grants = filesystemGrants;
                        if (!grants)
                            throw new Error('Notebook filesystem grants are unavailable.');
                        const grantedRoot = grants.resolveDirectory({ headers: request.headers }, root, { purpose: 'notebook' });
                        const nextStatus = runtime.create(grantedRoot, {
                            ...(typeof title === 'string' ? { title } : {}),
                            ...(typeof id === 'string' ? { id } : {}),
                        });
                        setStatefullyNotebook(nextStatus);
                        process.env.HYPERCANVAS_NOTEBOOK_ROOT = nextStatus.root ?? '';
                        initialError = null;
                        allowActiveNotebook();
                        updateNotebookWatcher();
                        restartScheduled = true;
                        sendJson(response, 200, { ...nextStatus, redirect: runtimeServer.config.base || '/', restarting: true });
                        setTimeout(async () => {
                            try {
                                await restart({ manual: true });
                            }
                            finally {
                                restartScheduled = false;
                            }
                        }, 0).unref?.();
                        return;
                    }
                    if (request.method === 'POST' && request.url === '/close') {
                        const nextStatus = runtime.close();
                        setStatefullyNotebook(nextStatus);
                        process.env.HYPERCANVAS_NOTEBOOK_ROOT = '';
                        updateNotebookWatcher();
                        allowActiveNotebook();
                        restartScheduled = true;
                        sendJson(response, 200, { ...nextStatus, restarting: true });
                        setTimeout(async () => {
                            try {
                                await restart({ manual: true });
                            }
                            finally {
                                restartScheduled = false;
                            }
                        }, 0).unref?.();
                        return;
                    }
                    if (request.method === 'POST' && request.url === '/restart') {
                        // Vite owns its dependency optimizer and watcher state, so use its
                        // supported restart rather than trying to recreate either in place.
                        void restart({ manual: true });
                        sendJson(response, 202, { restarting: true });
                        return;
                    }
                }
                catch (error) {
                    const record = error !== null && typeof error === 'object' ? error : {};
                    const code = typeof record.code === 'string' ? record.code : 'NOTEBOOK_RUNTIME_ERROR';
                    const message = typeof record.message === 'string' ? record.message : String(error);
                    const status = ['FILESYSTEM_ORIGIN_NOT_ALLOWED', 'FILESYSTEM_GRANT_REQUIRED', 'FILESYSTEM_GRANT_ORIGIN_MISMATCH'].includes(code) ? 403 : 422;
                    sendJson(response, status, { error: { code, message } });
                    return;
                }
                next();
            };
            runtimeServer.__hypercanvasNotebookRuntime = notebookMiddleware;
            runtimeServer.middlewares.use('/_hypercanvas/notebook-runtime', notebookMiddleware);
            // A server-level error can leave Vite's watcher or optimizer unusable.
            // One serialized restart gives the persistent desktop runtime a recovery
            // path without turning ordinary request failures into restart loops.
            runtimeServer.httpServer?.once('error', () => {
                const delay = [100, 500, 2000][restartAttempts.length] || 2000;
                setTimeout(() => { void restart(); }, delay).unref?.();
            });
        },
        transformIndexHtml() {
            if (process.env.HYPERCANVAS_ENABLE_DEV_CONTROLS !== '1')
                return [];
            return [{
                    tag: 'script',
                    injectTo: 'body',
                    children: `(() => {
          const button = document.createElement('button');
          button.type = 'button'; button.textContent = 'Restart Vite';
          button.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;padding:8px 12px;background:#24292f;color:#fff;border:1px solid #57606a;border-radius:6px;cursor:pointer';
          button.onclick = async () => { button.disabled = true; button.textContent = 'Restarting…'; await fetch('/_hypercanvas/notebook-runtime/restart', { method: 'POST' }); };
          document.body.append(button);
        })();`,
                }];
        },
    };
    return plugin;
}
