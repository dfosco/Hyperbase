import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { globSync } from 'glob';
import { isAtomicCanvasStagingFile } from '../canvas/writeGuard.js';
import { RESERVED_PUBLIC_ROUTE_ROOTS } from './first-look/contract.js';
import { inspectNotebook } from './notebook.js';
const VIRTUAL_ID = 'virtual:hypercanvas-notebook-routes';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;
function routeFiles(root, pattern, { allowPrivateAncestors = false } = {}) {
    return globSync(pattern, {
        cwd: root,
        absolute: true,
    }).filter((file) => {
        if (!fs.statSync(file).isFile())
            return false;
        const name = path.basename(file);
        const segments = path.relative(root, file).split(path.sep);
        // Legacy folder-bound pages keep the private-helper convention: files
        // under `_`-prefixed ancestor folders are never implicit pages. Suffix-
        // artifact folders are `_`-visibility-only, so their descendants always
        // scan. React Router's public `_layout` route wraps its descendants;
        // other underscore files stay private helpers either way.
        if (!allowPrivateAncestors && segments.slice(0, -1).some(segment => segment.startsWith('_')))
            return false;
        return !name.startsWith('_') || /^_layout\.(jsx|tsx|mdx)$/.test(name);
    });
}
function nestedArtifactPath(relative) {
    return relative.split('/').slice(0, -1).some(segment => /\.(prototype|component|canvas|site)$/.test(segment));
}
/**
 * Relative paths INSIDE an artifact folder keep the private-helper rule:
 * `_`-prefixed ancestor folders are source units, not routes. The owning
 * artifact folder's own `_` prefix is sidebar visibility only.
 */
