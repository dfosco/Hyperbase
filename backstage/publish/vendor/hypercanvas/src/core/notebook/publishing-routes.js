import { buildPublishSite, getPublishOperation, publishNotebookProject, preparePublish, publishNotebook, publishingStatus, retryPublish, savePublishingCredential, setupPublishingRepository, } from './publishing.js';
import { cancelGitHubLogin, getGitHubAuthState, getGitHubLogin, recheckGitHub, startGitHubLogin } from './publishing/githubConnection.js';
import { requestGhCliRetry } from './publishing/ghExecutable.js';
const CLIENT_ERRORS = new Set([
    'INVALID_NOTEBOOK', 'INVALID_MODE', 'INVALID_DESTINATION',
    'DESTINATION_INSIDE_NOTEBOOK', 'DESTINATION_NOT_EMPTY',
    'DESTINATION_NOT_DIRECTORY', 'UNSUPPORTED_PROVIDER', 'INVALID_CREDENTIAL',
    'INVALID_REPOSITORY', 'INVALID_REPOSITORY_MODE', 'INVALID_VISIBILITY',
    'INVALID_BRANCH', 'OPERATION_NOT_FOUND', 'OPERATION_NOT_RETRYABLE',
    'GH_LOGIN_NOT_FOUND',
]);
const CONFLICT_ERRORS = new Set([
    'NOT_A_PUBLICATION', 'MARKER_MISMATCH', 'PARENT_REPOSITORY',
    'REMOTE_CONFLICT', 'REMOTE_NOT_PUBLICATION', 'ORIGIN_MISMATCH',
    'PAGES_SITE_CONFIGURED', 'REPOSITORY_EXISTS', 'REPOSITORY_NOT_FOUND',
    'PAGES_WORKFLOW_CONFLICT', 'DESTINATION_NOT_EMPTY',
    'GH_LOGIN_IN_PROGRESS', 'GH_LOGIN_STALE',
]);
const UNAVAILABLE_ERRORS = new Set([
    'GH_UNAVAILABLE', 'GH_NOT_AUTHENTICATED', 'GIT_UNAVAILABLE',
    'NPM_UNAVAILABLE', 'PAGES_REQUEST_FAILED',
    'GH_NETWORK_UNAVAILABLE', 'GH_PROVISIONING_UNSUPPORTED',
]);
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function failure(sendJson, res, error) {
    const details = isRecord(error) ? error : {};
    const code = details.code || 'PUBLISHING_FAILED';
    const status = CLIENT_ERRORS.has(code) ? 422 : CONFLICT_ERRORS.has(code) ? 409 : UNAVAILABLE_ERRORS.has(code) ? 503 : 500;
    return sendJson(res, status, {
        status: 'failed',
        finalStatus: 'error',
        output: [],
        error: {
            code,
            message: details.message || 'Publishing failed',
            detail: details.detail || null,
            hint: details.hint || null,
            actionable: Boolean(details.actionable),
        },
    });
}
/** HTTP API for the UI, CLI, agents, and user scripts. */
export function createPublishingHandler({ root, applicationRoot = root, getNotebookRoot = () => root, sendJson }) {
    return async function publishingHandler(_req, res, { body: untrustedBody = {}, path = '/', method }) {
        const body = isRecord(untrustedBody) ? untrustedBody : {};
        try {
            const pathname = (typeof path === 'string' ? path : '/').split('?', 1)[0] ?? '/';
            const notebookRoot = getNotebookRoot();
            const stateRoot = notebookRoot;
            if (method === 'GET' && pathname === '/status') {
                return sendJson(res, 200, publishingStatus(stateRoot));
            }
            // GitHub connection (gh CLI discovery, auth preflight, owned browser sign-in).
            if (method === 'GET' && pathname === '/github') {
                const { login, blocked } = getGitHubLogin(notebookRoot);
                return sendJson(res, 200, { auth: getGitHubAuthState(), login, blocked });
            }
            if (method === 'GET' && pathname === '/github/login') {
                return sendJson(res, 200, getGitHubLogin(notebookRoot));
            }
            if (method === 'POST' && pathname === '/github/login') {
                return sendJson(res, 200, startGitHubLogin({ notebookRoot }));
            }
            if (method === 'POST' && pathname === '/github/login/cancel') {
                return sendJson(res, 200, { login: cancelGitHubLogin({ notebookRoot, sessionId: body.sessionId }) });
            }
            if (method === 'POST' && pathname === '/github/recheck') {
                return sendJson(res, 200, { auth: recheckGitHub(), ...getGitHubLogin(notebookRoot) });
            }
            if (method === 'POST' && pathname === '/github/cli/retry') {
                return sendJson(res, 200, { cli: requestGhCliRetry() });
            }
            const operationMatch = pathname.match(/^\/operations\/([^/]+)$/);
            const operationId = operationMatch?.[1];
            if (method === 'GET' && operationId !== undefined) {
                return sendJson(res, 200, getPublishOperation(stateRoot, operationId));
            }
            if (method === 'POST' && (pathname === '/project' || pathname === '/materialize')) {
                const project = await publishNotebookProject({ notebookRoot, destination: body.destination, mode: body.mode });
                return sendJson(res, 200, project);
            }
            if (method === 'POST' && pathname === '/build') {
                return sendJson(res, 200, await buildPublishSite({ notebookRoot, destination: body.destination, mode: body.mode ?? 'default' }));
            }
            // Backward-compatible prepare endpoint. The release UI calls /publish
            // to run the complete operation instead.
            if (method === 'POST' && pathname === '/prepare') {
                return sendJson(res, 200, await preparePublish({ root: stateRoot, applicationRoot, ...body, notebookRoot }));
            }
            if (method === 'POST' && pathname === '/credentials') {
                return sendJson(res, 200, savePublishingCredential({ root: stateRoot, ...body }));
            }
            if (method === 'POST' && pathname === '/repository') {
                return sendJson(res, 200, await setupPublishingRepository({ root: stateRoot, notebookRoot, ...body }));
            }
            if (method === 'POST' && pathname === '/publish') {
                return sendJson(res, 200, await publishNotebook({
                    root: stateRoot,
                    notebookRoot,
                    ...body,
                }));
            }
            if (method === 'POST' && pathname === '/retry') {
                if (typeof body.operationId !== 'string' || !body.operationId) {
                    return sendJson(res, 422, { error: { code: 'INVALID_OPERATION_ID', message: 'An operation ID is required.' } });
                }
                return sendJson(res, 200, await retryPublish({ root: stateRoot, operationId: body.operationId }));
            }
            if (method === 'POST' && pathname === '/deploy') {
                // Old callers can still prepare a project and then deploy through the
                // release flow. They now need explicit repository coordinates.
                return sendJson(res, 200, await publishNotebook({ root: stateRoot, notebookRoot, ...body }));
            }
            return sendJson(res, 404, { error: { code: 'ROUTE_NOT_FOUND', message: `Unknown publishing route: ${method} ${pathname}` } });
        }
        catch (error) {
            return failure(sendJson, res, error);
        }
    };
}
