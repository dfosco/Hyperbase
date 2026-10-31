import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { artifactFolderLogicalName, artifactFolderVisibilityPrefix } from '../artifact/visibility.js';
export { normalizeSiteId, normalizeSiteRoute, normalizeSiteUrl, parseSiteUrl, resolveSiteUrl, resolveSiteDevelopmentUrl, sitePreviewPath, siteRouteFromPreviewUrl, siteRouteForUrl } from './contract.js';
import { normalizeSiteId, normalizeSiteUrl } from './contract.js';
export const SITE_FORMAT_VERSION = 1;
export const SITE_RUNTIME_DIR = '.hypercanvas';
export const LEGACY_SITE_RUNTIME_DIR = '.storyboard';
export const SITE_DESCRIPTOR_FILE = 'site.config.json';
export const SITE_ARTIFACT_MARKER_FILE = '.hypercanvas-artifact.json';
export const NOTEBOOK_INFRASTRUCTURE_DIRECTORIES = new Set([
    '.git', '.hypercanvas', '.storyboard', '.vite', 'node_modules', 'build', 'coverage', 'dist',
    'publish', 'public', 'storybook-static', '.storyboard-public',
]);
function resolveRuntimeDirSite(root) {
    // The active aggregate file decides the directory, so a Notebook that still
    // carries `sites.config.json` under the legacy name keeps working until its
    // startup migration runs; the primary name wins for fresh state and writes.
    const primary = path.join(root, '.hypercanvas');
    const legacy = path.join(root, '.storyboard');
    if (fs.existsSync(path.join(primary, 'sites.config.json')))
        return primary;
    if (fs.existsSync(path.join(legacy, 'sites.config.json')))
        return legacy;
    return primary;
}
/**
 * Site descriptors keep whichever runtime directory the project already has.
 * The active file lives under the active runtime directory; the very old
 * `.storyboard/sites.json` layout is read for migration/diagnostics only.
 */
