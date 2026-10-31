import { invoke, isTauriAvailable } from './tauri-bridge.js';
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function browserWindow() {
    return typeof window === 'undefined' ? null : window;
}
function desktopRuntimeBridge() {
    const bridge = browserWindow()?.mygo;
    if (!bridge || typeof bridge.call !== 'function' || typeof bridge.on !== 'function') {
        throw new Error('The Hypercanvas desktop runtime bridge is unavailable.');
    }
    return bridge;
}
/** Read the current MyGo-owned desktop lifecycle snapshot. */
export function getDesktopRuntimeSnapshot() {
    return desktopRuntimeBridge().call('Bootstrap.RuntimeState');
}
/** Subscribe to ordered full snapshots. Dispose the listener when its document unmounts. */
export function subscribeDesktopRuntimeState(listener) {
    return desktopRuntimeBridge().on('desktop-runtime-state', listener);
}
/** Keep whichever complete snapshot has the newest Go-owned sequence. */
export function reconcileDesktopRuntimeSnapshot(current, incoming) {
    if (incoming.schemaVersion !== 1 || !Number.isSafeInteger(incoming.sequence) || incoming.sequence < 1) {
        throw new TypeError('Invalid desktop runtime snapshot version or sequence.');
    }
    if (!Array.isArray(incoming.actions) || incoming.actions.some(action => !diagnosticRecoveryActions.has(action))) {
        throw new TypeError('Invalid desktop runtime snapshot action.');
    }
    if (current && current.schemaVersion === 1 && incoming.sequence <= current.sequence)
        return current;
    return incoming;
}
const diagnosticRecoveryActions = new Set([
    'retry-core', 'reload-page', 'restart-app', 'open-diagnostics',
]);
const executableRecoveryActions = new Set(['retry-core', 'reload-page']);
/** Ask MyGo to authorize one action against the exact snapshot rendered by the caller. */
export function requestDesktopRecoveryAction(request) {
    const bridge = desktopRuntimeBridge();
    if (!request || !executableRecoveryActions.has(request.action)) {
        throw new TypeError('Desktop recovery action is not executable.');
    }
    return bridge.call('Bootstrap.RequestRecoveryAction', request);
}
/** Acknowledge a mounted Core context against the exact snapshot it observed. */
export function confirmDesktopFrontendReady(request) {
    return desktopRuntimeBridge().call('Bootstrap.ConfirmFrontendReady', request);
}
/** Observational only: this never changes runtime state or grants process actions. */
export function reportDesktopModuleRecovery(decision) {
    return desktopRuntimeBridge().call('Bootstrap.ReportModuleRecovery', { decision });
}
function isDesktopAppearanceSnapshot(value) {
    return isRecord(value)
        && value.schemaVersion === 1
        && Number.isSafeInteger(value.sequence)
        && Number(value.sequence) >= 0
        && (value.mode === 'system' || value.mode === 'light' || value.mode === 'dark')
        && (value.resolved === 'light' || value.resolved === 'dark');
}
/** Read the Go-owned persisted global appearance preference. */
export async function getDesktopAppearance() {
    const snapshot = await desktopRuntimeBridge().call('Bootstrap.GetDesktopAppearance');
    if (!isDesktopAppearanceSnapshot(snapshot))
        throw new TypeError('Invalid desktop appearance snapshot.');
    return snapshot;
}
/** Persist a user-selected global appearance through the existing MyGo RPC. */
export async function setDesktopAppearanceMode(mode) {
    if (mode !== 'system' && mode !== 'light' && mode !== 'dark') {
        throw new TypeError('Desktop appearance mode must be system, light, or dark.');
    }
    const snapshot = await desktopRuntimeBridge().call('Bootstrap.SetDesktopAppearanceMode', { mode });
    if (!isDesktopAppearanceSnapshot(snapshot))
        throw new TypeError('Invalid desktop appearance snapshot.');
    return snapshot;
}
/** Subscribe to full Go appearance snapshots and ignore malformed or stale events. */
export function subscribeDesktopAppearance(listener) {
    let latestSequence = -1;
    return desktopRuntimeBridge().on('desktop-appearance-state', incoming => {
        if (!isDesktopAppearanceSnapshot(incoming) || incoming.sequence <= latestSequence)
            return;
        latestSequence = incoming.sequence;
        listener(incoming);
    });
}
function isDesktopLifecycleLoggingPreferenceSnapshot(value) {
    return isRecord(value)
        && value.schemaVersion === 1
        && Number.isSafeInteger(value.sequence)
        && Number(value.sequence) > 0
        && typeof value.enabled === 'boolean'
        && typeof value.defaultEnabled === 'boolean'
        && (value.channel === 'dev' || value.channel === 'beta' || value.channel === 'prod' || value.channel === 'unknown')
        && (value.source === 'default' || value.source === 'user')
        && typeof value.available === 'boolean'
        && typeof value.sessionAvailable === 'boolean'
        && (value.sessionError === undefined || typeof value.sessionError === 'string')
        && (value.error === undefined || typeof value.error === 'string');
}
/** Read the Go-owned lifecycle logging preference; never infer a local default. */
export async function getDesktopLifecycleLoggingPreference() {
    const snapshot = await desktopRuntimeBridge()
        .call('Bootstrap.GetDesktopLifecycleLoggingPreference');
    if (!isDesktopLifecycleLoggingPreferenceSnapshot(snapshot)) {
        throw new TypeError('Invalid desktop lifecycle logging preference snapshot.');
    }
    return snapshot;
}
/** Persist an explicit logging preference through the existing MyGo RPC. */
export async function setDesktopLifecycleLoggingPreference(request) {
    if (!request || typeof request.enabled !== 'boolean') {
        throw new TypeError('Desktop lifecycle logging preference requires an enabled boolean.');
    }
    const snapshot = await desktopRuntimeBridge().call('Bootstrap.SetDesktopLifecycleLoggingPreference', request);
    if (!isDesktopLifecycleLoggingPreferenceSnapshot(snapshot)) {
        throw new TypeError('Invalid desktop lifecycle logging preference snapshot.');
    }
    return snapshot;
}
/** Subscribe to Go-owned logging preference snapshots without a browser fallback. */
export function subscribeDesktopLifecycleLoggingPreference(listener) {
    let latestSequence = 0;
    return desktopRuntimeBridge().on('desktop-lifecycle-logging-preference', incoming => {
        if (!isDesktopLifecycleLoggingPreferenceSnapshot(incoming) || incoming.sequence <= latestSequence)
            return;
        latestSequence = incoming.sequence;
        listener(incoming);
    });
}
export const ISSUE_LOG_FEEDBACK_REPOSITORY = 'dfosco/hypercanvas';
export const ISSUE_LOG_FEEDBACK_REPOSITORY_URL = 'https://github.com/dfosco/hypercanvas';
const feedbackFailure = 'Feedback settings could not be saved. Check your token, repository access and network, then try again.';
/** Project only safe native settings fields. Saved credentials have no JS API. */
function issueLogFeedbackSettings(value) {
    if (!isRecord(value) || value.repository !== ISSUE_LOG_FEEDBACK_REPOSITORY
        || value.repositoryUrl !== ISSUE_LOG_FEEDBACK_REPOSITORY_URL
        || typeof value.tokenConfigured !== 'boolean' || typeof value.enabled !== 'boolean'
        || (value.enabled && !value.tokenConfigured)) {
        throw new TypeError('Invalid desktop feedback settings.');
    }
    const validationStatus = ['not_configured', 'validated', 'unavailable', 'invalid'].includes(String(value.validationStatus))
        ? value.validationStatus : undefined;
    const lastUploadStatus = ['never', 'sent', 'no_new_logs', 'failed', 'disabled'].includes(String(value.lastUploadStatus))
        ? value.lastUploadStatus : undefined;
    const snapshot = {
        repository: ISSUE_LOG_FEEDBACK_REPOSITORY,
        repositoryUrl: ISSUE_LOG_FEEDBACK_REPOSITORY_URL,
        tokenConfigured: value.tokenConfigured,
        enabled: value.enabled,
    };
    if (typeof value.accountLogin === 'string' && /^[a-z\d-]{1,39}$/i.test(value.accountLogin))
        snapshot.accountLogin = value.accountLogin;
    if (validationStatus)
        snapshot.validationStatus = validationStatus;
    if (lastUploadStatus)
        snapshot.lastUploadStatus = lastUploadStatus;
    if (typeof value.lastUploadAt === 'string' && value.lastUploadAt.length <= 64 && Number.isFinite(Date.parse(value.lastUploadAt)))
        snapshot.lastUploadAt = value.lastUploadAt;
    if (typeof value.lastIssueUrl === 'string' && /^https:\/\/github\.com\/dfosco\/hypercanvas\/issues\/\d+$/.test(value.lastIssueUrl))
        snapshot.lastIssueUrl = value.lastIssueUrl;
    // Never echo native exceptions or remote response bodies into the document.
    if (value.error)
        snapshot.error = feedbackFailure;
    return snapshot;
}
export async function getIssueLogFeedbackSettings() {
    try {
        return issueLogFeedbackSettings(await desktopRuntimeBridge().call('Bootstrap.GetIssueLogFeedbackSettings'));
    }
    catch {
        throw new Error('Feedback settings are unavailable. Open this page in the Hypercanvas desktop app and try again.');
    }
}
/** Send credentials only to Go. No browser, Notebook, or config API persistence. */
export async function saveIssueLogFeedbackSettings(request) {
    if (!request || typeof request.enabled !== 'boolean'
        || (request.token !== undefined && typeof request.token !== 'string')
        || (request.clearToken !== undefined && typeof request.clearToken !== 'boolean')) {
        throw new TypeError('Feedback settings require a token string and an enabled boolean.');
    }
    const update = request.clearToken
        ? { enabled: false, clearToken: true }
        : { token: request.token || '', enabled: request.enabled };
    try {
        return issueLogFeedbackSettings(await desktopRuntimeBridge().call('Bootstrap.SaveIssueLogFeedbackSettings', update));
    }
    catch {
        throw new Error(feedbackFailure);
    }
}
export function isBrowserCoreMode() {
    return browserWindow()?.__HYPERCANVAS_CORE_MODE__ === true;
}
export const PENDING_NOTEBOOK_REDIRECT_KEY = 'hypercanvas.pendingNotebookRedirect';
export const NOTEBOOK_SWITCH_PENDING_KEY = 'hypercanvas.notebookSwitchPending';
export const NOTEBOOK_SWITCH_EVENT = 'storyboard:notebook-switch';
export const NOTEBOOK_SIDEBAR_EVENT = 'storyboard:open-notebook-sidebar';
const NOTEBOOK_REDIRECT_TTL_MS = 2 * 60 * 1000;
function notifyNotebookSwitch(state) {
    if (typeof window === 'undefined')
        return;
    window.dispatchEvent(new CustomEvent(NOTEBOOK_SWITCH_EVENT, { detail: { state } }));
}
function setNotebookSwitchPending(pending) {
    try {
        const storage = browserWindow()?.sessionStorage;
        if (!storage)
            return;
        if (pending)
            storage.setItem(NOTEBOOK_SWITCH_PENDING_KEY, '1');
        else
            storage.removeItem(NOTEBOOK_SWITCH_PENDING_KEY);
    }
    catch { /* session storage can be disabled */ }
}
export function hasPendingNotebookSwitch() {
    try {
        return browserWindow()?.sessionStorage.getItem(NOTEBOOK_SWITCH_PENDING_KEY) === '1';
    }
    catch {
        return false;
    }
}
export function clearPendingNotebookSwitch() {
    setNotebookSwitchPending(false);
}
export function finishPendingNotebookSwitch(state) {
    clearPendingNotebookSwitch();
    notifyNotebookSwitch(state);
}
/** Open and focus the shared Notebook navigation without changing the route. */
export function openNotebookSidebar({ focusType = null } = {}) {
    if (typeof window === 'undefined')
        return false;
    window.dispatchEvent(new CustomEvent(NOTEBOOK_SIDEBAR_EVENT, { detail: { focusType } }));
    return true;
}
export function resumePendingNotebookRedirect({ storage, location, navigate, now = Date.now(), } = {}) {
    const currentWindow = browserWindow();
    const targetStorage = storage || (() => {
        try {
            return currentWindow?.sessionStorage || null;
        }
        catch {
            return null;
        }
    })();
    const currentLocation = location || currentWindow?.location;
    if (!targetStorage || !currentLocation)
        return false;
    let pending;
    try {
        const value = targetStorage.getItem(PENDING_NOTEBOOK_REDIRECT_KEY);
        if (!value)
            return false;
        pending = JSON.parse(value);
    }
    catch {
        try {
            targetStorage.removeItem(PENDING_NOTEBOOK_REDIRECT_KEY);
        }
        catch { /* storage may be unavailable */ }
        return false;
    }
    const discard = () => {
        try {
            targetStorage.removeItem(PENDING_NOTEBOOK_REDIRECT_KEY);
        }
        catch { /* storage may be unavailable */ }
    };
    const pendingRecord = isRecord(pending) ? pending : null;
    if (typeof pendingRecord?.url !== 'string'
        || typeof pendingRecord.expiresAt !== 'number'
        || !Number.isFinite(pendingRecord.expiresAt)
        || pendingRecord.expiresAt <= now) {
        discard();
        return false;
    }
    try {
        const target = new URL(pendingRecord.url, currentLocation.href);
        if (target.origin !== currentLocation.origin) {
            discard();
            return false;
        }
        const nextPath = `${target.pathname}${target.search}${target.hash}`;
        const currentPath = `${currentLocation.pathname}${currentLocation.search}${currentLocation.hash}`;
        if (nextPath === currentPath) {
            discard();
            return false;
        }
        const navigateTo = navigate || ((url) => currentWindow?.location.replace(url));
        navigateTo(nextPath);
        return true;
    }
    catch {
        discard();
        return false;
    }
}
if (typeof window !== 'undefined')
    resumePendingNotebookRedirect();
