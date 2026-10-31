/**
 * Portable publication project generator.
 *
 * Materializes a Notebook as ONE self-contained site project: exact pinned
 * dependencies, an embedded deterministic lockfile, embedded canvas states,
 * copied Notebook sources and assets, the regular Storyboard application,
 * and an identity marker. The project builds with `npm ci`, `npm run build`,
 * and `npm run preview` anywhere it is copied — no Notebook, no Hypercanvas
 * checkout. See DOCS/publishing.md for the contract.
 *
 * Generation is deterministic: repeated generation from the same Notebook is
 * byte-stable (no timestamps, no machine paths). Regeneration updates managed
 * scopes in place and never deletes `.git`, the Pages workflow, `node_modules/`,
 * committed `dist/`, or unrelated user files.
 */
import fs from 'node:fs';
import path from 'node:path';
import { builtinModules, createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ignore from 'ignore';
import { inspectNotebook, LEGACY_NOTEBOOK_CONFIG_FILE, LEGACY_NOTEBOOK_PUBLISH_DIR, NOTEBOOK_CONFIG_FILE_NAMES, NOTEBOOK_CONFIG_FILES, NOTEBOOK_CANVAS_CONFIG_FILE, NOTEBOOK_MANIFEST_FILE, NOTEBOOK_PUBLISH_DIR, NOTEBOOK_DIRECTORIES, resolveNotebookManifestPath } from '../notebook.js';
import { NOTEBOOK_BACKSTAGE_DIR, NOTEBOOK_CONTENT_DIRECTORY_NAMES, physicalNotebookRelativePath } from '../layout.js';
import { APP_CONFIG_PRIMARY, LEGACY_CANVAS_CONFIG_FILE, readAppConfig } from '../../configFile.js';
import { SiteStore } from '../../site/site.js';
import { materializeFromText } from '../../canvas/materializer.js';
import { preparePublishedFrames, preparePublishedSitePages, validatePublishedSnapshots } from '../frame-snapshot-publishing.js';
import { buildNotebookNavigationTree } from '../navigation-tree.js';
import { isNotebookSiblingRef } from '../sibling-order.js';
import { publishingError } from './errors.js';
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
function arrayOfStrings(value) {
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}
function errorCode(error) {
    return isRecord(error) ? error.code : undefined;
}
function errorMessage(error) {
    return isRecord(error) ? error.message : undefined;
}
function validatedNotebook(value) {
    if (!isRecord(value) || typeof value.status !== 'string' || typeof value.root !== 'string' || !isRecord(value.manifest)) {
        throw publishingError('INVALID_NOTEBOOK', 'Notebook must be valid before it can be published.');
    }
    const manifest = value.manifest;
    if (typeof manifest.id !== 'string' || typeof manifest.title !== 'string' || !Array.isArray(value.pages)) {
        throw publishingError('INVALID_NOTEBOOK', 'Notebook must be valid before it can be published.');
    }
    const pages = [];
    for (const candidate of value.pages) {
        if (!isRecord(candidate) || typeof candidate.id !== 'string' || typeof candidate.type !== 'string' || typeof candidate.index !== 'number' || (typeof candidate.path !== 'string' && candidate.path !== null) || typeof candidate.title !== 'string') {
            throw publishingError('INVALID_NOTEBOOK', 'Notebook must be valid before it can be published.');
        }
        pages.push({
            id: candidate.id,
            type: candidate.type,
            index: candidate.index,
            path: candidate.path,
            title: candidate.title,
            ...(typeof candidate.route === 'string' || candidate.route === null ? { route: candidate.route } : {}),
            ...(typeof candidate.available === 'boolean' ? { available: candidate.available } : {}),
            ...(candidate.diagnostics === undefined ? {} : { diagnostics: candidate.diagnostics }),
            ...(typeof candidate.siteId === 'string' ? { siteId: candidate.siteId } : {}),
        });
    }
    return {
        status: value.status,
        root: value.root,
        manifest: { id: manifest.id, title: manifest.title, navigation: manifest.navigation, ...(Array.isArray(manifest.pages) ? { pages } : {}) },
        pages,
        ...(Array.isArray(value.artifacts) ? { artifacts: value.artifacts } : {}),
        ...(Array.isArray(value.sites) ? {
            sites: value.sites.filter((site) => isRecord(site)
                && typeof site.id === 'string' && typeof site.path === 'string'),
        } : {}),
        ...(value.diagnostics === undefined ? {} : { diagnostics: value.diagnostics }),
    };
}
const require = createRequire(import.meta.url);
const BUILTIN_MODULES = new Set(builtinModules.map((name) => name.replace(/^node:/, '')));
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../');
const SCAFFOLD_ROOT = path.join(PACKAGE_ROOT, 'scaffold');
const packageMetadata = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'));
const HYPERCANVAS_PACKAGE = record(packageMetadata);
const NOTEBOOK_CONTENT_DIRECTORY = 'notebook-content';
const SCAFFOLD_DEPENDENCY_NAMES = [
    '@base-ui/react',
    '@dfosco/hypercanvas',
    '@generouted/react-router',
    '@github/browserslist-config',
    '@tailwindcss/vite',
    '@vitejs/plugin-react',
    'glob',
    'postcss-preset-env',
    'react',
    'react-dom',
    'react-is',
    'react-router-dom',
    'tailwindcss',
    'vite',
];
const BASE_DEPENDENCY_NAMES = [...new Set([
        ...Object.keys(record(HYPERCANVAS_PACKAGE.dependencies)),
        ...Object.entries(record(HYPERCANVAS_PACKAGE.peerDependencies))
            .filter(([name]) => record(record(HYPERCANVAS_PACKAGE.peerDependenciesMeta)[name]).optional !== true)
            .map(([name]) => name),
        ...SCAFFOLD_DEPENDENCY_NAMES,
    ])].sort();
const BASE_DEPENDENCIES = Object.fromEntries(BASE_DEPENDENCY_NAMES.map((name) => [name, null]));
const EXCLUDED_DIRECTORY_NAMES = new Set(['.git', '.storyboard', '.hypercanvas', 'node_modules']);
const VENDORED_RUNTIME = 'vendor/hypercanvas';
const LEGACY_MIRROR_SCOPES = new Set([NOTEBOOK_DIRECTORIES.prototypes, NOTEBOOK_DIRECTORIES.assets]);
const PUBLISH_WORKFLOW_PATH = '.github/workflows/deploy-pages.yml';
const LEGACY_PRESENTATION_FILES = [
    'src/App.jsx',
    'src/main.jsx',
    'src/CanvasPage.jsx',
    'src/PrototypePage.jsx',
    'src/HomePage.jsx',
    'src/NotFoundPage.jsx',
    'src/styles.css',
];
export const PUBLICATION_MARKER_FILE = 'hypercanvas.publication.json';
export const PUBLICATION_FORMAT_VERSION = 1;
export const LOCKFILE_SCAFFOLD = '../../../../scaffold/publish/package-lock.json';
/** Managed regeneration scopes — stale files inside these are removed. */
const MANAGED_SCOPES = ['src/generated', VENDORED_RUNTIME, NOTEBOOK_DIRECTORIES.prototypes, NOTEBOOK_DIRECTORIES.assets];
export function pageSlug(page) {
    return page.id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `page-${page.index + 1}`;
}
function generatorVersion() {
    try {
        return require('../../../../package.json').version;
    }
    catch {
        return '0';
    }
}
export function publicationMarker(notebook, sourceFiles = [], generatedNotebookFiles = []) {
    return {
        formatVersion: PUBLICATION_FORMAT_VERSION,
        kind: 'hypercanvas-publication',
        notebook: { id: notebook.manifest.id, title: notebook.manifest.title },
        generator: { name: '@dfosco/hypercanvas', version: generatorVersion() },
        sourceFiles: [...sourceFiles].sort(),
        generatedNotebookFiles: [...generatedNotebookFiles].sort(),
    };
}
export function readMarker(projectDir) {
    try {
        const parsed = JSON.parse(fs.readFileSync(path.join(projectDir, PUBLICATION_MARKER_FILE), 'utf8'));
        if (!isRecord(parsed) || parsed.kind !== 'hypercanvas-publication' || !isRecord(parsed.notebook) || typeof parsed.notebook.id !== 'string' || !parsed.notebook.id)
            return null;
        const marker = {
            ...parsed,
            notebook: { ...parsed.notebook, id: parsed.notebook.id },
        };
        return marker;
    }
    catch {
        return null;
    }
}
/**
 * A project directory may only be reused when it is an empty folder or a
 * recognized publication of the same Notebook. Anything else is refused so a
 * publish never overwrites unrelated work (see DOCS/publishing.md).
 */
export function verifyMarker(projectDir, notebook, { mode = 'external' } = {}) {
    const unrecognizedHint = mode === 'default'
        ? 'The Notebook publish/ folder already contains unrecognized files. Back it up outside the Notebook, then retry; Hypercanvas will not overwrite or remove those files.'
        : 'Back up the existing content or choose an empty external folder, then retry.';
    const mismatchedHint = mode === 'default'
        ? 'The Notebook publish/ folder belongs to another Notebook. Move it outside the Notebook or open the Notebook it belongs to, then retry.'
        : 'Choose the Notebook bound to this publication or another empty external folder, then retry.';
    const marker = readMarker(projectDir);
    if (!marker)
        throw publishingError('NOT_A_PUBLICATION', 'The destination is not an empty folder or a recognized Hypercanvas publication.', projectDir, unrecognizedHint);
    if (marker.notebook.id !== notebook.manifest.id) {
        throw publishingError('MARKER_MISMATCH', `The destination is bound to another Notebook (${JSON.stringify(marker.notebook.title)}).`, projectDir, mismatchedHint);
    }
    return marker;
}
function canonical(candidate) {
    try {
        return fs.realpathSync.native(candidate);
    }
    catch {
        return path.resolve(candidate);
    }
}
function isInside(parent, child) {
    const relative = path.relative(parent, child);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
/* ------------------------------------------------------------------ *
 * Generation (portable project)
 * ------------------------------------------------------------------ */
/**
 * Validate and prepare the project directory without destructive behavior.
 * Default mode targets the Notebook's managed publish project directory
 * (`backstage/publish`, or the legacy `publish/` project of a build that put
 * it there); external mode targets a folder outside the Notebook that must be
 * empty or a recognized publication of this Notebook.
 */
export function ensureProjectDirectory({ destination, notebookRoot, mode }) {
    const resolved = path.resolve(destination);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    const canonicalDestination = path.join(canonical(path.dirname(resolved)), path.basename(resolved));
    const canonicalNotebook = canonical(notebookRoot);
    const managedPublish = canonical(path.join(canonicalNotebook, NOTEBOOK_PUBLISH_DIR));
    const legacyPublish = canonical(path.join(canonicalNotebook, LEGACY_NOTEBOOK_PUBLISH_DIR));
    if (mode === 'external' && isInside(canonicalNotebook, canonicalDestination)) {
        throw publishingError('DESTINATION_INSIDE_NOTEBOOK', 'External publish destinations must be outside the Notebook.');
    }
    if (canonicalDestination !== managedPublish && canonicalDestination !== legacyPublish && isInside(canonicalNotebook, canonicalDestination)) {
        throw publishingError('DESTINATION_INSIDE_NOTEBOOK', 'Publish destination must not be inside the Notebook.');
    }
    if (fs.existsSync(resolved) && !fs.statSync(resolved).isDirectory()) {
        throw publishingError('DESTINATION_NOT_DIRECTORY', 'Publish destination must be a directory.');
    }
    const managed = canonicalDestination === managedPublish || canonicalDestination === legacyPublish;
    if (mode === 'default' && !managed) {
        throw publishingError('INVALID_DESTINATION', 'Default publishing uses the Notebook publish/ directory.');
    }
    if (fs.existsSync(resolved) && fs.readdirSync(resolved).length) {
        verifyMarker(resolved, validatedNotebook(inspectNotebook(notebookRoot)), { mode });
    }
    fs.mkdirSync(resolved, { recursive: true });
    return { directory: resolved, managed };
}
function readCanvasState(notebook, page) {
    if (page.path === null)
        throw publishingError('INVALID_NOTEBOOK', `Canvas page ${page.id} has no path.`);
    const file = path.join(notebook.root, page.path);
    return materializeFromText(fs.readFileSync(file, 'utf8'));
}
function prototypeEntry(notebook, page) {
    if (page.path === null)
        return null;
    const directory = path.join(notebook.root, page.path);
    for (const name of ['index.jsx', 'index.js', 'index.tsx', 'index.ts']) {
        if (fs.existsSync(path.join(directory, name)))
            return `${page.path}/${name}`;
    }
    return null;
}
function jsonScript(value) { return JSON.stringify(value, null, 2); }
function ignoreMatcher(notebookRoot) {
    const cache = new Map();
    const matcherFor = (directory) => {
        const cached = cache.get(directory);
        if (cached)
            return cached;
        const matcher = ignore();
        const ignoreFile = path.join(directory, '.gitignore');
        if (fs.existsSync(ignoreFile) && fs.statSync(ignoreFile).isFile()) {
            try {
                matcher.add(fs.readFileSync(ignoreFile, 'utf8'));
            }
            catch (error) {
                throw publishingError('PUBLISH_IGNORE_INVALID', `Could not read ignore rules from ${path.relative(notebookRoot, ignoreFile) || '.gitignore'}.`, errorMessage(error), 'Fix the invalid .gitignore entry, then retry publishing.');
            }
        }
        cache.set(directory, matcher);
        return matcher;
    };
    return (relativePath, isDirectory = false) => {
        const segments = relativePath.split('/');
        let ignored = false;
        for (let end = 1; end <= segments.length; end += 1) {
            const isCurrentDirectory = end < segments.length || isDirectory;
            const prefix = segments.slice(0, end).join('/');
            for (let scopeDepth = 0; scopeDepth < end; scopeDepth += 1) {
                const scope = path.join(notebookRoot, ...segments.slice(0, scopeDepth));
                const scopedPath = segments.slice(scopeDepth, end).join('/');
                const result = matcherFor(scope).test(scopedPath);
                if (result.ignored)
                    ignored = true;
                else if (result.unignored)
                    ignored = false;
            }
            if (isCurrentDirectory && ignored)
                return true;
            if (!isCurrentDirectory && prefix === relativePath)
                return ignored;
        }
        return ignored;
    };
}
/** Inventory every user-owned top-level directory without assuming its name. */
function isManagedPublishRelative(relativePath) {
    // The primary managed output; `publish/` covers publications generated by
    // earlier builds and stays out of the published source either way.
    return relativePath === NOTEBOOK_PUBLISH_DIR || relativePath.startsWith(`${NOTEBOOK_PUBLISH_DIR}/`)
        || relativePath === LEGACY_NOTEBOOK_PUBLISH_DIR || relativePath.startsWith(`${LEGACY_NOTEBOOK_PUBLISH_DIR}/`);
}
function notebookSourceFiles(notebookRoot) {
    if (!fs.existsSync(notebookRoot))
        return [];
    const isIgnored = ignoreMatcher(notebookRoot);
    const files = new Set();
    for (const filename of [...NOTEBOOK_CONFIG_FILE_NAMES, NOTEBOOK_CANVAS_CONFIG_FILE]) {
        for (const relativePath of [filename, `config/${filename}`]) {
            const candidate = path.join(notebookRoot, ...relativePath.split('/'));
            try {
                if (fs.lstatSync(candidate).isFile() && !isIgnored(relativePath))
                    files.add(relativePath);
            }
            catch { /* this config candidate is absent */ }
        }
    }
    const visit = (directory, relativeDirectory) => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            if (EXCLUDED_DIRECTORY_NAMES.has(entry.name))
                continue;
            const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
            const fullPath = path.join(directory, entry.name);
            if (isManagedPublishRelative(relativePath))
                continue;
            if (entry.isDirectory()) {
                if (!isIgnored(relativePath, true))
                    visit(fullPath, relativePath);
            }
            else if (entry.isFile() && relativePath !== PUBLISH_WORKFLOW_PATH && !isIgnored(relativePath)) {
                files.add(relativePath);
            }
        }
    };
    for (const entry of fs.readdirSync(notebookRoot, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.isFile() && /(?:\.doc\.mdx|\.(?:png|jpe?g|gif|webp|svg|avif|ico))$/i.test(entry.name) && !isIgnored(entry.name))
            files.add(entry.name);
        if (!entry.isDirectory() || EXCLUDED_DIRECTORY_NAMES.has(entry.name))
            continue;
        // `backstage/` keeps its published content scope only: `assets/` and
        // `data/` publish under their logical names, everything else stays local.
        if (entry.name === NOTEBOOK_BACKSTAGE_DIR) {
            for (const backstageEntry of fs.readdirSync(path.join(notebookRoot, NOTEBOOK_BACKSTAGE_DIR), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
                const contentName = NOTEBOOK_CONTENT_DIRECTORY_NAMES.find(candidate => candidate === backstageEntry.name);
                const ignoredPath = contentName ? contentName : `${NOTEBOOK_BACKSTAGE_DIR}/${backstageEntry.name}`;
                if (backstageEntry.isFile() && !isIgnored(ignoredPath)) {
                    files.add(ignoredPath);
                }
                else if (backstageEntry.isDirectory() && !isIgnored(ignoredPath, true)) {
                    if (contentName) {
                        // Content folders publish under their logical names even when
                        // they live backstage; other authored backstage files keep paths.
                        visit(path.join(notebookRoot, NOTEBOOK_BACKSTAGE_DIR, backstageEntry.name), contentName);
                    }
                    else {
                        visit(path.join(notebookRoot, NOTEBOOK_BACKSTAGE_DIR, backstageEntry.name), `${NOTEBOOK_BACKSTAGE_DIR}/${backstageEntry.name}`);
                    }
                }
            }
            continue;
        }
        if (!isIgnored(entry.name, true))
            visit(path.join(notebookRoot, entry.name), entry.name);
    }
    return [...files].sort();
}
function packageNameFromSpecifier(specifier) {
    const value = String(specifier ?? '').split(/[?#]/, 1)[0];
    if (!value || value.startsWith('.') || value.startsWith('#') || value.startsWith('@/') || value.startsWith('/') || value.startsWith('\\') || value.startsWith('node:') || /^[A-Za-z][\w+.-]*:/.test(value) || /^[A-Za-z]:[\\/]/.test(value))
        return null;
    const segments = value.split('/');
    const packageName = value.startsWith('@')
        ? segments.length >= 2 && segments[1] ? `${segments[0]}/${segments[1]}` : null
        : segments[0];
    if (!packageName || BUILTIN_MODULES.has(packageName) || value === '@dfosco/hypercanvas')
        return null;
    return packageName;
}
function prototypeModuleSpecifiers(source, extension) {
    const specifiers = new Set();
    const withoutComments = source
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|\s)\/\/[^\n]*/gm, '$1');
    const patterns = extension === '.css'
        ? [/@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/g]
        : [
            /\b(?:import|export)\s+(?:[^'";`]*?\sfrom\s*)?['"]([^'"]+)['"]/g,
            /\b(?:import|require)\s*\(\s*['"]([^'"]+)['"]/g,
        ];
    for (const pattern of patterns) {
        for (const match of withoutComments.matchAll(pattern)) {
            const specifier = match[1];
            if (specifier !== undefined)
                specifiers.add(specifier);
        }
    }
    return specifiers;
}
function notebookLockedPackageVersion(notebookRoot, packageName) {
    if (!notebookRoot)
        return null;
    let parsedManifest;
    try {
        parsedManifest = JSON.parse(fs.readFileSync(path.join(notebookRoot, 'package.json'), 'utf8'));
    }
    catch {
        return null;
    }
    if (!isRecord(parsedManifest))
        return null;
    const manifest = parsedManifest;
    const declared = ['dependencies', 'devDependencies', 'optionalDependencies']
        .some((key) => Object.hasOwn(record(manifest[key]), packageName));
    if (!declared)
        return null;
    let lockfile;
    try {
        lockfile = JSON.parse(fs.readFileSync(path.join(notebookRoot, 'package-lock.json'), 'utf8'));
    }
    catch { /* try exact manifest pins below */ }
    const lockRecord = record(lockfile);
    const lockPackages = record(lockRecord.packages);
    const lockDependency = record(record(lockRecord.dependencies)[packageName]);
    const lockVersion = stringField(record(lockPackages[`node_modules/${packageName}`]), 'version') || stringField(lockDependency, 'version');
    if (typeof lockVersion === 'string' && lockVersion)
        return lockVersion;
    const exactVersion = ['dependencies', 'devDependencies', 'optionalDependencies']
        .map((key) => record(manifest[key])[packageName])
        .find((version) => typeof version === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version));
    return typeof exactVersion === 'string' ? exactVersion : null;
}
function installedPackageVersion(packageName, notebookRoot) {
    const notebookVersion = notebookLockedPackageVersion(notebookRoot, packageName);
    if (notebookVersion)
        return notebookVersion;
    let entry = null;
    try {
        entry = require.resolve(packageName);
    }
    catch { /* package exports may hide its root entry */ }
    if (entry) {
        let directory = path.dirname(entry);
        while (true) {
            try {
                const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
                if (isRecord(metadata) && metadata.name === packageName && typeof metadata.version === 'string')
                    return metadata.version;
            }
            catch { /* keep searching parent directories */ }
            const parent = path.dirname(directory);
            if (parent === directory)
                break;
            directory = parent;
        }
    }
    // Package export maps may intentionally hide package.json (or even '.').
    // Resolve metadata through ancestor node_modules directories as a fallback.
    for (let directory = path.dirname(fileURLToPath(import.meta.url));; directory = path.dirname(directory)) {
        const metadataPath = path.join(directory, 'node_modules', packageName, 'package.json');
        try {
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            if (isRecord(metadata) && metadata.name === packageName && typeof metadata.version === 'string')
                return metadata.version;
        }
        catch { /* keep searching ancestor node_modules directories */ }
        const parent = path.dirname(directory);
        if (parent === directory)
            break;
    }
    throw publishingError('PUBLISH_DEPENDENCY_UNAVAILABLE', `Could not determine an exact installed version for prototype dependency "${packageName}".`, packageName, `Install "${packageName}" in the Hypercanvas application, then retry publishing.`);
}
function prototypeDependencies(notebook, sourceFiles = notebookSourceFiles(notebook.root)) {
    const packageNames = new Set();
    for (const relativePath of sourceFiles) {
        if (!/\.(?:[cm]?[jt]sx?|css)$/i.test(relativePath))
            continue;
        const fullPath = path.join(notebook.root, ...relativePath.split('/'));
        const extension = path.extname(relativePath).toLowerCase();
        for (const specifier of prototypeModuleSpecifiers(fs.readFileSync(fullPath, 'utf8'), extension)) {
            const packageName = packageNameFromSpecifier(specifier);
            if (packageName && !Object.hasOwn(BASE_DEPENDENCIES, packageName))
                packageNames.add(packageName);
        }
    }
    return Object.fromEntries([...packageNames].sort().map((packageName) => [packageName, installedPackageVersion(packageName, notebook.root)]));
}
function prototypeNameForPath(relativePath) {
    const segments = String(relativePath || '').split('/');
    const prototypeIndex = segments.indexOf(NOTEBOOK_DIRECTORIES.prototypes);
    if (prototypeIndex < 0)
        return null;
    for (const segment of segments.slice(prototypeIndex + 1)) {
        if (segment === 'drafts' || segment.endsWith('.folder'))
            continue;
        return segment;
    }
    return null;
}
export function lockfileMatchesDependencies(lockfile, dependencies) {
    const lock = record(lockfile);
    const packages = record(lock.packages);
    const rootPackage = record(packages['']);
    const actual = record(rootPackage.dependencies);
    const expected = record(dependencies);
    const expectedNames = Object.keys(expected).sort();
    const actualNames = Object.keys(actual).sort();
    return expectedNames.length === actualNames.length
        && expectedNames.every((name, index) => name === actualNames[index] && expected[name] === actual[name]);
}
function escapeHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function safePublicationDiagnostics(diagnostics, notebookRoot) {
    return (Array.isArray(diagnostics) ? diagnostics : []).map((candidate) => {
        const item = record(candidate);
        let message = String(item.message || 'This page is unavailable.');
        if (notebookRoot)
            message = message.replaceAll(notebookRoot, '[Notebook]');
        message = message.replace(/(?:\/Users\/|\/home\/|\/private\/var\/)[^\s"'<>]+/g, '[local path]');
        return { code: typeof item.code === 'string' ? item.code : 'PAGE_UNAVAILABLE', message };
    });
}
function publicationPayload(notebook, frames, sitePages, generatedOutputPaths = []) {
    const pages = (notebook.pages || []).map(page => {
        const common = {
            id: page.id,
            type: page.type,
            title: page.title,
            route: page.route || null,
            available: page.available === true,
            diagnostics: safePublicationDiagnostics(page.diagnostics, notebook.root),
        };
        if (page.type === 'canvas')
            return { ...common, siteFrames: frames.get(pageSlug(page)) || {} };
        if (page.type === 'prototype')
            return { ...common, path: page.path };
        if (page.type === 'component' || page.type === 'doc')
            return { ...common, path: page.path };
        const site = sitePages.get(page.id);
        return {
            ...common,
            siteId: page.siteId,
            available: page.available !== false && site?.available === true,
            diagnostics: safePublicationDiagnostics(site?.diagnostics || page.diagnostics, notebook.root),
            productionUrl: site?.productionUrl || null,
            snapshot: site?.snapshot || null,
            snapshotDark: site?.snapshotDark || null,
            publicationStatus: site?.publicationStatus || 'unavailable',
        };
    });
    const appConfig = readAppConfig(notebook.root);
    const configNotebook = record(appConfig?.notebook);
    const siblingOrder = record(configNotebook.siblingOrder);
    const siblingOrders = Object.fromEntries(Object.entries(siblingOrder).flatMap(([parentPath, value]) => Array.isArray(value)
        ? [[parentPath, value.filter(isNotebookSiblingRef)]]
        : []));
    const tree = buildNotebookNavigationTree(notebook.root, notebook, siblingOrders, false, generatedOutputPaths);
    return {
        formatVersion: 2,
        notebookId: notebook.manifest.id,
        title: notebook.manifest.title || 'Notebook',
        navigation: notebook.manifest.navigation,
        tree,
        pages,
    };
}
function injectPublicationPayload(indexHtml, payload) {
    const json = JSON.stringify(payload).replaceAll('<', '\\u003c');
    const script = `<script>window.__HYPERCANVAS_NOTEBOOK_PUBLICATION__=${json}</script>`;
    return indexHtml.replace('</head>', `${script}\n  </head>`);
}
function publishedPages(notebook) {
    const canvases = notebook.pages
        .filter((page) => page.type === 'canvas' && page.available && page.path !== null)
        .map((page) => ({ ...page, slug: pageSlug(page), state: readCanvasState(notebook, page) }));
    const prototypes = notebook.pages
        .filter((page) => page.type === 'prototype' && page.available && page.path !== null)
        .map((page) => ({ ...page, slug: pageSlug(page), entry: prototypeEntry(notebook, page), prototypeName: page.path ? prototypeNameForPath(page.path) : null }));
    const documents = notebook.pages
        .filter((page) => page.type === 'doc' && page.available && page.path !== null)
        .map((page) => ({ ...page, slug: pageSlug(page) }));
    return [...canvases, ...prototypes, ...documents].sort((a, b) => a.index - b.index);
}
/** Give manifest-listed prototypes a workspace card even when they have no metadata or flows. */
function generatedPrototypeMetadata(pages, sourceFiles) {
    const files = {};
    const seenDirectories = new Set();
    for (const page of pages) {
        if (page.type !== 'prototype' || !page.path || seenDirectories.has(page.path))
            continue;
        seenDirectories.add(page.path);
        const prototypeName = prototypeNameForPath(page.path);
        const hasMetadata = sourceFiles.some((relativePath) => {
            const metadataFile = /\.prototype\.jsonc?$/.test(relativePath);
            const nestedMetadata = metadataFile && relativePath.startsWith(`${page.path}/`);
            const topLevelMetadata = prototypeName && [
                `prototypes/${prototypeName}.prototype.json`,
                `prototypes/${prototypeName}.prototype.jsonc`,
            ].includes(relativePath);
            return nestedMetadata || topLevelMetadata;
        });
        if (hasMetadata)
            continue;
        const relativePath = `${NOTEBOOK_CONTENT_DIRECTORY}/${page.path}/hypercanvas-publication.prototype.json`;
        files[relativePath] = `${jsonScript({ meta: { title: page.title || prototypeNameForPath(page.path) || 'Prototype' } })}\n`;
    }
    return files;
}
const RUNTIME_SCAFFOLD_FILES = [
    'src/_prototype.jsx',
    'src/library/mount.jsx',
    'src/library/prototypes-entry.jsx',
    'src/library/routes.jsx',
    'src/library/_app.jsx',
    'src/library/_app.module.css',
    'src/library/index.jsx',
    'src/library/home.jsx',
    'src/library/create.jsx',
    'src/library/viewfinder.jsx',
    'src/library/sites.jsx',
    'src/library/workspace.jsx',
    'src/library/workspace-entry.jsx',
];
function scaffoldText(relativePath) {
    return fs.readFileSync(path.join(SCAFFOLD_ROOT, relativePath), 'utf8');
}
function runtimeDependencies() {
    return Object.fromEntries(BASE_DEPENDENCY_NAMES.map((name) => [
        name,
        name === '@dfosco/hypercanvas' ? `file:${VENDORED_RUNTIME}` : installedPackageVersion(name, null),
    ]));
}
function vendoredRuntimeFiles() {
    const packageFiles = arrayOfStrings(HYPERCANVAS_PACKAGE.files);
    const entries = new Set([
        'package.json',
        ...packageFiles.filter((entry) => entry !== 'dist'),
        'vite.ui.config.js',
        'vite.canvas.config.js',
        'scripts/gen-themes-css.mjs',
    ]);
    const files = {};
    for (const entry of entries) {
        const absolute = path.join(PACKAGE_ROOT, entry);
        if (!fs.existsSync(absolute))
            continue;
        if (fs.statSync(absolute).isDirectory()) {
            for (const relative of walkFiles(absolute)) {
                // Core runtime files are emitted by the TypeScript build. The source
                // tree may contain TS modules that cannot execute directly in the
                // published Node/Vite project, so vendor its compiled output at the
                // historical `src/core` package path.
                if (entry === 'src' && (relative === 'core' || relative.startsWith('core/')))
                    continue;
                const sourcePath = path.join(absolute, ...relative.split('/'));
                let content = fs.readFileSync(sourcePath);
                files[`${VENDORED_RUNTIME}/${entry}/${relative}`] = content;
            }
        }
        else {
            files[`${VENDORED_RUNTIME}/${entry}`] = fs.readFileSync(absolute);
        }
    }
    const emittedCore = path.join(PACKAGE_ROOT, 'dist/core');
    if (!fs.existsSync(emittedCore)) {
        throw new Error('Compiled Hypercanvas Core output is required to materialize a publication.');
    }
    for (const relative of walkFiles(emittedCore)) {
        let content = fs.readFileSync(path.join(emittedCore, ...relative.split('/')));
        // Package exports resolve through dist/core at runtime. The UI and canvas
        // Vite builds still use the historical src/core layout for CSS scanning,
        // source entry points, and their shared-state externalization rules.
        files[`${VENDORED_RUNTIME}/src/core/${relative}`] = content;
        files[`${VENDORED_RUNTIME}/dist/core/${relative}`] = content;
    }
    const emittedSupport = path.join(PACKAGE_ROOT, 'dist/internals');
    if (fs.existsSync(emittedSupport)) {
        for (const relative of walkFiles(emittedSupport)) {
            files[`${VENDORED_RUNTIME}/dist/internals/${relative}`] = fs.readFileSync(path.join(emittedSupport, ...relative.split('/')));
        }
    }
    return files;
}
function normalRuntimeFiles(notebook, sourceFiles, basePath = './') {
    const files = Object.fromEntries(RUNTIME_SCAFFOLD_FILES.map((relativePath) => [relativePath, scaffoldText(relativePath)]));
    const selectedAppConfig = selectedNotebookAppConfig(sourceFiles);
    const configDirectory = selectedAppConfig?.startsWith('config/') ? 'config/' : '';
    for (const filename of NOTEBOOK_CONFIG_FILES) {
        const candidates = [filename, `config/${filename}`];
        if (filename === APP_CONFIG_PRIMARY && selectedAppConfig)
            continue;
        if (candidates.some(candidate => sourceFiles.includes(candidate)))
            continue;
        const fallback = path.join(PACKAGE_ROOT, filename);
        if (fs.existsSync(fallback))
            files[`${configDirectory}${filename}`] = fs.readFileSync(fallback, 'utf8');
    }
    let viteConfig = scaffoldText('vite.config.js');
    viteConfig = viteConfig.replace('const __dirname = path.dirname(fileURLToPath(import.meta.url))', "const __dirname = path.dirname(fileURLToPath(import.meta.url))\nprocess.env.HYPERCANVAS_NOTEBOOK_ROOT = path.resolve(__dirname, './notebook-content')");
    viteConfig = viteConfig.replace("const base = process.env.VITE_BASE_PATH || '/'", `const base = process.env.VITE_BASE_PATH || ${JSON.stringify(basePath)}`);
    viteConfig = viteConfig.replace("'@': path.resolve(__dirname, './src'),", "'@': fileURLToPath(new URL('./notebook-content/', import.meta.url)),");
    viteConfig = viteConfig.replace('    base,\n', "    base,\n    define: {\n      'globalThis.__HYPERCANVAS_NOTEBOOK_PUBLICATION__': 'true',\n      'import.meta.env.VITE_NOTEBOOK_PUBLISHED': JSON.stringify('1'),\n    },\n");
    files['vite.config.js'] = viteConfig;
    files['index.html'] = [
        '<!doctype html>',
        '<html>',
        '  <head>',
        '    <meta charset="UTF-8" />',
        '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
        `    <title>${escapeHtml(notebook.manifest.title)}</title>`,
        '  </head>',
        '  <body>',
        '    <div id="root"></div>',
        '    <script type="module" src="/src/library/mount.jsx"></script>',
        '  </body>',
        '</html>',
        '',
    ].join('\n');
    files['prototypes.html'] = [
        '<!doctype html>',
        '<html>',
        '  <head>',
        '    <meta charset="UTF-8" />',
        '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
        `    <title>${escapeHtml(notebook.manifest.title)}</title>`,
        '  </head>',
        '  <body>',
        '    <div id="root"></div>',
        '    <script type="module" src="/src/library/prototypes-entry.jsx"></script>',
        '  </body>',
        '</html>',
        '',
    ].join('\n');
    files['public/404.html'] = [
        '<!doctype html>',
        '<html>',
        '  <head>',
        '    <meta charset="utf-8" />',
        '    <title>Redirecting&hellip;</title>',
        '    <script>',
        '      /* Resolve the nearest hosted app root so project and branch prefixes work. */',
        '      (async function () {',
        '        var segments = window.location.pathname.split("/").filter(Boolean)',
        '        for (var count = segments.length; count >= 0; count -= 1) {',
        '          var base = count ? "/" + segments.slice(0, count).join("/") + "/" : "/"',
        '          try {',
        '            var response = await fetch(base + "index.html", { method: "HEAD", cache: "no-store" })',
        '            if (!response.ok) continue',
        '            var route = segments.slice(count).join("/") + window.location.search + window.location.hash',
        '            var target = base + "?p=" + encodeURIComponent(route) + "&b=" + encodeURIComponent(base)',
        '            window.location.replace(target)',
        '            return',
        '          } catch { /* try the next parent */ }',
        '        }',
        '        window.location.replace("/")',
        '      })()',
        '    </script>',
        '  </head>',
        '  <body></body>',
        '</html>',
        '',
    ].join('\n');
    files['public/.nojekyll'] = '';
    // Generated artifacts are reproducible from the committed publication
    // source; they must never become part of it.
    files['.gitignore'] = [
        '.hypercanvas/',
        '.storyboard/',
        '.DS_Store',
        'node_modules/',
        'dist/',
        'src/router.ts',
        'vendor/hypercanvas/dist/',
        '',
    ].join('\n');
    // @dfosco packages are published to npmjs: make the publication's own
    // registry resolution authoritative instead of inheriting whatever global
    // npm registry settings exist on the machine.
    files['.npmrc'] = '@dfosco:registry=https://registry.npmjs.org/\n';
    return files;
}
function generatedFiles(notebook, pages, frames, sourceFiles, basePath = './', generatedNotebookFiles = {}, publishedSites = [], sitePages = new Map(), generatedOutputPaths = []) {
    const files = normalRuntimeFiles(notebook, sourceFiles, basePath);
    Object.assign(files, vendoredRuntimeFiles());
    Object.assign(files, generatedNotebookFiles);
    const dependencies = { ...runtimeDependencies(), ...prototypeDependencies(notebook, sourceFiles) };
    files['package.json'] = jsonScript({
        name: 'published-notebook-site',
        private: true,
        version: '1.0.0',
        type: 'module',
        scripts: {
            dev: 'npm run build:runtime && vite',
            build: 'npm run build:runtime && vite build',
            preview: 'vite preview',
            'build:runtime': 'npm run build:css --prefix vendor/hypercanvas && npm run build:ui --prefix vendor/hypercanvas && npm run build:canvas --prefix vendor/hypercanvas',
        },
        dependencies,
        devDependencies: {},
    }) + '\n';
    files[PUBLICATION_MARKER_FILE] = jsonScript(publicationMarker(notebook, sourceFiles, Object.keys(generatedNotebookFiles))) + '\n';
    const manifestPath = resolveNotebookManifestPath(notebook.root);
    const manifestSource = fs.existsSync(manifestPath)
        ? fs.readFileSync(manifestPath, 'utf8')
        : `${jsonScript(notebook.manifest)}\n`;
    files[NOTEBOOK_MANIFEST_FILE] = manifestSource;
    files[`public/${NOTEBOOK_MANIFEST_FILE}`] = manifestSource;
    // The data plugin discovers Notebook artifacts from the Vite content root.
    // Keep the catalog beside those payloads so suffix-folder stories resolve
    // through their canonical artifact routes in a static publication build.
    files[`${NOTEBOOK_CONTENT_DIRECTORY}/${NOTEBOOK_MANIFEST_FILE}`] = manifestSource;
    files['public/hypercanvas.sites.json'] = jsonScript({ sites: publishedSites }) + '\n';
    const indexHtml = files['index.html'];
    if (typeof indexHtml !== 'string')
        throw new Error('Publication scaffold is missing index.html.');
    files['index.html'] = injectPublicationPayload(indexHtml, publicationPayload(notebook, frames, sitePages, generatedOutputPaths));
    files['publish-manifest.json'] = jsonScript({
        formatVersion: 1,
        title: notebook.manifest.title,
        notebookId: notebook.manifest.id,
        pages: pages.map(({ id, type, title, slug, prototypeName }) => ({ id, type, title, slug, prototypeName: prototypeName || null })),
    }) + '\n';
    files['package-lock.json'] = null;
    return files;
}
function safeSourcePath(value) {
    if (typeof value !== 'string' || !value || value.includes('\\') || path.posix.isAbsolute(value))
        return null;
    const segments = value.split('/');
    if (segments.some((segment) => !segment || segment === '.' || segment === '..'))
        return null;
    if (segments.some((segment) => EXCLUDED_DIRECTORY_NAMES.has(segment)))
        return null;
    if (isManagedPublishRelative(value) || segments[0] === 'dist' || value === PUBLISH_WORKFLOW_PATH)
        return null;
    return value;
}
function pathsOverlap(first, second) {
    return first === second || first.startsWith(`${second}/`) || second.startsWith(`${first}/`);
}
function sourceConflict(relativePath, reason) {
    return publishingError('PUBLISH_SOURCE_CONFLICT', `Notebook source path "${relativePath}" conflicts with the generated publication project${reason ? ` (${reason})` : ''}.`, relativePath, 'Move or rename the conflicting Notebook path, then retry; Hypercanvas will not overwrite it.');
}
function preflightSourceFiles({ notebookRoot, destination, sourceFiles, generatedPaths, previousMarker }) {
    const previousSources = new Set(arrayOfStrings(previousMarker?.sourceFiles).map(safeSourcePath).filter((value) => value !== null));
    const hasPreviousPublication = Boolean(previousMarker);
    const generated = [...generatedPaths];
    const selectedAppConfig = selectedNotebookAppConfig(sourceFiles);
    const selectedCanvasConfig = selectedNotebookConfigFile(sourceFiles, NOTEBOOK_CANVAS_CONFIG_FILE);
    for (const relativePath of sourceFiles) {
        if (!safeSourcePath(relativePath))
            throw sourceConflict(relativePath, 'unsafe or reserved path');
        if (relativePath === 'dist' || relativePath.startsWith('dist/'))
            throw sourceConflict(relativePath, 'dist/ is generated by the site build');
        if (relativePath === PUBLISH_WORKFLOW_PATH)
            throw sourceConflict(relativePath, 'the Pages workflow is managed by publishing');
        for (const targetPath of notebookDestinationPaths(relativePath, selectedAppConfig, selectedCanvasConfig)) {
            if (generated.some((generatedPath) => pathsOverlap(targetPath, generatedPath))) {
                throw sourceConflict(relativePath, `it overlaps generated site file ${targetPath}`);
            }
            const target = path.join(destination, ...targetPath.split('/'));
            const parentSegments = targetPath.split('/').slice(0, -1);
            let parent = destination;
            for (const segment of parentSegments) {
                parent = path.join(parent, segment);
                try {
                    if (!fs.lstatSync(parent).isDirectory())
                        throw sourceConflict(relativePath, 'a destination parent is not a directory');
                }
                catch (error) {
                    if (errorCode(error) !== 'ENOENT')
                        throw error;
                }
            }
            try {
                const stat = fs.lstatSync(target);
                if (!stat.isFile())
                    throw sourceConflict(relativePath, 'the destination path is not a regular file');
                const topLevel = relativePath.split('/')[0];
                const legacyManaged = hasPreviousPublication && topLevel !== undefined && LEGACY_MIRROR_SCOPES.has(topLevel);
                if (!previousSources.has(relativePath) && !legacyManaged) {
                    throw sourceConflict(relativePath, 'an unrelated destination file already exists');
                }
            }
            catch (error) {
                if (errorCode(error) !== 'ENOENT')
                    throw error;
            }
        }
    }
    // Resolve each source against the Notebook root before any destination write.
    // Content dirs (`assets/`, `data/`) map to their physical layout.
    for (const relativePath of sourceFiles) {
        const source = path.join(notebookRoot, ...physicalNotebookRelativePath(notebookRoot, relativePath).split('/'));
        try {
            if (!fs.lstatSync(source).isFile())
                throw sourceConflict(relativePath, 'source is not a regular file');
        }
        catch (error) {
            if (errorCode(error) === 'ENOENT')
                throw sourceConflict(relativePath, 'source disappeared during generation');
            throw error;
        }
    }
}
function selectedNotebookAppConfig(sourceFiles) {
    return [
        APP_CONFIG_PRIMARY,
        `config/${APP_CONFIG_PRIMARY}`,
        LEGACY_NOTEBOOK_CONFIG_FILE,
        `config/${LEGACY_NOTEBOOK_CONFIG_FILE}`,
    ].find(candidate => sourceFiles.includes(candidate)) || null;
}
function notebookDestinationPaths(relativePath, selectedAppConfig = selectedNotebookAppConfig([relativePath]), selectedCanvasConfig = selectedNotebookConfigFile([relativePath], NOTEBOOK_CANVAS_CONFIG_FILE)) {
    const paths = [`${NOTEBOOK_CONTENT_DIRECTORY}/${relativePath}`];
    const configPrefix = relativePath.startsWith('config/') ? 'config/' : '';
    const configFilename = configPrefix ? relativePath.slice(configPrefix.length) : relativePath;
    if (configFilename === APP_CONFIG_PRIMARY || configFilename === LEGACY_NOTEBOOK_CONFIG_FILE) {
        // Keep source copies under notebook-content, then materialize only the
        // selected application config as the canonical primary at its location.
        if (selectedAppConfig === relativePath)
            paths.push(`${configPrefix}${APP_CONFIG_PRIMARY}`);
        return paths;
    }
    if (configFilename === LEGACY_CANVAS_CONFIG_FILE) {
        if (selectedCanvasConfig === relativePath)
            paths.push(relativePath);
        return paths;
    }
    if (NOTEBOOK_CONFIG_FILES.includes(configFilename))
        paths.push(relativePath);
    if (relativePath.startsWith(`${NOTEBOOK_DIRECTORIES.assets}/`)) {
        paths.push(`public/${relativePath}`);
    }
    return paths;
}
function selectedNotebookConfigFile(sourceFiles, filename) {
    return [filename, `config/${filename}`].find(candidate => sourceFiles.includes(candidate)) || null;
}
function copyNotebookFiles(notebookRoot, destination, sourceFiles) {
    const copiedPaths = new Set();
    const selectedAppConfig = selectedNotebookAppConfig(sourceFiles);
    const selectedCanvasConfig = selectedNotebookConfigFile(sourceFiles, NOTEBOOK_CANVAS_CONFIG_FILE);
    for (const relativePath of sourceFiles) {
        const source = path.join(notebookRoot, ...physicalNotebookRelativePath(notebookRoot, relativePath).split('/'));
        for (const targetPath of notebookDestinationPaths(relativePath, selectedAppConfig, selectedCanvasConfig)) {
            const target = path.join(destination, ...targetPath.split('/'));
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.copyFileSync(source, target);
            copiedPaths.add(targetPath);
        }
    }
    return copiedPaths;
}
function walkFiles(root) {
    const files = [];
    if (!fs.existsSync(root))
        return files;
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory())
                walk(full);
            else if (entry.isFile())
                files.push(path.relative(root, full).split(path.sep).join('/'));
        }
    };
    walk(root);
    return files;
}
function removeEmptyDirectories(root) {
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory())
        return;
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (!entry.isDirectory())
            continue;
        const full = path.join(root, entry.name);
        removeEmptyDirectories(full);
        if (fs.readdirSync(full).length === 0)
            fs.rmdirSync(full);
    }
}
function removeEmptyParents(destination, relativePath) {
    let directory = path.dirname(path.join(destination, ...relativePath.split('/')));
    while (directory !== destination && isInside(destination, directory)) {
        try {
            if (fs.readdirSync(directory).length)
                return;
            fs.rmdirSync(directory);
        }
        catch {
            return;
        }
        directory = path.dirname(directory);
    }
}
/** Remove only legacy-scope files or source paths previously owned by publishing. */
function cleanupStale(destination, desired, previousSourceFiles = [], previousGeneratedNotebookFiles = []) {
    const previousSources = arrayOfStrings(previousSourceFiles);
    const previousAppConfig = selectedNotebookAppConfig(previousSources);
    const previousCanvasConfig = selectedNotebookConfigFile(previousSources, NOTEBOOK_CANVAS_CONFIG_FILE);
    for (const scope of MANAGED_SCOPES) {
        const scopeRoot = path.join(destination, scope);
        for (const relative of walkFiles(scopeRoot)) {
            if (!desired.has(`${scope}/${relative}`))
                fs.rmSync(path.join(scopeRoot, relative), { force: true });
        }
        removeEmptyDirectories(scopeRoot);
    }
    for (const relativePath of previousSources) {
        const safePath = safeSourcePath(relativePath);
        if (!safePath)
            continue;
        for (const targetPath of notebookDestinationPaths(safePath, previousAppConfig, previousCanvasConfig)) {
            if (desired.has(targetPath))
                continue;
            const filePath = path.join(destination, ...targetPath.split('/'));
            try {
                const stat = fs.lstatSync(filePath);
                if (stat.isFile() || stat.isSymbolicLink())
                    fs.rmSync(filePath, { force: true });
                removeEmptyParents(destination, targetPath);
            }
            catch (error) {
                if (errorCode(error) !== 'ENOENT')
                    throw error;
            }
        }
        const topLevel = safePath.split('/')[0];
        if (desired.has(safePath) || MANAGED_SCOPES.some((scope) => safePath.startsWith(`${scope}/`)))
            continue;
        if (topLevel !== undefined && LEGACY_MIRROR_SCOPES.has(topLevel))
            continue;
        const legacyPath = path.join(destination, ...safePath.split('/'));
        try {
            const stat = fs.lstatSync(legacyPath);
            if (stat.isFile() || stat.isSymbolicLink())
                fs.rmSync(legacyPath, { force: true });
            removeEmptyParents(destination, safePath);
        }
        catch (error) {
            if (errorCode(error) !== 'ENOENT')
                throw error;
        }
    }
    for (const relativePath of arrayOfStrings(previousGeneratedNotebookFiles)) {
        const safePath = safeSourcePath(relativePath);
        if (!safePath?.startsWith(`${NOTEBOOK_CONTENT_DIRECTORY}/prototypes/`) || desired.has(safePath))
            continue;
        const filePath = path.join(destination, ...safePath.split('/'));
        try {
            const stat = fs.lstatSync(filePath);
            if (stat.isFile() || stat.isSymbolicLink())
                fs.rmSync(filePath, { force: true });
            removeEmptyParents(destination, safePath);
        }
        catch (error) {
            if (errorCode(error) !== 'ENOENT')
                throw error;
        }
    }
    for (const relativePath of LEGACY_PRESENTATION_FILES) {
        if (desired.has(relativePath))
            continue;
        const filePath = path.join(destination, ...relativePath.split('/'));
        try {
            fs.rmSync(filePath, { force: true });
        }
        catch { /* a stale legacy file is optional */ }
        removeEmptyParents(destination, relativePath);
    }
}
function appendPublishedFrameEvents(destination, pages, frames) {
    for (const page of pages) {
        if (page.type !== 'canvas')
            continue;
        const framesByWidget = frames.get(page.slug);
        if (!framesByWidget)
            continue;
        if (!page.path)
            continue;
        const target = path.join(destination, NOTEBOOK_CONTENT_DIRECTORY, ...page.path.split('/'));
        let source;
        try {
            source = fs.readFileSync(target, 'utf8');
        }
        catch {
            continue;
        }
        const events = Object.entries(framesByWidget).map(([widgetId, props]) => JSON.stringify({
            event: 'widget_updated',
            timestamp: '1970-01-01T00:00:00.000Z',
            widgetId,
            props,
        }));
        if (!events.length)
            continue;
        fs.writeFileSync(target, `${source}${source.endsWith('\n') ? '' : '\n'}${events.join('\n')}\n`);
    }
}
/**
 * Materialize (or non-destructively update) the portable project for a valid
 * Notebook. Returns the project summary. The Notebook itself is never modified.
 */
