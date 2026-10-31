/**
 * Content-only Notebook support.
 *
 * A Notebook is a user-owned folder containing portable canvas and prototype
 * content. Application code, dependencies, and runtime state stay outside it.
 */
import { NOTEBOOK_BACKSTAGE_DIR, NOTEBOOK_MANIFEST_DIR, NOTEBOOK_MANIFEST_FILE, hasNotebookManifest, resolveNotebookContentDirectory, resolveNotebookManifestPath } from './layout.js';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createHash, randomUUID } from 'node:crypto';
import { parse as parseJsonc } from 'jsonc-parser';
import { LEGACY_CANVAS_CONFIG_FILE, resolveConfigFilePath, resolveNotebookConfigWritePath } from '../configFile.js';
import { NOTEBOOK_INFRASTRUCTURE_DIRECTORIES, SiteStore, readSiteDescriptorFile, siteConfigRelativePath, siteDescriptorRelativePath } from '../site/site.js';
import { artifactFolderLogicalName } from '../artifact/visibility.js';
import { FIRST_LOOK_DIAGNOSTIC_SOURCE, portableNotebookId, portablePageRecords, readPortableCatalog, reportCrossCatalogConflicts, reportMarkerConflicts, supersededRegistrations } from './first-look/catalog.node.js';
import { normalizeNotebookArtifactMigrationAliases, notebookRouteCollisionKey } from './artifact-migration-aliases.js';
import { resolveRuntimeDir } from '../runtimeDir.js';
import { applyNavigationOperation, createDefaultNavigation, normalizeNavigation, NOTEBOOK_PAGE_TYPES, } from './navigation.js';
function isPageType(value) {
    return NOTEBOOK_PAGE_TYPES.some(type => type === value);
}
function isValidManifestPage(value) {
    return isRecord(value) && typeof value.id === 'string' && typeof value.type === 'string'
        && isPageType(value.type) && typeof value.title === 'string'
        && (value.path === undefined || typeof value.path === 'string')
        && (value.siteId === undefined || typeof value.siteId === 'string')
        && (value.route === undefined || value.route === null || typeof value.route === 'string');
}
function isNotebookManifest(value) {
    return isRecord(value) && value.formatVersion === NOTEBOOK_FORMAT_VERSION
        && typeof value.id === 'string' && typeof value.title === 'string'
        && Array.isArray(value.pages) && value.pages.every(isValidManifestPage)
        && normalizeNavigation(value.navigation, navigationPages(value.pages)).valid;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function record(value) {
    return isRecord(value) ? value : {};
}
function stringField(value, key) {
    const field = value[key];
    return typeof field === 'string' ? field : undefined;
}
function navigationPages(pages) {
    return pages.flatMap((page) => typeof page.id === 'string' && typeof page.type === 'string'
        ? [{ id: page.id, type: page.type }]
        : []);
}
function errorMessage(error) {
    return isRecord(error) && typeof error.message === 'string' ? error.message : String(error);
}
function errorCode(error) {
    return isRecord(error) ? error.code : undefined;
}
export const NOTEBOOK_FORMAT_VERSION = 2;
export const NOTEBOOK_ARTIFACT_MARKER_FILE = '.hypercanvas-artifact.json';
export const NOTEBOOK_CANVAS_CONFIG_FILE = LEGACY_CANVAS_CONFIG_FILE;
/** Runtime directory name after the rename; existing Notebooks stay on `.storyboard/`. */
export const NOTEBOOK_RUNTIME_DIR = '.hypercanvas';
export const LEGACY_NOTEBOOK_RUNTIME_DIR = '.storyboard';
export const NOTEBOOK_PUBLISH_DIR = 'backstage/publish';
/** Where earlier builds placed the managed publication project. */
export const LEGACY_NOTEBOOK_PUBLISH_DIR = 'publish';
export { NOTEBOOK_BACKSTAGE_DIR, NOTEBOOK_MANIFEST_DIR, NOTEBOOK_MANIFEST_FILE, NOTEBOOK_CONTENT_DIRECTORY_NAMES, hasNotebookManifest, notebookContentPath, notebookManifestCandidates, notebookManifestRelativePath, physicalNotebookRelativePath, resolveNotebookContentDirectory, resolveNotebookManifestPath, } from './layout.js';
export const NOTEBOOK_SUPPORT_DIRECTORIES = Object.freeze(['hooks', 'lib', 'tools', 'widgets', 'styles']);
/** Conventional support paths prefer backstage; explicit backstage paths never fall back. */
export function notebookSupportCandidates(root, relativePath, preferRoot = false) {
    const normalized = relativePath.replaceAll('\\', '/');
    const segments = normalized.split('/');
    if (segments.some(segment => !segment || segment === '.' || segment === '..' || segment.includes('\0'))) {
        throw new Error('Notebook support path must be a contained relative path.');
    }
    const explicit = segments[0] === NOTEBOOK_BACKSTAGE_DIR;
    if (!NOTEBOOK_SUPPORT_DIRECTORIES.includes(segments[explicit ? 1 : 0] || '')) {
        throw new Error('Unknown Notebook support directory.');
    }
    const canonical = canonicalRoot(root);
    const candidates = explicit ? [path.join(canonical, normalized)] : [
        path.join(canonical, NOTEBOOK_BACKSTAGE_DIR, normalized), path.join(canonical, normalized),
    ];
    if (preferRoot && !explicit)
        candidates.reverse();
    // Validate existing ancestors too, including a dangling/escaping symlink.
    for (const candidate of candidates) {
        let current = canonical;
        for (const segment of path.relative(canonical, candidate).split(path.sep)) {
            current = path.join(current, segment);
            try {
                fs.lstatSync(current);
                if (!isInside(canonical, fs.realpathSync.native(current)))
                    throw new Error('Notebook support path escapes its root.');
            }
            catch (error) {
                if (errorCode(error) === 'ENOENT') {
                    // A missing ordinary path is writable; an unresolved symlink is not.
                    try {
                        if (fs.lstatSync(current).isSymbolicLink())
                            throw new Error('Notebook support path contains an unresolved symlink.');
                    }
                    catch (nested) {
                        if (errorCode(nested) !== 'ENOENT')
                            throw nested;
                    }
                    break;
                }
                throw error;
            }
        }
    }
    return candidates;
}
export function resolveNotebookSupportPath(root, relativePath, { preferRoot = false, fresh = false } = {}) {
    const candidates = notebookSupportCandidates(root, relativePath, preferRoot);
    const existing = candidates.find(candidate => fs.existsSync(candidate));
    if (existing)
        return existing;
    if (candidates.length === 1)
        return candidates[0];
    return fresh || fs.existsSync(path.join(root, NOTEBOOK_BACKSTAGE_DIR)) ? candidates[preferRoot ? 1 : 0] : candidates[preferRoot ? 0 : 1];
}
/** Candidate paths for imports from Notebook modules, including Vite-expanded @ aliases. */
export function notebookSupportImportCandidates(root, id, importer, applicationRoot) {
    const cleanImporter = importer?.split('?')[0];
    const notebookRoot = canonicalRoot(root);
    const source = cleanImporter ? canonicalRoot(cleanImporter) : null;
    if (!source || !isInside(notebookRoot, source) || source.includes(`${path.sep}node_modules${path.sep}`))
        return [];
    let relative;
    if (id.startsWith('@/'))
        relative = id.slice(2);
    else if (id.startsWith('.'))
        relative = path.relative(notebookRoot, path.resolve(path.dirname(source), id));
    else if (path.isAbsolute(id)) {
        const target = canonicalRoot(id);
        relative = path.relative(notebookRoot, target);
        if (!isInside(notebookRoot, target)) {
            relative = isInside(root, id) ? path.relative(root, id) : path.relative(path.join(applicationRoot, 'src'), id);
        }
    }
    else
        return [];
    if (!NOTEBOOK_SUPPORT_DIRECTORIES.includes(relative.split(path.sep)[0] || ''))
        return [];
    return notebookSupportCandidates(notebookRoot, relative);
}
/** Optional application-config files a Notebook may override explicitly. */
export const NOTEBOOK_CONFIG_FILES = Object.freeze([
    'hypercanvas.config.json',
    'terminal.config.json',
    'toolbar.config.json',
    'commandpalette.config.json',
    'paste.config.json',
    'widgets.config.json',
    'mascot.config.json',
]);
/** All application-config filenames ever emitted — legacy projects keep theirs. */
export const LEGACY_NOTEBOOK_CONFIG_FILE = 'storyboard.config.json';
export const NOTEBOOK_CONFIG_FILE_NAMES = Object.freeze([
    ...NOTEBOOK_CONFIG_FILES,
    LEGACY_NOTEBOOK_CONFIG_FILE,
]);
export const NOTEBOOK_DIRECTORIES = Object.freeze({
    canvases: 'canvas',
    prototypes: 'prototypes',
    widgets: 'widgets',
    tools: 'tools',
    components: 'components',
    data: 'data',
    assets: 'assets',
    publish: NOTEBOOK_PUBLISH_DIR,
});
// Read old Site descriptor locations for migration/diagnostics only. Site
// project directories are external and are never created in the Notebook.
const LEGACY_SITE_DIRECTORY = 'sites';
const RECOVERABLE_PAGE_DIAGNOSTICS = new Set([
    'MISSING_PAGE_PAYLOAD',
    'MISSING_SITE_DESCRIPTOR',
    'UNSUPPORTED_CANVAS_LOCATION',
    'PAGE_ROUTE_CONFLICT',
    'NESTED_ARTIFACT',
    'INVALID_ARTIFACT_IDENTITY',
    'MALFORMED_ARTIFACT_PAYLOAD',
    'AMBIGUOUS_CANVAS_PAYLOAD',
    'DUPLICATE_ARTIFACT_ID',
    'ARTIFACT_ROUTE_CONFLICT',
    'UNREPRESENTABLE_ARTIFACT_ROUTE',
    'INVALID_EXTERNAL_PROTOTYPE_URL',
    'PROTOTYPE_DATA_SCOPE_CONFLICT',
    'CUSTOM_DRAFT_EXCLUSION',
]);
const DEFAULT_CANVAS_CONFIG = Object.freeze({
    version: 1,
    canvasDirectory: NOTEBOOK_DIRECTORIES.canvases,
    prototypeDirectory: NOTEBOOK_DIRECTORIES.prototypes,
    assetsDirectory: NOTEBOOK_DIRECTORIES.assets,
});
function diagnostic(code, message, relativePath = null) {
    return { code, message, path: relativePath };
}
function runtimePathError() {
    return Object.assign(new Error('Notebook runtime directory resolves outside its filesystem root.'), { code: 'UNSAFE_NOTEBOOK_PATH' });
}
function makeId() {
    return `nb_${randomUUID().replaceAll('-', '')}`;
}
function canonicalRoot(root) {
    const resolved = path.resolve(String(root || '.'));
    try {
        return fs.realpathSync.native(resolved);
    }
    catch {
        return resolved;
    }
}
function isDirectory(filePath) {
    try {
        return fs.statSync(filePath).isDirectory();
    }
    catch {
        return false;
    }
}
function isFile(filePath) {
    try {
        return fs.statSync(filePath).isFile();
    }
    catch {
        return false;
    }
}
function isInside(root, candidate) {
    const relative = path.relative(root, candidate);
    return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}
function payloadState(root, relativePath, type) {
    const candidate = path.resolve(root, relativePath);
    if (!isInside(root, candidate))
        return { available: false, unsafe: true };
    try {
        const resolved = fs.realpathSync.native(candidate);
        if (!isInside(root, resolved))
            return { available: false, unsafe: true };
    }
    catch {
        return { available: false, unsafe: false };
    }
    return {
        available: type === 'canvas' ? isFile(candidate) : isDirectory(candidate),
        unsafe: false,
    };
}
function safeRelativePath(value) {
    if (typeof value !== 'string' || value.trim() === '')
        return null;
    const normalized = value.replaceAll('\\', '/');
    if (normalized.startsWith('/') || path.posix.isAbsolute(normalized))
        return null;
    const segments = normalized.split('/');
    if (segments.includes('..') || segments.includes(''))
        return null;
    const clean = path.posix.normalize(normalized);
    return clean === '.' || clean.startsWith('../') ? null : clean;
}
function pagePathIsValid(type, relativePath) {
    if (type === 'canvas') {
        return (relativePath.startsWith(`${NOTEBOOK_DIRECTORIES.canvases}/`) && relativePath.endsWith('.canvas.jsonl'))
            || /(?:^|\/)[^/]+\.canvas\/[^/]+\.canvas\.jsonl$/.test(relativePath);
    }
    if (type === 'prototype')
        return relativePath.startsWith(`${NOTEBOOK_DIRECTORIES.prototypes}/`)
            || /(?:^|\/)[^/]+\.prototype$/.test(relativePath);
    return type === 'component' && /(?:^|\/)[^/]+\.component$/.test(relativePath);
}
function deterministicId(prefix, value) {
    const suffix = createHash('sha256').update(String(value)).digest('hex').slice(0, 20);
    return `${prefix}-${suffix}`;
}
const NOTEBOOK_ARTIFACT_SUFFIXES = Object.freeze({
    '.prototype': 'prototype',
    '.component': 'component',
    '.canvas': 'canvas',
    '.site': 'site',
});
const ARTIFACT_SOURCE_EXTENSIONS = ['jsx', 'js', 'tsx', 'ts', 'mdx'];
function artifactKindForDirectory(name) {
    for (const [suffix, kind] of Object.entries(NOTEBOOK_ARTIFACT_SUFFIXES)) {
        if (name.endsWith(suffix) && name.length > suffix.length)
            return kind;
    }
    return null;
}
function canonicalArtifactRoute(kind, logicalName) {
    if (kind === 'prototype')
        return `/${encodeURIComponent(`${logicalName}.prototype`)}`;
    if (kind === 'canvas')
        return `/canvas/${encodeURIComponent(logicalName)}`;
    if (kind === 'component')
        return `/components/${encodeURIComponent(logicalName)}`;
    return `/sites/${encodeURIComponent(logicalName)}`;
}
function artifactRouteNameIssue(logicalName) {
    if (!logicalName)
        return 'Artifact folder has an empty logical basename after removing its visibility prefix and kind suffix.';
    if (logicalName.includes('/') || logicalName.includes('\\'))
        return 'Artifact logical names cannot contain filesystem path separators.';
    if (logicalName.includes('?'))
        return 'Artifact names containing "?" cannot be represented as static React Router paths.';
    // React Router treats a leading `:param` as dynamic even when the suffix
    // appended below makes the final route look like `:param.more.prototype`.
    if (/^:[A-Za-z_$][A-Za-z0-9_$]*/.test(logicalName)) {
        return 'Artifact names beginning with a route parameter such as ":preview" would match unrelated routes.';
    }
    return null;
}
function notebookRoutePathsOverlap(left, right) {
    return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}
function readArtifactIdentity(directory, kind, folderPath) {
    const markerPath = path.join(directory, NOTEBOOK_ARTIFACT_MARKER_FILE);
    let markerStat;
    try {
        markerStat = fs.lstatSync(markerPath);
    }
    catch {
        return { id: null, diagnostics: [] };
    }
    if (!markerStat.isFile())
        return { id: null, diagnostics: [diagnostic('INVALID_ARTIFACT_IDENTITY', `Artifact identity ${folderPath}/${NOTEBOOK_ARTIFACT_MARKER_FILE} must be a regular file inside the artifact folder. Replace the symlink or special file with a JSON marker.`, `${folderPath}/${NOTEBOOK_ARTIFACT_MARKER_FILE}`)] };
    try {
        const value = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
        const marker = record(value);
        if (marker.formatVersion !== 1 || typeof marker.id !== 'string' || !marker.id.trim()
            || marker.kind !== kind) {
            return { id: null, diagnostics: [diagnostic('INVALID_ARTIFACT_IDENTITY', `Artifact identity at ${folderPath}/${NOTEBOOK_ARTIFACT_MARKER_FILE} must contain formatVersion 1, a nonempty id, and kind "${kind}". Repair or recreate this marker.`, `${folderPath}/${NOTEBOOK_ARTIFACT_MARKER_FILE}`)] };
        }
        const migrationAliases = normalizeNotebookArtifactMigrationAliases(marker.migrationAliases);
        if (marker.migrationAliases !== undefined && !migrationAliases) {
            return { id: marker.id, marker, diagnostics: [diagnostic('INVALID_ARTIFACT_MIGRATION_ALIASES', 'Artifact migration aliases at ' + folderPath + '/' + NOTEBOOK_ARTIFACT_MARKER_FILE + ' are malformed. Repair the alias metadata before registering this artifact.', folderPath + '/' + NOTEBOOK_ARTIFACT_MARKER_FILE)] };
        }
        return {
            id: marker.id,
            marker,
            ...(migrationAliases && Object.keys(migrationAliases).length ? { migrationAliases } : {}),
            diagnostics: [],
        };
    }
    catch (error) {
        return { id: null, diagnostics: [diagnostic('INVALID_ARTIFACT_IDENTITY', `Could not parse ${folderPath}/${NOTEBOOK_ARTIFACT_MARKER_FILE}: ${errorMessage(error)}. Repair or recreate this marker.`, `${folderPath}/${NOTEBOOK_ARTIFACT_MARKER_FILE}`)] };
    }
}
function artifactPayload(root, absoluteDirectory, folderPath, kind) {
    const basename = path.posix.basename(folderPath);
    const name = basename.slice(0, basename.lastIndexOf('.')).replace(/^_+/, '');
    let payloadPath = null;
    let title = name.replace(/[-_]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()) || name;
    let route = null;
    let externalUrl;
    let issue = null;
    let issueCode = 'MALFORMED_ARTIFACT_PAYLOAD';
    let entries = [];
    try {
        entries = fs.readdirSync(absoluteDirectory, { withFileTypes: true });
    }
    catch { /* surfaced as missing payload */ }
    if (kind === 'prototype') {
        const source = entries.find(entry => entry.isFile() && ARTIFACT_SOURCE_EXTENSIONS.some(extension => entry.name === `index.${extension}`));
        const metadata = entries.find(entry => entry.isFile() && [`${name}.prototype.json`, `${name}.prototype.jsonc`].includes(entry.name));
        if (source)
            payloadPath = path.posix.join(folderPath, source.name);
        else if (metadata) {
            payloadPath = path.posix.join(folderPath, metadata.name);
            const errors = [];
            const parsed = parseJsonc(fs.readFileSync(path.join(absoluteDirectory, metadata.name), 'utf8'), errors);
            if (errors.length || !isRecord(parsed))
                issue = `${payloadPath} must contain valid Prototype metadata JSON or JSONC.`;
            else {
                const metadataTitle = stringField(record(parsed.meta), 'title');
                if (metadataTitle?.trim())
                    title = metadataTitle.trim();
                const rawUrl = stringField(parsed, 'url')?.trim();
                let parsedUrl = null;
                try {
                    parsedUrl = rawUrl ? new URL(rawUrl) : null;
                }
                catch { /* reported below */ }
                if (!parsedUrl || !['http:', 'https:'].includes(parsedUrl.protocol)) {
                    issueCode = 'INVALID_EXTERNAL_PROTOTYPE_URL';
                    issue = `${payloadPath} must contain an absolute HTTP(S) URL in its top-level "url" field.`;
                }
                else {
                    externalUrl = rawUrl;
                }
            }
        }
        else
            issue = `Add index.jsx, index.tsx, or ${name}.prototype.json to ${folderPath}.`;
        if (source)
            title = readPrototypeTitle(absoluteDirectory);
        route = canonicalArtifactRoute(kind, name);
    }
    else if (kind === 'component') {
        const stories = [];
        const collectStories = (directory, relative = '') => {
            for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
                if (entry.name.startsWith('.') || entry.name === 'node_modules')
                    continue;
                // A leading underscore on files is the private-module convention;
                // on directories it is sidebar-only visibility, so `_` folders scan.
                if (entry.isFile() && entry.name.startsWith('_'))
                    continue;
                const inside = path.posix.join(relative, entry.name);
                if (entry.isFile() && /\.stor(?:y|ies)\.[jt]sx?$/.test(entry.name))
                    stories.push(inside);
                else if (entry.isDirectory() && !/\.(prototype|component|canvas|site)$/.test(entry.name)) {
                    collectStories(path.join(directory, entry.name), inside);
                }
            }
        };
        collectStories(absoluteDirectory);
        const primary = stories.find(file => ARTIFACT_SOURCE_EXTENSIONS.some(extension => file === `${name}.story.${extension}`))
            || stories.find(file => ARTIFACT_SOURCE_EXTENSIONS.some(extension => file === `${name}.stories.${extension}`))
            || stories[0];
        if (primary)
            payloadPath = path.posix.join(folderPath, primary);
        else
            issue = `Add a .story.jsx, .stories.jsx, .story.tsx or .stories.tsx module to ${folderPath}.`;
        route = canonicalArtifactRoute(kind, name);
    }
    else if (kind === 'canvas') {
        const filename = `${name}.canvas.jsonl`;
        const source = entries.find(entry => entry.isFile() && entry.name === filename);
        const canvasPayloads = entries.filter(entry => entry.isFile() && entry.name.endsWith('.canvas.jsonl'));
        if (source) {
            payloadPath = path.posix.join(folderPath, source.name);
            title = readCanvasTitle(path.join(root, payloadPath));
            try {
                const lines = fs.readFileSync(path.join(root, payloadPath), 'utf8').split(/\r?\n/).filter(Boolean);
                for (const [index, line] of lines.entries()) {
                    try {
                        JSON.parse(line);
                    }
                    catch {
                        issue = `${payloadPath} contains invalid JSON on line ${index + 1}. Repair that line before opening the Canvas.`;
                        break;
                    }
                }
            }
            catch (error) {
                issue = `Could not read ${payloadPath}: ${errorMessage(error)}.`;
            }
        }
        else
            issue = `Add ${filename} to ${folderPath}.`;
        if (canvasPayloads.length > 1) {
            issueCode = 'AMBIGUOUS_CANVAS_PAYLOAD';
            issue = `Canvas artifact ${folderPath} has multiple JSONL payloads (${canvasPayloads.map(entry => entry.name).join(', ')}). Keep only ${filename} before opening the Canvas.`;
        }
        route = canonicalArtifactRoute(kind, name);
    }
    else {
        const filename = 'site.config.json';
        const source = entries.find(entry => entry.isFile() && entry.name === filename);
        if (source) {
            payloadPath = path.posix.join(folderPath, source.name);
            try {
                const descriptor = readSiteDescriptorFile(path.join(root, payloadPath), name.toLowerCase());
                title = descriptor.title || descriptor.id;
                if (name.toLowerCase() !== descriptor.id.toLowerCase()) {
                    issue = `${folderPath} must be named ${descriptor.id}.site (ignoring its visibility prefix) to match its normalized Site descriptor ID.`;
                }
                else {
                    route = `/sites/${encodeURIComponent(descriptor.id)}`;
                }
            }
            catch (error) {
                issue = `${payloadPath} is not valid JSON (${errorMessage(error)}). Repair or recreate the Site config.`;
            }
        }
        else
            issue = `Add ${filename} to ${folderPath}.`;
    }
    const routeNameIssue = artifactRouteNameIssue(name);
    if (routeNameIssue)
        route = null;
    return {
        payloadPath,
        title,
        route,
        ...(externalUrl ? { externalUrl } : {}),
        diagnostics: [
            ...(issue ? [diagnostic(issueCode, issue, payloadPath || folderPath)] : []),
            ...(routeNameIssue ? [diagnostic('UNREPRESENTABLE_ARTIFACT_ROUTE', `${routeNameIssue} Rename this artifact folder to a routable logical name.`, folderPath)] : []),
        ],
    };
}
function discoverNotebookArtifacts(root, registeredPages, claimedLocators = new Set()) {
    const rootRealPath = fs.realpathSync.native(root);
    const found = [];
    const diagnostics = [];
    const walk = (directory, relativeDirectory, artifactAncestors, hidden) => {
        let realDirectory;
        try {
            realDirectory = fs.realpathSync.native(directory);
        }
        catch {
            return;
        }
        if (!isInside(rootRealPath, realDirectory))
            return;
        let entries;
        try {
            entries = fs.readdirSync(directory, { withFileTypes: true });
        }
        catch {
            return;
        }
        entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
        for (const entry of entries) {
            if (entry.isSymbolicLink() || NOTEBOOK_INFRASTRUCTURE_DIRECTORIES.has(entry.name) || !entry.isDirectory())
                continue;
            const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
            const absolutePath = path.join(directory, entry.name);
            const kind = artifactKindForDirectory(entry.name);
            // Portable artifact folders are owned by the first-look scanner, including their nested-artifact diagnostics.
            if (kind && claimedLocators.has(relativePath))
                continue;
            const nextHidden = hidden || entry.name.startsWith('_');
            const nextAncestors = [...artifactAncestors];
            if (kind) {
                const metadata = artifactPayload(root, absolutePath, relativePath, kind);
                const identity = readArtifactIdentity(absolutePath, kind, relativePath);
                const registered = registeredPages.filter(page => page.type === kind && typeof page.path === 'string'
                    && (page.path.replaceAll('\\', '/') === relativePath || page.path.replaceAll('\\', '/') === metadata.payloadPath));
                const id = identity.id || (registered.length === 1 && typeof registered[0]?.id === 'string'
                    ? registered[0].id
                    : deterministicId(`artifact-${kind}`, relativePath));
                const diagnosticsForArtifact = [...identity.diagnostics, ...metadata.diagnostics];
                diagnostics.push(...diagnosticsForArtifact);
                const artifact = {
                    id, kind, folderPath: relativePath, payloadPath: metadata.payloadPath,
                    title: metadata.title, route: metadata.route,
                    ...(metadata.externalUrl ? { externalUrl: metadata.externalUrl } : {}), visible: !nextHidden,
                    available: metadata.payloadPath !== null && diagnosticsForArtifact.length === 0,
                    ...(identity.migrationAliases ? { migrationAliases: identity.migrationAliases } : {}),
                    diagnostics: diagnosticsForArtifact,
                };
                if (artifactAncestors.length) {
                    const containingArtifact = artifactAncestors.at(-1);
                    const outermostArtifact = artifactAncestors[0];
                    const repairParentPath = path.posix.dirname(outermostArtifact.path);
                    const normalizedRepairParentPath = repairParentPath === '.' ? '' : repairParentPath;
                    const proposedDestination = path.posix.join(normalizedRepairParentPath, path.posix.basename(relativePath));
                    const item = Object.assign(diagnostic('NESTED_ARTIFACT', `${kind} artifact ${relativePath} is nested inside ${containingArtifact.kind} artifact ${containingArtifact.path}. Move it to ${proposedDestination}.`, relativePath), {
                        nestedArtifact: { kind, path: relativePath },
                        containingArtifact,
                        repairParentPath: normalizedRepairParentPath,
                        proposedDestination,
                    });
                    diagnostics.push(item);
                }
                else
                    found.push({ directory: absolutePath, artifact });
                nextAncestors.push({ kind, path: relativePath });
            }
            walk(absolutePath, relativePath, nextAncestors, nextHidden);
        }
    };
    walk(root, '', [], false);
    const idPaths = new Map();
    const routePaths = new Map();
    for (const { artifact } of found) {
        idPaths.set(artifact.id, [...(idPaths.get(artifact.id) || []), artifact]);
        if (artifact.available && artifact.route) {
            const routeKey = notebookRouteCollisionKey(artifact.route);
            routePaths.set(routeKey, [...(routePaths.get(routeKey) || []), artifact]);
        }
    }
    for (const [id, matches] of idPaths) {
        if (matches.length < 2)
            continue;
        for (const artifact of matches) {
            const item = diagnostic('DUPLICATE_ARTIFACT_ID', `Artifact identity "${id}" is shared by ${matches.map(match => match.folderPath).join(' and ')}; assign distinct IDs before registering either artifact.`, artifact.folderPath);
            artifact.available = false;
            artifact.diagnostics.push(item);
            diagnostics.push(item);
        }
    }
    for (const matches of routePaths.values()) {
        if (matches.length < 2)
            continue;
        const routes = [...new Set(matches.map(match => match.route))];
        for (const artifact of matches) {
            const item = diagnostic('ARTIFACT_ROUTE_CONFLICT', `Canonical artifact route${routes.length === 1 ? '' : 's'} ${routes.map(route => `"${route}"`).join(' / ')} conflict across ${matches.map(match => match.folderPath).join(' and ')}; rename or re-route these artifacts before registration.`, artifact.folderPath);
            artifact.available = false;
            artifact.diagnostics.push(item);
            diagnostics.push(item);
        }
    }
    const routeAliasOwners = new Map();
    const canvasAliasOwners = new Map();
    const failArtifact = (artifact, code, message) => {
        const item = diagnostic(code, message, artifact.folderPath);
        artifact.available = false;
        artifact.diagnostics.push(item);
        diagnostics.push(item);
    };
    for (const { artifact } of found) {
        if (!artifact.available)
            continue;
        for (const alias of artifact.migrationAliases?.legacyRoutes || []) {
            const key = notebookRouteCollisionKey(alias.from);
            const priorAliases = routeAliasOwners.get(key) || [];
            const canonicalOwners = [...routePaths.entries()]
                .filter(([route]) => notebookRoutePathsOverlap(route, key))
                .flatMap(([, owners]) => owners);
            const registeredOwners = registeredPages.filter(page => typeof page.route === 'string'
                && notebookRoutePathsOverlap(notebookRouteCollisionKey(page.route), key)
                && page.id !== artifact.id && page.path !== artifact.folderPath && page.path !== artifact.payloadPath);
            const reserved = isReservedApplicationRoute(alias.from);
            const owners = [...priorAliases.map(owner => owner.artifact), ...canonicalOwners, ...registeredOwners.flatMap(page => {
                    const owner = found.find(candidate => candidate.artifact.id === page.id)?.artifact;
                    return owner ? [owner] : [];
                })];
            const overlappingAliases = [...routeAliasOwners.entries()]
                .filter(([route]) => notebookRoutePathsOverlap(route, key))
                .flatMap(([, entries]) => entries.map(entry => entry.artifact));
            if (reserved || owners.some(owner => owner !== artifact) || overlappingAliases.some(owner => owner !== artifact)) {
                failArtifact(artifact, 'ARTIFACT_ROUTE_ALIAS_CONFLICT', 'Migration route alias ' + alias.from + ' conflicts with an active canonical route, another alias, or a reserved application route.');
                for (const owner of owners) {
                    if (owner !== artifact)
                        failArtifact(owner, 'ARTIFACT_ROUTE_ALIAS_CONFLICT', 'Artifact route conflicts with migration alias ' + alias.from + '.');
                }
            }
            routeAliasOwners.set(key, [...priorAliases, { artifact, from: alias.from }]);
        }
        for (const canvasId of artifact.migrationAliases?.legacyCanvasIds || []) {
            canvasAliasOwners.set(canvasId, [...(canvasAliasOwners.get(canvasId) || []), artifact]);
        }
    }
    for (const { artifact } of found) {
        const aliases = artifact.migrationAliases?.legacyCanvasIds || [];
        for (const canvasId of aliases) {
            const canonicalOwners = idPaths.get(canvasId) || [];
            const owners = [...new Set([...(canvasAliasOwners.get(canvasId) || []), ...canonicalOwners])];
            if (owners.length < 2)
                continue;
            failArtifact(artifact, 'ARTIFACT_CANVAS_ALIAS_CONFLICT', 'Legacy Canvas identity "' + canvasId + '" conflicts with another artifact ID or alias.');
            for (const owner of owners) {
                if (owner !== artifact)
                    failArtifact(owner, 'ARTIFACT_CANVAS_ALIAS_CONFLICT', 'Artifact identity conflicts with legacy Canvas alias "' + canvasId + '".');
            }
        }
    }
    return { artifacts: found.map(({ artifact }) => artifact).sort((left, right) => left.folderPath.localeCompare(right.folderPath, 'en')), diagnostics };
}
function isReservedApplicationRoute(route) {
    const first = route.split('/').filter(Boolean)[0]?.toLocaleLowerCase('en-US');
    return !first || ['workspace', 'viewfinder', 'create', 'sites', 'canvas', 'components', 'notebook', '_hypercanvas'].includes(first);
}
function persistArtifactIdentityMarkers(root, artifacts, pages) {
    const rootPath = fs.realpathSync.native(root);
    for (const artifact of artifacts) {
        // Portable artifacts keep their identity in their own descriptors; never write a marker into them.
        if (!artifact.available || artifact.portable === true)
            continue;
        const directory = path.resolve(rootPath, artifact.folderPath);
        let realDirectory;
        try {
            realDirectory = fs.realpathSync.native(directory);
        }
        catch {
            continue;
        }
        if (!isInside(rootPath, directory) || !isInside(rootPath, realDirectory))
            continue;
        const registered = pages.find(page => page.type === artifact.kind && page.id && (page.path === artifact.folderPath || page.path === artifact.payloadPath));
        const markerPath = path.join(directory, NOTEBOOK_ARTIFACT_MARKER_FILE);
        const current = readArtifactIdentity(directory, artifact.kind, artifact.folderPath);
        const id = current.id || (typeof registered?.id === 'string' && registered.id.trim() ? registered.id : artifact.id);
        const marker = { ...(current.marker || {}), formatVersion: 1, id, kind: artifact.kind };
        if (isFile(markerPath)) {
            if (current.id === id)
                continue;
        }
        writeJsonAtomic(markerPath, marker);
    }
}
function pageRoute(page) {
    if (page.type === 'prototype' && typeof page.path === 'string' && page.path.endsWith('.prototype')) {
        const name = artifactFolderLogicalName(path.posix.basename(page.path));
        return name ? canonicalArtifactRoute('prototype', name) : null;
    }
    if (page.type === 'component' && typeof page.path === 'string' && path.posix.basename(page.path).endsWith('.component')) {
        const name = artifactFolderLogicalName(path.posix.basename(page.path));
        return name ? canonicalArtifactRoute('component', name) : null;
    }
    if (page.type === 'canvas' && typeof page.path === 'string' && page.path.includes('.canvas/')) {
        const folder = page.path.slice(0, page.path.indexOf('.canvas/'));
        const name = artifactFolderLogicalName(`${path.posix.basename(folder)}.canvas`);
        return name ? canonicalArtifactRoute('canvas', name) : null;
    }
    if (typeof page.route === 'string' && page.route.startsWith('/'))
        return page.route;
    if (page.type === 'site')
        return `/sites/${encodeURIComponent(String(page.siteId || page.id || ''))}`;
    if (page.type === 'component' && typeof page.path === 'string') {
        const folderName = path.posix.basename(page.path);
        const basename = artifactFolderLogicalName(folderName) || folderName.replace(/\.component$/, '');
        return `/components/${basename}`;
    }
    if (page.type === 'prototype' && typeof page.path === 'string' && page.path.endsWith('.prototype')) {
        const folderName = path.posix.basename(page.path);
        return `/${artifactFolderLogicalName(folderName) || folderName}`;
    }
    if (page.type === 'canvas' && typeof page.path === 'string' && page.path.includes('.canvas/')) {
        const folder = page.path.slice(0, page.path.indexOf('.canvas/'));
        return `/canvas/${artifactFolderLogicalName(`${path.posix.basename(folder)}.canvas`) || path.posix.basename(folder)}`;
    }
    const locator = String(page.path || '').replaceAll('\\', '/');
    const segments = locator.split('/').filter(Boolean);
    if (page.type === 'canvas' && locator.startsWith(`${NOTEBOOK_DIRECTORIES.canvases}/`) && locator.endsWith('.canvas.jsonl')) {
        const routeSegments = segments.slice(1, -1).concat((segments.at(-1) || '').replace(/\.canvas\.jsonl$/, ''))
            .filter(segment => segment !== 'drafts' && !segment.endsWith('.folder'));
        return `/canvas/${routeSegments.join('/')}`;
    }
    if (page.type === 'prototype' && locator.startsWith(`${NOTEBOOK_DIRECTORIES.prototypes}/`)) {
        const routeSegments = segments.slice(1, -1)
            .filter(segment => segment !== 'drafts' && !segment.endsWith('.folder'))
            .concat(segments.at(-1) || []);
        return `/${routeSegments.join('/')}`;
    }
    return null;
}
function legacyGroupKey(page) {
    const segments = String(page.path || '').replaceAll('\\', '/').split('/').filter(Boolean);
    if (page.type === 'canvas' && segments[0] === NOTEBOOK_DIRECTORIES.canvases) {
        const groups = segments.slice(1, -1);
        return groups.length ? groups.join('/') : null;
    }
    if (page.type === 'prototype' && segments[0] === NOTEBOOK_DIRECTORIES.prototypes) {
        const groups = segments.slice(1, -1).filter(segment => segment.endsWith('.folder')).map(segment => segment.slice(0, -7));
        return groups.length ? groups.join('/') : null;
    }
    return null;
}
function migrateManifestV1(root, legacy) {
    if (!isRecord(legacy) || legacy.formatVersion !== 1)
        return legacy;
    const legacyRecord = legacy;
    const pages = (Array.isArray(legacyRecord.pages) ? legacyRecord.pages : []).map((page, index) => {
        if (!isRecord(page))
            return page;
        const locator = safeRelativePath(page.path) || `invalid-${index + 1}`;
        const type = isPageType(page.type) ? page.type : 'page';
        const migrated = {
            ...page,
            id: typeof page.id === 'string' && page.id.trim() ? page.id : deterministicId(type, locator),
            title: typeof page.title === 'string' && page.title.trim() ? page.title : path.posix.basename(locator).replace(/\.canvas\.jsonl$/, ''),
        };
        migrated.route = pageRoute(migrated);
        return migrated;
    });
    const siteStore = new SiteStore(root);
    const usedIds = new Set(pages.map(page => isRecord(page) ? page.id : undefined).filter((id) => typeof id === 'string'));
    for (const site of siteStore.list()) {
        const id = deterministicId('site', site.id);
        if (usedIds.has(id))
            continue;
        usedIds.add(id);
        pages.push({ id, type: 'site', siteId: site.id, title: site.title, route: `/sites/${encodeURIComponent(site.id)}` });
    }
    const groupsByTitle = new Map();
    for (const candidate of pages) {
        const page = record(candidate);
        const key = legacyGroupKey(page);
        if (!key)
            continue;
        const title = key.split('/').join(' / ');
        if (!groupsByTitle.has(title))
            groupsByTitle.set(title, []);
        if (typeof page.id === 'string')
            groupsByTitle.get(title)?.push(page.id);
    }
    const legacyGroups = [...groupsByTitle].map(([title, pageIds]) => ({
        id: deterministicId('section', title.toLowerCase()),
        title,
        pageIds,
    }));
    return {
        ...legacyRecord,
        formatVersion: 2,
        pages,
        navigation: createDefaultNavigation(navigationPages(pages.filter(isRecord).map(record)), { legacyGroups }),
    };
}
function listFilesRecursively(directory, predicate, results = []) {
    if (!isDirectory(directory))
        return results;
    let entries = [];
    try {
        entries = fs.readdirSync(directory, { withFileTypes: true });
    }
    catch {
        return results;
    }
    for (const entry of entries) {
        if (entry.name.startsWith('.') && !entry.name.endsWith('.folder'))
            continue;
        if (entry.name.startsWith('_'))
            continue;
        const absolute = path.join(directory, entry.name);
        if (entry.isSymbolicLink())
            continue;
        if (entry.isDirectory() && !artifactKindForDirectory(entry.name))
            listFilesRecursively(absolute, predicate, results);
        else if (entry.isFile() && predicate(entry.name, absolute))
            results.push(absolute);
    }
    return results;
}
function readCanvasTitle(filePath, { fallbackName = true } = {}) {
    try {
        const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
        for (let index = lines.length - 1; index >= 0; index -= 1) {
            const line = lines[index];
            if (line === undefined)
                continue;
            const event = JSON.parse(line);
            if (!isRecord(event))
                continue;
            const settings = record(event.settings);
            const settingsTitle = event.event === 'settings_updated' ? stringField(settings, 'title') : undefined;
            if (settingsTitle?.trim())
                return settingsTitle.trim();
            if (typeof event.title === 'string' && event.title.trim())
                return event.title.trim();
        }
    }
    catch { /* damaged canvases stay discoverable under their file name */ }
    return fallbackName ? path.basename(filePath).replace(/\.canvas\.jsonl$/, '') : '';
}
function readPrototypeTitle(directory) {
    let entries = [];
    try {
        entries = fs.readdirSync(directory, { withFileTypes: true });
    }
    catch {
        return path.basename(directory);
    }
    const metadata = entries.find(entry => entry.isFile() && (entry.name.endsWith('.prototype.json') || entry.name.endsWith('.prototype.jsonc')));
    if (metadata) {
        try {
            const errors = [];
            const value = parseJsonc(fs.readFileSync(path.join(directory, metadata.name), 'utf8'), errors);
            if (errors.length)
                return path.basename(directory);
            const title = isRecord(value) ? stringField(record(value.meta), 'title') : undefined;
            if (title?.trim())
                return title.trim();
        }
        catch { /* malformed metadata does not hide the prototype */ }
    }
    return path.basename(directory);
}
function prototypeDirectories(root) {
    const prototypesRoot = path.join(root, NOTEBOOK_DIRECTORIES.prototypes);
    const directories = [];
    const walkLegacyGroups = (directory) => {
        let entries = [];
        try {
            entries = fs.readdirSync(directory, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (entry.name.startsWith('_') || entry.isSymbolicLink() || !entry.isDirectory())
                continue;
            if (artifactKindForDirectory(entry.name))
                continue;
            const target = path.join(directory, entry.name);
            let children = [];
            try {
                children = fs.readdirSync(target, { withFileTypes: true });
            }
            catch {
                continue;
            }
            if (children.some(child => child.isFile() && (child.name.endsWith('.prototype.json') || /^index\.(jsx|js|tsx|ts)$/.test(child.name)))) {
                directories.push(target);
            }
            if (entry.name.endsWith('.folder') || entry.name === 'drafts')
                walkLegacyGroups(target);
        }
    };
    walkLegacyGroups(prototypesRoot);
    return directories;
}
function appendDiscoveredPages(navigation, pages, addedPages) {
    if (!addedPages.length)
        return normalizeNavigation(navigation, navigationPages(pages)).navigation;
    const current = normalizeNavigation(navigation, navigationPages(pages)).navigation;
    for (const page of addedPages) {
        if (typeof page.id !== 'string' || typeof page.type !== 'string')
            continue;
        if (isPageType(page.type)) {
            const order = current.type.order;
            (order[page.type] ??= []).push(page.id);
        }
        current.files.flatOrder.push(page.id);
        current.files.entries.push({ type: 'page', pageId: page.id });
    }
    return current;
}
/** Discover supported payloads without changing saved page identities or layout. */
function discoverNotebookPages(root, registeredPages, excludedLocators = new Set()) {
    const knownLocators = new Set([...excludedLocators, ...registeredPages.flatMap(page => typeof page.path === 'string' ? [page.path.replaceAll('\\', '/')] : [])]);
    const knownSites = new Set(registeredPages.flatMap(page => page.type === 'site' && typeof page.siteId === 'string' ? [page.siteId] : []));
    const knownIds = new Set(registeredPages.flatMap(page => typeof page.id === 'string' ? [page.id] : []));
    const discovered = [];
    const add = (page) => {
        const locator = typeof page.path === 'string' ? page.path.replaceAll('\\', '/') : null;
        if (locator && knownLocators.has(locator))
            return;
        if (typeof page.id === 'string' && registeredPages.some(registered => registered.id === page.id && registered.type === page.type)) {
            if (locator)
                knownLocators.add(locator);
            return;
        }
        if (page.type === 'site' && typeof page.siteId === 'string' && knownSites.has(page.siteId))
            return;
        let id = typeof page.id === 'string' ? page.id : deterministicId(String(page.type || 'page'), locator || page.title || '');
        while (knownIds.has(id))
            id = `${id}-next`;
        page.id = id;
        knownIds.add(id);
        if (locator)
            knownLocators.add(locator);
        if (page.type === 'site' && typeof page.siteId === 'string')
            knownSites.add(page.siteId);
        discovered.push(page);
    };
    const canvasRoot = path.join(root, NOTEBOOK_DIRECTORIES.canvases);
    for (const absolute of listFilesRecursively(canvasRoot, (name) => name.endsWith('.canvas.jsonl'))) {
        const relative = path.relative(root, absolute).replaceAll('\\', '/');
        const page = {
            id: deterministicId('canvas', relative),
            type: 'canvas',
            title: readCanvasTitle(absolute),
            path: relative,
        };
        page.route = pageRoute(page);
        add(page);
    }
    const prototypeRoot = path.join(root, NOTEBOOK_DIRECTORIES.prototypes);
    for (const absolute of prototypeDirectories(root)) {
        const relative = path.relative(root, absolute).replaceAll('\\', '/');
        const page = {
            id: deterministicId('prototype', relative),
            type: 'prototype',
            title: readPrototypeTitle(absolute),
            path: relative,
        };
        page.route = pageRoute(page);
        add(page);
    }
    for (const absolute of listFilesRecursively(prototypeRoot, (name) => name.endsWith('.canvas.jsonl'))) {
        const relative = path.relative(root, absolute).replaceAll('\\', '/');
        const page = {
            id: deterministicId('canvas', relative),
            type: 'canvas',
            title: readCanvasTitle(absolute),
            path: relative,
            route: null,
        };
        add(page);
    }
    const catalog = discoverNotebookArtifacts(root, registeredPages);
    const catalogSiteIds = new Set();
    for (const artifact of catalog.artifacts) {
        if (artifact.kind === 'site' && artifact.payloadPath) {
            try {
                catalogSiteIds.add(readSiteDescriptorFile(path.join(root, artifact.payloadPath)).id);
            }
            catch { /* diagnosed by catalog */ }
        }
        if (!artifact.available)
            continue;
        if (artifact.kind === 'site') {
            if (!artifact.payloadPath || !artifact.route)
                continue;
            try {
                const site = readSiteDescriptorFile(path.join(root, artifact.payloadPath));
                add({
                    id: artifact.id,
                    type: 'site',
                    siteId: site.id,
                    title: artifact.title,
                    route: artifact.route,
                });
            }
            catch { /* malformed Site descriptors are surfaced by the artifact catalog */ }
            continue;
        }
        const pagePath = artifact.kind === 'canvas' ? artifact.payloadPath : artifact.folderPath;
        if (!pagePath)
            continue;
        const page = {
            id: artifact.id,
            type: artifact.kind,
            title: artifact.title,
            path: pagePath,
            route: artifact.route,
        };
        add(page);
    }
    for (const site of new SiteStore(root).list()) {
        if (catalogSiteIds.has(site.id))
            continue;
        add({
            id: deterministicId('site', site.id),
            type: 'site',
            siteId: site.id,
            title: site.title || site.id,
            route: `/sites/${encodeURIComponent(site.id)}`,
        });
    }
    return discovered;
}
function validateManifestShape(manifest) {
    const diagnostics = [];
    if (!isRecord(manifest)) {
        return [diagnostic('INVALID_MANIFEST', 'Notebook manifest must be a JSON object.', NOTEBOOK_MANIFEST_FILE)];
    }
    if (manifest.formatVersion !== NOTEBOOK_FORMAT_VERSION) {
        const code = Number(manifest.formatVersion) > NOTEBOOK_FORMAT_VERSION
            ? 'UNSUPPORTED_VERSION'
            : 'INVALID_VERSION';
        diagnostics.push(diagnostic(code, `Notebook formatVersion must be ${NOTEBOOK_FORMAT_VERSION}.`, NOTEBOOK_MANIFEST_FILE));
    }
    if (typeof manifest.id !== 'string' || manifest.id.trim() === '') {
        diagnostics.push(diagnostic('MISSING_NOTEBOOK_ID', 'Notebook manifest requires a stable id.', NOTEBOOK_MANIFEST_FILE));
    }
    if (typeof manifest.title !== 'string' || manifest.title.trim() === '') {
        diagnostics.push(diagnostic('MISSING_NOTEBOOK_TITLE', 'Notebook manifest requires a title.', NOTEBOOK_MANIFEST_FILE));
    }
    if (!Array.isArray(manifest.pages)) {
        diagnostics.push(diagnostic('INVALID_PAGES', 'Notebook manifest pages must be an array.', NOTEBOOK_MANIFEST_FILE));
    }
    return diagnostics;
}
function validatePages(root, manifest) {
    const diagnostics = [];
    const pages = [];
    const ids = new Set();
    const manifestPages = record(manifest).pages;
    if (!Array.isArray(manifestPages))
        return { pages, diagnostics };
    for (const [index, candidate] of manifestPages.entries()) {
        const pageRecord = isRecord(candidate) ? candidate : null;
        const page = pageRecord ?? {};
        const pagePath = page.path;
        const relativePath = safeRelativePath(pagePath);
        const pageDiagnostics = [];
        if (!pageRecord) {
            pageDiagnostics.push(diagnostic('INVALID_PAGE', `Page ${index + 1} must be an object.`, `pages[${index}]`));
        }
        else {
            if (typeof page.id !== 'string' || page.id.trim() === '') {
                pageDiagnostics.push(diagnostic('MISSING_PAGE_ID', `Page ${index + 1} requires a stable id.`, `pages[${index}].id`));
            }
            else if (ids.has(page.id)) {
                pageDiagnostics.push(diagnostic('DUPLICATE_PAGE_ID', `Page id "${page.id}" is used more than once.`, `pages[${index}].id`));
            }
            else {
                ids.add(page.id);
            }
            if (!isPageType(page.type)) {
                pageDiagnostics.push(diagnostic('UNKNOWN_PAGE_TYPE', `Page type must be prototype, canvas, or site.`, `pages[${index}].type`));
            }
            if (typeof page.title !== 'string' || page.title.trim() === '') {
                pageDiagnostics.push(diagnostic('MISSING_PAGE_TITLE', `Page "${page.id || index + 1}" requires a title.`, `pages[${index}].title`));
            }
            if (page.type === 'site') {
                if (typeof page.siteId !== 'string' || !page.siteId.trim() || page.path !== undefined) {
                    pageDiagnostics.push(diagnostic('INVALID_SITE_REFERENCE', `Site page "${page.id || index + 1}" requires a siteId and cannot have a payload path.`, `pages[${index}]`));
                }
            }
            else if (!relativePath || !pagePathIsValid(page.type, relativePath)) {
                const prototypeCanvas = page.type === 'canvas' && relativePath?.startsWith(`${NOTEBOOK_DIRECTORIES.prototypes}/`);
                pageDiagnostics.push(diagnostic(prototypeCanvas ? 'UNSUPPORTED_CANVAS_LOCATION' : 'INVALID_PAGE_PATH', prototypeCanvas
                    ? 'Canvas pages cannot be registered inside a Prototype; the deprecated workspace can still read this legacy path.'
                    : `Page path must stay under canvas/ or prototypes/ and match its page type.`, `pages[${index}].path`));
            }
        }
        const isSite = page.type === 'site';
        const siteDescriptor = isSite && typeof page.siteId === 'string' ? new SiteStore(root).get(page.siteId) : null;
        if (isSite && !siteDescriptor) {
            pageDiagnostics.push(diagnostic('MISSING_SITE_DESCRIPTOR', `Site "${page.siteId}" is not registered in the local Site store.`, typeof page.siteId === 'string' ? page.siteId : null));
        }
        const payload = relativePath && !isSite
            ? payloadState(root, relativePath, page.type)
            : { available: false, unsafe: false };
        const payloadTitle = page.type === 'canvas' && payload.available && relativePath
            ? readCanvasTitle(path.join(root, relativePath), { fallbackName: false })
            : '';
        if (payload.unsafe) {
            pageDiagnostics.push(diagnostic('UNSAFE_PAGE_PATH', `Page payload resolves outside the Notebook: ${relativePath}.`, relativePath));
        }
        const available = isSite ? Boolean(siteDescriptor) : payload.available;
        if (relativePath && !isSite && !available) {
            pageDiagnostics.push(diagnostic('MISSING_PAGE_PAYLOAD', `Page payload is missing: ${relativePath}.`, relativePath));
        }
        diagnostics.push(...pageDiagnostics);
        pages.push({
            ...(pageRecord ?? {}),
            ...(payloadTitle ? { title: payloadTitle } : {}),
            index,
            path: relativePath || (typeof pagePath === 'string' ? pagePath : null),
            route: pageRoute(page || {}),
            ...(siteDescriptor ? {
                title: typeof page?.title === 'string' && page.title.trim() ? page.title : siteDescriptor.title,
                productionUrl: record(siteDescriptor.deployments)[String(siteDescriptor.defaultDeployment)] && typeof record(record(siteDescriptor.deployments)[String(siteDescriptor.defaultDeployment)]).baseUrl === 'string'
                    ? String(record(record(siteDescriptor.deployments)[String(siteDescriptor.defaultDeployment)]).baseUrl)
                    : null,
            } : {}),
            available: available && pageDiagnostics.length === 0,
            diagnostics: pageDiagnostics,
        });
    }
    const routes = new Map();
    for (const page of pages) {
        if (!page.route)
            continue;
        const routePages = routes.get(page.route);
        if (routePages)
            routePages.push(page);
        else
            routes.set(page.route, [page]);
    }
    for (const [route, matches] of routes) {
        if (matches.length < 2)
            continue;
        for (const page of matches) {
            const item = diagnostic('PAGE_ROUTE_CONFLICT', `Page route "${route}" is shared by multiple registered pages; explicitly resolve the conflict.`, typeof page.path === 'string' ? page.path : typeof page.siteId === 'string' ? page.siteId : null);
            page.diagnostics.push(item);
            diagnostics.push(item);
            page.available = false;
        }
    }
    return { pages, diagnostics };
}
function enforceArtifactPageRules(pages, artifacts, diagnostics) {
    for (const page of pages) {
        const artifact = artifacts.find(item => item.kind === page.type && (item.id === page.id || page.path === item.folderPath || page.path === item.payloadPath));
        const nested = diagnostics.find(item => item.code === 'NESTED_ARTIFACT'
            && item.nestedArtifact
            && typeof page.path === 'string'
            && (page.path === item.nestedArtifact.path || page.path.startsWith(`${item.nestedArtifact.path}/`)));
        const artifactIssues = artifact?.diagnostics.filter(item => [
            'INVALID_ARTIFACT_IDENTITY', 'MALFORMED_ARTIFACT_PAYLOAD', 'AMBIGUOUS_CANVAS_PAYLOAD', 'DUPLICATE_ARTIFACT_ID', 'ARTIFACT_ROUTE_CONFLICT', 'UNREPRESENTABLE_ARTIFACT_ROUTE', 'INVALID_EXTERNAL_PROTOTYPE_URL',
        ].includes(item.code)) || [];
        if (nested) {
            page.route = null;
            page.available = false;
            page.diagnostics.push(nested);
        }
        if (artifact && !artifact.available) {
            page.available = false;
            page.route = null;
            page.diagnostics.push(...artifactIssues);
        }
    }
}
function prototypeOwner(relativePath) {
    const segments = String(relativePath || '').replaceAll('\\', '/').split('/').filter(Boolean);
    if (segments[0] === NOTEBOOK_DIRECTORIES.prototypes)
        segments.shift();
    return segments.find(segment => segment !== 'drafts' && !segment.endsWith('.folder') && !segment.startsWith('_')) || null;
}
function prototypeDataScopeConflicts(root, pages) {
    const prototypeRoot = path.join(root, NOTEBOOK_DIRECTORIES.prototypes);
    const files = listFilesRecursively(prototypeRoot, name => /\.(flow|scene|object|record)\.jsonc?$/.test(name));
    const declarations = new Map();
    for (const absolute of files) {
        const relative = path.relative(root, absolute).replaceAll('\\', '/');
        const match = path.basename(absolute).match(/^(.+)\.(flow|scene|object|record)\.jsonc?$/);
        const owner = prototypeOwner(relative);
        if (!match || !owner)
            continue;
        const suffix = match[2] === 'scene' ? 'flow' : match[2];
        const key = `${owner}/${match[1]}.${suffix}`;
        const declarationPaths = declarations.get(key);
        if (declarationPaths)
            declarationPaths.push(relative);
        else
            declarations.set(key, [relative]);
    }
    const diagnostics = [];
    const affectedOwners = new Map();
    for (const [key, paths] of declarations) {
        if (paths.length < 2)
            continue;
        const owner = key.slice(0, key.indexOf('/'));
        const ownerConflicts = affectedOwners.get(owner);
        if (ownerConflicts)
            ownerConflicts.push({ key, paths });
        else
            affectedOwners.set(owner, [{ key, paths }]);
    }
    for (const page of pages) {
        if (page.type !== 'prototype')
            continue;
        const owner = prototypeOwner(page.path);
        const conflicts = owner ? affectedOwners.get(owner) || [] : [];
        for (const conflict of conflicts) {
            const item = diagnostic('PROTOTYPE_DATA_SCOPE_CONFLICT', `Prototype data key "${conflict.key}" is declared in multiple payload files; resolve the conflict before using this Prototype.`, page.path);
            page.diagnostics.push(item);
            page.available = false;
            diagnostics.push(item);
        }
    }
    return diagnostics;
}
function customDraftIgnoreDiagnostics(root) {
    const file = path.join(root, '.gitignore');
    if (!isFile(file))
        return [];
    const recognized = new Set([
        'assets/canvas/images/drafts/',
        'src/canvas/**/drafts/',
        'src/prototypes/**/drafts/',
    ]);
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    return lines.flatMap((line, index) => {
        const rule = line.trim();
        if (!rule || rule.startsWith('#') || rule.startsWith('!') || !rule.includes('drafts'))
            return [];
        if (recognized.has(rule))
            return [diagnostic('CUSTOM_DRAFT_EXCLUSION', `Recognized legacy rule "${rule}" excludes content under drafts/; the notebook scaffold will remove it.`, `.gitignore:${index + 1}`)];
        return [diagnostic('CUSTOM_DRAFT_EXCLUSION', `Custom .gitignore rule "${rule}" may exclude registered content under drafts/; remove or narrow the rule explicitly.`, `.gitignore:${index + 1}`)];
    });
}
function readManifest(root) {
    const manifestPath = resolveNotebookManifestPath(root);
    if (!isFile(manifestPath)) {
        return { manifest: null, diagnostics: [diagnostic('MISSING_MANIFEST', `Missing ${NOTEBOOK_MANIFEST_FILE}.`, NOTEBOOK_MANIFEST_FILE)] };
    }
    try {
        return { manifest: JSON.parse(fs.readFileSync(manifestPath, 'utf8')), diagnostics: [] };
    }
    catch (error) {
        return {
            manifest: null,
            diagnostics: [diagnostic('MALFORMED_MANIFEST', `Could not parse ${NOTEBOOK_MANIFEST_FILE}: ${errorMessage(error)}.`, NOTEBOOK_MANIFEST_FILE)],
        };
    }
}
function writeJsonAtomic(filePath, value) {
    const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
    try {
        fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
        fs.renameSync(temporaryPath, filePath);
    }
    finally {
        try {
            fs.rmSync(temporaryPath, { force: true });
        }
        catch { /* atomic rename already succeeded */ }
    }
}
function resolveConfigSource(root, filename) {
    return [
        resolveConfigFilePath(root, filename),
        path.join(root, 'packages', 'storyboard', filename),
        path.join(root, 'packages', 'hypercanvas', filename),
        path.join(root, 'node_modules', '@dfosco', 'hypercanvas', filename),
    ].find(isFile) || null;
}
function ensureNotebookLayout(paths, configRoot, { preserveMissingToolbarOverride = false } = {}) {
    // Artifact-shaped Notebooks carry prototypes, canvases, components and
    // sites as `name.kind` folders anywhere in the Notebook, so the legacy
    // grouping directories are never created again. Their write paths still
    // read; features that write create their own parents.
    fs.mkdirSync(paths.widgets, { recursive: true });
    fs.mkdirSync(paths.tools, { recursive: true });
    fs.mkdirSync(paths.data, { recursive: true });
    fs.mkdirSync(paths.assets, { recursive: true });
    assertRuntimeDirectoryContained(paths);
    fs.mkdirSync(paths.runtime, { recursive: true });
    assertRuntimeDirectoryContained(paths);
    const configWrites = [];
    // The canvas config is a legacy-layout surface (`canvas/<name>.canvas.jsonl`
    // grouping). Artifact-shaped Notebooks only receive it when a legacy
    // `canvas/` directory is present; otherwise readers fall back to defaults
    // and canvas settings write through the config-directory resolver.
    if (!isFile(paths.canvasConfig) && fs.existsSync(path.join(paths.root, NOTEBOOK_DIRECTORIES.canvases))) {
        configWrites.push({ destination: paths.canvasConfig, value: DEFAULT_CANVAS_CONFIG });
    }
    for (const filename of NOTEBOOK_CONFIG_FILES) {
        // A missing toolbar config means “inherit package defaults”. Reopening an
        // existing Notebook must not turn that deliberate absence into a local
        // override. New Notebooks still receive the starter config below.
        if (preserveMissingToolbarOverride && filename === 'toolbar.config.json')
            continue;
        const destination = resolveNotebookConfigWritePath(paths.root, filename);
        const source = resolveConfigSource(configRoot, filename);
        if (!isFile(destination) && source)
            configWrites.push({ destination, source });
        // The application config always exists in a scaffolded Notebook, even when
        // the application ships no template to copy.
        else if (!isFile(destination) && filename === 'hypercanvas.config.json')
            configWrites.push({ destination, value: {} });
    }
    for (const { destination } of configWrites)
        assertOrdinaryConfigParent(paths.root, destination, true);
    for (const { destination } of configWrites) {
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        assertOrdinaryConfigParent(paths.root, destination);
    }
    for (const { destination, source, value } of configWrites) {
        if (source)
            fs.copyFileSync(source, destination);
        else
            writeJsonAtomic(destination, value);
    }
}
function assertOrdinaryConfigParent(root, filePath, allowMissing = false) {
    const relativeParent = path.relative(root, path.dirname(filePath));
    if (relativeParent.startsWith('..') || path.isAbsolute(relativeParent)) {
        throw new Error('Notebook config directory is outside the Notebook root.');
    }
    let current = root;
    for (const segment of relativeParent.split(path.sep).filter(Boolean)) {
        current = path.join(current, segment);
        let stat;
        try {
            stat = fs.lstatSync(current);
        }
        catch (error) {
            if (allowMissing && isRecord(error) && error.code === 'ENOENT')
                return;
            throw error;
        }
        if (stat.isSymbolicLink() || !stat.isDirectory()
            || fs.realpathSync.native(current) !== current || !isInside(root, current)) {
            throw new Error('Notebook config directory must be an ordinary directory inside the Notebook root.');
        }
    }
}
function pageTitleFromPath(relativePath) {
    const name = path.posix.basename(relativePath.replace(/\.canvas\.jsonl$/, ''));
    return name.replace(/[-_]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()) || 'Untitled';
}
function walkContainedFiles(root, relativeRoot, visit) {
    const directory = path.join(root, relativeRoot);
    if (!isDirectory(directory))
        return;
    const pending = [relativeRoot];
    while (pending.length > 0) {
        const relativeDirectory = pending.pop();
        if (!relativeDirectory)
            continue;
        const absoluteDirectory = path.join(root, relativeDirectory);
        let realDirectory;
        try {
            realDirectory = fs.realpathSync.native(absoluteDirectory);
        }
        catch {
            continue;
        }
        if (!isInside(root, realDirectory))
            continue;
        let entries;
        try {
            entries = fs.readdirSync(absoluteDirectory, { withFileTypes: true });
        }
        catch {
            continue;
        }
        entries.sort((left, right) => right.name.localeCompare(left.name));
        for (const entry of entries) {
            const relativePath = path.posix.join(relativeDirectory.replaceAll(path.sep, '/'), entry.name);
            if (entry.isSymbolicLink())
                continue;
            if (entry.isDirectory() && !['.git', '.storyboard', '.hypercanvas', 'build', 'coverage', 'dist', 'node_modules'].includes(entry.name))
                pending.push(relativePath);
            else if (entry.isFile())
                visit(relativePath);
        }
    }
}
function discoverRecoverableNotebookPages(root) {
    const pages = [];
    walkContainedFiles(root, NOTEBOOK_DIRECTORIES.canvases, (relativePath) => {
        if (!relativePath.endsWith('.canvas.jsonl'))
            return;
        const normalized = relativePath.replaceAll(path.sep, '/');
        const stable = createHash('sha256').update(`canvas:${normalized}`).digest('hex').slice(0, 10);
        pages.push({ id: `recovered-canvas-${stable}`, type: 'canvas', title: pageTitleFromPath(normalized), path: normalized });
    });
    const prototypeDirectories = new Set();
    walkContainedFiles(root, NOTEBOOK_DIRECTORIES.prototypes, (relativePath) => {
        if (!/^index\.(jsx|js|tsx|ts|mdx)$/.test(path.posix.basename(relativePath)))
            return;
        const directory = path.posix.dirname(relativePath);
        if (directory === NOTEBOOK_DIRECTORIES.prototypes)
            return;
        prototypeDirectories.add(directory);
    });
    for (const relativePath of prototypeDirectories) {
        const stable = createHash('sha256').update(`prototype:${relativePath}`).digest('hex').slice(0, 10);
        pages.push({ id: `recovered-prototype-${stable}`, type: 'prototype', title: pageTitleFromPath(relativePath), path: relativePath });
    }
    return pages;
}
function recoverableManifestPages(root, value) {
    const discovered = discoverRecoverableNotebookPages(root);
    const pages = [];
    const ids = new Set();
    const paths = new Set();
    const valuePages = record(value).pages;
    if (Array.isArray(valuePages)) {
        for (const candidate of valuePages) {
            if (!isRecord(candidate))
                continue;
            const page = candidate;
            const relativePath = safeRelativePath(page.path);
            if (typeof page.id !== 'string' || !page.id.trim()
                || !isPageType(page.type)
                || typeof page.title !== 'string' || !page.title.trim()
                || !relativePath || !pagePathIsValid(page.type, relativePath)
                || ids.has(page.id) || paths.has(relativePath))
                continue;
            const { route: rawRoute, siteId: rawSiteId, ...pageFields } = page;
            void rawRoute;
            void rawSiteId;
            pages.push({ ...pageFields, id: page.id, type: page.type, title: page.title, path: relativePath,
                ...(typeof rawSiteId === 'string' ? { siteId: rawSiteId } : {}),
                ...(typeof rawRoute === 'string' ? { route: rawRoute } : rawRoute === null ? { route: null } : {}),
            });
            ids.add(page.id);
            paths.add(relativePath);
        }
    }
    for (const page of discovered) {
        if (typeof page.path !== 'string' || typeof page.id !== 'string' || !isPageType(page.type) || typeof page.title !== 'string' || paths.has(page.path))
            continue;
        let id = page.id;
        if (ids.has(id))
            id = `${id}-${pages.length + 1}`;
        const { route: rawRoute, siteId: rawSiteId, ...pageFields } = page;
        void rawRoute;
        void rawSiteId;
        pages.push({ ...pageFields, id, type: page.type, title: page.title, path: page.path,
            ...(typeof rawSiteId === 'string' ? { siteId: rawSiteId } : {}),
            ...(typeof rawRoute === 'string' ? { route: rawRoute } : rawRoute === null ? { route: null } : {}),
        });
        ids.add(id);
        paths.add(page.path);
    }
    return pages;
}
function backupDamagedManifest(paths) {
    const recoveryDirectory = path.join(paths.runtime, 'recovery');
    fs.mkdirSync(recoveryDirectory, { recursive: true });
    const realRecoveryDirectory = fs.realpathSync.native(recoveryDirectory);
    if (!isInside(paths.root, realRecoveryDirectory) || !isInside(paths.root, fs.realpathSync.native(paths.runtime))) {
        throw runtimePathError();
    }
    const timestamp = new Date().toISOString().replaceAll(':', '-');
    let backupPath = path.join(recoveryDirectory, `${timestamp}-${NOTEBOOK_MANIFEST_FILE}.bak`);
    let suffix = 1;
    while (fs.existsSync(backupPath)) {
        backupPath = path.join(recoveryDirectory, `${timestamp}-${suffix}-${NOTEBOOK_MANIFEST_FILE}.bak`);
        suffix += 1;
    }
    fs.copyFileSync(paths.manifest, backupPath, fs.constants.COPYFILE_EXCL);
}
function repairExistingManifest(paths, { id, title, configRoot }) {
    const { manifest: current } = readManifest(paths.root);
    ensureNotebookLayout(paths, configRoot, { preserveMissingToolbarOverride: true });
    backupDamagedManifest(paths);
    const pages = recoverableManifestPages(paths.root, current);
    const repaired = {
        ...record(current),
        ...notebookManifest({
            id: typeof record(current).id === 'string' && String(record(current).id).trim() ? String(record(current).id) : id || makeId(),
            title: typeof record(current).title === 'string' && String(record(current).title).trim() ? String(record(current).title) : title || path.basename(paths.root),
            pages,
        }),
    };
    writeJsonAtomic(paths.manifest, repaired);
    return inspectNotebook(paths.root);
}
function assertRuntimeDirectoryContained(paths) {
    try {
        const realPath = fs.realpathSync.native(paths.runtime);
        if (!isInside(paths.root, realPath) || !fs.statSync(realPath).isDirectory())
            throw runtimePathError();
    }
    catch (error) {
        if (errorCode(error) === 'ENOENT')
            return;
        if (errorCode(error) === 'UNSAFE_NOTEBOOK_PATH')
            throw error;
        throw runtimePathError();
    }
}
export function notebookManifest({ id = makeId(), title = 'Notebook', pages = [] } = {}) {
    return {
        formatVersion: NOTEBOOK_FORMAT_VERSION,
        id,
        title,
        pages,
        navigation: createDefaultNavigation(pages),
    };
}
export function notebookPaths(root, { notebook } = {}) {
    const notebookRoot = canonicalRoot(root);
    // Keep the runtime directory on the legacy name when it already exists so
    // long-lived Notebooks stay consistent; fresh Notebooks create `.hypercanvas`.
    const runtimeDir = resolveRuntimeDir(notebookRoot);
    return {
        root: notebookRoot,
        manifest: resolveNotebookManifestPath(notebookRoot),
        canvasConfig: resolveNotebookConfigWritePath(notebookRoot, NOTEBOOK_CANVAS_CONFIG_FILE),
        configFiles: [...NOTEBOOK_CONFIG_FILE_NAMES, NOTEBOOK_CANVAS_CONFIG_FILE].flatMap(filename => [
            path.join(notebookRoot, filename),
            path.join(notebookRoot, 'config', filename),
            path.join(notebookRoot, NOTEBOOK_MANIFEST_DIR, filename),
        ]),
        runtime: runtimeDir,
        siteConfig: path.join(notebookRoot, siteConfigRelativePath(notebookRoot)),
        canvases: path.join(notebookRoot, NOTEBOOK_DIRECTORIES.canvases),
        prototypes: path.join(notebookRoot, NOTEBOOK_DIRECTORIES.prototypes),
        widgets: resolveNotebookSupportPath(notebookRoot, NOTEBOOK_DIRECTORIES.widgets, { fresh: !hasNotebookManifest(notebookRoot) }),
        tools: resolveNotebookSupportPath(notebookRoot, NOTEBOOK_DIRECTORIES.tools, { fresh: !hasNotebookManifest(notebookRoot) }),
        components: path.join(notebookRoot, NOTEBOOK_DIRECTORIES.components),
        data: resolveNotebookContentDirectory(notebookRoot, 'data', { notebook: notebook ?? hasNotebookManifest(notebookRoot) }),
        assets: resolveNotebookContentDirectory(notebookRoot, 'assets', { notebook: notebook ?? hasNotebookManifest(notebookRoot) }),
        publish: path.join(notebookRoot, NOTEBOOK_DIRECTORIES.publish),
    };
}
/**
 * Inspect without modifying the selected folder.
 * Missing payloads keep the Notebook recognizable but mark individual pages
 * unavailable, allowing the rest of the Notebook to remain usable.
 */
export function inspectNotebook(root) {
    const paths = notebookPaths(root);
    if (!isDirectory(paths.root)) {
        return {
            status: 'unavailable',
            root: paths.root,
            manifest: null,
            pages: [],
            artifacts: [],
            diagnostics: [diagnostic('ROOT_NOT_FOUND', `Notebook folder does not exist: ${paths.root}.`)],
        };
    }
    // Reads only. Portable artifacts never create, repair, or migrate files on disk.
    const portable = readPortableCatalog(paths.root);
    const { manifest: sourceManifest, diagnostics: readDiagnostics } = readManifest(paths.root);
    // A folder with no manifest file but with recognized content is valid in memory only: portable
    // first-look artifacts, or legacy artifact markers/payloads and loose legacy pages. Nothing is written.
    // A malformed or unreadable manifest is never replaced by an in-memory one.
    const manifestAbsent = readDiagnostics.some(item => item.code === 'MISSING_MANIFEST');
    const inMemoryManifest = manifestAbsent && (portable.artifacts.length > 0
        || discoverNotebookArtifacts(paths.root, [], portable.claimedLocators).artifacts.length > 0
        || discoverNotebookPages(paths.root, []).length > 0);
    const manifestDiagnostics = inMemoryManifest ? [] : readDiagnostics;
    const sourceRecord = record(sourceManifest);
    const needsMigration = sourceRecord.formatVersion === 1;
    const migratedManifest = inMemoryManifest
        ? notebookManifest({ id: portableNotebookId(paths.root), title: path.basename(paths.root), pages: [] })
        : migrateManifestV1(paths.root, sourceManifest);
    const migratedRecord = isRecord(migratedManifest) ? migratedManifest : null;
    const superseded = supersededRegistrations(portable.artifacts, (Array.isArray(migratedRecord?.pages) ? migratedRecord.pages : []).filter(isRecord).map(record));
    const registeredValues = (Array.isArray(migratedRecord?.pages) ? migratedRecord.pages : [])
        .filter(value => !isRecord(value) || superseded.pages.includes(record(value)));
    const registeredPages = registeredValues.filter(isRecord).map(record);
    const artifactCatalog = discoverNotebookArtifacts(paths.root, registeredPages, portable.claimedLocators);
    const reconciledRegisteredValues = registeredValues.map((value) => {
        const page = record(value);
        const artifact = artifactCatalog.artifacts.find(candidate => candidate.kind === page.type && (candidate.id === page.id
            || candidate.folderPath === String(page.path || '').replaceAll('\\', '/')
            || candidate.payloadPath === String(page.path || '').replaceAll('\\', '/')
            || (candidate.kind === 'site' && page.type === 'site' && candidate.route === `/sites/${encodeURIComponent(String(page.siteId || ''))}`)));
        if (!artifact)
            return value;
        if (artifact.kind === 'site')
            return page.route === artifact.route ? value : { ...page, route: artifact.route };
        const pagePath = artifact.kind === 'canvas' ? artifact.payloadPath : artifact.folderPath;
        if (!pagePath)
            return value;
        if (page.id === artifact.id && page.path === pagePath && page.title === artifact.title && page.route === artifact.route)
            return value;
        return { ...page, id: artifact.id, path: pagePath, title: artifact.title, route: artifact.route };
    });
    const reconciledRegisteredPages = reconciledRegisteredValues.filter(isRecord).map(record);
    const discoveredPages = migratedRecord?.formatVersion === NOTEBOOK_FORMAT_VERSION
        ? discoverNotebookPages(paths.root, reconciledRegisteredPages, portable.claimedLocators)
        : [];
    const needsPageRegistration = discoveredPages.length > 0 || reconciledRegisteredValues.some((value, index) => value !== registeredValues[index]);
    const legacyManifest = migratedRecord && migratedRecord.formatVersion === NOTEBOOK_FORMAT_VERSION
        ? {
            ...migratedRecord,
            pages: [...reconciledRegisteredValues, ...discoveredPages],
            navigation: appendDiscoveredPages(migratedRecord.navigation, reconciledRegisteredPages, discoveredPages),
        }
        : migratedManifest;
    const shapeDiagnostics = validateManifestShape(legacyManifest);
    const { pages: legacyPages, diagnostics: pageDiagnostics } = validatePages(paths.root, legacyManifest);
    enforceArtifactPageRules(legacyPages, artifactCatalog.artifacts, artifactCatalog.diagnostics);
    // Portable identity conflicts are attached to the artifacts they block.
    const conflictDiagnostics = [
        ...superseded.diagnostics,
        ...reportMarkerConflicts(paths.root, portable.artifacts),
        ...reportCrossCatalogConflicts([...portable.artifacts, ...artifactCatalog.artifacts]),
    ];
    const portableEntries = portablePageRecords(portable.artifacts);
    const portableManifestPages = portableEntries.map(entry => entry.record);
    const portableNotebookPages = portableEntries.map(({ record: pageRecord, artifact }, offset) => ({
        ...pageRecord,
        index: legacyPages.length + offset,
        route: artifact.route,
        available: artifact.available,
        diagnostics: artifact.diagnostics,
    }));
    const pages = [...legacyPages, ...portableNotebookPages];
    const reconciledRecord = record(legacyManifest);
    const navigationWithPortable = portableManifestPages.length && reconciledRecord.formatVersion === NOTEBOOK_FORMAT_VERSION
        ? appendDiscoveredPages(reconciledRecord.navigation, legacyPages.map(record), portableManifestPages)
        : reconciledRecord.navigation;
    const normalizedNavigation = normalizeNavigation(navigationWithPortable, navigationPages(pages));
    const needsNavigationRepair = migratedRecord?.formatVersion === 2
        && (!migratedRecord.navigation || !normalizedNavigation.valid);
    const manifest = reconciledRecord.formatVersion === NOTEBOOK_FORMAT_VERSION
        ? { ...reconciledRecord, pages: [...(Array.isArray(reconciledRecord.pages) ? reconciledRecord.pages : []), ...portableManifestPages], navigation: normalizedNavigation.navigation }
        : legacyManifest;
    const navigationDiagnostics = normalizedNavigation.diagnostic ? [normalizedNavigation.diagnostic] : [];
    const sites = listSiteFiles(paths.root);
    const dataScopeDiagnostics = prototypeDataScopeConflicts(paths.root, legacyPages);
    const gitignoreDiagnostics = customDraftIgnoreDiagnostics(paths.root);
    const artifacts = [...artifactCatalog.artifacts, ...portable.artifacts]
        .sort((left, right) => left.folderPath.localeCompare(right.folderPath, 'en'));
    const diagnostics = [...new Set([
            ...manifestDiagnostics,
            ...shapeDiagnostics,
            ...artifactCatalog.diagnostics,
            ...portable.diagnostics,
            ...conflictDiagnostics,
            ...pageDiagnostics,
            ...dataScopeDiagnostics,
            ...navigationDiagnostics,
            ...gitignoreDiagnostics,
        ])];
    const hasMissingPayload = diagnostics.some(({ code }) => code === 'MISSING_PAGE_PAYLOAD' || code === 'MISSING_SITE_DESCRIPTOR');
    // First-look diagnostics block only their artifacts, never the whole Notebook.
    const hasStructuralError = diagnostics.some(item => !RECOVERABLE_PAGE_DIAGNOSTICS.has(item.code)
        && item.code !== 'INVALID_NAVIGATION' && item.source !== FIRST_LOOK_DIAGNOSTIC_SOURCE);
    if (hasStructuralError || !isNotebookManifest(manifest)) {
        return { status: 'invalid', root: paths.root, manifest: isRecord(manifest) ? manifest : null, pages, artifacts, diagnostics, sites,
            hasMissingPayload, needsMigration, needsPageRegistration, needsNavigationRepair };
    }
    return { status: 'valid', root: paths.root, manifest: { ...manifest, navigation: normalizedNavigation.navigation }, pages, artifacts, sites,
        diagnostics, hasMissingPayload, needsMigration, needsPageRegistration, needsNavigationRepair };
}
// Portable pages are in-memory catalog entries. Only legacy pages and their navigation are stored.
function storedManifestValue(manifest) {
    if (!isRecord(manifest) || !Array.isArray(manifest.pages))
        return manifest;
    const pages = manifest.pages.filter(page => !(isRecord(page) && page.portable === true));
    if (pages.length === manifest.pages.length)
        return manifest;
    const navigation = manifest.navigation === undefined
        ? undefined
        : normalizeNavigation(manifest.navigation, navigationPages(pages.filter(isRecord).map(record))).navigation;
    return { ...manifest, pages, ...(navigation ? { navigation } : {}) };
}
function backupAndWriteNormalizedManifest(paths, snapshot) {
    const backupDirectory = path.join(paths.runtime, 'migrations');
    fs.mkdirSync(backupDirectory, { recursive: true });
    const backupName = snapshot.needsMigration
        ? 'hypercanvas.notebook.v1.json'
        : 'hypercanvas.notebook.v2.before-reconciliation.json';
    const backupPath = path.join(backupDirectory, backupName);
    if (!isFile(backupPath))
        fs.copyFileSync(paths.manifest, backupPath);
    writeJsonAtomic(paths.manifest, storedManifestValue(snapshot.manifest));
}
function clone(value) {
    return structuredClone(value);
}
/** Persist the reconciled v2 registry and navigation for one Notebook. */
export function writeNotebookManifest(root, manifest) {
    const paths = notebookPaths(root);
    if (!isFile(paths.manifest) || !isNotebookManifest(manifest)) {
        const error = Object.assign(new Error('A valid manifest-v2 Notebook is required for page mutations.'), { code: 'INVALID_NOTEBOOK' });
        throw error;
    }
    writeJsonAtomic(paths.manifest, storedManifestValue(manifest));
    const snapshot = inspectNotebook(paths.root);
    if (snapshot.status === 'valid')
        persistArtifactIdentityMarkers(paths.root, snapshot.artifacts, snapshot.manifest.pages);
    return inspectNotebook(paths.root);
}
/** Register a created page and place it in the requested virtual section. */
export function registerNotebookPage(root, input, { sectionId = null, sectionTitle = null, insertAfterPageId = null } = {}) {
    const snapshot = inspectNotebook(root);
    if (snapshot.status !== 'valid' || !snapshot.manifest || !isFile(notebookPaths(root).manifest))
        return null;
    const inputRecord = record(input);
    const pathKey = typeof inputRecord.path === 'string' ? inputRecord.path.replaceAll('\\', '/') : null;
    if (pathKey && snapshot.diagnostics.some(item => item.code === 'NESTED_ARTIFACT'
        && (item.nestedArtifact?.path === pathKey || pathKey.startsWith(`${item.nestedArtifact?.path}/`))))
        return null;
    const match = snapshot.manifest.pages.find(page => (pathKey && page.path === pathKey)
        || (inputRecord.siteId && page.type === 'site' && page.siteId === inputRecord.siteId)
        || (inputRecord.id && page.id === inputRecord.id));
    let page = match;
    let manifest = snapshot.manifest;
    if (!page) {
        const type = inputRecord.type;
        if (!isPageType(type))
            return null;
        const idInput = typeof inputRecord.id === 'string' ? inputRecord.id : undefined;
        const idSource = pathKey || inputRecord.siteId || idInput || `${type}:${inputRecord.title || ''}`;
        const candidate = {
            ...inputRecord,
            id: idInput || deterministicId(type, idSource),
            ...(pathKey ? { path: pathKey } : {}),
        };
        if (!isValidManifestPage(candidate))
            return null;
        page = candidate;
        const pages = [...manifest.pages, page];
        const navigation = appendDiscoveredPages(manifest.navigation, manifest.pages, [page]);
        manifest = { ...manifest, pages, navigation };
    }
    const inputTitle = typeof inputRecord.title === 'string' ? inputRecord.title : '';
    if (inputTitle && page.title !== inputTitle) {
        const pages = manifest.pages.map(item => item.id === page?.id ? { ...item, title: inputTitle } : item);
        page = pages.find(item => item.id === page?.id);
        if (!page)
            return null;
        manifest = { ...manifest, pages };
    }
    if (sectionId || sectionTitle) {
        const currentPage = page;
        let section = sectionId
            ? manifest.navigation.files.sections.find(item => item.id === sectionId)
            : manifest.navigation.files.sections.find(item => item.title.toLocaleLowerCase() === String(sectionTitle).trim().toLocaleLowerCase());
        if (!section && sectionTitle) {
            manifest = {
                ...manifest,
                navigation: applyNavigationOperation(manifest.navigation, manifest.pages, {
                    type: 'createSection', title: String(sectionTitle).trim(), index: manifest.navigation.files.entries.length,
                }),
            };
            section = manifest.navigation.files.sections.at(-1);
        }
        if (section) {
            const pageIds = section.pageIds.filter(id => id !== currentPage.id);
            manifest = {
                ...manifest,
                navigation: applyNavigationOperation(manifest.navigation, manifest.pages, {
                    type: 'movePage', layout: 'filesSections', pageId: currentPage.id, sectionId: section.id, index: pageIds.length,
                }),
            };
        }
    }
    if (!sectionId && !sectionTitle && insertAfterPageId && insertAfterPageId !== page.id) {
        const target = manifest.pages.find(item => item.id === insertAfterPageId);
        if (target && manifest.navigation.mode === 'type' && target.type === page.type) {
            const order = manifest.navigation.type.order[page.type] ?? [];
            const index = order.indexOf(target.id);
            if (index >= 0)
                manifest = {
                    ...manifest,
                    navigation: applyNavigationOperation(manifest.navigation, manifest.pages, {
                        type: 'movePage', layout: 'type', pageId: page.id, index: index + 1,
                    }),
                };
        }
        else if (target && manifest.navigation.mode === 'files') {
            if (manifest.navigation.sectionsEnabled) {
                const targetSection = manifest.navigation.files.sections.find(section => section.pageIds.includes(target.id));
                const sectionIdToUse = targetSection?.id || null;
                if (targetSection) {
                    manifest = {
                        ...manifest,
                        navigation: applyNavigationOperation(manifest.navigation, manifest.pages, {
                            type: 'movePage', layout: 'filesSections', pageId: page.id, sectionId: sectionIdToUse,
                            index: targetSection.pageIds.indexOf(target.id) + 1,
                        }),
                    };
                }
                else {
                    const rootEntries = manifest.navigation.files.entries.filter(entry => entry.type === 'page');
                    const index = rootEntries.findIndex(entry => entry.pageId === target.id);
                    if (index >= 0)
                        manifest = {
                            ...manifest,
                            navigation: applyNavigationOperation(manifest.navigation, manifest.pages, {
                                type: 'movePage', layout: 'filesSections', pageId: page.id, index: index + 1,
                            }),
                        };
                }
            }
            else {
                const index = manifest.navigation.files.flatOrder.indexOf(target.id);
                if (index >= 0)
                    manifest = {
                        ...manifest,
                        navigation: applyNavigationOperation(manifest.navigation, manifest.pages, {
                            type: 'movePage', layout: 'filesFlat', pageId: page.id, index: index + 1,
                        }),
                    };
            }
        }
    }
    if (!snapshot.needsPageRegistration && manifest === snapshot.manifest && !inputTitle)
        return page;
    writeNotebookManifest(snapshot.root, manifest);
    return page;
}
/** Remove a primary page and all of its references from every saved layout. */
export function unregisterNotebookPage(root, selector = {}) {
    const snapshot = inspectNotebook(root);
    if (snapshot.status !== 'valid' || !snapshot.manifest || !isFile(notebookPaths(root).manifest))
        return false;
    const page = snapshot.manifest.pages.find(item => (selector?.id && item.id === selector.id)
        || (selector?.path && item.path === String(selector.path).replaceAll('\\', '/'))
        || (selector?.siteId && item.type === 'site' && item.siteId === selector.siteId));
    if (!page)
        return false;
    const pages = snapshot.manifest.pages.filter(item => item.id !== page.id);
    const navigation = clone(snapshot.manifest.navigation);
    navigation.type.order[page.type] = (navigation.type.order[page.type] ?? []).filter(id => id !== page.id);
    navigation.files.flatOrder = navigation.files.flatOrder.filter(id => id !== page.id);
    navigation.files.entries = navigation.files.entries.filter(entry => !(entry.type === 'page' && entry.pageId === page.id));
    for (const section of navigation.files.sections)
        section.pageIds = section.pageIds.filter(id => id !== page.id);
    writeNotebookManifest(snapshot.root, { ...snapshot.manifest, pages, navigation });
    return true;
}
/** Explicit local repair. Never infer ownership from titles or prune other missing pages. */
export function forgetMissingNotebookCanvas(root, { pageId, expectedRevision }) {
    const paths = notebookPaths(root);
    const revision = createHash('sha256').update(fs.readFileSync(paths.manifest)).digest('hex');
    if (revision !== expectedRevision)
        throw new Error('Notebook manifest changed; inspect it again before removing a registration.');
    const snapshot = inspectNotebook(root);
    if (snapshot.status !== 'valid')
        throw new Error('A valid Notebook is required.');
    const page = snapshot.pages.find(item => item.id === pageId);
    if (!page || page.type !== 'canvas' || typeof page.path !== 'string'
        || page.available || page.diagnostics.some(item => item.code !== 'MISSING_PAGE_PAYLOAD')
        || !page.diagnostics.some(item => item.code === 'MISSING_PAGE_PAYLOAD')) {
        throw new Error('Only an explicitly selected canvas with a missing payload can be forgotten.');
    }
    for (const relative of [page.path, page.path.replace(/\.canvas\.jsonl$/, '.canvas.jsx')]) {
        try {
            fs.lstatSync(path.join(paths.root, relative));
        }
        catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
                continue;
            throw error;
        }
        throw new Error('Canvas payload or companion exists; preserve and inspect its content before removal.');
    }
    if (!unregisterNotebookPage(root, { id: pageId }))
        throw new Error('Canvas registration was not removed.');
    return { success: true, removed: pageId, path: page.path,
        revision: createHash('sha256').update(fs.readFileSync(paths.manifest)).digest('hex') };
}
/** Update display metadata without changing stable identity or layout order. */
export function updateNotebookPage(root, selector = {}, updates = {}) {
    const snapshot = inspectNotebook(root);
    if (snapshot.status !== 'valid' || !snapshot.manifest || !isFile(notebookPaths(root).manifest))
        return null;
    const page = snapshot.manifest.pages.find(item => (selector?.id && item.id === selector.id)
        || (selector?.path && item.path === String(selector.path).replaceAll('\\', '/'))
        || (selector?.siteId && item.type === 'site' && item.siteId === selector.siteId));
    if (!page)
        return null;
    const safeUpdates = record(updates);
    const pages = snapshot.manifest.pages.map(item => item.id === page.id ? { ...item, ...safeUpdates, id: item.id, type: item.type } : item);
    writeNotebookManifest(snapshot.root, { ...snapshot.manifest, pages });
    return pages.find(item => item.id === page.id) || null;
}
/**
 * Create the portable Notebook skeleton and ignored runtime directory.
 * Existing valid Notebooks are returned unchanged. Any selected directory can
 * be adopted as a Notebook: initialization adds missing layout and identity.
 * Damaged manifests are backed up under .storyboard/recovery/ before repair.
 */
