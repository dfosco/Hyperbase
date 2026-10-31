/**
 * Shared Notebook publish operations — the release publishing API.
 *
 * One portable, self-contained site project; two repository ownership modes
 * (Notebook root by default, a dedicated external repository otherwise); a
 * GitHub Pages deployment configured through the signed-in `gh` CLI that
 * deploys the committed local build without rebuilding; operation records with
 * structured steps, redacted output, and retry. See DOCS/publishing.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { inspectNotebook, LEGACY_NOTEBOOK_PUBLISH_DIR, NOTEBOOK_FORMAT_VERSION, notebookManifestRelativePath, NOTEBOOK_PUBLISH_DIR } from './notebook.js';
import { publishingError } from './publishing/errors.js';
import { readState, writeState, withState, withStateAsync, saveBinding, readBinding, runtimePath } from './publishing/state.js';
import { PUBLICATION_MARKER_FILE, materializeProject } from './publishing/generator.js';
import { buildProject } from './publishing/build.js';
import { resolveRepositoryRoot, ensureRepository, ensureCommitIdentity, stagePublication, commitPublication, reconcileAndRestore, pushToRemote, readFileOnRemote, remoteUrl, fetchRemote, remoteBranches, stagedFileExists, runGit, } from './publishing/git.js';
import { ghAccount, viewRepository, createRepository, getPages, configurePagesSite, dispatchPagesWorkflow, latestPagesWorkflowRun, pagesWorkflowYaml, pagesUrl, WORKFLOW_INSTALL_PATH, } from './publishing/github.js';
import { getGitHubAuthState, getGitHubLogin } from './publishing/githubConnection.js';
import { runOperation, retryOperation, publicOperation, redactOutput } from './publishing/operations.js';
import { notebookPublishWorkflow, runWorkflow } from './publishing/workflow.js';
const PROVIDERS = new Set(['github-pages', 'vercel', 'netlify']);
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function rootString(value) {
    if (typeof value !== 'string' || !value.trim())
        throw publishingError('PUBLISHING_FAILED', 'A Notebook root is required.');
    return value;
}
function isPublishOperation(value) {
    return isRecord(value)
        && typeof value.id === 'string'
        && typeof value.kind === 'string'
        && typeof value.status === 'string'
        && Array.isArray(value.steps)
        && Array.isArray(value.output);
}
/* ------------------------------------------------------------------ *
 * Validation helpers
 * ------------------------------------------------------------------ */
