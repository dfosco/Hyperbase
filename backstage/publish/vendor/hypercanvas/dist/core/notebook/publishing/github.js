/**
 * GitHub integration through the signed-in `gh` CLI.
 *
 * Publishing never handles GitHub tokens itself: every operation runs through
 * the user's `gh` authentication. Repository creation and connection, Pages
 * configuration, and workflow dispatch all use documented `gh` commands (see
 * DOCS/publishing.md — "Deployment pipeline").
 */
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { publishingError } from './errors.js';
import { recordOperationOutput } from './operations.js';
import { resolveGhExecutable } from './ghExecutable.js';
export const PAGES_WORKFLOW_FILE = 'deploy-pages.yml';
export const WORKFLOW_INSTALL_PATH = '.github/workflows/deploy-pages.yml';
/** Bound every synchronous gh call so a hung network cannot freeze Core. */
export const GH_COMMAND_TIMEOUT_MS = 60_000;
/** Environment for gh child processes: never prompt, never color, no update nags. */
export function ghProcessEnv(overrides = {}) {
    return { ...process.env, GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1', NO_COLOR: '1', ...overrides };
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function field(value, key) {
    return isRecord(value) ? value[key] : undefined;
}
function outputOf(error) {
    return [field(error, 'stdout'), field(error, 'stderr')]
        .filter((value) => typeof value === 'string' && value.length > 0)
        .join('\n').trim();
}
function ghUnavailable(error) {
    return field(error, 'code') === 'ENOENT';
}
function runGh(args, { cwd } = {}) {
    const mutating = (args[0] === 'repo' && args[1] === 'create')
        || (args[0] === 'api' && args.includes('--method'))
        || (args[0] === 'workflow' && args[1] === 'run');
    const label = `$ gh ${args.slice(0, 2).join(' ')}`;
    try {
        const output = execFileSync(resolveGhExecutable(), args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: GH_COMMAND_TIMEOUT_MS, env: ghProcessEnv() });
        if (mutating)
            recordOperationOutput(label, output);
        return output;
    }
    catch (error) {
        if (mutating)
            recordOperationOutput(label, outputOf(error) || 'Command failed without output.');
        throw error;
    }
}
function ghAuthError(detail) {
    return publishingError('GH_NOT_AUTHENTICATED', 'GitHub authentication is required. Sign in with gh, then retry.', detail, 'Connect GitHub from Publish, or run: gh auth login');
}
/** Signed-in `gh` account login, or an actionable authentication error. */
export function ghAccount() {
    let raw;
    try {
        raw = runGh(['api', 'user', '--jq', '.login']);
    }
    catch (error) {
        if (ghUnavailable(error)) {
            throw publishingError('GH_UNAVAILABLE', 'The GitHub CLI (gh) is unavailable.', null, 'Install gh: https://cli.github.com/ then run gh auth login');
        }
        if (/auth|login|credential|401/i.test(outputOf(error)))
            throw ghAuthError(outputOf(error));
        throw publishingError('GH_NOT_AUTHENTICATED', 'GitHub authentication is required. Sign in with gh, then retry.', outputOf(error), 'Connect GitHub from Publish, or run: gh auth login');
    }
    const login = String(raw ?? '').trim();
    if (!login)
        throw ghAuthError(null);
    return login;
}
/** Repository view (or null when not found). */
export function viewRepository({ owner, name }) {
    try {
        const raw = runGh(['repo', 'view', `${owner}/${name}`, '--json', 'nameWithOwner,visibility,defaultBranchRef']);
        const parsed = JSON.parse(String(raw));
        if (!isRecord(parsed))
            throw new Error('GitHub returned an invalid repository response.');
        const data = parsed;
        return {
            nameWithOwner: String(data.nameWithOwner),
            visibility: data.visibility,
            defaultBranch: typeof field(data.defaultBranchRef, 'name') === 'string' ? String(field(data.defaultBranchRef, 'name')) : 'main',
        };
    }
    catch (error) {
        if (/not found|could not resolve|404/i.test(outputOf(error)))
            return null;
        if (ghUnavailable(error)) {
            throw publishingError('GH_UNAVAILABLE', 'The GitHub CLI (gh) is unavailable.', null, 'Install gh: https://cli.github.com/ then run gh auth login');
        }
        if (/auth|login|credential|401/i.test(outputOf(error)))
            throw ghAuthError(outputOf(error));
        throw publishingError('REPOSITORY_UNAVAILABLE', `Could not inspect ${owner}/${name}.`, outputOf(error));
    }
}
/** Create a repository (personal or organization, when permission allows). */
export function createRepository({ owner, name, visibility = 'private' }) {
    try {
        runGh(['repo', 'create', `${owner}/${name}`, `--${visibility}`]);
        return { created: true, nameWithOwner: `${owner}/${name}` };
    }
    catch (error) {
        const output = outputOf(error);
        if (/already exists|name already exists|422/i.test(output)) {
            throw publishingError('REPOSITORY_EXISTS', `Repository ${owner}/${name} already exists.`, output, 'Connect to it instead of creating it, then retry.');
        }
        if (/must be an organization|admin permission|not a member|403/i.test(output)) {
            throw publishingError('REPOSITORY_UNAVAILABLE', `Cannot create ${owner}/${name} with the current gh account.`, output, 'Create the repository on GitHub, then connect to it.');
        }
        if (ghUnavailable(error)) {
            throw publishingError('GH_UNAVAILABLE', 'The GitHub CLI (gh) is unavailable.', null, 'Install gh: https://cli.github.com/ then run gh auth login');
        }
        if (/auth|login|credential|401/i.test(output))
            throw ghAuthError(output);
        throw publishingError('REPOSITORY_UNAVAILABLE', `Could not create ${owner}/${name}.`, output);
    }
}
/** Pages site configuration (or null when Pages is not enabled). */
export function getPages({ owner, name }) {
    try {
        const raw = runGh(['api', `repos/${owner}/${name}/pages`]);
        const parsed = JSON.parse(String(raw));
        if (!isRecord(parsed))
            throw new Error('GitHub returned invalid Pages settings.');
        const data = parsed;
        return {
            url: typeof data.html_url === 'string' ? data.html_url : null,
            buildType: typeof data.build_type === 'string' ? data.build_type : null,
            source: data.source || null,
        };
    }
    catch (error) {
        const output = outputOf(error);
        if (/404|not found/i.test(output))
            return null;
        if (ghUnavailable(error)) {
            throw publishingError('GH_UNAVAILABLE', 'The GitHub CLI (gh) is unavailable.', null, 'Install gh: https://cli.github.com/ then run gh auth login');
        }
        if (/auth|login|credential|401/i.test(output))
            throw ghAuthError(output);
        throw publishingError('PAGES_REQUEST_FAILED', `Could not read Pages settings for ${owner}/${name}.`, output);
    }
}
/**
 * Configure an Actions-based Pages site. A pre-existing Pages site with a
 * different build type is refused — publishing never silently takes over an
 * unrelated Pages deployment (DOCS/publishing.md — "Repository ownership").
 */
export function configurePagesSite({ owner, name }) {
    const existing = getPages({ owner, name });
    if (existing) {
        if (existing.buildType === 'workflow')
            return { configured: false, existing: true, url: existing.url };
        throw publishingError('PAGES_SITE_CONFIGURED', `GitHub Pages is already configured for ${owner}/${name} with build type "${existing.buildType}".`, JSON.stringify(existing), 'Change the Pages build type to "GitHub Actions" in the repository settings, or publish to another repository, then retry.');
    }
    try {
        const raw = runGh(['api', '--method', 'POST', `repos/${owner}/${name}/pages`, '-f', 'build_type=workflow']);
        const parsed = JSON.parse(String(raw || '{}'));
        const data = isRecord(parsed) ? parsed : {};
        return { configured: true, existing: false, url: typeof data.html_url === 'string' ? data.html_url : null };
    }
    catch (error) {
        const output = outputOf(error);
        if (ghUnavailable(error)) {
            throw publishingError('GH_UNAVAILABLE', 'The GitHub CLI (gh) is unavailable.', null, 'Install gh: https://cli.github.com/ then run gh auth login');
        }
        if (/auth|login|credential|401/i.test(output))
            throw ghAuthError(output);
        throw publishingError('PAGES_REQUEST_FAILED', `Could not configure GitHub Pages for ${owner}/${name}.`, output);
    }
}
/** Dispatch the Pages workflow (first-push ordering safety net). */
export function dispatchPagesWorkflow({ owner, name, branch, workflowFile = PAGES_WORKFLOW_FILE }) {
    try {
        runGh(['workflow', 'run', workflowFile, '--repo', `${owner}/${name}`, '--ref', branch]);
        return { dispatched: true };
    }
    catch (error) {
        const output = outputOf(error);
        if (/could not find|no workflow|404/i.test(output)) {
            throw publishingError('WORKFLOW_DISPATCH_FAILED', `The ${workflowFile} workflow was not found on ${branch}.`, output, 'Push the workflow file, then retry.');
        }
        throw publishingError('WORKFLOW_DISPATCH_FAILED', `Could not dispatch ${workflowFile} on ${owner}/${name}.`, output);
    }
}
/** Latest workflow run URL for the Pages workflow (or null). */
export function latestPagesWorkflowRun({ owner, name, workflowFile = PAGES_WORKFLOW_FILE }) {
    try {
        const raw = runGh(['run', 'list', '--repo', `${owner}/${name}`, `--workflow=${workflowFile}`, '--limit', '1', '--json', 'url,status,conclusion,headSha,event']);
        const runs = JSON.parse(String(raw));
        const run = Array.isArray(runs) ? runs[0] : null;
        if (!isRecord(run))
            return null;
        return { url: run.url, status: run.status, conclusion: run.conclusion, headSha: run.headSha || null, event: run.event || null };
    }
    catch {
        return null;
    }
}
/**
 * The deploy-pages workflow. GitHub Actions installs the publication's exact
 * dependencies (`npm ci`) and builds `dist/` before uploading it — the
 * publication source is committed, never its build output (see
 * DOCS/publishing.md). `distPath` is `publish/dist` in default mode and
 * `dist` in external mode; `projectDir` is `publish` in default mode and
 * `.` in external mode.
 */
export function pagesWorkflowYaml({ branch = 'main', distPath = 'dist', projectDir = '.' } = {}) {
    const inProject = (command) => projectDir === '.'
        ? `      - run: ${command}`
        : `      - run: ${command}\n        working-directory: ${projectDir}`;
    return [
        '# Hypercanvas publication deploy — installs and builds the committed publication source, then deploys.',
        `# Build output: ${distPath} (generated here, not committed; see DOCS/publishing.md).`,
        `name: Deploy published site to GitHub Pages`,
        '',
        'on:',
        `  push:`,
        `    branches: [${branch}]`,
        '  workflow_dispatch:',
        '',
        'permissions:',
        '  contents: read',
        '  pages: write',
        '  id-token: write',
        '',
        'concurrency:',
        '  group: pages',
        '  cancel-in-progress: false',
        '',
        'jobs:',
        '  deploy:',
        '    environment:',
        '      name: github-pages',
        `      url: \${{ steps.deployment.outputs.page_url }}`,
        '    runs-on: ubuntu-latest',
        '    steps:',
        '      - uses: actions/checkout@v4',
        '      - uses: actions/setup-node@v4',
        '        with:',
        '          node-version: 22',
        '          cache: npm',
        `          cache-dependency-path: ${projectDir === '.' ? 'package-lock.json' : `${projectDir}/package-lock.json`}`,
        '          registry-url: https://registry.npmjs.org',
        inProject('npm ci'),
        inProject('npm run build'),
        '      - uses: actions/configure-pages@v5',
        '      - uses: actions/upload-pages-artifact@v3',
        '        with:',
        `          path: ${distPath}`,
        '      - id: deployment',
        '        uses: actions/deploy-pages@v4',
        '',
    ].join('\n');
}
/** Canonical GitHub Pages URL for a repository. */
export function pagesUrl({ owner, name }) {
    const ownerHost = `${owner.toLowerCase()}.github.io`;
    if (name.toLowerCase() === ownerHost)
        return `https://${ownerHost}/`;
    return `https://${ownerHost}/${name}/`;
}
export const __test = { runGh };
export { runGh as runGhCommand, outputOf as ghOutputOf, ghUnavailable };
