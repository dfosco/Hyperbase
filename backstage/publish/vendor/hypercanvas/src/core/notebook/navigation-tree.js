import fs from 'node:fs';
import path from 'node:path';
import ignore from 'ignore';
import { readAppConfig } from '../configFile.js';
import { configDefaults } from '../stores/configSchema.js';
import { resolveNotebookSiblingOrder, } from './sibling-order.js';
import { readSiteDescriptorFile } from '../site/site.js';
/** Directories required for safe/internal traversal, independent of user rules. */
export const NOTEBOOK_TREE_INTERNAL_DIRECTORIES = new Set([
    '.git', '.hypercanvas', '.storyboard', '.vite',
]);
const ARTIFACT_KINDS = new Set(['prototype', 'component', 'canvas', 'site', 'doc']);
const ARTIFACT_DIRECTORY_SUFFIXES = ['.prototype', '.component', '.canvas', '.site'];
const NOTEBOOK_PUBLICATION_MARKER_FILE = 'hypercanvas.publication.json';
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function relativePath(value) {
    if (typeof value !== 'string' || !value || value.includes('\\') || value.startsWith('/'))
        return null;
    const segments = value.split('/');
    if (segments.some(segment => !segment || segment === '.' || segment === '..'))
        return null;
    return value;
}
function sidebarIgnorePatterns(root) {
    const raw = readAppConfig(root)?.sidebarIgnored;
    const patterns = Array.isArray(raw) && raw.every(pattern => typeof pattern === 'string')
        ? raw
        : configDefaults.sidebarIgnored;
    return patterns;
}
function sidebarIgnoreMatcher(root) { return ignore().add(sidebarIgnorePatterns(root)); }
function ownsNotebookPublication(directory, notebookId) {
    try {
        const marker = JSON.parse(fs.readFileSync(path.join(directory, NOTEBOOK_PUBLICATION_MARKER_FILE), 'utf8'));
        return isRecord(marker)
            && marker.kind === 'hypercanvas-publication'
            && isRecord(marker.notebook)
            && marker.notebook.id === notebookId;
    }
    catch {
        return false;
    }
}
function isNotebookManagedPublicationPath(root, value, notebookId) {
    if (!notebookId || !value)
        return false;
    let current = root;
    for (const segment of value.split('/')) {
        current = path.join(current, segment);
        try {
            if (fs.realpathSync.native(current) !== current || !fs.statSync(current).isDirectory())
                return false;
        }
        catch {
            return false;
        }
        if (ownsNotebookPublication(current, notebookId))
            return true;
    }
    return false;
}
function isExcludedGeneratedOutputPath(value, excludedPaths) {
    for (const excluded of excludedPaths) {
        if (value === excluded || value.startsWith(`${excluded}/`))
            return true;
    }
    return false;
}
function isVisiblePath(value, matcher, finalIsDirectory = true) {
    const segments = value.split('/');
    if (segments.some(segment => segment.startsWith('_') || NOTEBOOK_TREE_INTERNAL_DIRECTORIES.has(segment)))
        return false;
    const directorySegmentCount = finalIsDirectory ? segments.length : segments.length - 1;
    for (let index = 1; index <= directorySegmentCount; index += 1) {
        if (matcher.ignores(`${segments.slice(0, index).join('/')}/`))
            return false;
    }
    return true;
}
function isDirectoryPath(root, value) {
    try {
        return fs.statSync(path.join(root, ...value.split('/'))).isDirectory();
    }
    catch {
        return false;
    }
}
function hasArtifactDirectorySuffix(name) {
    return ARTIFACT_DIRECTORY_SUFFIXES.some(suffix => name.length > suffix.length && name.endsWith(suffix));
}
function isAggregateSiteRegistryPath(value) {
    return value === '.hypercanvas/sites.config.json' || value === '.storyboard/sites.config.json';
}
function artifactKind(value) {
    return typeof value === 'string' && ARTIFACT_KINDS.has(value)
        ? value
        : null;
}
function errorWithCode(message, code) {
    return Object.assign(new Error(message), { code });
}
function pageEntryPath(page, source) {
    const directPath = relativePath(page.path);
    if (directPath)
        return directPath;
    if (typeof page.siteId !== 'string')
        return null;
    const site = source.sites?.find(candidate => candidate.id === page.siteId);
    return site ? relativePath(site.path) : null;
}
function artifactEntries(root, source, matcher) {
    const pages = (Array.isArray(source.pages) ? source.pages : [])
        .filter(isRecord);
    const artifacts = (Array.isArray(source.artifacts) ? source.artifacts : [])
        .filter(isRecord);
    const visibleByPath = new Map();
    const hiddenArtifactPaths = new Set();
    const artifactPaths = [];
    const usedPageIds = new Set();
    const artifactIdCounts = new Map();
    for (const artifact of artifacts) {
        if (typeof artifact.id === 'string' && artifact.id.trim()) {
            artifactIdCounts.set(artifact.id, (artifactIdCounts.get(artifact.id) || 0) + 1);
        }
    }
    for (const artifact of artifacts) {
        const kind = artifactKind(artifact.kind);
        const folderPath = relativePath(artifact.folderPath);
        if (!kind || !folderPath)
            continue;
        artifactPaths.push(folderPath);
        if (artifact.visible !== true || !isVisiblePath(folderPath, matcher)) {
            hiddenArtifactPaths.add(folderPath);
            continue;
        }
        if (typeof artifact.id !== 'string' || !artifact.id.trim())
            continue;
        let page = pages.find(candidate => candidate.id === artifact.id
            || (candidate.type === kind && (candidate.path === artifact.folderPath || candidate.path === artifact.payloadPath)));
        let sitePageAmbiguous = false;
        let siteId = null;
        if (kind === 'site') {
            const payloadPath = relativePath(artifact.payloadPath);
            if (payloadPath) {
                try {
                    siteId = readSiteDescriptorFile(path.join(root, ...payloadPath.split('/'))).id;
                }
                catch { /* use page/catalog identity */ }
            }
            siteId ??= typeof page?.siteId === 'string'
                ? page.siteId
                : typeof artifact.siteId === 'string' ? artifact.siteId : null;
            if (!page && siteId) {
                const sitePages = pages.filter(candidate => candidate.type === 'site' && candidate.siteId === siteId
                    && typeof candidate.id === 'string' && candidate.id.trim());
                if (sitePages.length === 1)
                    page = sitePages[0];
                else if (sitePages.length > 1)
                    sitePageAmbiguous = true;
            }
        }
        const pageId = typeof page?.id === 'string' && !sitePageAmbiguous ? page.id : null;
        if (pageId) {
            usedPageIds.add(pageId);
        }
        const diagnostics = [
            ...(Array.isArray(artifact.diagnostics) ? artifact.diagnostics.filter(isRecord) : []),
            ...(Array.isArray(page?.diagnostics) ? page.diagnostics.filter(isRecord) : []),
        ];
        const duplicateArtifactId = (artifactIdCounts.get(artifact.id) || 0) > 1;
        const ambiguous = duplicateArtifactId || sitePageAmbiguous;
        if (sitePageAmbiguous)
            diagnostics.push({
                code: 'AMBIGUOUS_SITE_PAGE_ID',
                message: `Site descriptor "${siteId}" matches multiple registered Site pages; the tree cannot choose a page identity safely.`,
                path: folderPath,
            });
        if (duplicateArtifactId && !diagnostics.some(item => item.code === 'DUPLICATE_ARTIFACT_ID')) {
            diagnostics.push({
                code: 'DUPLICATE_ARTIFACT_ID',
                message: `Artifact identity "${artifact.id}" is shared by multiple physical artifacts. Assign distinct IDs before registering either artifact.`,
                path: folderPath,
            });
        }
        visibleByPath.set(folderPath, {
            id: artifact.id,
            kind,
            path: folderPath,
            payloadPath: relativePath(artifact.payloadPath),
            title: typeof page?.title === 'string'
                ? page.title
                : typeof artifact.title === 'string' ? artifact.title : path.posix.basename(folderPath),
            route: typeof page?.route === 'string' || page?.route === null
                ? page.route
                : typeof artifact.route === 'string' ? artifact.route : null,
            siteId,
            available: !ambiguous && !sitePageAmbiguous && (typeof page?.available === 'boolean'
                ? page.available
                : artifact.available === true),
            diagnostics,
            pageId,
            legacyPageIds: siteId && pageId ? [pageId] : [],
            ambiguous,
        });
    }
    const legacyByPath = new Map();
    const aggregateSites = [];
    for (const page of pages) {
        if (page.type !== 'site' || typeof page.id !== 'string' || !page.id.trim()
            || typeof page.siteId !== 'string' || usedPageIds.has(page.id))
            continue;
        const site = source.sites?.find(candidate => candidate.id === page.siteId);
        if (!site || !isAggregateSiteRegistryPath(site.path))
            continue;
        const entry = {
            id: page.id,
            kind: 'site',
            path: null,
            name: typeof page.title === 'string' && page.title.trim() ? page.title : page.siteId,
            payloadPath: null,
            title: typeof page.title === 'string' && page.title.trim() ? page.title : page.siteId,
            route: typeof page.route === 'string' ? page.route : null,
            siteId: page.siteId,
            available: page.available === true,
            diagnostics: Array.isArray(page.diagnostics)
                ? page.diagnostics.filter(isRecord)
                : [],
            pageId: page.id,
            legacyPageIds: [],
            ambiguous: false,
        };
        aggregateSites.push(entry);
        usedPageIds.add(page.id);
    }
    for (const page of pages) {
        if (typeof page.id !== 'string' || !page.id.trim() || usedPageIds.has(page.id))
            continue;
        const kind = artifactKind(page.type);
        const entryPath = pageEntryPath(page, source);
        if (!kind || !entryPath || !isVisiblePath(entryPath, matcher, isDirectoryPath(root, entryPath)))
            continue;
        // A matching catalog projection already represents this page. Do not turn
        // the payload file of a folder artifact into a second tree leaf.
        if (artifacts.some(artifact => artifact.kind === kind
            && (artifact.folderPath === page.path || artifact.payloadPath === page.path)))
            continue;
        // A manifest page whose file or folder no longer exists is stale; drop it
        // instead of listing an errored leaf the user cannot open or fix.
        if (kind !== 'site' && page.available !== true && !fs.existsSync(path.join(root, ...entryPath.split('/'))))
            continue;
        const entry = {
            id: page.id,
            kind,
            path: entryPath,
            payloadPath: kind === 'canvas' || kind === 'site' ? entryPath : null,
            title: typeof page.title === 'string' ? page.title : path.posix.basename(entryPath),
            route: typeof page.route === 'string' ? page.route : null,
            siteId: kind === 'site' ? (typeof page.siteId === 'string' ? page.siteId : null) : null,
            available: page.available === true,
            diagnostics: Array.isArray(page.diagnostics)
                ? page.diagnostics.filter(isRecord)
                : [],
            pageId: page.id,
            legacyPageIds: [],
            ambiguous: (artifactIdCounts.get(page.id) || 0) > 1,
        };
        const samePath = legacyByPath.get(entryPath) || [];
        samePath.push(entry);
        legacyByPath.set(entryPath, samePath);
        artifactPaths.push(entryPath);
    }
    return { visibleByPath, hiddenArtifactPaths, legacyByPath, aggregateSites, artifactPaths };
}
function parentPathFor(value) {
    const parent = path.posix.dirname(value);
    return parent === '.' ? '' : parent;
}
function createArtifactNode(entry, depth) {
    const parentPath = entry.path === null ? '' : parentPathFor(entry.path);
    return {
        kind: 'artifact',
        ref: entry.ambiguous ? null : { kind: 'artifact', id: entry.id },
        id: entry.id,
        pageId: entry.pageId,
        artifactKind: entry.kind,
        name: entry.name || (entry.path === null ? entry.siteId || entry.title : path.posix.basename(entry.path)),
        title: entry.title,
        path: entry.path,
        parentPath,
        depth,
        payloadPath: entry.payloadPath,
        route: entry.route,
        siteId: entry.siteId,
        available: entry.available,
        diagnostics: entry.diagnostics,
    };
}
function readDirectory(rootRealPath, folderPath) {
    const absolute = path.resolve(rootRealPath, ...folderPath.split('/').filter(Boolean));
    let real;
    try {
        real = fs.realpathSync.native(absolute);
    }
    catch {
        return [];
    }
    if (real !== absolute || !real.startsWith(`${rootRealPath}${path.sep}`) && real !== rootRealPath)
        return [];
    try {
        return fs.readdirSync(real, { withFileTypes: true });
    }
    catch {
        return [];
    }
}
/** Return the same visible, direct sibling list used to validate reorder requests. */
export function readDirectNotebookSiblings(root, parentPath, source, savedOrder) {
    const direct = collectDirectNotebookTreeEntries(root, parentPath, source);
    if (direct.ambiguousArtifacts.length) {
        throw errorWithCode('Sibling ordering is unavailable because this folder contains artifacts with duplicate marker IDs.', 'INVALID_SIBLING_TARGET');
    }
    return resolveNotebookSiblingOrder(direct.siblings, savedOrder);
}
function collectDirectNotebookTreeEntries(root, parentPath, source, matcher = sidebarIgnoreMatcher(root), excludedGeneratedOutputPaths = new Set()) {
    if (parentPath !== '' && (relativePath(parentPath) !== parentPath || !isVisiblePath(parentPath, matcher))) {
        throw errorWithCode('Sibling ordering is not available inside a hidden or invalid folder.', 'INVALID_SIBLING_TARGET');
    }
    if (parentPath.split('/').some(hasArtifactDirectorySuffix)) {
        throw errorWithCode('Sibling ordering is not available inside an artifact folder.', 'INVALID_SIBLING_TARGET');
    }
    const entries = artifactEntries(root, source, matcher);
    if (entries.artifactPaths.some(artifactPath => parentPath === artifactPath || parentPath.startsWith(`${artifactPath}/`))) {
        throw errorWithCode('Sibling ordering is not available inside an artifact folder.', 'INVALID_SIBLING_TARGET');
    }
    const rootRealPath = fs.realpathSync.native(root);
    const notebookId = typeof source.manifest?.id === 'string' ? source.manifest.id : null;
    if (isExcludedGeneratedOutputPath(parentPath, excludedGeneratedOutputPaths)
        || isNotebookManagedPublicationPath(rootRealPath, parentPath, notebookId)) {
        throw errorWithCode('Sibling ordering is not available inside a managed publication output.', 'INVALID_SIBLING_TARGET');
    }
    const parentAbsolute = path.resolve(rootRealPath, ...parentPath.split('/').filter(Boolean));
    if (parentAbsolute !== rootRealPath && !parentAbsolute.startsWith(`${rootRealPath}${path.sep}`)) {
        throw errorWithCode('Sibling parent is outside the active Notebook.', 'INVALID_SIBLING_TARGET');
    }
    let realParent;
    try {
        realParent = fs.realpathSync.native(parentAbsolute);
    }
    catch {
        throw errorWithCode('Sibling parent does not exist.', 'INVALID_SIBLING_TARGET');
    }
    if (realParent !== parentAbsolute || !fs.statSync(realParent).isDirectory()) {
        throw errorWithCode('Sibling parent must resolve directly inside the active Notebook.', 'INVALID_SIBLING_TARGET');
    }
    const siblings = [];
    const ambiguousArtifacts = [];
    for (const entry of readDirectory(rootRealPath, parentPath)) {
        if (entry.isSymbolicLink() || entry.name.startsWith('_') || NOTEBOOK_TREE_INTERNAL_DIRECTORIES.has(entry.name))
            continue;
        const childPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
        if (!isVisiblePath(childPath, matcher, entry.isDirectory()))
            continue;
        if (entry.isDirectory() && (isExcludedGeneratedOutputPath(childPath, excludedGeneratedOutputPaths)
            || isNotebookManagedPublicationPath(rootRealPath, childPath, notebookId)))
            continue;
        const artifact = entries.visibleByPath.get(childPath);
        const legacy = entries.legacyByPath.get(childPath) || [];
        if (artifact) {
            if (artifact.ambiguous)
                ambiguousArtifacts.push(artifact);
            else
                siblings.push({
                    ref: { kind: 'artifact', id: artifact.id },
                    kind: 'artifact',
                    name: entry.name,
                    legacyArtifactIds: artifact.legacyPageIds,
                });
            continue;
        }
        if (legacy.length) {
            for (const value of legacy)
                siblings.push({ ref: { kind: 'artifact', id: value.id }, kind: 'artifact', name: entry.name });
            continue;
        }
        if (entries.hiddenArtifactPaths.has(childPath))
            continue;
        if (entry.isDirectory()) {
            if (hasArtifactDirectorySuffix(entry.name))
                continue;
            siblings.push({ ref: { kind: 'folder', path: childPath }, kind: 'folder', name: entry.name });
        }
    }
    if (parentPath === '') {
        for (const site of entries.aggregateSites) {
            siblings.push({ ref: { kind: 'artifact', id: site.id }, kind: 'artifact', name: site.name || site.siteId || site.title });
        }
    }
    return { siblings, ambiguousArtifacts };
}
export function buildNotebookNavigationTree(root, source, siblingOrders = {}, reorderSiblings = true, excludedGeneratedOutputPaths = []) {
    const rootRealPath = fs.realpathSync.native(root);
    const matcher = sidebarIgnoreMatcher(rootRealPath);
    const excludedPaths = new Set(excludedGeneratedOutputPaths.flatMap(value => {
        const normalized = relativePath(value);
        return normalized ? [normalized] : [];
    }));
    const entries = artifactEntries(rootRealPath, source, matcher);
    const emittedArtifactPaths = new Set();
    const artifactEntryKey = (entry) => entry.path === null
        ? `aggregate-site\0${entry.id}\0${entry.siteId || ''}`
        : entry.path;
    const walk = (parentPath, depth) => {
        const direct = collectDirectNotebookTreeEntries(rootRealPath, parentPath, source, matcher, excludedPaths);
        const siblings = resolveNotebookSiblingOrder(direct.siblings, siblingOrders[parentPath]);
        const byRef = new Map();
        for (const sibling of siblings) {
            if (sibling.ref.kind === 'artifact') {
                const id = sibling.ref.id;
                const artifact = [...entries.visibleByPath.values(), ...[...entries.legacyByPath.values()].flat(), ...entries.aggregateSites]
                    .find(candidate => candidate.id === id && !candidate.ambiguous);
                if (!artifact || emittedArtifactPaths.has(artifactEntryKey(artifact)))
                    continue;
                emittedArtifactPaths.add(artifactEntryKey(artifact));
                byRef.set(`artifact\0${artifact.id}`, createArtifactNode(artifact, depth));
                continue;
            }
            const folderPath = sibling.ref.path;
            const folderDirect = collectDirectNotebookTreeEntries(rootRealPath, folderPath, source, matcher, excludedPaths);
            const folder = {
                kind: 'folder',
                ref: { kind: 'folder', path: folderPath },
                name: path.posix.basename(folderPath),
                path: folderPath,
                parentPath,
                depth,
                capabilities: { reorderSiblings: reorderSiblings && !folderDirect.ambiguousArtifacts.length },
                children: walk(folderPath, depth + 1),
            };
            byRef.set(`folder\0${folderPath}`, folder);
        }
        const ordered = siblings.flatMap(sibling => {
            const key = sibling.ref.kind === 'folder' ? `folder\0${sibling.ref.path}` : `artifact\0${sibling.ref.id}`;
            const node = byRef.get(key);
            return node ? [node] : [];
        });
        const ambiguous = direct.ambiguousArtifacts
            .filter(entry => !emittedArtifactPaths.has(artifactEntryKey(entry)))
            .sort((left, right) => left.title.localeCompare(right.title, 'en')
            || (left.path || '').localeCompare(right.path || '', 'en'))
            .map(entry => {
            emittedArtifactPaths.add(artifactEntryKey(entry));
            return createArtifactNode(entry, depth);
        });
        return [...ordered, ...ambiguous];
    };
    const title = typeof source.manifest?.title === 'string' && source.manifest.title.trim()
        ? source.manifest.title.trim()
        : 'Notebook';
    const rootNode = {
        kind: 'folder', ref: null, name: title, path: '', parentPath: null, depth: 0,
        capabilities: { reorderSiblings: reorderSiblings && !collectDirectNotebookTreeEntries(rootRealPath, '', source, matcher, excludedPaths).ambiguousArtifacts.length },
        children: walk('', 1),
    };
    return { root: rootNode, capabilities: { reorderSiblings }, sidebarIgnored: [...sidebarIgnorePatterns(rootRealPath)] };
}