export function initializeNotebook(root, { id, title, configRoot = process.cwd() } = {}) {
    const requestedRoot = path.resolve(String(root || '.'));
    fs.mkdirSync(requestedRoot, { recursive: true });
    // Scaffolding (fresh or repair) opts into the backstage content layout;
    // existing root assets/data folders still keep the root location.
    const paths = notebookPaths(requestedRoot, { notebook: true });
    if (isFile(paths.manifest)) {
        const current = inspectNotebook(paths.root);
        if (current.status === 'valid') {
            ensureNotebookLayout(paths, configRoot, { preserveMissingToolbarOverride: true });
            if (current.needsMigration || current.needsPageRegistration || current.needsNavigationRepair)
                backupAndWriteNormalizedManifest(paths, current);
            persistArtifactIdentityMarkers(paths.root, current.artifacts, current.manifest.pages);
            return inspectNotebook(paths.root);
        }
        return repairExistingManifest(paths, { ...(id !== undefined ? { id } : {}), ...(title !== undefined ? { title } : {}), configRoot });
    }
    ensureNotebookLayout(paths, configRoot);
    const discoveredPages = discoverNotebookPages(paths.root, []).filter(isValidManifestPage);
    fs.mkdirSync(path.dirname(paths.manifest), { recursive: true });
    writeJsonAtomic(paths.manifest, notebookManifest({ ...(id !== undefined ? { id } : {}), title: title || 'Notebook', pages: discoveredPages }));
    const created = inspectNotebook(paths.root);
    if (created.status === 'valid')
        persistArtifactIdentityMarkers(paths.root, created.artifacts, created.manifest.pages);
    return inspectNotebook(paths.root);
}
export function openNotebook(root, { watch = false, onChange } = {}) {
    let snapshot = inspectNotebook(root);
    let closed = false;
    let timer = null;
    const listeners = new Set();
    if (typeof onChange === 'function')
        listeners.add(onChange);
    const refresh = () => {
        if (closed)
            return snapshot;
        const next = inspectNotebook(root);
        // Keep the last usable page snapshot visible while an editor's atomic
        // save briefly leaves the manifest malformed. Diagnostics still expose
        // the invalid on-disk state and the next valid refresh replaces it.
        const visible = next.status === 'invalid' && snapshot.status === 'valid'
            ? { ...next, manifest: snapshot.manifest, pages: snapshot.pages }
            : next;
        const changed = JSON.stringify(visible) !== JSON.stringify(snapshot);
        snapshot = visible;
        if (changed) {
            for (const listener of listeners)
                listener(snapshot);
        }
        return snapshot;
    };
    let watcher = null;
    if (watch && isDirectory(snapshot.root)) {
        try {
            watcher = fs.watch(snapshot.root, { recursive: true }, () => {
                if (timer)
                    clearTimeout(timer);
                timer = setTimeout(() => { timer = null; refresh(); }, 25);
            });
            watcher.on('error', () => refresh());
        }
        catch {
            watcher = null;
        }
    }
    return {
        get snapshot() { return snapshot; },
        refresh,
        subscribe(listener) {
            if (typeof listener !== 'function')
                return () => { };
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        close() {
            closed = true;
            if (timer)
                clearTimeout(timer);
            watcher?.close();
            listeners.clear();
        },
    };
}
export const __test = { safeRelativePath, validateManifestShape, validatePages, payloadState };
function listSiteFiles(root) {
    const sites = new SiteStore(root).listEntries();
    const configRel = siteConfigRelativePath(root);
    const hasUnifiedConfig = isFile(path.join(root, configRel));
    return sites.map(({ site, folderPath }) => ({
        id: site.id,
        path: folderPath
            ? siteDescriptorRelativePath(folderPath)
            : hasUnifiedConfig || !isFile(path.join(root, LEGACY_SITE_DIRECTORY, `${site.id}.site.json`))
                ? configRel
                : `${LEGACY_SITE_DIRECTORY}/${site.id}.site.json`,
    }));
}
