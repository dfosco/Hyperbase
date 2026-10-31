/**
 * Publishing store — the client controller for GitHub Pages publishing.
 *
 * One shared snapshot feeds the toolbar Publish control and the side panel so
 * both show the same connection, repository and operation state. Every action
 * calls an existing Core publishing route (/status, /repository, /publish,
 * /retry, /github/*). Capabilities that the Core service does not provide yet
 * are named in UNAVAILABLE_CAPABILITIES and rendered as explicit limits, never
 * as simulated successful operations. GitHub account connection uses the
 * /github routes: the real `gh` browser sign-in is owned by Core and mirrored
 * here as `login`.
 */
import { getFlag } from './featureFlags.js';
export const STATUS_POLL_MS = 1200;
export const UNAVAILABLE_CAPABILITIES = Object.freeze({
    sourcePush: 'Pushing source without publishing isn’t available yet. Publishing pushes the whole notebook and starts the website together.',
});
export const publishingEnabled = () => getFlag('notebook-publishing');
const FAILED_STATUSES = new Set(['failed', 'awaiting_retry']);
const ACTIVE_LOGIN_STATUSES = new Set(['starting', 'awaiting_browser', 'verifying']);
function asObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}
function messageOf(value, fallback) {
    return typeof value === 'string' && value ? value : fallback;
}
function nullableString(value) {
    return typeof value === 'string' ? value : null;
}
/** Core publishing request. Errors carry the Core `code`, `message` and `hint`. */
export async function requestPublishing(path, { body, method = 'POST', fetchImpl } = {}) {
    const base = import.meta.env?.BASE_URL ?? '/';
    const doFetch = fetchImpl ?? ((...args) => globalThis.fetch(...args));
    const response = await doFetch(`${base}_hypercanvas/publishing${path}`, {
        method,
        ...(method === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) } : {}),
    });
    const data = asObject(await response.json().catch(() => ({})));
    if (!response.ok) {
        const error = asObject(data.error);
        throw Object.assign(new Error(messageOf(error.message, `Publishing request failed (HTTP ${response.status}).`)), error);
    }
    return data;
}
/**
 * Derive the single GitHub Pages view model from the store snapshot.
 *
 * Phases: loading | unavailable | connecting | signin | running | failed |
 * repository | ready | published. `unavailable` covers a missing, installing or
 * failed GitHub CLI (`cli` says which); `connecting` is an active browser
 * sign-in (`login` carries the real code); `signin` also covers an
 * authenticated account that still needs a permission (`needsPermission`).
 * `repository` is the bound `{ owner, name, visibility, branch }` from the
 * default-mode binding, or null before setup.
 */
export function deriveGitHubPublishingView(snapshot) {
    const { auth = null, bindings = [], operation = null, error = null, busy = null, login = null } = snapshot;
    const binding = bindings.find(item => item?.mode === 'default' && item.repository) || null;
    const repository = binding?.repository ?? null;
    const needsPermission = Boolean(auth?.authenticated && auth.missingScopes?.length);
    const base = {
        phase: 'loading',
        repository,
        account: auth?.account ?? null,
        operation,
        error,
        busy,
        hint: null,
        login,
        cli: auth?.cli ?? null,
        needsPermission,
        offline: Boolean(auth?.offline),
    };
    if (login && ACTIVE_LOGIN_STATUSES.has(login.status))
        return { ...base, phase: 'connecting' };
    if (!auth)
        return { ...base, phase: 'loading' };
    if (!auth.available)
        return { ...base, phase: 'unavailable', hint: auth.hint || 'GitHub CLI isn’t available on this computer.' };
    if (!auth.authenticated || needsPermission)
        return { ...base, phase: 'signin', hint: auth.hint || 'Connect GitHub to publish this notebook.' };
    if (operation?.status === 'running')
        return { ...base, phase: 'running' };
    if (operation && FAILED_STATUSES.has(operation.status))
        return { ...base, phase: 'failed' };
    if (!repository)
        return { ...base, phase: 'repository' };
    if (operation?.status === 'succeeded')
        return { ...base, phase: 'published' };
    return { ...base, phase: 'ready' };
}
// ---------------------------------------------------------------------------
// Snapshot and subscriptions
// ---------------------------------------------------------------------------
const listeners = new Set();
let snapshot = { auth: null, bindings: [], operation: null, error: null, busy: null, login: null };
let retainCount = 0;
let pollTimer = null;
let inFlightRefresh = null;
function setSnapshot(patch) {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach(listener => listener(snapshot));
}
export function getPublishingSnapshot() {
    return snapshot;
}
export function subscribePublishing(listener) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
/**
 * Reload /status. Concurrent callers share one request; disabled publishing
 * never fetches. `fresh` is for reads after a mutation: a request already in
 * flight may predate the mutation, so it is awaited and then repeated.
 */
export function refreshPublishing({ fresh = false } = {}) {
    if (!publishingEnabled())
        return Promise.resolve(snapshot);
    if (inFlightRefresh && fresh)
        return inFlightRefresh.then(() => refreshPublishing());
    if (inFlightRefresh)
        return inFlightRefresh;
    inFlightRefresh = requestPublishing('/status', { method: 'GET' })
        .then((status) => {
        // The server lists publish operations newest first.
        const operations = Array.isArray(status.operations) ? status.operations : [];
        setSnapshot({
            auth: (status.auth ?? null),
            bindings: Array.isArray(status.bindings) ? status.bindings : [],
            operation: operations[0] ?? null,
            login: (status.login ?? null),
            error: null,
        });
        return snapshot;
    })
        .catch((failure) => {
        const details = asObject(failure);
        setSnapshot({ error: { message: messageOf(details.message, 'Publishing request failed'), hint: nullableString(details.hint) } });
        return snapshot;
    })
        .finally(() => { inFlightRefresh = null; });
    return inFlightRefresh;
}
/**
 * Keep status polling while at least one visible surface needs it. The first
 * retainer starts one poll loop; the last release stops it.
 */