function validRepositoryPart(value, field) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_.-]+$/.test(value)) {
        throw publishingError('INVALID_REPOSITORY', `${field} must contain only letters, numbers, periods, hyphens, or underscores.`);
    }
    return value;
}
function normalizeMode(mode) {
    if (mode !== 'default' && mode !== 'external') {
        throw publishingError('INVALID_MODE', 'Repository mode must be default or external.');
    }
    return mode;
}
function normalizeRepositoryMode(repositoryMode) {
    if (repositoryMode !== 'create' && repositoryMode !== 'connect') {
        throw publishingError('INVALID_REPOSITORY_MODE', 'Repository mode must be create or connect.');
    }
    return repositoryMode;
}
function normalizeVisibility(visibility) {
    if (visibility !== 'public' && visibility !== 'private') {
        throw publishingError('INVALID_VISIBILITY', 'Visibility must be public or private.');
    }
    return visibility;
}
function normalizeBranch(branch) {
    if (!/^[A-Za-z0-9_./-]+$/.test(String(branch))) {
        throw publishingError('INVALID_BRANCH', 'Branch name is invalid.');
    }
    return String(branch);
}
function markerRelativePath(root) {
    return notebookManifestRelativePath(root);
}
function legacyMarkerRelativePath(mode) {
    return mode === 'default' ? `${NOTEBOOK_PUBLISH_DIR}/${PUBLICATION_MARKER_FILE}` : PUBLICATION_MARKER_FILE;
}
function remoteMarkerIdentity(contents) {
    try {
        const marker = JSON.parse(contents);
        if (!isRecord(marker))
            return null;
        const notebook = marker.notebook;
        if (marker.kind === 'hypercanvas-publication' && isRecord(notebook) && typeof notebook.id === 'string' && notebook.id) {
            return { id: notebook.id };
        }
        if (typeof marker.formatVersion === 'number'
            && Number.isInteger(marker.formatVersion)
            && marker.formatVersion >= 1
            && marker.formatVersion <= NOTEBOOK_FORMAT_VERSION
            && typeof marker.id === 'string'
            && marker.id) {
            return { id: marker.id };
        }
    }
    catch { /* absent or invalid marker */ }
    return null;
}
/** Refuse to adopt a remote branch unless its publication marker proves ownership. */
function verifyRemoteOwnership({ repositoryRoot, branch, relativePath, legacyRelativePath, notebook, existing, owner, name }) {
    const branches = remoteBranches({ repositoryRoot });
    if (branches.includes(branch)) {
        const markerPaths = [...new Set([relativePath, legacyRelativePath].filter(Boolean))];
        for (const markerPath of markerPaths) {
            const identity = remoteMarkerIdentity(readFileOnRemote({ repositoryRoot, remote: 'origin', branch, relativePath: markerPath }) ?? '');
            if (!identity)
                continue;
            if (identity.id !== notebook.manifest.id) {
                throw publishingError('MARKER_MISMATCH', `Remote branch ${branch} belongs to another Notebook.`, null, 'Choose the bound Notebook or another repository, then retry.');
            }
            return { verified: true, markerPath };
        }
        throw publishingError('REMOTE_NOT_PUBLICATION', `Remote branch ${branch} is not a Hypercanvas Notebook or publication.`, null, 'Choose an empty repository or the branch containing this Notebook manifest, then retry.');
    }
    if (branches.length) {
        throw publishingError('REMOTE_NOT_PUBLICATION', `Repository ${owner}/${name} has existing branches but ${branch} does not contain this Notebook's publication marker.`, branches, 'Choose the publication branch or an empty repository, then retry.');
    }
    // An empty existing repository can be explicitly connected, unless Pages is
    // already configured for unrelated content.
    if (existing) {
        const pages = getPages({ owner, name });
        if (pages) {
            throw publishingError('REMOTE_NOT_PUBLICATION', `Repository ${owner}/${name} already has a GitHub Pages site and is not a Hypercanvas publication of this Notebook.`, JSON.stringify(pages), 'Choose another repository, then retry.');
        }
    }
    return { verified: false };
}
function requireValidNotebook(notebookRoot) {
    const notebook = inspectNotebook(notebookRoot);
    if (notebook.status !== 'valid') {
        throw publishingError('INVALID_NOTEBOOK', 'Notebook must be valid before it can be published.', notebook.diagnostics);
    }
    return notebook;
}
function pagesBasePath(owner, name) {
    const configuredBase = String(process.env.VITE_BASE_PATH || '');
    if (configuredBase.startsWith('/') && !configuredBase.startsWith('//')) {
        return configuredBase.endsWith('/') ? configuredBase : `${configuredBase}/`;
    }
    if (!owner || !name)
        return './';
    if (String(name).toLowerCase() === `${String(owner).toLowerCase()}.github.io`)
        return '/';
    return `/${encodeURIComponent(String(name))}/`;
}
/* ------------------------------------------------------------------ *
 * Generation (portable project)
 * ------------------------------------------------------------------ */
/** Managed publication project directory, honoring where earlier builds put it. */
function managedPublishDir(notebookRoot) {
    // Notebooks published by older builds keep the legacy `publish/` directory
    // until that project has been moved (the runtime merge moves it on open).
    const canonical = (candidate) => {
        try {
            return fs.realpathSync.native(candidate);
        }
        catch {
            return path.resolve(candidate);
        }
    };
    const candidate = canonical(path.join(notebookRoot, NOTEBOOK_PUBLISH_DIR));
    if (fs.existsSync(candidate))
        return candidate;
    const legacy = canonical(path.join(notebookRoot, LEGACY_NOTEBOOK_PUBLISH_DIR));
    if (fs.existsSync(legacy) && !fs.existsSync(candidate))
        return legacy;
    return candidate;
}
/**
 * Materialize a valid Notebook as its portable site project — without
 * modifying the Notebook. Default mode targets the Notebook's managed
 * publish project directory (`backstage/publish`); an external destination
 * must be an empty folder or a recognized publication of this Notebook.
 */
