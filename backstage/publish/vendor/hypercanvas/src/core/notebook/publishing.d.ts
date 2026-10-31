/**
 * Shared Notebook publish operations — the release publishing API.
 *
 * One portable, self-contained site project; two repository ownership modes
 * (Notebook root by default, a dedicated external repository otherwise); a
 * GitHub Pages deployment configured through the signed-in `gh` CLI that
 * deploys the committed local build without rebuilding; operation records with
 * structured steps, redacted output, and retry. See DOCS/publishing.md.
 */
import { inspectNotebook } from './notebook.js';
import { runtimePath } from './publishing/state.js';
import { materializeProject } from './publishing/generator.js';
import { redactOutput } from './publishing/operations.js';
import type { PublishOperation } from './publishing/operations.js';
import type { PublishingState } from './publishing/state.js';
type PublishMode = 'default' | 'external';
type RepositoryMode = 'create' | 'connect';
type Visibility = 'public' | 'private';
type ValidNotebook = Extract<ReturnType<typeof inspectNotebook>, {
    status: 'valid';
}>;
interface DeployRequest extends Record<string, unknown> {
    notebookRoot: string;
    mode: PublishMode;
    repositoryMode: RepositoryMode;
    owner: string;
    name: string;
    visibility: Visibility;
    branch: string;
    destination?: string;
}
declare function markerRelativePath(root: string): string;
/** Refuse to adopt a remote branch unless its publication marker proves ownership. */
declare function verifyRemoteOwnership({ repositoryRoot, branch, relativePath, legacyRelativePath, notebook, existing, owner, name }: {
    repositoryRoot: string;
    branch: string;
    relativePath: string;
    legacyRelativePath: string;
    notebook: ValidNotebook;
    existing: unknown;
    owner: string;
    name: string;
}): {
    verified: boolean;
    markerPath?: string;
};
declare function pagesBasePath(owner: unknown, name: unknown): string;
/**
 * Materialize a valid Notebook as its portable site project — without
 * modifying the Notebook. Default mode targets the Notebook's managed
 * publish project directory (`backstage/publish`); an external destination
 * must be an empty folder or a recognized publication of this Notebook.
 */
export declare function publishNotebookProject(options?: unknown): Promise<Awaited<ReturnType<typeof materializeProject>>>;
export declare const exportNotebookProject: typeof publishNotebookProject;
/**
 * Build the portable project locally: install its exact dependencies
 * (`npm ci`) and produce a committed-ready `dist/`. Building never removes
 * repository metadata or unrelated files.
 */
export declare function buildPublishSite(options?: unknown): Promise<Record<string, unknown>>;
/** Create an application-owned working copy used as the deployment project. */
export declare function preparePublish(options?: unknown): Promise<Record<string, unknown>>;
/** Credentials never enter generated projects and are only returned as presence metadata. */
export declare function savePublishingCredential(options?: unknown): {
    provider: string;
    connected: true;
};
export declare function publishingStatus(root: string): Record<string, unknown>;
/** Read one publish operation, including its redacted terminal output. */
export declare function getPublishOperation(root: string, id: string): PublishOperation;
declare function remoteMatchesTarget(url: unknown, owner: string, name: string): boolean;
/**
 * Create or connect the publication's GitHub repository and point `origin`
 * at it, without pushing. Verifies publication ownership on the remote before
 * claiming it (DOCS/publishing.md — "Repository ownership").
 */
export declare function setupPublishingRepository(options?: Record<string, unknown>): Promise<Record<string, unknown>>;
declare function installWorkflow({ repositoryRoot, mode, branch }: {
    repositoryRoot: string;
    mode: PublishMode;
    branch: string;
}): string;
declare function ensureRequiredFilesStaged({ repositoryRoot, mode }: {
    repositoryRoot: string;
    mode: PublishMode;
}): void;
declare function deployFlow({ root, state, request }: {
    root: string;
    state: PublishingState;
    request: DeployRequest;
}): Promise<PublishOperation>;
declare function normalizeDeployRequest(request?: Record<string, unknown>): DeployRequest;
/**
 * The full publish operation: generate the portable project, build it
 * locally, commit through the correct repository, create/connect the GitHub
 * repository, configure the Actions-based Pages site, push safely, and link
 * the workflow run. Failures pause the recorded operation for retry.
 */
export declare function deployPublish(options?: Record<string, unknown>): Promise<PublishOperation>;
/** Canonical Core API for publishing a Notebook to its configured host. */
export declare const publishNotebook: typeof deployPublish;
/** Canonical Core API for reading all Notebook publishing state. */
export declare const getPublishStatus: typeof publishingStatus;
/** Retry a paused or failed publish operation from its recorded request. */
export declare function retryPublishOperation({ root, operationId }: {
    root: string;
    operationId: string;
}): Promise<PublishOperation>;
/** Canonical Core API name; retained `retryPublishOperation` for compatibility. */
export declare const retryPublish: typeof retryPublishOperation;
export declare const __test: {
    runtimePath: typeof runtimePath;
    markerRelativePath: typeof markerRelativePath;
    installWorkflow: typeof installWorkflow;
    ensureRequiredFilesStaged: typeof ensureRequiredFilesStaged;
    pagesBasePath: typeof pagesBasePath;
    normalizeDeployRequest: typeof normalizeDeployRequest;
    remoteMatchesTarget: typeof remoteMatchesTarget;
    verifyRemoteOwnership: typeof verifyRemoteOwnership;
    deployFlow: typeof deployFlow;
    redactOutput: typeof redactOutput;
};
export {};