function innerPrivatePath(insideArtifact) {
    return insideArtifact.split('/').slice(0, -1).some(segment => segment.startsWith('_'));
}
function artifactBoundaryPath(relative) {
    return relative.split('/').some(segment => /\.(prototype|component|canvas|site)$/.test(segment));
}
/** Whether a Notebook file event can change the generated prototype route map. */
export function isNotebookPrototypeRouteMapEvent(root, file, event) {
    if (!root || !file)
        return false;
    const absoluteRoot = path.resolve(root);
    const absoluteFile = path.resolve(file);
    const relativePath = path.relative(absoluteRoot, absoluteFile);
    if (relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath))
        return false;
    const relative = relativePath.replaceAll(path.sep, '/');
    const segments = relative.split('/');
    const filename = segments.at(-1) || '';
    const suffixPrototypeIndex = segments.findIndex(segment => segment.endsWith('.prototype'));
    const isLegacyPrototype = segments[0] === 'prototypes' && !artifactBoundaryPath(relative);
    const isSuffixPrototype = suffixPrototypeIndex >= 0
        && !segments.slice(suffixPrototypeIndex + 1, -1).some(segment => /\.(prototype|component|canvas|site)$/.test(segment));
    if (!isLegacyPrototype && !isSuffixPrototype)
        return false;
    if (filename === '.hypercanvas-artifact.json')
        return suffixPrototypeIndex >= 0;
    if (/\.prototype\.jsonc?$/i.test(filename) && suffixPrototypeIndex >= 0)
        return true;
    if (/\.flow\.json$/i.test(filename))
        return true;
    // A file's contents do not change the route map; adding or removing a
    // module changes its import inventory and can add/remove a route.
    return event !== 'change' && /\.(jsx|tsx|mdx)$/i.test(filename);
}
function addRouteModule(target, collisions, key, file) {
    if (collisions.has(key))
        return;
    const existing = target.get(key);
    if (existing && existing !== file) {
        target.delete(key);
        collisions.add(key);
        return;
    }
    target.set(key, file);
}
function flowRouteKey(route, prefix = '') {
    const routePath = route.trim().replace(/^\/+|\/+$/g, '');
    if (!routePath || routePath.split('/').some(segment => segment === '.' || segment === '..'))
        return null;
    return `/src/prototypes/${prefix ? `${prefix}/` : ''}${routePath}/index.jsx`;
}
function declaredRouteKeys(directory, relative, artifactPrefix = '') {
    const flowFiles = globSync('*.flow.json', { cwd: directory, absolute: true });
    const routes = flowFiles.map((file) => {
        try {
            const value = JSON.parse(fs.readFileSync(file, 'utf8'));
            return value !== null && typeof value === 'object' && typeof value.route === 'string'
                ? value.route
                : null;
        }
        catch {
            return null;
        }
    }).filter((route) => typeof route === 'string' && route.trim().length > 0);
    if (routes.length === 0)
        return [artifactPrefix ? `/src/prototypes/${artifactPrefix}/index.jsx` : `/src/${relative}`];
    if (artifactPrefix) {
        const rootKey = `/src/prototypes/${artifactPrefix}/index.jsx`;
        return [rootKey, ...new Set(routes.map(route => flowRouteKey(route, artifactPrefix)).filter((key) => key !== null))];
    }
    // The folder's own route stays reachable (the catalog links to it) alongside
    // the routes its flows declare.
    return [...new Set([`/src/${relative}`, ...routes.map(route => flowRouteKey(route)).filter((key) => key !== null)])];
}
function moduleMap(root, pattern, artifacts) {
    const modalOnly = pattern === 'modals';
    const modules = new Map();
    const collisions = new Set();
    const addFile = (file, relative, artifactPrefix = '', artifactDirectory = '') => {
        const name = path.basename(file);
        // Storyboard view modules are discovered through their own registry. They
        // are source units, not implicit React Router pages.
        if (name.endsWith('.view.tsx') || (modalOnly ? !name.startsWith('+') : name.startsWith('+')))
            return;
        const keys = artifactPrefix
            ? [`/src/prototypes/${artifactPrefix}/${path.relative(artifactDirectory, file).replaceAll(path.sep, '/')}`]
            : path.basename(file).startsWith('index.') ? declaredRouteKeys(path.dirname(file), relative) : [`/src/${relative}`];
        const artifactKeys = artifactPrefix && path.basename(file).startsWith('index.')
            ? declaredRouteKeys(path.dirname(file), relative, artifactPrefix)
            : keys;
        for (const key of artifactKeys)
            addRouteModule(modules, collisions, key, file);
    };
    for (const file of routeFiles(root, 'prototypes/**/*.{jsx,tsx,mdx}')) {
        const relative = path.relative(root, file).replaceAll(path.sep, '/');
        // Legacy routes retain their existing URL derivation. Files below
        // suffix-marked artifacts are added below under their flat route root.
        if (artifactBoundaryPath(relative))
            continue;
        addFile(file, relative);
    }
    for (const artifact of artifacts) {
        if (artifact.kind !== 'prototype' || !artifact.available)
            continue;
        if (artifact.portable === true)
            continue;
        const artifactName = path.posix.basename(artifact.folderPath);
        const route = `/${encodeURIComponent(artifactName)}`;
        // The catalog route is an encoded href. Module keys still use the physical
        // logical root verbatim and are normalized by the route compiler.
        if (artifact.route !== route)
            continue;
        const directory = path.join(root, ...artifact.folderPath.split('/'));
        for (const file of routeFiles(directory, '**/*.{jsx,tsx,mdx}', { allowPrivateAncestors: true })) {
            const inner = path.relative(directory, file).replaceAll(path.sep, '/');
            // Inner `_` helper folders stay private even inside a visible artifact;
            // the artifact folder's own `_` prefix is sidebar visibility only.
            if (innerPrivatePath(inner))
                continue;
            if (nestedArtifactPath(inner))
                continue;
            const relative = `${artifact.folderPath}/${inner}`;
            addFile(file, relative, artifactName, directory);
        }
    }
    return [...modules.entries()].map(([key, file]) => `${JSON.stringify(key)}: () => import(${JSON.stringify(file)})`).join(',\n');
}
function storyboardViewMap(root, artifacts) {
    const views = new Map();
    for (const file of globSync('prototypes/**/*.view.tsx', { cwd: root, absolute: true }).sort()) {
        if (!fs.statSync(file).isFile())
            continue;
        const relative = path.relative(path.join(root, 'prototypes'), file).replaceAll(path.sep, '/');
        if (!artifactBoundaryPath(relative))
            views.set(relative.replace(/\.view\.tsx$/, ''), file);
    }
    for (const artifact of artifacts) {
        if (artifact.kind !== 'prototype' || !artifact.available)
            continue;
        const directory = path.join(root, ...artifact.folderPath.split('/'));
        for (const file of globSync('**/*.view.tsx', { cwd: directory, absolute: true }).sort()) {
            if (!fs.statSync(file).isFile())
                continue;
            const relative = path.relative(directory, file).replaceAll(path.sep, '/');
            // Inner `_` helper folders stay private (see innerPrivatePath).
            if (innerPrivatePath(relative) || nestedArtifactPath(relative))
                continue;
            const id = `${path.posix.basename(artifact.folderPath)}/${relative.replace(/\.view\.tsx$/, '')}`;
            if (!views.has(id))
                views.set(id, file);
        }
    }
    return [...views].map(([id, file]) => `${JSON.stringify(id)}: () => import(${JSON.stringify(file)})`).join(',\n');
}
function routeRootsFromModuleMap(source) {
    const roots = new Set();
    for (const line of source.split('\n')) {
        const separator = line.indexOf(': () => import(');
        if (separator < 0)
            continue;
        let key;
        try {
            key = JSON.parse(line.slice(0, separator));
        }
        catch {
            continue;
        }
        const relative = key.replace(/^\/src\/prototypes\//, '').replace(/\.(jsx|tsx|mdx)$/i, '');
        const first = relative.split('/').filter(Boolean)[0];
        // Module keys contain physical names, including literal percent signs.
        // They are not encoded hrefs and must not be URI-decoded here.
        if (first)
            roots.add(first.toLocaleLowerCase('en-US'));
    }
    return roots;
}
/**
 * Build the source of the notebook prototype route map for a given root.
 *
 * Shared by `notebookRoutesPlugin` (which owns `virtual:hypercanvas-notebook-routes`
 * for the canvas SPA) and the storyboard data plugin (which serves the same map
 * under `virtual:storyboard-notebook-prototype-routes` so the library's isolated
 * iframe entry — `prototypes.html` — can route to Notebook prototypes too; the
 * data plugin is registered by every consumer config, the routes plugin only by
 * notebook-runtime ones).
 */
export function notebookPrototypeRouteSource(root) {
    const notebookRoot = root && fs.existsSync(root) ? root : null;
    const snapshot = notebookRoot ? inspectNotebook(notebookRoot) : null;
    const artifacts = snapshot?.status === 'valid' ? snapshot.artifacts : [];
    const externalRoutes = artifacts.flatMap(artifact => {
        if (artifact.kind !== 'prototype' || !artifact.available
            || !artifact.route || !artifact.externalUrl)
            return [];
        return [{ artifactId: artifact.id, route: artifact.route, title: artifact.title, url: artifact.externalUrl }];
    });
    const routeAliases = artifacts.flatMap(artifact => {
        if (artifact.kind !== 'prototype' || !artifact.available || !artifact.route)
            return [];
        return (artifact.migrationAliases?.legacyRoutes || []).map(alias => ({
            artifactId: artifact.id, from: alias.from, targetPath: alias.targetPath, route: artifact.route,
        }));
    });
    const legacyRouteRoots = new Set([
        ...routeRootsFromModuleMap(notebookRoot ? moduleMap(notebookRoot, 'routes', artifacts) : ''),
        ...routeRootsFromModuleMap(fs.existsSync(path.join(process.cwd(), 'src'))
            ? moduleMap(path.join(process.cwd(), 'src'), 'routes', []) : ''),
    ]);
    const portableIdCounts = new Map();
    for (const artifact of artifacts) {
        if (artifact.portable !== true || typeof artifact.id !== 'string')
            continue;
        const key = artifact.id.toLocaleLowerCase('en-US');
        portableIdCounts.set(key, (portableIdCounts.get(key) ?? 0) + 1);
    }
    const statefullyRoutes = artifacts.flatMap(artifact => {
        if (artifact.kind !== 'prototype' || artifact.portable !== true || !artifact.route)
            return [];
        const id = decodeURIComponent(artifact.id || '');
        const reserved = RESERVED_PUBLIC_ROUTE_ROOTS.has(id.toLocaleLowerCase('en-US'));
        const duplicate = (portableIdCounts.get(id.toLocaleLowerCase('en-US')) ?? 0) > 1;
        const legacyCollision = legacyRouteRoots.has(id.toLocaleLowerCase('en-US'));
        const collision = reserved || duplicate || legacyCollision;
        const routeDiagnostics = collision ? [...artifact.diagnostics, {
                code: 'ARTIFACT_ROUTE_CONFLICT',
                message: reserved
                    ? `Prototype ID "${id}" uses a reserved public route root.`
                    : duplicate
                        ? `Prototype ID "${id}" is duplicated across portable artifacts.`
                        : `Portable Prototype route "${artifact.route}" conflicts with an existing Hypercanvas route. Resolve the conflict before using either route.`,
                severity: 'error',
            }] : artifact.diagnostics;
        return [{
                artifactId: artifact.id,
                route: artifact.route,
                title: artifact.title,
                folderPath: artifact.folderPath,
                entry: artifact.entry ?? null,
                runtime: artifact.runtime ?? null,
                available: artifact.available,
                routeConflict: collision,
                diagnostics: routeDiagnostics.map(({ code, message, severity }) => ({ code, message, severity })),
            }];
    });
    const portableSiteRoutes = artifacts.flatMap(artifact => {
        if (artifact.kind !== 'site' || artifact.portable !== true || !artifact.route)
            return [];
        const descriptor = artifact.descriptor && typeof artifact.descriptor === 'object'
            ? artifact.descriptor
            : {};
        return [{
                id: artifact.id,
                route: artifact.route,
                title: artifact.title,
                available: artifact.available,
                diagnostics: artifact.diagnostics.map(({ code, message, severity }) => ({ code, message, severity })),
                local: descriptor.local ?? null,
                published: descriptor.published ?? null,
                views: Array.isArray(descriptor.views) ? descriptor.views : [],
            }];
    });
    return `export const PROTOTYPE_ROUTES = {${notebookRoot ? `\n${moduleMap(notebookRoot, 'routes', artifacts)}` : ''}\n}\nexport const PROTOTYPE_EXTERNAL_ROUTES = ${JSON.stringify(externalRoutes)}\nexport const PROTOTYPE_STATEFULLY_ROUTES = ${JSON.stringify(statefullyRoutes)}\nexport const PORTABLE_SITE_ROUTES = ${JSON.stringify(portableSiteRoutes)}\nexport const PROTOTYPE_MODALS = {${notebookRoot ? `\n${moduleMap(notebookRoot, 'modals', artifacts)}` : ''}\n}\nexport const STORYBOARD_VIEWS = {${notebookRoot ? `\n${storyboardViewMap(notebookRoot, artifacts)}` : ''}\n}\nexport const PROTOTYPE_ROUTE_ALIASES = ${JSON.stringify(routeAliases)}`;
}
export default function notebookRoutesPlugin({ runtime = null } = {}) {
    let server = null;
    const activeRoot = () => runtime?.status().root
        || (process.env.HYPERCANVAS_NOTEBOOK_ROOT ? path.resolve(process.env.HYPERCANVAS_NOTEBOOK_ROOT) : null)
        || (fs.existsSync(path.join(process.cwd(), 'src', 'prototypes')) ? path.join(process.cwd(), 'src') : null);
    function invalidate() {
        const activeServer = server;
        if (!activeServer)
            return;
        const module = activeServer.moduleGraph.getModuleById(RESOLVED_ID);
        if (module)
            activeServer.moduleGraph.invalidateModule(module);
        activeServer.ws.send({ type: 'full-reload' });
    }
    const plugin = {
        name: 'hypercanvas-notebook-routes',
        transform: {
            // Vite's import analysis emits filesystem IDs verbatim. Run after it so
            // physical percent signs cannot become malformed browser URL escapes.
            order: 'post',
            async handler(code) {
                const root = activeRoot();
                if (!server || !root || !code.includes('/@fs/') || !code.includes('%'))
                    return null;
                const ts = await import(/* @vite-ignore */ 'typescript').catch(() => null);
                if (!ts)
                    return null;
                const canonicalRoot = fs.realpathSync(root);
                const tree = ts.createSourceFile('module.js', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
                const edits = [];
                const visit = (node) => {
                    if (ts.isStringLiteralLike(node)) {
                        const parent = node.parent;
                        const imported = (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) && parent.moduleSpecifier === node
                            || ts.isCallExpression(parent) && parent.expression.kind === ts.SyntaxKind.ImportKeyword && parent.arguments[0] === node;
                        const offset = node.text.indexOf('/@fs/');
                        if (imported && offset >= 0) {
                            const query = node.text.indexOf('?');
                            const pathname = query < 0 ? node.text : node.text.slice(0, query);
                            const file = `/${pathname.slice(offset + '/@fs/'.length)}`;
                            if (file.includes('%')) {
                                try {
                                    const relative = path.relative(canonicalRoot, fs.realpathSync(file));
                                    if (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
                                        const value = pathname.replaceAll('%', '%25') + (query < 0 ? '' : node.text.slice(query));
                                        edits.push({ start: node.getStart(tree), end: node.end, value: JSON.stringify(value) });
                                    }
                                }
                                catch { /* Disappeared or already encoded imports remain Vite's responsibility. */ }
                            }
                        }
                    }
                    ts.forEachChild(node, visit);
                };
                visit(tree);
                if (!edits.length)
                    return null;
                for (const edit of edits.sort((a, b) => b.start - a.start))
                    code = code.slice(0, edit.start) + edit.value + code.slice(edit.end);
                return { code, map: null };
            },
        },
        resolveId(id) {
            return id === VIRTUAL_ID ? RESOLVED_ID : null;
        },
        load(id) {
            if (id !== RESOLVED_ID)
                return null;
            return notebookPrototypeRouteSource(activeRoot());
        },
        configureServer(nextServer) {
            const routeServer = nextServer;
            server = routeServer;
            // The runtime plugin calls this when the active Notebook changes. A
            // watcher event is not emitted for an environment-root switch, so the
            // virtual route index must be invalidated explicitly.
            routeServer.__hypercanvasNotebookRoutesReload = invalidate;
            const update = (file = '', event = 'add') => {
                if (isAtomicCanvasStagingFile(file))
                    return;
                const root = activeRoot();
                if (isNotebookPrototypeRouteMapEvent(root, file, event))
                    invalidate();
            };
            nextServer.watcher.on('add', (file) => update(file, 'add'));
            nextServer.watcher.on('change', (file) => update(file, 'change'));
            nextServer.watcher.on('unlink', (file) => update(file, 'unlink'));
        },
    };
    return plugin;
}
