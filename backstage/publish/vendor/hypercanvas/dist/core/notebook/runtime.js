/** Runtime-owned adapter for one active, content-only Notebook. */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { resolveAppConfigWritePath as resolveAppConfigWritePathInRoot } from '../configFile.js';
import { resolveRuntimeDir } from '../runtimeDir.js';
import { migrateLegacyNotebookFileLocations } from './legacyFileLocations.js';
import { resolveHypercanvasAppStateDirectory } from '../appStateDirectory.js';
import { initializeNotebook, inspectNotebook, notebookPaths, NOTEBOOK_CANVAS_CONFIG_FILE, NOTEBOOK_CONFIG_FILE_NAMES, NOTEBOOK_DIRECTORIES, LEGACY_NOTEBOOK_RUNTIME_DIR, NOTEBOOK_MANIFEST_FILE, NOTEBOOK_PUBLISH_DIR, NOTEBOOK_RUNTIME_DIR, NOTEBOOK_BACKSTAGE_DIR, NOTEBOOK_SUPPORT_DIRECTORIES, resolveNotebookSupportPath, hasNotebookManifest, } from './notebook.js';
import { physicalNotebookRelativePath } from './layout.js';
const NOTEBOOK_ENTRIES = new Set([
    NOTEBOOK_MANIFEST_FILE,
    NOTEBOOK_CANVAS_CONFIG_FILE,
    ...NOTEBOOK_PUBLISH_DIR.split('/'),
    'config',
    NOTEBOOK_BACKSTAGE_DIR,
    ...NOTEBOOK_SUPPORT_DIRECTORIES,
    ...NOTEBOOK_CONFIG_FILE_NAMES,
    ...Object.values(NOTEBOOK_DIRECTORIES),
]);
const APPLICATION_DEFAULT_ENTRIES = new Set([
    NOTEBOOK_CANVAS_CONFIG_FILE,
    'config',
    ...NOTEBOOK_CONFIG_FILE_NAMES,
]);
const NOTEBOOK_RUNTIME_ENTRIES = new Set([NOTEBOOK_RUNTIME_DIR, LEGACY_NOTEBOOK_RUNTIME_DIR]);
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isValidNotebook(value) {
    return value.status === 'valid';
}
function devlog(message, details = {}) {
    console.debug('[devlog][notebook-runtime]', message, details);
}
function runtimeError(code, message) {
    return Object.assign(new Error(message), { code });
}
/** Return the newest valid Notebook saved in Core's recent Notebook history. */
export function resolveLastOpenedNotebookRoot({ stateDirectory = resolveHypercanvasAppStateDirectory(), } = {}) {
    let entries;
    try {
        entries = JSON.parse(fs.readFileSync(path.join(stateDirectory, 'notebooks.json'), 'utf8'));
    }
    catch {
        return null;
    }
    if (!Array.isArray(entries))
        return null;
    for (const entry of entries) {
        const root = isRecord(entry) ? entry.root : undefined;
        if (typeof root !== 'string' || !path.isAbsolute(root))
            continue;
        try {
            const notebook = inspectNotebook(root);
            if (notebook.status === 'valid')
                return notebook.root;
        }
        catch { /* continue to the next saved Notebook */ }
    }
    return null;
}
function isInside(root, candidate) {
    const relative = path.relative(root, candidate);
    return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
function nearestRealPath(candidate) {
    let current = candidate;
    while (current !== path.dirname(current)) {
        try {
            return fs.realpathSync.native(current);
        }
        catch {
            current = path.dirname(current);
        }
    }
    return current;
}
function canonicalRoot(root) {
    const absolute = path.resolve(String(root || '.'));
    return fs.existsSync(absolute) ? fs.realpathSync.native(absolute) : absolute;
}
function canonicalNotebookRoot(root) {
    const absolute = path.resolve(String(root || '.'));
    try {
        if (fs.lstatSync(absolute).isSymbolicLink()) {
            throw runtimeError('UNSAFE_NOTEBOOK_PATH', 'Notebook root changed or resolves through a symlink.');
        }
        const canonical = fs.realpathSync.native(absolute);
        if (!fs.statSync(canonical).isDirectory()) {
            throw runtimeError('UNSAFE_NOTEBOOK_PATH', 'Notebook root changed or resolves through a symlink.');
        }
        return canonical;
    }
    catch (error) {
        if (isRecord(error) && error.code === 'UNSAFE_NOTEBOOK_PATH')
            throw error;
        throw runtimeError('UNSAFE_NOTEBOOK_PATH', 'Notebook root is unavailable.');
    }
}
function safeRelativePath(relativePath) {
    const normalized = String(relativePath || '').replaceAll('\\', '/');
    const segments = normalized.split('/');
    if (!normalized
        || normalized.includes('\0')
        || normalized.startsWith('/')
        || segments.some(segment => !segment || segment === '.' || segment === '..')) {
        throw runtimeError('UNSAFE_NOTEBOOK_PATH', 'Path must be a normalized Notebook content path.');
    }
    return normalized;
}
function resolveContained(root, relativePath, { entries = null } = {}) {
    const normalized = safeRelativePath(relativePath);
    const topLevel = normalized.split('/')[0];
    if (entries && (!topLevel || !entries.has(topLevel))) {
        throw runtimeError('UNSAFE_NOTEBOOK_PATH', 'Path is not part of the active Notebook contract.');
    }
    const candidate = path.resolve(root, normalized);
    if (!isInside(root, candidate))
        throw runtimeError('UNSAFE_NOTEBOOK_PATH', 'Path resolves outside its filesystem root.');
    const resolved = fs.existsSync(candidate)
        ? fs.realpathSync.native(candidate)
        : nearestRealPath(path.dirname(candidate));
    if (!isInside(root, resolved))
        throw runtimeError('UNSAFE_NOTEBOOK_PATH', 'Path resolves outside its filesystem root.');
    return candidate;
}
export function resolveNotebookPath(root, relativePath) {
    const canonical = canonicalNotebookRoot(root);
    const normalized = safeRelativePath(relativePath);
    const support = NOTEBOOK_SUPPORT_DIRECTORIES.includes(normalized.split('/')[0] || '')
        ? path.relative(canonical, resolveNotebookSupportPath(canonical, normalized))
        : physicalNotebookRelativePath(canonical, normalized);
    return resolveContained(canonical, support, { entries: NOTEBOOK_ENTRIES });
}
export function resolveNotebookRuntimePath(root, relativePath = '') {
    const suffix = relativePath ? safeRelativePath(relativePath) : '';
    const notebookRoot = canonicalNotebookRoot(root);
    // Legacy notebooks keep their `.storyboard/` state; fresh ones use
    // `.hypercanvas/`. Both stay contained to the Notebook root.
    const runtimePath = path.join(path.basename(resolveRuntimeDir(notebookRoot)), suffix);
    return resolveContained(notebookRoot, runtimePath, { entries: NOTEBOOK_RUNTIME_ENTRIES });
}
export function resolvePathWithinRoot(root, relativePath) {
    return resolveContained(canonicalNotebookRoot(root), relativePath);
}
/**
 * Keep the Vite project root stable while exposing only the selected
 * Notebook's manifest-owned content. The owner can swap roots atomically.
 */
export function createNotebookRuntime(options = {}) {
    const settings = typeof options === 'string' || options == null
        ? { initialRoot: options }
        : options;
    const applicationRoot = canonicalRoot(settings.applicationRoot || process.cwd());
    const stateDirectory = settings.stateDirectory || process.env.HYPERCANVAS_APP_STATE_DIR || null;
    const recentFile = stateDirectory ? path.join(path.resolve(stateDirectory), 'notebooks.json') : null;
    const globalRoots = (settings.globalRoots || []).map(({ root, access = ['read'] }) => ({
        root: canonicalRoot(root),
        access: new Set(access),
    }));
    let active = null;
    let generation = 0;
    const listeners = new Set();
    function readRecent() {
        if (!recentFile)
            return [];
        try {
            const entries = JSON.parse(fs.readFileSync(recentFile, 'utf8'));
            if (!Array.isArray(entries))
                return [];
            return entries.filter((entry) => isRecord(entry)
                && typeof entry.root === 'string' && path.isAbsolute(entry.root));
        }
        catch {
            return [];
        }
    }
    function persistRecent(entries) {
        if (!recentFile)
            return;
        const directory = path.dirname(recentFile);
        fs.mkdirSync(directory, { recursive: true });
        if (process.platform !== 'win32')
            fs.chmodSync(directory, 0o700);
        const temporary = `${recentFile}.${process.pid}.tmp`;
        fs.writeFileSync(temporary, `${JSON.stringify(entries.slice(0, 20), null, 2)}\n`, { mode: 0o600 });
        fs.renameSync(temporary, recentFile);
    }
    function remember(notebook) {
        if (!recentFile)
            return;
        const root = notebook.root;
        const entries = readRecent().filter(entry => entry.root !== root);
        entries.unshift({
            root,
            id: notebook.manifest?.id || null,
            title: notebook.manifest?.title || path.basename(root),
            lastOpened: new Date().toISOString(),
        });
        try {
            persistRecent(entries);
        }
        catch (error) {
            devlog('could not persist recent Notebook history', { message: error instanceof Error ? error.message : String(error) });
        }
    }
    function close() {
        const previous = active;
        if (!previous)
            return status();
        generation += 1;
        active = null;
        for (const listener of listeners)
            listener({ previous, current: null });
        return status();
    }
    function recent() {
        return readRecent().map(entry => {
            let available = false;
            let title = typeof entry.title === 'string' ? entry.title : path.basename(entry.root);
            let id = typeof entry.id === 'string' ? entry.id : null;
            try {
                const notebook = inspectNotebook(entry.root);
                available = isValidNotebook(notebook);
                if (isValidNotebook(notebook)) {
                    title = notebook.manifest.title || title;
                    id = notebook.manifest.id || id;
                }
            }
            catch {
                available = false;
            }
            return { ...entry, title, id, available };
        });
    }
    function forget(root) {
        if (typeof root !== 'string' || !root.trim() || !path.isAbsolute(root)) {
            throw runtimeError('INVALID_NOTEBOOK_ROOT', 'A Notebook root path is required to remove recent history.');
        }
        const target = canonicalRoot(root);
        const entries = readRecent();
        const remaining = entries.filter(entry => canonicalRoot(entry.root) !== target);
        const forgotten = remaining.length !== entries.length;
        if (forgotten)
            persistRecent(remaining);
        return { forgotten, notebooks: recent() };
    }
    // Opening is otherwise read-only: a recognized Notebook is never repaired,
    // migrated, adopted, or given identity markers here. The one exception is
    // the startup legacy-location merge below — it moves machine-local runtime
    // state and the managed publish project onto their new names before any
    // service reads a legacy path, and never overwrites existing targets. An
    // invalid folder fails with its diagnostics and stays byte-for-byte
    // unchanged. Creation and adoption go through create().
    /**
     * Any usable directory can be a Notebook. A folder without a valid manifest
     * (empty, foreign, or with a malformed one) is scaffolded in place rather than
     * rejected: initializeNotebook backs up a malformed manifest, keeps existing
     * config files wherever they live, and creates only what is missing. Only a
     * folder that cannot hold a Notebook at all (missing, not a directory, the
     * filesystem root, unwritable) is refused.
     */
    function scaffoldIfNeeded(root) {
        // Refuse before inspecting: inspecting the filesystem root (or a missing
        // path) must never start a scan.
        const requested = path.resolve(String(root || ''));
        let isDirectory = false;
        try {
            isDirectory = fs.statSync(requested).isDirectory();
        }
        catch { /* reported below */ }
        if (!isDirectory || requested === path.parse(requested).root) {
            throw runtimeError('INVALID_NOTEBOOK', 'Choose an existing folder that is not the filesystem root.');
        }
        let first;
        try {
            first = inspectNotebook(requested);
        }
        catch (error) {
            throw runtimeError('INVALID_NOTEBOOK', `This folder cannot be read as a Notebook: ${error instanceof Error ? error.message : String(error)}`);
        }
        if (isValidNotebook(first))
            return first;
        try {
            initializeNotebook(requested, { configRoot: applicationRoot });
        }
        catch (error) {
            throw runtimeError('INVALID_NOTEBOOK', `Could not set up a Notebook in this folder: ${error instanceof Error ? error.message : String(error)}`);
        }
        const scaffolded = inspectNotebook(requested);
        if (!isValidNotebook(scaffolded)) {
            const detail = scaffolded.diagnostics?.find(d => d.message)?.message
                || 'Notebook must be valid before it can become active.';
            throw runtimeError('INVALID_NOTEBOOK', detail);
        }
        return scaffolded;
    }
    function open(root) {
        devlog('open requested', { root });
        try {
            migrateLegacyNotebookFileLocations(canonicalRoot(root));
        }
        catch (error) {
            devlog('legacy location merge failed', { root, error: String(error) });
        }
        const notebook = scaffoldIfNeeded(root);
        const previous = active;
        generation += 1;
        active = Object.freeze({ root: notebook.root, notebook, paths: notebookPaths(notebook.root), generation });
        remember(notebook);
        for (const listener of listeners)
            listener({ previous, current: active });
        devlog('open succeeded', { root: active.root, id: notebook.manifest?.id, title: notebook.manifest?.title });
        return status();
    }
    function create(root, { title = 'Notebook', id } = {}) {
        const requested = String(root || '').trim();
        const requestedRoot = path.resolve(requested);
        if (!requested || requestedRoot === path.parse(requestedRoot).root) {
            throw runtimeError('INVALID_NOTEBOOK_ROOT', 'Choose a non-root directory for the new Notebook.');
        }
        if (hasNotebookManifest(requestedRoot)) {
            throw runtimeError('NOTEBOOK_ALREADY_EXISTS', 'This folder already contains a Notebook; open it instead of creating another one.');
        }
        initializeNotebook(requestedRoot, { title, ...(id !== undefined ? { id } : {}), configRoot: applicationRoot });
        return open(requestedRoot);
    }
    function status() {
        return active
            ? { active: true, root: active.root, notebook: active.notebook, generation: active.generation }
            : { active: false, root: null, notebook: null, generation };
    }
    function refreshNotebook() {
        if (!active)
            return status();
        // Layout/catalog writes happen without switching scope, so keep the
        // generation stable while replacing the captured snapshot. Do not notify
        // Notebook-switch listeners: they own lifecycle work for a different
        // event, such as rebinding terminal sessions or Paseo services.
        const notebook = inspectNotebook(active.root);
        active = Object.freeze({ ...active, notebook });
        return status();
    }
    function requireNotebookRoot() {
        if (!active)
            throw runtimeError('NO_ACTIVE_NOTEBOOK', 'No Notebook is active.');
        return active.root;
    }
    function resolve(relativePath, { scope = 'notebook', access = 'read', globalRoot = null } = {}) {
        if (scope === 'notebook') {
            return resolveNotebookPath(requireNotebookRoot(), relativePath);
        }
        if (scope === 'application-default') {
            if (access !== 'read')
                throw runtimeError('IMMUTABLE_APPLICATION_SOURCE', 'Application source is read-only.');
            return resolveContained(applicationRoot, relativePath, { entries: APPLICATION_DEFAULT_ENTRIES });
        }
        if (scope === 'global') {
            const requestedRoot = canonicalRoot(globalRoot);
            const capability = globalRoots.find(item => item.root === requestedRoot && item.access.has(access));
            if (!capability)
                throw runtimeError('GLOBAL_PATH_NOT_ALLOWED', 'Global filesystem access is not allowlisted.');
            return resolveContained(capability.root, relativePath);
        }
        throw runtimeError('UNKNOWN_FILESYSTEM_SCOPE', `Unknown filesystem scope: ${scope}`);
    }
    function read(relativePath) {
        return fs.readFileSync(resolve(relativePath), 'utf8');
    }
    function write(relativePath, content) {
        const destination = resolve(relativePath);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, content, 'utf8');
    }
    function subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }
    function viteAllowRoots() {
        return [applicationRoot, ...(active ? [active.root] : [])];
    }
    if (settings.initialRoot)
        open(settings.initialRoot);
    function watchPaths() {
        if (!active)
            return [];
        return [
            active.paths.manifest,
            active.paths.canvasConfig,
            ...active.paths.configFiles,
            active.paths.canvases,
            active.paths.prototypes,
            active.paths.widgets,
            active.paths.tools,
            active.paths.components,
            active.paths.data,
            active.paths.assets,
            active.paths.siteConfig,
            path.join(active.root, 'config'),
            path.join(active.root, NOTEBOOK_BACKSTAGE_DIR),
            ...NOTEBOOK_SUPPORT_DIRECTORIES.map(directory => path.join(active.root, directory)),
        ];
    }
    function resolveAppConfigWritePath() {
        // The application config keeps whatever filename the Notebook already
        // uses (hypercanvas.config.json, or the legacy storyboard.config.json)
        // so Settings writes stay inside the single existing file.
        const root = requireNotebookRoot();
        const selected = resolveAppConfigWritePathInRoot(root);
        return resolveContained(root, path.relative(root, selected), { entries: NOTEBOOK_ENTRIES });
    }
    return {
        applicationRoot,
        open,
        create,
        close,
        recent,
        forget,
        status,
        refreshNotebook,
        requireNotebookRoot,
        resolve,
        resolveAppConfigWritePath,
        read,
        write,
        subscribe,
        watchPaths,
        viteAllowRoots,
    };
}