export async function publishNotebookProject(options = {}) {
    const input = isRecord(options) ? options : {};
    const notebook = requireValidNotebook(rootString(input.notebookRoot));
    const destination = typeof input.destination === 'string' ? input.destination : undefined;
    const initializeGit = input.initializeGit === true;
    const modeValue = input.mode;
    const basePath = typeof input.basePath === 'string' ? input.basePath : './';
    const resolvedDestination = destination
        ? path.resolve(destination)
        : managedPublishDir(notebook.root);
    const inferredMode = modeValue ? normalizeMode(modeValue) : (resolvedDestination === managedPublishDir(notebook.root) ? 'default' : 'external');
    const project = await materializeProject({ notebookRoot: notebook.root, destination: resolvedDestination, mode: inferredMode, basePath });
    if (initializeGit) {
        ensureRepository({ repositoryRoot: project.destination, branch: 'main' });
        ensureCommitIdentity(project.destination);
        stagePublication({ repositoryRoot: project.destination });
        commitPublication({ repositoryRoot: project.destination, message: 'Initial Hypercanvas publication' });
    }
    return project;
}
export const exportNotebookProject = publishNotebookProject;
/**
 * Build the portable project locally: install its exact dependencies
 * (`npm ci`) and produce a committed-ready `dist/`. Building never removes
 * repository metadata or unrelated files.
 */
export async function buildPublishSite(options = {}) {
    const input = isRecord(options) ? options : {};
    const notebook = requireValidNotebook(rootString(input.notebookRoot));
    const destination = typeof input.destination === 'string' ? input.destination : undefined;
    const mode = input.mode ?? 'default';
    const basePath = typeof input.basePath === 'string' ? input.basePath : undefined;
    const owner = input.owner;
    const name = input.name;
    const resolvedDestination = destination
        ? path.resolve(destination)
        : managedPublishDir(notebook.root);
    const resolvedBasePath = basePath || pagesBasePath(owner, name);
    const project = await materializeProject({ notebookRoot: notebook.root, destination: resolvedDestination, mode: normalizeMode(mode), basePath: resolvedBasePath });
    const buildBasePath = resolvedBasePath === './' ? undefined : resolvedBasePath;
    const build = await buildProject({ projectDir: project.destination, ...(buildBasePath !== undefined ? { basePath: buildBasePath } : {}) });
    return { ...project, dist: build.dist };
}
/* ------------------------------------------------------------------ *
 * Legacy-compatible granular entry points
 * ------------------------------------------------------------------ */
/** Create an application-owned working copy used as the deployment project. */
export async function preparePublish(options = {}) {
    const input = isRecord(options) ? options : {};
    const root = rootString(input.root);
    const notebookRoot = rootString(input.notebookRoot);
    const requestedProvider = input.provider;
    if (requestedProvider !== undefined && (typeof requestedProvider !== 'string' || !PROVIDERS.has(requestedProvider))) {
        throw publishingError('UNSUPPORTED_PROVIDER', 'Provider must be github-pages, vercel, or netlify.');
    }
    const provider = typeof requestedProvider === 'string' ? requestedProvider : 'github-pages';
    const id = `publish_${randomUUID().replaceAll('-', '')}`;
    const project = await publishNotebookProject({ notebookRoot });
    withState(root, (state) => {
        state.projects[id] = {
            id,
            provider,
            destination: project.destination,
            createdAt: new Date().toISOString(),
            status: 'prepared',
        };
        return null;
    });
    return { id, ...project, provider, status: 'prepared' };
}
/** Credentials never enter generated projects and are only returned as presence metadata. */
export function savePublishingCredential(options = {}) {
    const input = isRecord(options) ? options : {};
    const root = rootString(input.root);
    const provider = input.provider;
    const token = input.token;
    if (typeof provider !== 'string' || !PROVIDERS.has(provider))
        throw publishingError('UNSUPPORTED_PROVIDER', 'Unsupported publishing provider.');
    if (typeof token !== 'string' || !token.trim())
        throw publishingError('INVALID_CREDENTIAL', 'A provider credential is required.');
    withState(root, (state) => {
        state.credentials[provider] = { token: token.trim(), updatedAt: new Date().toISOString() };
        return null;
    });
    return { provider, connected: true };
}
/* ------------------------------------------------------------------ *
 * Status
 * ------------------------------------------------------------------ */
