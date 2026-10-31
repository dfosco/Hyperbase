import { execFileSync } from 'node:child_process';
import process from 'node:process';
export const ARTIFACT_MANIFEST_SCHEMA_VERSION = 1;
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function record(value) {
    return isRecord(value) ? value : {};
}
function fieldString(value, key) {
    const field = value[key];
    return typeof field === 'string' ? field : undefined;
}
function fieldRecord(value, key) {
    return record(value[key]);
}
function readGitValue(args, cwd) {
    try {
        return execFileSync('git', args, {
            cwd,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim() || null;
    }
    catch {
        return null;
    }
}
export function sanitizeBranchName(branch) {
    return String(branch ?? '')
        .replace(/[^a-zA-Z0-9._-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
}
export function resolveManifestEnv(options = {}) {
    const env = isRecord(options.env) ? options.env : process.env;
    const cwd = typeof options.cwd === 'string' ? options.cwd : process.cwd();
    const branch = fieldString(env, 'branch') || fieldString(env, 'GITHUB_REF_NAME') || readGitValue(['branch', '--show-current'], cwd) || 'main';
    const deployBranch = fieldString(env, 'deployBranch') || sanitizeBranchName(branch);
    const folder = env.folder !== undefined
        ? env.folder
        : branch === 'main'
            ? ''
            : `branch--${deployBranch}`;
    const sha = env.sha !== undefined
        ? env.sha
        : fieldString(env, 'GITHUB_SHA') || readGitValue(['rev-parse', 'HEAD'], cwd);
    return {
        branch,
        deployBranch,
        folder,
        sha: sha || null,
        generatedAt: fieldString(env, 'generatedAt') || isoNow(),
        basePath: fieldString(env, 'basePath') || fieldString(env, 'VITE_BASE_PATH') || '/',
    };
}
function isoNow() {
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}
function asEntries(collection) {
    if (Array.isArray(collection)) {
        return collection.filter(isRecord).map(item => [
            fieldString(item, 'id') || fieldString(item, 'dirName') || fieldString(item, 'name') || '',
            item,
        ]);
    }
    if (!isRecord(collection))
        return [];
    return Object.entries(collection).filter((entry) => isRecord(entry[1]));
}
function artifactMeta(item) {
    return isRecord(item.meta) ? item.meta : isRecord(item._canvasMeta) ? item._canvasMeta : {};
}
function isPrivateArtifact(..._values) {
    return false;
}
function isCrossBranchEnabled(item) {
    if (item.crossBranch === false)
        return false;
    return artifactMeta(item).crossBranch !== false;
}
function normalizeRoute(route) {
    if (!route)
        return null;
    const value = String(route);
    return value.startsWith('/') ? value : `/${value}`;
}
function normalizeTimestamp(value) {
    if (!value || (typeof value !== 'string' && typeof value !== 'number'))
        return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return null;
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
function appendTokens(url, tokens) {
    if (!isRecord(tokens))
        return url;
    const reserved = new Set(['flow', 'scene']);
    const entries = Object.entries(tokens).filter(([key, value]) => value != null && !reserved.has(key) && typeof value !== 'object');
    if (entries.length === 0)
        return url;
    const separator = url.includes('?') ? '&' : '?';
    const query = entries
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&');
    return `${url}${separator}${query}`;
}
function resolveFlowRoute(flowKey, flowData = {}) {
    const meta = fieldRecord(flowData, 'meta');
    const explicitRoute = fieldString(flowData, 'route') || fieldString(meta, 'route') ||
        fieldString(fieldRecord(flowData, 'flowMeta'), 'route') || fieldString(fieldRecord(flowData, 'sceneMeta'), 'route');
    const baseRoute = normalizeRoute(explicitRoute || flowData._route);
    const route = baseRoute
        ? meta.default === true
            ? baseRoute
            : `${baseRoute}?flow=${encodeURIComponent(flowKey)}`
        : `/?flow=${encodeURIComponent(flowKey)}`;
    return appendTokens(route, flowData.tokens);
}
function prototypeFlows(discovery, dirName, proto) {
    if (Array.isArray(proto.flows)) {
        return proto.flows.filter(isRecord).map(flow => ({
            key: fieldString(flow, 'key') || '',
            name: fieldString(flow, 'name') || '',
            route: fieldString(flow, 'route') || '',
            meta: isRecord(flow.meta) ? flow.meta : null,
            data: isRecord(flow.data) ? flow.data : flow,
        }));
    }
    return asEntries(discovery.flows)
        .filter(([flowKey]) => flowKey.startsWith(`${dirName}/`))
        .map(([flowKey, flowData]) => ({
        key: flowKey,
        name: flowKey.slice(dirName.length + 1),
        route: resolveFlowRoute(flowKey, flowData),
        meta: isRecord(flowData.meta) ? flowData.meta : isRecord(flowData.flowMeta) ? flowData.flowMeta : isRecord(flowData.sceneMeta) ? flowData.sceneMeta : null,
        data: flowData,
    }));
}
function resolvePrototypeRoute(discovery, dirName, proto, isExternal) {
    if (isExternal)
        return null;
    const route = fieldString(proto, 'route');
    if (route)
        return normalizeRoute(route);
    const flows = prototypeFlows(discovery, dirName, proto);
    const defaultFlow = flows.find(flow => flow.meta?.default === true || fieldRecord(flow.data, 'meta').default === true);
    const flow = defaultFlow || flows[0];
    if (flow)
        return flow.route || resolveFlowRoute(flow.key || flow.name, flow.data);
    return `/${dirName}`;
}
function titleCase(value) {
    return String(value || '')
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}
function canvasRoute(canvasId, data) {
    return normalizeRoute(fieldString(data, 'route') || fieldString(data, '_route')) || `/canvas/${canvasId}`;
}
function prototypeEntryMap(discovery) {
    const prototypes = new Map();
    for (const [key, proto] of asEntries(discovery.prototypes)) {
        const dirName = fieldString(proto, 'dirName') || fieldString(proto, 'id') || key;
        if (dirName)
            prototypes.set(dirName, proto);
    }
    for (const [flowKey] of asEntries(discovery.flows)) {
        const slashIdx = flowKey.indexOf('/');
        if (slashIdx <= 0)
            continue;
        const dirName = flowKey.slice(0, slashIdx);
        if (!prototypes.has(dirName))
            prototypes.set(dirName, {});
    }
    return [...prototypes.entries()];
}
function buildPrototypeEntries(discovery) {
    return prototypeEntryMap(discovery)
        .filter(([dirName, proto]) => dirName && !isPrivateArtifact(proto, dirName) && isCrossBranchEnabled(proto))
        .map(([dirName, proto]) => {
        const meta = artifactMeta(proto);
        const isExternal = Boolean(proto.isExternal ?? proto.url ?? proto.externalUrl);
        return {
            id: dirName,
            dirName,
            title: fieldString(meta, 'title') || fieldString(proto, 'title') || fieldString(proto, 'name') || dirName,
            description: meta.description || proto.description || null,
            folder: proto.folder || null,
            isExternal,
            externalUrl: isExternal ? proto.externalUrl || proto.url || null : null,
            route: resolvePrototypeRoute(discovery, dirName, proto, isExternal),
            isPrivate: false,
            crossBranch: true,
            lastModified: normalizeTimestamp(proto.lastModified),
        };
    })
        .sort((a, b) => a.id.localeCompare(b.id));
}
function canvasPageEntry(canvasId, data, isPrivate) {
    const segment = canvasId.split('/').pop() || '';
    return {
        id: canvasId,
        name: data.name || data.title || titleCase(segment),
        route: canvasRoute(canvasId, data),
        isPrivate,
    };
}
function buildCanvasEntries(discovery) {
    const entries = [];
    const seenGroups = new Map();
    for (const [key, data] of asEntries(discovery.canvases)) {
        const canvasId = fieldString(data, 'id') || fieldString(data, 'dirName') || key;
        if (!canvasId || isPrivateArtifact(data, canvasId) || !isCrossBranchEnabled(data))
            continue;
        const meta = artifactMeta(data);
        const group = fieldString(data, 'group') || fieldString(data, '_group') || null;
        const folder = fieldString(data, 'folder') || fieldString(data, '_folder') || null;
        const page = canvasPageEntry(canvasId, data, false);
        if (group && seenGroups.has(group)) {
            const existing = entries[seenGroups.get(group) ?? -1];
            if (existing) {
                if (!existing.pages) {
                    existing.pages = [{ id: existing.id, name: existing.name, route: existing.route, isPrivate: existing.isPrivate }];
                }
                existing.pages.push(page);
            }
            continue;
        }
        const pages = Array.isArray(data.pages)
            ? data.pages
                .filter(isRecord)
                .map((item) => ({ ...item, id: fieldString(item, 'id') || fieldString(item, 'dirName') || fieldString(item, 'name') }))
                .filter((item) => Boolean(item.id) && !isPrivateArtifact(item, item.id))
                .map((item) => ({
                id: item.id,
                name: item.name || item.title || item.id,
                route: canvasRoute(item.id, item),
                isPrivate: false,
            }))
            : null;
        const manifestEntry = {
            id: canvasId,
            name: fieldString(meta, 'title') || fieldString(data, 'name') || fieldString(data, 'title') || canvasId,
            folder,
            route: page.route,
            isPrivate: false,
            crossBranch: true,
            group,
            pages,
            lastModified: normalizeTimestamp(data.lastModified),
        };
        if (group)
            seenGroups.set(group, entries.length);
        entries.push(manifestEntry);
    }
    return entries.sort((a, b) => a.id.localeCompare(b.id));
}
function buildFolderEntries(discovery) {
    return asEntries(discovery.folders)
        .map(([key, folder]) => {
        const name = fieldString(folder, 'dirName') || fieldString(folder, 'id') || key || fieldString(folder, 'name') || '';
        return [name, folder];
    })
        .filter(([name, folder]) => name && !isPrivateArtifact(folder, name) && isCrossBranchEnabled(folder))
        .map(([name, folder]) => {
        const meta = artifactMeta(folder);
        return {
            name,
            title: fieldString(folder, 'title') || fieldString(meta, 'title') || name,
            isPrivate: false,
        };
    })
        .sort((a, b) => a.name.localeCompare(b.name));
}
export function buildArtifactManifest(options = {}) {
    const discovery = isRecord(options.discovery) ? options.discovery : {};
    const env = isRecord(options.env) ? options.env : {};
    const branch = fieldString(env, 'branch') || 'main';
    const deployBranch = fieldString(env, 'deployBranch') || sanitizeBranchName(branch);
    const folder = env.folder !== undefined
        ? env.folder
        : branch === 'main'
            ? ''
            : `branch--${deployBranch}`;
    return {
        schemaVersion: ARTIFACT_MANIFEST_SCHEMA_VERSION,
        branch,
        deployBranch,
        folder,
        sha: env.sha ?? null,
        generatedAt: fieldString(env, 'generatedAt') || isoNow(),
        basePath: fieldString(env, 'basePath') || '/',
        prototypes: buildPrototypeEntries(discovery),
        canvases: buildCanvasEntries(discovery),
        folders: buildFolderEntries(discovery),
    };
}
