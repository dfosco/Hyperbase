/**
 * GitHub integration through the signed-in `gh` CLI.
 *
 * Publishing never handles GitHub tokens itself: every operation runs through
 * the user's `gh` authentication. Repository creation and connection, Pages
 * configuration, and workflow dispatch all use documented `gh` commands (see
 * DOCS/publishing.md — "Deployment pipeline").
 */
export declare const PAGES_WORKFLOW_FILE = "deploy-pages.yml";
export declare const WORKFLOW_INSTALL_PATH = ".github/workflows/deploy-pages.yml";
/** Bound every synchronous gh call so a hung network cannot freeze Core. */
export declare const GH_COMMAND_TIMEOUT_MS = 60000;
/** Environment for gh child processes: never prompt, never color, no update nags. */
export declare function ghProcessEnv(overrides?: Record<string, string>): NodeJS.ProcessEnv;
type GhOptions = {
    cwd?: string;
};
type RepositoryRef = {
    owner: string;
    name: string;
};
declare function outputOf(error: unknown): string;
declare function ghUnavailable(error: unknown): boolean;
declare function runGh(args: string[], { cwd }?: GhOptions): string;
/** Signed-in `gh` account login, or an actionable authentication error. */
export declare function ghAccount(): string;
/** Repository view (or null when not found). */
export declare function viewRepository({ owner, name }: RepositoryRef): {
    nameWithOwner: string;
    visibility: unknown;
    defaultBranch: string;
} | null;
/** Create a repository (personal or organization, when permission allows). */
export declare function createRepository({ owner, name, visibility }: RepositoryRef & {
    visibility?: 'private' | 'public' | 'internal';
}): {
    created: true;
    nameWithOwner: string;
};
/** Pages site configuration (or null when Pages is not enabled). */
export declare function getPages({ owner, name }: RepositoryRef): {
    url: string | null;
    buildType: string | null;
    source: unknown;
} | null;
/**
 * Configure an Actions-based Pages site. A pre-existing Pages site with a
 * different build type is refused — publishing never silently takes over an
 * unrelated Pages deployment (DOCS/publishing.md — "Repository ownership").
 */
export declare function configurePagesSite({ owner, name }: RepositoryRef): {
    configured: boolean;
    existing: boolean;
    url: string | null;
};
/** Dispatch the Pages workflow (first-push ordering safety net). */
export declare function dispatchPagesWorkflow({ owner, name, branch, workflowFile }: RepositoryRef & {
    branch: string;
    workflowFile?: string;
}): {
    dispatched: true;
};
/** Latest workflow run URL for the Pages workflow (or null). */
export declare function latestPagesWorkflowRun({ owner, name, workflowFile }: RepositoryRef & {
    workflowFile?: string;
}): {
    url: unknown;
    status: unknown;
    conclusion: unknown;
    headSha: unknown;
    event: unknown;
} | null;
/**
 * The deploy-pages workflow. GitHub Actions installs the publication's exact
 * dependencies (`npm ci`) and builds `dist/` before uploading it — the
 * publication source is committed, never its build output (see
 * DOCS/publishing.md). `distPath` is `publish/dist` in default mode and
 * `dist` in external mode; `projectDir` is `publish` in default mode and
 * `.` in external mode.
 */
export declare function pagesWorkflowYaml({ branch, distPath, projectDir }?: {
    branch?: string;
    distPath?: string;
    projectDir?: string;
}): string;
/** Canonical GitHub Pages URL for a repository. */
export declare function pagesUrl({ owner, name }: RepositoryRef): string;
export declare const __test: {
    runGh: typeof runGh;
};
export { runGh as runGhCommand, outputOf as ghOutputOf, ghUnavailable };