export function publishingStatus(root) {
    const state = readState(root);
    const operations = Object.values(state.operations).filter(isPublishOperation)
        .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))
        .map(publicOperation);
    return {
        projects: Object.values(state.projects),
        bindings: Object.values(state.bindings),
        operations,
        auth: getGitHubAuthState(),
        login: getGitHubLogin(root).login,
    };
}
/** Read one publish operation, including its redacted terminal output. */
export function getPublishOperation(root, id) {
    const state = readState(root);
    const operation = state.operations[id];
    if (!operation)
        throw publishingError('OPERATION_NOT_FOUND', 'Publish operation was not found.');
    if (!isPublishOperation(operation))
        throw publishingError('OPERATION_NOT_FOUND', 'Publish operation was not found.');
    return publicOperation(operation);
}
/* ------------------------------------------------------------------ *
 * Repository setup (granular, no push)
 * ------------------------------------------------------------------ */
function remoteMatchesTarget(url, owner, name) {
    return new RegExp(`[/:]${owner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[/]${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.git$`, 'i')
        .test(String(url || ''))
        || new RegExp(`[/:]${owner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[/]${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
            .test(String(url || ''));
}
/**
 * Create or connect the publication's GitHub repository and point `origin`
 * at it, without pushing. Verifies publication ownership on the remote before
 * claiming it (DOCS/publishing.md — "Repository ownership").
 */
export async function setupPublishingRepository(options = {}) {
    const { root, notebookRoot = root, destination, repositoryMode: requestedRepositoryMode, owner: requestedOwner, name: requestedName, visibility = 'private', branch = 'main', } = options;
    const rootPath = rootString(root);
    const destinationPath = typeof destination === 'string' ? destination : undefined;
    const legacyMode = typeof options.mode === 'string' && ['create', 'connect'].includes(options.mode) ? options.mode : null;
    const mode = normalizeMode(legacyMode ? (options.publishMode ?? 'default') : (options.mode ?? 'default'));
    const repositoryMode = normalizeRepositoryMode(requestedRepositoryMode ?? legacyMode ?? options.repository ?? 'create');
    const owner = validRepositoryPart(requestedOwner, 'Owner');
    const name = validRepositoryPart(requestedName, 'Repository name');
    const normalizedVisibility = normalizeVisibility(visibility);
    const normalizedBranch = normalizeBranch(branch);
    const notebook = requireValidNotebook(rootString(notebookRoot));
    const state = readState(rootPath);
    const projectDir = mode === 'default'
        ? managedPublishDir(notebook.root)
        : path.resolve(destinationPath ?? (typeof readBinding(state, 'external')?.projectDir === 'string' ? readBinding(state, 'external')?.projectDir : ''));
    if (mode === 'external' && !destinationPath && typeof readBinding(state, 'external')?.projectDir !== 'string') {
        throw publishingError('INVALID_DESTINATION', 'External publishing requires a destination folder (or a previous binding).', null, 'Choose an empty destination folder, then retry.');
    }
    const repositoryRoot = resolveRepositoryRoot({ notebookRoot: notebook.root, mode, projectDir });
    await publishNotebookProject({ notebookRoot: notebook.root, destination: projectDir, mode });
    ensureRepository({ repositoryRoot, branch: normalizedBranch });
    ensureCommitIdentity(repositoryRoot);
    const target = `https://github.com/${owner}/${name}.git`;
    const current = remoteUrl({ repositoryRoot });
    if (current && !remoteMatchesTarget(current, owner, name)) {
        throw publishingError('ORIGIN_MISMATCH', `This publication's origin remote is already set to ${current}.`, current, 'Publish to that repository, or remove the origin remote manually, then retry.');
    }
    const account = ghAccount();
    const existing = viewRepository({ owner, name });
    if (repositoryMode === 'create' && existing) {
        throw publishingError('REPOSITORY_EXISTS', `Repository ${owner}/${name} already exists.`, null, 'Choose "connect" to verify and use the existing repository, then retry.');
    }
    let created = false;
    if (repositoryMode === 'create' && !existing) {
        createRepository({ owner, name, visibility: normalizedVisibility });
        created = true;
    }
    else if (repositoryMode === 'connect' && !existing) {
        throw publishingError('REPOSITORY_NOT_FOUND', `Repository ${owner}/${name} was not found.`, null, 'Create it first (or use repository mode "create"), then retry.');
    }
    if (!current) {
        runGit(repositoryRoot, ['remote', 'add', 'origin', target]);
    }
    fetchRemote({ repositoryRoot, remote: 'origin', branch: normalizedBranch });
    verifyRemoteOwnership({
        repositoryRoot,
        branch: normalizedBranch,
        relativePath: markerRelativePath(repositoryRoot),
        legacyRelativePath: legacyMarkerRelativePath(mode),
        notebook,
        existing,
        owner,
        name,
    });
    withState(rootPath, (stateToUpdate) => {
        saveBinding(stateToUpdate, mode, {
            projectDir,
            repository: { owner, name, branch: normalizedBranch, visibility: normalizedVisibility },
        });
        return null;
    });
    return {
        status: 'ready',
        created,
        repository: { owner, name, branch: normalizedBranch, visibility: normalizedVisibility },
        repositoryRoot,
        projectDir,
        origin: target,
        account,
    };
}
/* ------------------------------------------------------------------ *
 * Full deploy operation (generate → build → git → GitHub Pages)
 * ------------------------------------------------------------------ */
function installWorkflow({ repositoryRoot, mode, branch }) {
    const workflowPath = path.join(repositoryRoot, WORKFLOW_INSTALL_PATH);
    const contents = pagesWorkflowYaml({
        branch,
        distPath: mode === 'default' ? `${NOTEBOOK_PUBLISH_DIR}/dist` : 'dist',
        projectDir: mode === 'default' ? NOTEBOOK_PUBLISH_DIR : '.',
    });
    if (fs.existsSync(workflowPath)) {
        const previous = fs.readFileSync(workflowPath, 'utf8');
        const managed = previous.startsWith('# Hypercanvas publication deploy');
        if (previous !== contents && !managed) {
            throw publishingError('PAGES_WORKFLOW_CONFLICT', `Refusing to replace the existing workflow at ${WORKFLOW_INSTALL_PATH}.`, null, 'Rename the existing workflow or choose another repository, then retry.');
        }
        if (previous === contents)
            return workflowPath;
    }
    fs.mkdirSync(path.dirname(workflowPath), { recursive: true });
    fs.writeFileSync(workflowPath, contents);
    return workflowPath;
}
function ensureRequiredFilesStaged({ repositoryRoot, mode }) {
    // The publication source is committed; `dist/` is generated by the Pages
    // workflow itself and must never be required (or committed) here.
    const projectPrefix = mode === 'default' ? `${NOTEBOOK_PUBLISH_DIR}/` : '';
    const required = [
        `${projectPrefix}package.json`,
        `${projectPrefix}package-lock.json`,
        `${projectPrefix}${PUBLICATION_MARKER_FILE}`,
        WORKFLOW_INSTALL_PATH,
    ];
    const missing = [];
    for (const relative of required) {
        if (!stagedFileExists(repositoryRoot, relative))
            missing.push(relative);
    }
    if (missing.length) {
        throw publishingError('IGNORED_REQUIRED_FILES', `Required publication files are not staged (likely excluded by .gitignore): ${missing.join(', ')}.`, missing.join('\n'), 'Remove the ignore rules for these files, then retry.');
    }
}
function currentDeployContext(context) {
    if (!isRecord(context))
        throw publishingError('PUBLISHING_FAILED', 'Publishing workflow context is invalid.');
    return context;
}
function requiredValue(value, name) {
    if (value == null)
        throw publishingError('PUBLISHING_FAILED', `Publishing workflow is missing ${name}.`);
    return value;
}
function createDeployActions(context) {
    const { state, request, persist } = context;
    const { mode, destination, repositoryMode, owner, name, visibility, branch } = request;
    return {
        'validate-notebook': ({ context: rawContext }) => {
            const current = currentDeployContext(rawContext);
            current.notebook = requireValidNotebook(request.notebookRoot);
            return { root: current.notebook.root };
        },
        'resolve-local-repository': ({ context: rawContext }) => {
            const current = currentDeployContext(rawContext);
            const notebook = requiredValue(current.notebook, 'Notebook');
            current.projectDir = mode === 'default'
                ? managedPublishDir(notebook.root)
                : path.resolve(destination ?? (typeof readBinding(state, 'external')?.projectDir === 'string' ? readBinding(state, 'external')?.projectDir : ''));
            if (mode === 'external' && !destination && !readBinding(state, 'external')?.projectDir) {
                throw publishingError('INVALID_DESTINATION', 'External publishing requires a destination folder (or a previous binding).', null, 'Choose an empty destination folder, then retry.');
            }
            current.repositoryRoot = resolveRepositoryRoot({ notebookRoot: notebook.root, mode, projectDir: requiredValue(current.projectDir, 'project directory') });
            return current.repositoryRoot;
        },
        'generate-project': async ({ context: rawContext }) => {
            const current = currentDeployContext(rawContext);
            const notebook = requiredValue(current.notebook, 'Notebook');
            current.basePath = pagesBasePath(owner, name);
            const project = await materializeProject({ notebookRoot: notebook.root, destination: requiredValue(current.projectDir, 'project directory'), mode, basePath: current.basePath });
            current.frameWarnings = Array.isArray(project.warnings) ? project.warnings : [];
            saveBinding(state, mode, { projectDir: project.destination });
            return { projectDir: project.destination, pages: project.pages.length };
        },
        'build-project': async ({ context: rawContext }) => {
            const current = currentDeployContext(rawContext);
            const buildBasePath = current.basePath === './' ? undefined : current.basePath;
            current.build = await buildProject({ projectDir: requiredValue(current.projectDir, 'project directory'), ...(buildBasePath !== undefined ? { basePath: buildBasePath } : {}) });
            saveBinding(state, mode, { dist: current.build.dist });
            return { dist: current.build.dist };
        },
        'initialize-local-repository': ({ context: rawContext }) => {
            const current = currentDeployContext(rawContext);
            const repositoryRoot = requiredValue(current.repositoryRoot, 'repository root');
            ensureRepository({ repositoryRoot, branch });
            ensureCommitIdentity(repositoryRoot);
            return null;
        },
        'create-or-connect-remote': ({ context: rawContext }) => {
            const current = currentDeployContext(rawContext);
            const repositoryRoot = requiredValue(current.repositoryRoot, 'repository root');
            const target = `https://github.com/${owner}/${name}.git`;
            const origin = remoteUrl({ repositoryRoot });
            if (origin && !remoteMatchesTarget(origin, owner, name)) {
                throw publishingError('ORIGIN_MISMATCH', `This publication's origin remote is already set to ${origin}.`, origin, 'Publish to that repository, or remove the origin remote manually, then retry.');
            }
            current.account = ghAccount();
            const existing = viewRepository({ owner, name });
            let created = false;
            if (repositoryMode === 'create' && !existing) {
                createRepository({ owner, name, visibility });
                created = true;
            }
            if (repositoryMode === 'connect' && !existing) {
                throw publishingError('REPOSITORY_NOT_FOUND', `Repository ${owner}/${name} was not found.`, null, 'Create it first (or use repository mode "create"), then retry.');
            }
            if (!origin)
                runGit(repositoryRoot, ['remote', 'add', 'origin', target]);
            fetchRemote({ repositoryRoot, remote: 'origin', branch });
            current.remoteOwnership = verifyRemoteOwnership({
                repositoryRoot,
                branch,
                relativePath: markerRelativePath(repositoryRoot),
                legacyRelativePath: legacyMarkerRelativePath(mode),
                notebook: requiredValue(current.notebook, 'Notebook'),
                existing,
                owner,
                name,
            });
            current.deployedRepository = { owner, name, branch, visibility, created };
            saveBinding(state, mode, { repository: current.deployedRepository });
            return { account: current.account, ...current.deployedRepository };
        },
        'install-pages-workflow': ({ context: rawContext }) => {
            const current = currentDeployContext(rawContext);
            installWorkflow({ repositoryRoot: requiredValue(current.repositoryRoot, 'repository root'), mode, branch });
            return { workflow: WORKFLOW_INSTALL_PATH };
        },
        'stage-publication': ({ context: rawContext }) => {
            const current = currentDeployContext(rawContext);
            const repositoryRoot = requiredValue(current.repositoryRoot, 'repository root');
            stagePublication({ repositoryRoot });
            ensureRequiredFilesStaged({ repositoryRoot, mode });
            return null;
        },
        'reconcile-remote': ({ context: rawContext }) => {
            const current = currentDeployContext(rawContext);
            return reconcileAndRestore({ repositoryRoot: requiredValue(current.repositoryRoot, 'repository root'), branch });
        },
        'commit-publication': ({ context: rawContext, step }) => {
            const current = currentDeployContext(rawContext);
            return commitPublication({
                repositoryRoot: requiredValue(current.repositoryRoot, 'repository root'),
                message: typeof step.with?.message === 'string' ? step.with.message : 'Publish Hypercanvas Notebook site',
            });
        },
        'push-publication': ({ context: rawContext }) => {
            const current = currentDeployContext(rawContext);
            pushToRemote({ repositoryRoot: requiredValue(current.repositoryRoot, 'repository root'), branch });
            return null;
        },
        'configure-pages': ({ context: rawContext }) => {
            const current = currentDeployContext(rawContext);
            const binding = readBinding(state, mode);
            const before = getPages({ owner, name });
            current.shouldDispatchPagesWorkflow = Boolean(binding?.pendingPagesDispatch || !before);
            if (current.shouldDispatchPagesWorkflow && !binding?.pendingPagesDispatch) {
                saveBinding(state, mode, { pendingPagesDispatch: true });
                persist();
            }
            const pages = configurePagesSite({ owner, name });
            current.pages = { ...(pages.url ? { url: pages.url } : {}), configured: pages.configured };
            return { url: pages.url || pagesUrl({ owner, name }), configured: pages.configured };
        },
        'dispatch-pages-workflow': ({ context: rawContext }) => {
            const current = currentDeployContext(rawContext);
            if (!current.shouldDispatchPagesWorkflow) {
                current.workflowDispatch = { dispatched: false, reason: 'Pages is already enabled; the pushed commit triggers its workflow.' };
                return current.workflowDispatch;
            }
            const headSha = String(runGit(requiredValue(current.repositoryRoot, 'repository root'), ['rev-parse', 'HEAD']).output || '').trim();
            const latest = latestPagesWorkflowRun({ owner, name });
            if (headSha && latest?.headSha === headSha) {
                saveBinding(state, mode, { pendingPagesDispatch: false });
                persist();
                current.workflowDispatch = { dispatched: false, reason: 'A Pages workflow run already exists for this commit.' };
                return current.workflowDispatch;
            }
            current.workflowDispatch = dispatchPagesWorkflow({ owner, name, branch });
            saveBinding(state, mode, { pendingPagesDispatch: false });
            persist();
            return current.workflowDispatch;
        },
        'collect-publish-result': ({ context: rawContext, outputs }) => {
            const current = currentDeployContext(rawContext);
            const workflowRun = latestPagesWorkflowRun({ owner, name });
            return {
                repository: current.deployedRepository,
                repositoryRoot: current.repositoryRoot,
                projectDir: current.projectDir,
                dist: current.build?.dist || null,
                pagesUrl: current.pages?.url || pagesUrl({ owner, name }),
                repoUrl: `https://github.com/${owner}/${name}`,
                runUrl: workflowRun?.url || null,
                workflowDispatched: isRecord(outputs.dispatch) && outputs.dispatch.dispatched === true,
                warnings: current.frameWarnings,
            };
        },
    };
}
async function deployFlow({ root, state, request }) {
    const persist = () => writeState(root, state);
    const context = {
        root,
        state,
        request,
        persist,
        notebook: null,
        projectDir: null,
        repositoryRoot: null,
        frameWarnings: [],
        build: null,
        deployedRepository: null,
        pages: null,
        workflowDispatch: null,
    };
    return runOperation({
        state: state,
        kind: 'publish',
        request,
        persist,
        run: async (runStep) => {
            const workflow = await runWorkflow({
                definition: notebookPublishWorkflow,
                actions: createDeployActions(context),
                input: request,
                context,
                runStep,
            });
            return workflow.outputs.result || null;
        },
    });
}
function normalizeDeployRequest(request = {}) {
    const notebookRoot = rootString(request.notebookRoot);
    const mode = normalizeMode(request.mode ?? 'default');
    const repositoryMode = normalizeRepositoryMode(request.repositoryMode ?? request.repository ?? 'create');
    const owner = validRepositoryPart(request.owner, 'Owner');
    const name = validRepositoryPart(request.name, 'Repository name');
    const visibility = normalizeVisibility(request.visibility ?? 'private');
    const branch = normalizeBranch(request.branch ?? 'main');
    const destination = typeof request.destination === 'string' && request.destination ? path.resolve(request.destination) : undefined;
    if (mode === 'external' && !destination && !request.allowBinding) {
        // Destination may come from a recorded binding; checked during the flow.
    }
    return { ...request, notebookRoot, mode, repositoryMode, owner, name, visibility, branch, ...(destination !== undefined ? { destination } : {}) };
}
/**
 * The full publish operation: generate the portable project, build it
 * locally, commit through the correct repository, create/connect the GitHub
 * repository, configure the Actions-based Pages site, push safely, and link
 * the workflow run. Failures pause the recorded operation for retry.
 */
export function deployPublish(options = {}) {
    const root = rootString(options.root);
    const notebookRoot = rootString(options.notebookRoot);
    const { root: _root, notebookRoot: _notebookRoot, ...request } = options;
    if (!root)
        throw publishingError('PUBLISHING_FAILED', 'A publishing state root is required.');
    if (!notebookRoot)
        throw publishingError('PUBLISHING_FAILED', 'A Notebook root is required.');
    const normalized = normalizeDeployRequest({ ...request, notebookRoot });
    return withStateAsync(root, (state) => deployFlow({ root, state, request: normalized }));
}
/** Canonical Core API for publishing a Notebook to its configured host. */
export const publishNotebook = deployPublish;
/** Canonical Core API for reading all Notebook publishing state. */
export const getPublishStatus = publishingStatus;
/** Retry a paused or failed publish operation from its recorded request. */
export function retryPublishOperation({ root, operationId }) {
    return withStateAsync(root, (state) => retryOperation({
        state: state,
        operationId,
        rerun: async ({ state: rerunState, request }) => {
            if (!isRecord(request))
                throw publishingError('PUBLISHING_FAILED', 'The recorded publish request is invalid.');
            const normalized = normalizeDeployRequest(request);
            return deployFlow({ root, state: rerunState, request: normalized });
        },
    }));
}
/** Canonical Core API name; retained `retryPublishOperation` for compatibility. */
export const retryPublish = retryPublishOperation;
export const __test = {
    runtimePath, markerRelativePath, installWorkflow, ensureRequiredFilesStaged, pagesBasePath,
    normalizeDeployRequest, remoteMatchesTarget, verifyRemoteOwnership, deployFlow, redactOutput,
};