export function retainPublishing() {
    retainCount += 1;
    if (retainCount === 1) {
        void refreshPublishing();
        pollTimer = setInterval(() => {
            if (publishingEnabled())
                void refreshPublishing();
        }, STATUS_POLL_MS);
    }
    let released = false;
    return () => {
        if (released)
            return;
        released = true;
        retainCount = Math.max(0, retainCount - 1);
        if (retainCount === 0 && pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    };
}
async function runAction(kind, action) {
    setSnapshot({ busy: kind, error: null });
    try {
        await action();
        return true;
    }
    catch (failure) {
        const details = asObject(failure);
        setSnapshot({ error: { message: messageOf(details.message, 'Publishing failed'), hint: nullableString(details.hint), code: nullableString(details.code) } });
        return false;
    }
    finally {
        setSnapshot({ busy: null });
    }
}
function defaultRepository() {
    return snapshot.bindings.find(item => item?.mode === 'default' && item.repository)?.repository ?? null;
}
// ---------------------------------------------------------------------------
// Actions — each one calls an existing Core route and reads status back.
// ---------------------------------------------------------------------------
/** Apply a login snapshot unless the server already moved on to a different session. */
function applyLogin(login) {
    const current = snapshot.login;
    if (login && current && current.id !== login.id && ACTIVE_LOGIN_STATUSES.has(current.status))
        return;
    setSnapshot({ login: login ?? null });
}
function operationFrom(result) {
    return { ...result, status: messageOf(result.status, 'unknown') };
}
function loginFrom(result) {
    const login = asObject(result.login);
    return typeof login.id === 'string' ? login : null;
}
/**
 * Connect GitHub: reuse the signed-in `gh` account, or start the owned browser
 * sign-in. A second call while a sign-in is active joins it instead of starting another.
 */
export function connectGitHub() {
    if (snapshot.login && ACTIVE_LOGIN_STATUSES.has(snapshot.login.status))
        return Promise.resolve(true);
    return runAction('connect', async () => {
        const result = await requestPublishing('/github/login');
        applyLogin(loginFrom(result));
        await refreshPublishing({ fresh: true });
    });
}
/** Cancel the active sign-in. A stale session id is rejected by Core and the state is reloaded. */
export function cancelGitHubConnection() {
    const login = snapshot.login;
    if (!login || !ACTIVE_LOGIN_STATUSES.has(login.status))
        return Promise.resolve(false);
    return runAction('cancel-connect', async () => {
        try {
            const result = await requestPublishing('/github/login/cancel', { body: { sessionId: login.id } });
            applyLogin(loginFrom(result));
        }
        finally {
            await refreshPublishing({ fresh: true });
        }
    });
}
/** Drop cached GitHub state and check again (after installing gh, changing accounts, or going online). */
export function recheckGitHubConnection() {
    return runAction('recheck', async () => {
        await requestPublishing('/github/recheck');
        await refreshPublishing({ fresh: true });
    });
}
/** Ask the desktop app to retry setting up the GitHub CLI after a failed or interrupted setup. */
export function retryGitHubCliSetup() {
    return runAction('cli-retry', async () => {
        await requestPublishing('/github/cli/retry');
        await refreshPublishing({ fresh: true });
    });
}
/** Create or connect the notebook's GitHub repository. Does not push. */
export function connectPublishingRepository({ repositoryMode, owner, name, visibility }) {
    return runAction('repository', async () => {
        await requestPublishing('/repository', {
            body: {
                mode: 'default',
                repositoryMode,
                owner,
                name,
                ...(repositoryMode === 'create' ? { visibility } : {}),
            },
        });
        await refreshPublishing();
    });
}
/** Push the whole notebook and configure GitHub Pages for the bound repository. */
export function publishWebsite() {
    const repository = defaultRepository();
    if (!repository) {
        setSnapshot({ error: { message: 'Connect a GitHub repository before publishing.', hint: null } });
        return Promise.resolve(false);
    }
    return runAction('publish', async () => {
        const operation = await requestPublishing('/publish', {
            body: {
                mode: 'default',
                repositoryMode: 'connect',
                owner: repository.owner,
                name: repository.name,
                visibility: repository.visibility,
                branch: repository.branch,
            },
        });
        setSnapshot({ operation: operationFrom(operation) });
        await refreshPublishing();
    });
}
/** Resume a paused or failed publish operation from its recorded request. */
export function retryPublishingOperation(operationId) {
    return runAction('retry', async () => {
        const operation = await requestPublishing('/retry', { body: { operationId } });
        setSnapshot({ operation: operationFrom(operation) });
        await refreshPublishing();
    });
}
/** Test helper: restore the initial snapshot and drop listeners and timers. */
export function _resetPublishingStore() {
    if (pollTimer)
        clearInterval(pollTimer);
    pollTimer = null;
    retainCount = 0;
    inFlightRefresh = null;
    listeners.clear();
    snapshot = { auth: null, bindings: [], operation: null, error: null, busy: null, login: null };
}