export function coreApiPath(pathname) {
    const importMetaEnv = import.meta.env;
    const basePath = browserWindow()?.__HYPERCANVAS_BASE_PATH__ || importMetaEnv?.BASE_URL || '/';
    return `${String(basePath).replace(/\/+$/, '')}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}
export function browserAgentSessionUrl({ agentId, widgetId, canvasId } = {}) {
    if (typeof agentId !== 'string' || !agentId.trim())
        return null;
    const params = new URLSearchParams();
    if (widgetId)
        params.set('widgetId', String(widgetId));
    if (canvasId)
        params.set('canvasId', String(canvasId));
    const query = params.toString();
    return coreApiPath(`/notebook/agent/${encodeURIComponent(agentId.trim())}${query ? `?${query}` : ''}`);
}
async function requestJson(pathname, options = {}) {
    const response = await fetch(coreApiPath(pathname), options);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        const record = isRecord(body) ? body : {};
        const nestedError = isRecord(record.error) ? record.error : null;
        const message = typeof nestedError?.message === 'string'
            ? nestedError.message
            : typeof record.error === 'string' ? record.error : `Core request failed (${response.status})`;
        const error = new Error(message);
        error.status = response.status;
        error.code = typeof nestedError?.code === 'string' ? nestedError.code
            : typeof record.code === 'string' ? record.code : null;
        error.data = record;
        throw error;
    }
    return body;
}
export async function selectNotebookDirectory({ purpose = 'notebook' } = {}) {
    const hooks = globalThis;
    const injectedPicker = hooks.__HYPERCANVAS_PICK_NOTEBOOK_FOLDER__;
    if (typeof injectedPicker === 'function')
        return injectedPicker({ purpose });
    if (isTauriAvailable())
        return invoke('pick_notebook_folder');
    const result = await requestJson('/_hypercanvas/system/select-directory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose }),
    });
    return isRecord(result) && typeof result.path === 'string' ? result.path : null;
}
export async function selectCoreFile() {
    const result = await requestJson('/_hypercanvas/system/select-file', { method: 'POST' });
    return isRecord(result) && typeof result.path === 'string' ? result.path : null;
}
export async function importCoreFile() {
    return requestJson('/_hypercanvas/system/import-file', { method: 'POST' });
}
export async function openNotebookPath(root) {
    const hooks = globalThis;
    const injectedOpener = hooks.__HYPERCANVAS_OPEN_NOTEBOOK__;
    if (typeof injectedOpener === 'function') {
        notifyNotebookSwitch('started');
        try {
            const result = await injectedOpener(root);
            notifyNotebookSwitch('ready');
            return result;
        }
        catch (error) {
            notifyNotebookSwitch('failed');
            throw error;
        }
    }
    return switchNotebookViaCore('open', { root });
}
/** Scaffold a blank Notebook in an empty folder, then switch Core to it. */
export function createNotebookPath(root, title) {
    return switchNotebookViaCore('create', { root, ...(title ? { title } : {}) });
}
async function switchNotebookViaCore(action, payload) {
    notifyNotebookSwitch('started');
    const currentWindow = browserWindow();
    if (!currentWindow) {
        notifyNotebookSwitch('failed');
        throw new Error('Notebook navigation requires a browser window.');
    }
    const fallbackRedirect = coreApiPath('/');
    const savePendingRedirect = (url) => {
        try {
            const target = new URL(url, currentWindow.location.href);
            if (target.origin !== currentWindow.location.origin)
                return;
            currentWindow.sessionStorage.setItem(PENDING_NOTEBOOK_REDIRECT_KEY, JSON.stringify({
                url: `${target.pathname}${target.search}${target.hash}`,
                expiresAt: Date.now() + NOTEBOOK_REDIRECT_TTL_MS,
            }));
        }
        catch { /* storage can be disabled; readiness polling remains available */ }
    };
    const clearPendingRedirect = () => {
        try {
            currentWindow.sessionStorage.removeItem(PENDING_NOTEBOOK_REDIRECT_KEY);
        }
        catch { /* storage can be disabled */ }
    };
    savePendingRedirect(fallbackRedirect);
    let response;
    try {
        response = await requestJson(`/_hypercanvas/notebook-runtime/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }
    catch (error) {
        if (isRecord(error) && (error.status || error.code))
            clearPendingRedirect();
        notifyNotebookSwitch('failed');
        throw error;
    }
    const responseRecord = isRecord(response) ? response : {};
    const redirect = typeof responseRecord.redirect === 'string' ? responseRecord.redirect : fallbackRedirect;
    if (!responseRecord.restarting) {
        clearPendingRedirect();
        notifyNotebookSwitch('ready');
        return response;
    }
    savePendingRedirect(redirect);
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 250));
        try {
            const status = await requestJson('/_hypercanvas/notebook-runtime/status');
            if (isRecord(status) && status.active && !status.restarting) {
                setNotebookSwitchPending(true);
                currentWindow.location.assign(redirect);
                return status;
            }
        }
        catch { /* Vite may be restarting; retry the branch-aware Core route. */ }
    }
    clearPendingRedirect();
    notifyNotebookSwitch('failed');
    throw new Error('Core did not finish switching Notebook before the timeout.');
}
export { requestJson as coreRequestJson };