/** Relative sites.config.json path inside the active runtime directory. */
export function siteConfigRelativePath(root) {
    return `${path.relative(root, resolveRuntimeDirSite(root)).replace(/\\/g, '/')}/sites.config.json`;
}
export function siteDescriptorRelativePath(folderPath) {
    return `${folderPath.replaceAll('\\', '/').replace(/\/$/, '')}/${SITE_DESCRIPTOR_FILE}`;
}
export function siteFolderPath(root, id, parentPath = '') {
    const siteId = normalizeSiteId(id);
    const normalizedParent = parentPath.replaceAll('\\', '/');
    if (normalizedParent.startsWith('/') || path.win32.isAbsolute(parentPath)) {
        throw Object.assign(new Error(`Site parent must be a relative ordinary Notebook folder: ${parentPath}`), { code: 'ARTIFACT_NESTING' });
    }
    const segments = normalizedParent ? normalizedParent.split('/') : [];
    if (segments.some(segment => !segment || segment === '.' || segment === '..' || /\.(prototype|component|canvas|site)$/.test(segment))) {
        throw Object.assign(new Error(`Site parent must be an ordinary Notebook folder: ${parentPath}`), { code: 'ARTIFACT_NESTING' });
    }
    const rootPath = fs.realpathSync.native(path.resolve(root));
    const parent = path.resolve(rootPath, ...segments);
    if (!isWithinRoot(rootPath, parent) || !isDirectory(parent))
        throw new Error(`Site parent folder does not exist: ${parentPath || '.'}`);
    let current = rootPath;
    for (const segment of segments) {
        current = path.join(current, segment);
        const stat = fs.lstatSync(current);
        if (stat.isSymbolicLink() || !stat.isDirectory()) {
            throw Object.assign(new Error(`Site parent must be an ordinary Notebook folder: ${parentPath}`), { code: 'ARTIFACT_NESTING' });
        }
    }
    if (!isWithinRoot(rootPath, fs.realpathSync.native(parent)))
        throw runtimePathError();
    return path.posix.join(...segments, `${siteId}.site`);
}
const LEGACY_SITE_RUNTIME_FILE = '.storyboard/sites.json';
export const SITE_RUNTIME_FILE = LEGACY_SITE_RUNTIME_FILE;
export function readSiteDescriptorFile(file, fallbackId) {
    const value = readJson(file, null);
    if (!isRecord(value))
        throw new Error(`Site descriptor must contain a JSON object: ${file}`);
    return normalizeSiteDescriptor({ ...value, id: value.id ?? fallbackId ?? '' });
}
export function isReservedSiteEnvironmentKey(key) {
    return /^(?:(?:HYPERCANVAS|PASEO)_|ELECTRON_RUN_AS_NODE$)/i.test(String(key || ''));
}
function safeSiteEnvironment(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return {};
    return Object.fromEntries(Object.entries(value).filter(([key]) => !isReservedSiteEnvironmentKey(key)));
}
export function normalizeSiteDescriptor(value = {}) {
    const id = normalizeSiteId(value.id);
    const deployments = {};
    for (const [name, deployment] of Object.entries(value.deployments ?? {})) {
        if (!/^[a-z0-9][a-z0-9-]*$/.test(name))
            throw new Error(`Invalid Site deployment name: ${name}`);
        deployments[name] = { baseUrl: normalizeSiteUrl(deployment?.baseUrl, { label: `${name} base URL` }) };
    }
    const defaultDeployment = value.defaultDeployment ?? (deployments.production ? 'production' : Object.keys(deployments)[0] ?? null);
    if (defaultDeployment && !deployments[String(defaultDeployment)])
        throw new Error(`Unknown default Site deployment: ${defaultDeployment}`);
    return {
        $schema: 'https://schemas.dfosco.dev/hypercanvas/site/v1.json',
        formatVersion: SITE_FORMAT_VERSION,
        id,
        title: String(value.title ?? id),
        defaultDeployment,
        deployments,
        ...(value.description === undefined ? {} : { description: String(value.description ?? '') }),
        capture: { waitUntil: value.capture?.waitUntil ?? 'networkidle', delayMs: bounded(value.capture?.delayMs, 0, 30000, 250) },
    };
}
export function updateSiteDescriptor(current, updates = {}) {
    const currentRecord = isRecord(current) ? current : {};
    const updateRecord = isRecord(updates) ? updates : {};
    const next = { ...currentRecord };
    if (updateRecord.title !== undefined)
        next.title = updateRecord.title;
    if (updateRecord.description !== undefined)
        next.description = updateRecord.description;
    if (updateRecord.deployments !== undefined)
        next.deployments = updateRecord.deployments;
    if (updateRecord.defaultDeployment !== undefined)
        next.defaultDeployment = updateRecord.defaultDeployment;
    const productionBaseUrl = updateRecord.productionBaseUrl !== undefined ? updateRecord.productionBaseUrl : updateRecord.deployUrl;
    if (productionBaseUrl !== undefined) {
        const deployments = { ...(next.deployments || {}) };
        if (productionBaseUrl === null || String(productionBaseUrl).trim() === '')
            delete deployments.production;
        else
            deployments.production = { ...deployments.production, baseUrl: String(productionBaseUrl).trim() };
        next.deployments = deployments;
        if (next.defaultDeployment === 'production' && !deployments.production) {
            next.defaultDeployment = Object.keys(deployments)[0] ?? null;
        }
    }
    return normalizeSiteDescriptor(next);
}
export function normalizeSiteBinding(value = {}) {
    const source = value.source ?? (value.startCommand || value.root || value.workspaceId || value.scriptName ? 'managed' : 'url');
    if (!['url', 'managed'].includes(source))
        throw new Error(`Unsupported Site source: ${source}`);
    const developmentBaseUrl = value.developmentBaseUrl ? normalizeSiteUrl(value.developmentBaseUrl, { loopbackOnly: true, label: 'development base URL' }) : null;
    if (!developmentBaseUrl && source !== 'managed')
        throw new Error('Missing required development base URL');
    // Provenance distinguishes explicit user configuration (`manual`) from
    // automatically discovered configuration (`discovered`); discovery must
    // never overwrite a manual URL. Legacy bindings without a marker are
    // treated as discovered. The marker is only meaningful alongside a URL.
    const developmentBaseUrlSource = value.developmentBaseUrlSource && ['manual', 'discovered'].includes(value.developmentBaseUrlSource) ? value.developmentBaseUrlSource : null;
    return {
        source,
        ...(value.workspaceId ? { workspaceId: String(value.workspaceId).trim() } : {}),
        ...(value.scriptName ? { scriptName: String(value.scriptName).trim() } : {}),
        ...(value.serviceName ? { serviceName: String(value.serviceName).trim() } : {}),
        ...(value.root ? { root: path.resolve(value.root) } : {}),
        ...(value.startCommand ? { startCommand: String(value.startCommand).trim() } : {}),
        ...(value.env && typeof value.env === 'object' ? { env: safeSiteEnvironment(value.env) } : {}),
        ...(value.terminalSessionId ? { terminalSessionId: String(value.terminalSessionId).trim() } : {}),
        ...(typeof value.legacyPid === 'number' && Number.isInteger(value.legacyPid) && value.legacyPid > 0 ? { legacyPid: value.legacyPid } : {}),
        ...(developmentBaseUrl ? { developmentBaseUrl } : {}),
        ...(developmentBaseUrl && developmentBaseUrlSource ? { developmentBaseUrlSource } : {}),
        status: value.status ?? 'stopped',
        pid: typeof value.pid === 'number' && Number.isInteger(value.pid) && value.pid > 0 ? value.pid : null,
        revision: typeof value.revision === 'number' && Number.isInteger(value.revision) && value.revision >= 0 ? value.revision : 0,
        updatedAt: value.updatedAt ?? new Date().toISOString(),
    };
}
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function recordOfRecords(value) {
    if (!isRecord(value))
        return {};
    return Object.fromEntries(Object.entries(value).filter((entry) => isRecord(entry[1])));
}
function runtimePathError() {
    const error = new Error('Notebook runtime path resolves outside its filesystem root.');
    error.code = 'UNSAFE_NOTEBOOK_PATH';
    return error;
}
function isWithinRoot(root, target) {
    const relative = path.relative(root, target);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
function resolveSiteRuntimePath(root, relativePath) {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath))
        throw runtimePathError();
    const resolvedRoot = path.resolve(root);
    const runtimeRoot = resolveRuntimeDirSite(resolvedRoot);
    const destination = path.resolve(runtimeRoot, relativePath);
    if (!isWithinRoot(runtimeRoot, destination))
        throw runtimePathError();
    try {
        const runtimeInfo = fs.lstatSync(runtimeRoot);
        if (runtimeInfo.isSymbolicLink() || !isWithinRoot(resolvedRoot, fs.realpathSync.native(runtimeRoot)))
            throw runtimePathError();
    }
    catch (error) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT')
            throw error;
    }
    try {
        const destinationInfo = fs.lstatSync(destination);
        if (destinationInfo.isSymbolicLink() || !isWithinRoot(resolvedRoot, fs.realpathSync.native(destination)))
            throw runtimePathError();
    }
    catch (error) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT')
            throw error;
    }
    return destination;
}
function persistableBinding(value) {
    const binding = normalizeSiteBinding(value);
    const persisted = { ...binding };
    delete persisted.status;
    delete persisted.pid;
    return persisted;
}
function mergeSiteRecords(legacyDescriptor, currentRecord, legacyBinding) {
    const descriptor = normalizeSiteDescriptor({ ...(legacyDescriptor || {}), ...(currentRecord || {}) });
    const binding = { ...(legacyBinding || {}), ...(legacyDescriptor?.binding || {}), ...(currentRecord?.binding || {}) };
    const record = { ...descriptor };
    if (Object.keys(binding).length > 0) {
        try {
            record.binding = persistableBinding(binding);
        }
        catch { /* keep an incomplete legacy binding out of the new config */ }
    }
    return record;
}
export class SiteStore {
    root;
    legacySiteDescriptorsRoot;
    resolveRuntimePath;
    configPath;
    legacyRuntimePath;
    legacyRuntimeStates;
    constructor(notebookRoot) {
        this.root = fs.realpathSync.native(path.resolve(notebookRoot));
        this.legacySiteDescriptorsRoot = path.join(this.root, 'sites');
        this.resolveRuntimePath = relativePath => resolveSiteRuntimePath(this.root, relativePath);
        this.configPath = this.resolveRuntimePath('sites.config.json');
        this.legacyRuntimePath = this.resolveRuntimePath('sites.json');
        this.legacyRuntimeStates = new Map();
    }
    listEntries() {
        const entries = this.readPortableEntries();
        const byId = new Map();
        const ambiguous = new Set();
        for (const entry of entries) {
            if (byId.has(entry.site.id)) {
                byId.delete(entry.site.id);
                ambiguous.add(entry.site.id);
            }
            else if (!ambiguous.has(entry.site.id))
                byId.set(entry.site.id, entry);
        }
        for (const legacy of this.readLegacyDescriptors()) {
            if (byId.has(legacy.site.id) || ambiguous.has(legacy.site.id))
                continue;
            byId.set(legacy.site.id, legacy);
        }
        const legacyRuntime = this.readLegacyRuntimeBindings();
        for (const [id, binding] of Object.entries(legacyRuntime)) {
            if (byId.has(id) || ambiguous.has(id))
                continue;
            try {
                byId.set(id, { site: normalizeSiteDescriptor({ id, title: binding.title || id }), folderPath: null, artifactId: null });
            }
            catch { /* ignore invalid legacy Site IDs */ }
        }
        return [...byId.values()].sort((a, b) => a.site.id.localeCompare(b.site.id));
    }
    list() {
        return this.listEntries().map(entry => this.withBinding(entry.site));
    }
    get(id) {
        const entry = this.listEntries().find(candidate => candidate.site.id === normalizeSiteId(id));
        return entry ? this.withBinding(entry.site) : null;
    }
    upsert(value, { parentPath = '' } = {}) {
        const site = normalizeSiteDescriptor(value);
        const existing = this.listEntries().find(candidate => candidate.site.id === site.id);
        const folderPath = existing?.folderPath ?? this.newFolderPath(site.id, parentPath);
        if (!existing && fs.existsSync(path.join(this.root, ...folderPath.split('/')))) {
            throw new Error(`Site folder already exists: ${folderPath}`);
        }
        this.writeDescriptor(folderPath, site, existing?.artifactId ?? null);
        return site;
    }
    move(id, parentPath) {
        const siteId = normalizeSiteId(id);
        const entry = this.listEntries().find(candidate => candidate.site.id === siteId);
        if (!entry?.folderPath)
            throw new Error(`Site "${siteId}" must be created in a .site folder before it can be moved`);
        const visibilityPrefix = artifactFolderVisibilityPrefix(path.posix.basename(entry.folderPath));
        const destination = this.newFolderPath(siteId, parentPath, visibilityPrefix);
        if (destination === entry.folderPath)
            return this.withBinding(entry.site);
        const absoluteDestination = path.join(this.root, ...destination.split('/'));
        if (fs.existsSync(absoluteDestination))
            throw new Error(`Site folder already exists: ${destination}`);
        fs.renameSync(path.join(this.root, ...entry.folderPath.split('/')), absoluteDestination);
        return this.withBinding(entry.site);
    }
    rename(id, newId) {
        const siteId = normalizeSiteId(id);
        const nextId = normalizeSiteId(newId);
        const entry = this.listEntries().find(candidate => candidate.site.id === siteId);
        if (!entry)
            throw new Error(`Site not found: ${siteId}`);
        if (nextId === siteId)
            return this.withBinding(entry.site);
        if (this.get(nextId))
            throw new Error(`Site already exists: ${nextId}`);
        if (!entry.folderPath)
            throw new Error(`Site "${siteId}" must be created in a .site folder before it can be renamed`);
        const parentPath = path.posix.dirname(entry.folderPath) === '.' ? '' : path.posix.dirname(entry.folderPath);
        const visibilityPrefix = artifactFolderVisibilityPrefix(path.posix.basename(entry.folderPath));
        const destination = this.newFolderPath(nextId, parentPath, visibilityPrefix);
        const absoluteDestination = path.join(this.root, ...destination.split('/'));
        if (fs.existsSync(absoluteDestination))
            throw new Error(`Site folder already exists: ${destination}`);
        const updated = normalizeSiteDescriptor({ ...entry.site, id: nextId });
        fs.renameSync(path.join(this.root, ...entry.folderPath.split('/')), absoluteDestination);
        writeJsonAtomic(path.join(absoluteDestination, SITE_DESCRIPTOR_FILE), updated);
        const registry = this.readRuntimeRegistry();
        if (registry.bindings[siteId]) {
            registry.bindings[nextId] = registry.bindings[siteId];
            delete registry.bindings[siteId];
            this.writeRuntimeRegistry(registry);
        }
        this.renameLegacyRuntimeBinding(siteId, nextId);
        return this.withBinding(updated);
    }
    remove(id) {
        const siteId = normalizeSiteId(id);
        const entry = this.listEntries().find(candidate => candidate.site.id === siteId);
        const existed = Boolean(entry);
        if (!existed)
            return false;
        if (entry?.folderPath)
            fs.rmSync(path.join(this.root, ...entry.folderPath.split('/')), { recursive: true, force: true });
        this.removeLegacyDescriptor(siteId);
        this.removeBinding(siteId);
        return true;
    }
    getBinding(id) {
        const siteId = normalizeSiteId(id);
        const runtime = readJson(this.configPath, {});
        const runtimeBinding = isRecord(runtime.bindings) && isRecord(runtime.bindings[siteId]) ? runtime.bindings[siteId] : null;
        const legacyConfig = isRecord(runtime.sites) && isRecord(runtime.sites[siteId]) && isRecord(runtime.sites[siteId].binding)
            ? runtime.sites[siteId].binding
            : null;
        const legacyBinding = this.readLegacyRuntimeBindings()[siteId];
        const binding = runtimeBinding ?? legacyConfig ?? legacyBinding;
        if (!binding)
            return null;
        return normalizeSiteBinding({ ...binding, ...(this.legacyRuntimeStates.get(siteId) || {}) });
    }
    upsertBinding(id, value) {
        const siteId = normalizeSiteId(id);
        const updates = isRecord(value) ? value : {};
        const reservedKeys = Object.keys(updates.env || {}).filter(isReservedSiteEnvironmentKey);
        if (reservedKeys.length) {
            const error = new Error(`Site environment cannot override reserved Core/Paseo variables: ${reservedKeys.join(', ')}`);
            error.code = 'SITE_RESERVED_ENVIRONMENT';
            throw error;
        }
        const current = this.getBinding(siteId) ?? { source: 'managed' };
        const hasPersistentUpdates = Object.keys(updates).some(key => key !== 'status' && key !== 'pid');
        const binding = normalizeSiteBinding({
            ...current,
            ...updates,
            revision: updates.revision ?? ((current.revision ?? 0) + (hasPersistentUpdates ? 1 : 0)),
        });
        if (hasPersistentUpdates) {
            const registry = this.readRuntimeRegistry();
            registry.bindings[siteId] = persistableBinding(binding);
            this.writeRuntimeRegistry(registry);
        }
        return binding;
    }
    removeBinding(id) {
        const siteId = normalizeSiteId(id);
        const registry = this.readRuntimeRegistry();
        const hadRuntimeBinding = Boolean(registry.bindings[siteId]);
        delete registry.bindings[siteId];
        if (hadRuntimeBinding)
            this.writeRuntimeRegistry(registry);
        this.legacyRuntimeStates.delete(siteId);
        const hadLegacyBinding = this.removeLegacyRuntimeBinding(siteId);
        return hadRuntimeBinding || hadLegacyBinding;
    }
    bindings() {
        const registry = this.readRuntimeRegistry();
        const legacy = this.readLegacyRuntimeBindings();
        const ids = new Set([...Object.keys(registry.bindings), ...Object.keys(legacy)]);
        return Object.fromEntries([...ids].map(id => [id, this.getBinding(id)]));
    }
    readState(_options = {}) {
        const configPath = this.resolveRuntimePath('sites.config.json');
        const legacyRuntimePath = this.resolveRuntimePath('sites.json');
        this.configPath = configPath;
        this.legacyRuntimePath = legacyRuntimePath;
        const sites = {};
        for (const { site } of this.listEntries()) {
            sites[site.id] = { ...site, ...(this.getBinding(site.id) ? { binding: this.getBinding(site.id) } : {}) };
        }
        for (const [id, binding] of Object.entries(this.readLegacyRuntimeBindings())) {
            if (!sites[id]) {
                try {
                    const runtimeBinding = this.getBinding(id);
                    sites[id] = { ...normalizeSiteDescriptor({ id, title: binding.title || id }), ...(runtimeBinding ? { binding: runtimeBinding } : {}) };
                }
                catch { /* ignore invalid legacy Site IDs */ }
            }
        }
        return { formatVersion: SITE_FORMAT_VERSION, sites };
    }
    migrateLegacy() {
        return this.readState();
    }
    getLegacyRuntimeState(id) {
        const siteId = normalizeSiteId(id);
        return this.legacyRuntimeStates.get(siteId) ?? null;
    }
    clearLegacyRuntimeState(id) {
        this.legacyRuntimeStates.delete(normalizeSiteId(id));
    }
    writeState(sites) {
        const registry = this.readRuntimeRegistry();
        for (const [id, value] of Object.entries(sites || {})) {
            if (value.binding)
                registry.bindings[normalizeSiteId(id)] = persistableBinding(value.binding);
        }
        this.writeRuntimeRegistry(registry);
    }
    withBinding(site) {
        const binding = this.getBinding(site.id);
        return { ...site, ...(binding ? { binding } : {}) };
    }
    readPortableEntries() {
        const found = [];
        const rootRealPath = fs.realpathSync.native(this.root);
        const walk = (directory, relativeDirectory) => {
            let entries;
            try {
                entries = fs.readdirSync(directory, { withFileTypes: true });
            }
            catch {
                return;
            }
            entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
            for (const entry of entries) {
                if (!entry.isDirectory() || entry.isSymbolicLink() || NOTEBOOK_INFRASTRUCTURE_DIRECTORIES.has(entry.name))
                    continue;
                const child = path.join(directory, entry.name);
                let realChild;
                try {
                    realChild = fs.realpathSync.native(child);
                }
                catch {
                    continue;
                }
                if (!isWithinRoot(rootRealPath, realChild))
                    continue;
                const relative = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
                const suffix = /\.(prototype|component|canvas|site)$/.exec(entry.name)?.[1];
                if (suffix) {
                    if (suffix === 'site') {
                        const markerPath = path.join(child, SITE_ARTIFACT_MARKER_FILE);
                        const configPath = path.join(child, SITE_DESCRIPTOR_FILE);
                        try {
                            if (!fs.lstatSync(configPath).isFile())
                                continue;
                            let artifactId = null;
                            try {
                                if (!fs.lstatSync(markerPath).isFile())
                                    continue;
                                const marker = readJson(markerPath, {});
                                if (marker.formatVersion !== 1 || marker.kind !== 'site' || typeof marker.id !== 'string' || !marker.id.trim())
                                    continue;
                                artifactId = marker.id;
                            }
                            catch (error) {
                                if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT')
                                    throw error;
                            }
                            const idFallback = artifactFolderLogicalName(entry.name)?.toLowerCase()
                                || entry.name.slice(0, -'.site'.length).replace(/^_+/, '').toLowerCase();
                            const site = readSiteDescriptorFile(configPath, idFallback);
                            if (artifactFolderLogicalName(entry.name)?.toLowerCase() !== site.id.toLowerCase())
                                continue;
                            found.push({ site, folderPath: relative, artifactId });
                        }
                        catch { /* invalid artifacts are diagnosed by the notebook catalog */ }
                    }
                    continue;
                }
                walk(child, relative);
            }
        };
        walk(this.root, '');
        return found;
    }
    readLegacyDescriptors() {
        const found = [];
        const runtime = readJson(this.configPath, {});
        for (const [rawId, rawValue] of Object.entries(isRecord(runtime.sites) ? runtime.sites : {})) {
            if (!isRecord(rawValue))
                continue;
            try {
                const descriptor = normalizeSiteDescriptor({ ...rawValue, id: rawValue.id ?? rawId });
                found.push({ site: mergeSiteRecords(descriptor, null, isRecord(rawValue.binding) ? rawValue.binding : undefined), folderPath: null, artifactId: null });
            }
            catch { /* compatibility data remains untouched */ }
        }
        if (isDirectory(this.legacySiteDescriptorsRoot)) {
            for (const name of fs.readdirSync(this.legacySiteDescriptorsRoot).filter(value => value.endsWith('.site.json')).sort()) {
                const raw = readJson(path.join(this.legacySiteDescriptorsRoot, name), null);
                if (!isRecord(raw))
                    continue;
                try {
                    found.push({ site: normalizeSiteDescriptor(raw), folderPath: null, artifactId: null });
                }
                catch { /* compatibility data remains untouched */ }
            }
        }
        const unique = new Map();
        for (const entry of found)
            if (!unique.has(entry.site.id))
                unique.set(entry.site.id, entry);
        return [...unique.values()];
    }
    readRuntimeRegistry() {
        const configPath = this.resolveRuntimePath('sites.config.json');
        this.configPath = configPath;
        const config = readJson(configPath, {});
        return {
            formatVersion: SITE_FORMAT_VERSION,
            sites: recordOfRecords(config.sites),
            bindings: recordOfRecords(config.bindings),
        };
    }
    writeRuntimeRegistry(registry) {
        const configPath = this.resolveRuntimePath('sites.config.json');
        this.configPath = configPath;
        fs.mkdirSync(path.dirname(configPath), { recursive: true });
        ensureRuntimeDirectoryIgnored(this.root);
        writeJsonAtomic(configPath, { formatVersion: SITE_FORMAT_VERSION, sites: registry.sites, bindings: registry.bindings });
    }
    readLegacyRuntimeBindings() {
        const legacyPath = this.resolveRuntimePath('sites.json');
        this.legacyRuntimePath = legacyPath;
        const legacy = readJson(legacyPath, {});
        const bindings = {};
        for (const [rawId, rawValue] of Object.entries(isRecord(legacy.sites) ? legacy.sites : {})) {
            try {
                const id = normalizeSiteId(rawId);
                const binding = isRecord(rawValue) ? { ...rawValue } : {};
                this.legacyRuntimeStates.set(id, binding);
                const active = binding.status === 'running' || binding.status === 'starting';
                if (active && !binding.scriptName && !binding.terminalSessionId && binding.workspaceId && binding.root)
                    binding.terminalSessionId = `site:${id}`;
                if (active && typeof binding.pid === 'number' && Number.isInteger(binding.pid) && binding.pid > 0)
                    binding.legacyPid = binding.pid;
                bindings[id] = binding;
            }
            catch { /* ignore invalid legacy IDs */ }
        }
        return bindings;
    }
    newFolderPath(id, parentPath, visibilityPrefix = '') {
        const canonical = siteFolderPath(this.root, id, parentPath);
        return visibilityPrefix ? path.posix.join(path.posix.dirname(canonical), `${visibilityPrefix}${id}.site`) : canonical;
    }
    writeDescriptor(folderPath, site, artifactId) {
        const absolute = path.join(this.root, ...folderPath.split('/'));
        if (!isWithinRoot(this.root, path.resolve(absolute)))
            throw runtimePathError();
        const existed = fs.existsSync(absolute);
        if (existed && !isDirectory(absolute))
            throw new Error(`Site folder is not a directory: ${folderPath}`);
        fs.mkdirSync(absolute, { recursive: true });
        const markerPath = path.join(absolute, SITE_ARTIFACT_MARKER_FILE);
        if (!existed || !fs.existsSync(markerPath)) {
            writeJsonAtomic(markerPath, { formatVersion: 1, id: artifactId || randomUUID(), kind: 'site' });
        }
        writeJsonAtomic(path.join(absolute, SITE_DESCRIPTOR_FILE), site);
    }
    removeLegacyDescriptor(id) {
        const runtime = this.readRuntimeRegistry();
        if (runtime.sites[id]) {
            const sites = { ...runtime.sites };
            delete sites[id];
            this.writeRuntimeRegistry({ ...runtime, sites });
        }
        const legacyFile = path.join(this.legacySiteDescriptorsRoot, `${id}.site.json`);
        if (fs.existsSync(legacyFile))
            fs.rmSync(legacyFile, { force: true });
    }
    removeLegacyRuntimeBinding(id) {
        const legacyPath = this.resolveRuntimePath('sites.json');
        const legacy = readJson(legacyPath, {});
        if (!isRecord(legacy.sites) || !legacy.sites[id])
            return false;
        const sites = { ...legacy.sites };
        delete sites[id];
        writeJsonAtomic(legacyPath, { ...legacy, sites });
        return true;
    }
    renameLegacyRuntimeBinding(from, to) {
        const legacyPath = this.resolveRuntimePath('sites.json');
        const legacy = readJson(legacyPath, {});
        if (!isRecord(legacy.sites) || !legacy.sites[from])
            return;
        const sites = { ...legacy.sites, [to]: legacy.sites[from] };
        delete sites[from];
        writeJsonAtomic(legacyPath, { ...legacy, sites });
        const legacyState = this.legacyRuntimeStates.get(from);
        if (legacyState) {
            this.legacyRuntimeStates.delete(from);
            this.legacyRuntimeStates.set(to, legacyState);
        }
    }
}
export function siteIdForTitle(title, store) {
    const base = String(title || '').toLowerCase().normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64).replace(/-+$/g, '');
    if (!base)
        throw new Error('Site name must contain letters or numbers');
    let id = base;
    for (let suffix = 2; store.get(id); suffix++)
        id = `${base.slice(0, 64 - String(suffix).length - 1)}-${suffix}`;
    return id;
}
export function assertExternalSiteRoot(notebookRoot, root) {
    const resolvedNotebookRoot = fs.realpathSync.native(path.resolve(notebookRoot));
    const resolved = fs.realpathSync.native(path.resolve(root));
    if (isWithinRoot(resolvedNotebookRoot, resolved)) {
        const error = new Error('Site directories must be outside the Notebook');
        error.code = 'SITE_ROOT_INSIDE_NOTEBOOK';
        throw error;
    }
    return resolved;
}
export function assertAvailableSiteRoot(store, root, exceptId = null) {
    const resolved = store?.root
        ? assertExternalSiteRoot(store.root, root)
        : fs.realpathSync.native(path.resolve(root));
    if (!fs.statSync(resolved).isDirectory())
        throw new Error('Select a directory');
    for (const site of store.list()) {
        if (site.id === exceptId)
            continue;
        const boundRoot = store.getBinding(site.id)?.root;
        if (!boundRoot)
            continue;
        try {
            if (fs.realpathSync.native(boundRoot) === resolved)
                throw new Error('This directory is already registered as a Site');
        }
        catch (error) {
            if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT')
                throw error;
        }
    }
    return resolved;
}
export function detectSiteConfiguration(root) {
    const projectRoot = path.resolve(String(root ?? '.'));
    const findings = [];
    const packagePath = path.join(projectRoot, 'package.json');
    const packageData = isFile(packagePath) ? readJson(packagePath, {}) : null;
    let startCommand = null;
    let framework = null;
    let defaultPort = null;
    if (packageData) {
        const scripts = packageData.scripts ?? {};
        const preferred = ['dev', 'start', 'serve'].find(name => typeof scripts[name] === 'string');
        const manager = packageManagerFor(packageData);
        const dependencies = { ...(packageData.dependencies ?? {}), ...(packageData.devDependencies ?? {}) };
        framework = detectNodeFramework(dependencies, preferred ? scripts[preferred] : '');
        if (preferred) {
            startCommand = packageScriptCommand(manager, preferred);
            findings.push({ kind: 'start-command', value: startCommand, reason: `package.json declares a ${preferred} script` });
        }
        else if (framework) {
            startCommand = packageBinaryCommand(manager, framework.binary, framework.args);
            findings.push({ kind: 'start-command', value: startCommand, reason: `package.json includes ${framework.package}` });
        }
        if (framework) {
            defaultPort = framework.port;
            findings.push({ kind: 'framework', value: framework.name, reason: `package.json includes ${framework.package}` });
        }
        defaultPort = numericPort(packageData.port) || numericPort(packageData.config?.port) || defaultPort;
    }
    const packageConfigText = [
        'vite.config.js', 'vite.config.mjs', 'vite.config.ts', 'vite.config.mts', 'vite.config.cjs',
        'astro.config.js', 'astro.config.mjs', 'astro.config.ts', 'nuxt.config.js', 'nuxt.config.ts',
        '.env', '.env.local', '.env.development',
    ].map(name => readText(path.join(projectRoot, name))).filter(Boolean).join('\n');
    const configPort = portFromText(packageConfigText);
    const commandText = packageData?.scripts?.dev || packageData?.scripts?.start || packageData?.scripts?.serve || startCommand || '';
    if (!startCommand) {
        const python = detectPythonSite(projectRoot);
        if (python) {
            startCommand = python.command;
            defaultPort = python.port;
            findings.push({ kind: 'start-command', value: python.command, reason: python.reason });
            findings.push({ kind: 'framework', value: python.framework, reason: python.reason });
        }
    }
    if (!startCommand) {
        const rust = detectRustSite(projectRoot);
        if (rust) {
            startCommand = rust.command;
            defaultPort = rust.port;
            findings.push({ kind: 'start-command', value: rust.command, reason: rust.reason });
            findings.push({ kind: 'framework', value: rust.framework, reason: rust.reason });
        }
    }
    if (!startCommand && isFile(path.join(projectRoot, 'index.html'))) {
        startCommand = 'python3 -m http.server 8000 --bind 127.0.0.1';
        defaultPort = 8000;
        findings.push({ kind: 'start-command', value: startCommand, reason: 'index.html can be served as a static Site' });
        findings.push({ kind: 'framework', value: 'Static HTML', reason: 'index.html exists' });
    }
    const port = portFromText(commandText) || configPort || defaultPort;
    if (port)
        findings.push({ kind: 'local-url', value: `http://127.0.0.1:${port}/`, reason: 'Expected local development URL from the detected command or framework defaults' });
    for (const [file, provider] of [['vercel.json', 'Vercel'], ['netlify.toml', 'Netlify'], ['wrangler.toml', 'Cloudflare']])
        if (isFile(path.join(projectRoot, file)))
            findings.push({ kind: 'provider', value: provider, reason: `${file} exists` });
    return { root: projectRoot, findings };
}
function packageManagerFor(pkg) {
    const name = String(pkg?.packageManager || 'npm').split('@')[0] ?? 'npm';
    return ['npm', 'pnpm', 'yarn', 'bun'].includes(name) ? name : 'npm';
}
function packageScriptCommand(manager, script) {
    if (manager === 'yarn')
        return `yarn ${script}`;
    if (manager === 'bun')
        return `bun run ${script}`;
    return `${manager} run ${script}`;
}
function packageBinaryCommand(manager, binary, args) {
    if (manager === 'pnpm')
        return `pnpm exec ${binary} ${args}`;
    if (manager === 'yarn')
        return `yarn ${binary} ${args}`;
    if (manager === 'bun')
        return `bunx ${binary} ${args}`;
    return `npx ${binary} ${args}`;
}
function detectNodeFramework(dependencies, script = '') {
    const names = Object.keys(dependencies || {});
    const byDependency = [
        { package: 'next', name: 'Next.js', port: 3000, binary: 'next', args: 'dev --hostname 127.0.0.1' },
        { package: 'nuxt', name: 'Nuxt', port: 3000, binary: 'nuxt', args: 'dev --host 127.0.0.1' },
        { package: 'astro', name: 'Astro', port: 4321, binary: 'astro', args: 'dev --host 127.0.0.1' },
        { package: '@remix-run/dev', name: 'Remix', port: 3000, binary: 'remix', args: 'vite:dev --host 127.0.0.1' },
        { package: 'react-scripts', name: 'Create React App', port: 3000, binary: 'react-scripts', args: 'start' },
        { package: 'vite', name: 'Vite', port: 5173, binary: 'vite', args: '--host 127.0.0.1' },
    ].find(item => names.includes(item.package));
    if (byDependency)
        return byDependency;
    const source = String(script || '');
    if (/(?:^|\s)(?:npx\s+)?vite(?:\s|$)/.test(source))
        return { package: 'vite', name: 'Vite', port: 5173, binary: 'vite', args: '--host 127.0.0.1' };
    if (/(?:^|\s)(?:npx\s+)?next(?:\s|$)/.test(source))
        return { package: 'next', name: 'Next.js', port: 3000, binary: 'next', args: 'dev --hostname 127.0.0.1' };
    return null;
}
function detectPythonSite(root) {
    const managePath = path.join(root, 'manage.py');
    if (isFile(managePath)) {
        const port = portFromText(readText(managePath)) || 8000;
        return { command: `python3 manage.py runserver 127.0.0.1:${port}`, port, framework: 'Django', reason: 'manage.py identifies a Django project' };
    }
    const metadata = ['pyproject.toml', 'requirements.txt', 'Pipfile', 'setup.py']
        .map(file => readText(path.join(root, file)))
        .filter(Boolean)
        .join('\n');
    if (!metadata)
        return null;
    if (/\bfastapi\b/i.test(metadata)) {
        const module = isFile(path.join(root, 'main.py')) ? 'main' : isFile(path.join(root, 'app.py')) ? 'app' : null;
        if (!module)
            return null;
        const port = portFromText(metadata) || portFromText(readText(path.join(root, `${module}.py`))) || 8000;
        return { command: `python3 -m uvicorn ${module}:app --host 127.0.0.1 --port ${port}`, port, framework: 'FastAPI', reason: 'Python metadata includes FastAPI' };
    }
    if (/\bflask\b/i.test(metadata)) {
        const module = isFile(path.join(root, 'app.py')) ? 'app' : isFile(path.join(root, 'main.py')) ? 'main' : null;
        if (!module)
            return null;
        const port = portFromText(readText(path.join(root, `${module}.py`))) || 5000;
        return { command: `python3 -m flask --app ${module} run --host 127.0.0.1 --port ${port}`, port, framework: 'Flask', reason: 'Python metadata includes Flask' };
    }
    return null;
}
function detectRustSite(root) {
    const manifest = readText(path.join(root, 'Cargo.toml'));
    if (!manifest)
        return null;
    const source = readText(path.join(root, 'src', 'main.rs')) || readText(path.join(root, 'src', 'lib.rs')) || '';
    const frameworks = [
        { package: 'axum', name: 'Axum', port: 3000 },
        { package: 'actix-web', name: 'Actix Web', port: 8080 },
        { package: 'rocket', name: 'Rocket', port: 8000 },
        { package: 'warp', name: 'Warp', port: 3030 },
        { package: 'poem', name: 'Poem', port: 3000 },
        { package: 'salvo', name: 'Salvo', port: 5800 },
    ];
    const framework = frameworks.find(item => new RegExp(`(?:^|[\\s"'])${item.package.replace('-', '[-_]')}\\s*=`, 'mi').test(manifest));
    if (!framework)
        return null;
    const port = portFromText(source) || portFromText(manifest) || framework.port;
    return { command: 'cargo run', port, framework: framework.name, reason: `Cargo.toml includes ${framework.package}` };
}
function portFromText(value) {
    const text = String(value || '');
    const matches = [
        text.match(/\bPORT\s*=\s*["']?(\d{2,5})/i),
        text.match(/(?:--port|-p)(?:=|\s+)(\d{2,5})/i),
        text.match(/\bport\s*[:=]\s*["']?(\d{2,5})/i),
        text.match(/(?:127\.0\.0\.1|0\.0\.0\.0|localhost):(\d{2,5})/i),
    ];
    return matches.map(match => numericPort(match?.[1])).find(Boolean) || null;
}
function numericPort(value) {
    const port = Number(value);
    return Number.isInteger(port) && port > 0 && port <= 65535 ? port : null;
}
function readText(file) {
    try {
        return fs.readFileSync(file, 'utf8');
    }
    catch {
        return '';
    }
}
function ensureRuntimeDirectoryIgnored(root) {
    const ignorePath = path.join(root, '.gitignore');
    let current = '';
    try {
        current = fs.readFileSync(ignorePath, 'utf8');
    }
    catch (error) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT')
            throw error;
    }
    const existingRules = new Set(current.split(/\r?\n/).map(line => line.trim()));
    if (['.storyboard/', '.storyboard', '/.storyboard/', '/.storyboard', '.storyboard/**', '/.storyboard/**', '**/.storyboard/**', '.hypercanvas/', '.hypercanvas', '/.hypercanvas/', '/.hypercanvas', '.hypercanvas/**', '/.hypercanvas/**', '**/.hypercanvas/**'].some(rule => existingRules.has(rule)))
        return;
    // Ignore the active runtime directory only — the gitignore rule follows
    // whichever name this project already uses.
    const activeRule = `${path.relative(root, resolveRuntimeDirSite(root)).replace(/\\/g, '/')}/`;
    fs.writeFileSync(ignorePath, `${current}${current && !current.endsWith('\n') ? '\n' : ''}${activeRule}\n`);
}
function bounded(value, min, max, fallback) { const number = Number(value); return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback; }
function isFile(file) { try {
    return fs.statSync(file).isFile();
}
catch {
    return false;
} }
function isDirectory(file) { try {
    return fs.statSync(file).isDirectory();
}
catch {
    return false;
} }
function readJson(file, fallback) { try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}
catch {
    return fallback;
} }
function writeJsonAtomic(file, value) { const tmp = `${file}.${process.pid}.tmp`; fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`); fs.renameSync(tmp, file); }