export async function materializeProject({ notebookRoot, destination, mode = 'external', basePath = './' }) {
    const inspection = inspectNotebook(notebookRoot);
    if (!isRecord(inspection) || inspection.status !== 'valid') {
        throw publishingError('INVALID_NOTEBOOK', 'Notebook must be valid before it can be published.', isRecord(inspection) ? inspection.diagnostics : undefined);
    }
    const notebook = validatedNotebook(inspection);
    const sourceFiles = notebookSourceFiles(notebook.root);
    const pages = publishedPages(notebook);
    const canvases = pages.filter((page) => page.type === 'canvas');
    const sitePageInputs = notebook.pages
        .filter((page) => page.type === 'site')
        .map((page) => ({ id: page.id, type: page.type, siteId: page.siteId || page.id, title: page.title }));
    const [{ frames, warnings }, sitePages] = await Promise.all([
        preparePublishedFrames({ notebookRoot: notebook.root, canvases }),
        preparePublishedSitePages({ notebookRoot: notebook.root, pages: sitePageInputs }),
    ]);
    const { directory } = ensureProjectDirectory({ destination, notebookRoot: notebook.root, mode });
    const canonicalNotebookRoot = canonical(notebook.root);
    const canonicalPublicationDirectory = canonical(directory);
    const publicationRelativePath = isInside(canonicalNotebookRoot, canonicalPublicationDirectory)
        ? path.relative(canonicalNotebookRoot, canonicalPublicationDirectory).split(path.sep).join('/')
        : '';
    const generatedOutputPaths = publicationRelativePath ? [publicationRelativePath] : [];
    const previousMarker = readMarker(directory);
    const generatedNotebookFiles = generatedPrototypeMetadata(pages, sourceFiles);
    const publishedSites = new SiteStore(notebook.root).list().map(site => {
        const deployments = record(site.deployments);
        const production = record(deployments.production);
        return {
            id: site.id,
            title: site.title || site.id,
            ...(site.description ? { description: site.description } : {}),
            productionUrl: stringField(production, 'baseUrl') || null,
        };
    });
    const files = generatedFiles(notebook, pages, frames, sourceFiles, basePath, generatedNotebookFiles, publishedSites, sitePages, generatedOutputPaths);
    files['package-lock.json'] = null;
    preflightSourceFiles({
        notebookRoot: notebook.root,
        destination: directory,
        sourceFiles,
        generatedPaths: Object.keys(files),
        previousMarker,
    });
    const desired = new Set(Object.keys(files));
    const packageJson = files['package.json'];
    if (typeof packageJson !== 'string')
        throw new Error('Publication package manifest is missing.');
    const packageManifest = JSON.parse(packageJson);
    const dependencies = isRecord(packageManifest) ? packageManifest.dependencies : undefined;
    for (const [relative, content] of Object.entries(files)) {
        const filePath = path.join(directory, relative);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        if (content === null) {
            let existingLockfile = null;
            try {
                existingLockfile = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            }
            catch { /* install the scaffold lockfile */ }
            if (!lockfileMatchesDependencies(existingLockfile, dependencies)) {
                fs.copyFileSync(require.resolve(LOCKFILE_SCAFFOLD), filePath);
            }
        }
        else
            fs.writeFileSync(filePath, content);
        desired.add(relative);
    }
    for (const relativePath of copyNotebookFiles(notebook.root, directory, sourceFiles))
        desired.add(relativePath);
    // Publication-time integrity gate: a broken snapshot reference (the historic
    // `/undefined` defect, or a missing PNG) must fail the publication instead
    // of silently shipping broken preview URLs.
    validatePublishedSnapshots({ destination: directory, frames, sitePages });
    appendPublishedFrameEvents(directory, pages, frames);
    cleanupStale(directory, desired, previousMarker?.sourceFiles, previousMarker?.generatedNotebookFiles);
    const markerJson = files[PUBLICATION_MARKER_FILE];
    if (typeof markerJson !== 'string')
        throw new Error('Publication marker is missing.');
    const marker = JSON.parse(markerJson);
    return {
        destination: directory,
        mode,
        marker,
        pages: pages.map((page) => ({ id: page.id, type: page.type, title: page.title, slug: page.slug })),
        warnings,
    };
}
export const __test = { normalRuntimeFiles, generatedFiles, publishedPages, generatedPrototypeMetadata, cleanupStale, notebookSourceFiles, packageNameFromSpecifier, prototypeModuleSpecifiers, prototypeDependencies, preflightSourceFiles, notebookDestinationPaths, selectedNotebookAppConfig, selectedNotebookConfigFile };
