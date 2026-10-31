import { getDesktopRuntimeSnapshot, reconcileDesktopRuntimeSnapshot, requestDesktopRecoveryAction, subscribeDesktopRuntimeState, } from '../notebook/browserBridge.js';
import { createDocumentReloadPolicy, } from '../../internals/documentReloadPolicy.js';
const executableActions = new Set(['retry-core', 'reload-page']);
function newTargetId(windowRef) {
    const randomUUID = windowRef.crypto?.randomUUID?.bind(windowRef.crypto);
    return `offline-error:${randomUUID ? randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}
function statusText(snapshot) {
    switch (snapshot.phase) {
        case 'starting': return 'The app is starting.';
        case 'ready': return 'The app reports ready. This document still shows the earlier failure.';
        case 'recovering': return 'App recovery is in progress.';
        case 'recovered': return 'The app reports recovery. This document still shows the earlier failure.';
        case 'exhausted': return 'Automatic recovery attempts have ended.';
        case 'manual': return 'The app requires manual recovery.';
        default: return 'The current app status is unavailable.';
    }
}
function guidanceText(snapshot, hasReadyAction) {
    if (!snapshot)
        return 'Automated controls are unavailable until this page can confirm the current app state. Follow the app’s normal recovery guidance.';
    if (snapshot.actions.some(action => action === 'restart-app')) {
        return 'Restart Hypercanvas manually from the app menu if the problem continues.';
    }
    if (snapshot.actions.some(action => action === 'open-diagnostics')) {
        return 'Review the diagnostic information before trying another recovery step.';
    }
    if (snapshot.phase === 'manual')
        return 'Manual recovery is required. Follow the app’s normal recovery guidance.';
    return hasReadyAction ? '' : 'No safe recovery control is available for this page. Follow the app’s normal recovery guidance.';
}
function supportedAction(value) {
    return value && executableActions.has(value)
        ? value
        : null;
}
/** Attach recovery controls to the current static error document. */
export function startOfflineRecoveryClient(dependencies = {}) {
    const documentRef = dependencies.documentRef ?? globalThis.document;
    const windowRef = dependencies.windowRef ?? globalThis.window;
    const status = documentRef?.querySelector('[data-hc-recovery-status]') ?? null;
    const guidance = documentRef?.querySelector('[data-hc-recovery-guidance]') ?? null;
    const controls = documentRef?.querySelector('[data-hc-recovery-controls]') ?? null;
    if (!documentRef || !windowRef || !status || !guidance || !controls)
        return { dispose() { } };
    const statusElement = status;
    const guidanceElement = guidance;
    const controlsElement = controls;
    const buttons = [...controlsElement.querySelectorAll('button[data-hc-recovery-action]')]
        .map(button => ({ button, action: supportedAction(button.getAttribute('data-hc-recovery-action')) }));
    for (const { button } of buttons)
        button.disabled = true;
    controls.hidden = true;
    const getSnapshot = dependencies.getSnapshot ?? getDesktopRuntimeSnapshot;
    const subscribe = dependencies.subscribe ?? subscribeDesktopRuntimeState;
    const authorizeAction = dependencies.authorizeAction ?? requestDesktopRecoveryAction;
    const makePolicy = dependencies.makePolicy ?? createDocumentReloadPolicy;
    const targetId = newTargetId(windowRef);
    let mounted = true;
    let bridgeReady = false;
    let actionPending = false;
    let snapshot = null;
    let unsubscribe = null;
    const policy = makePolicy({
        role: 'workspace-host',
        targetId,
        authorizeAction,
        getCurrentSnapshot: async () => snapshot,
        isUnsavedStateKnownClean: () => Boolean(mounted && documentRef.defaultView === windowRef
            && !documentRef.querySelector('input:not([type="hidden"]),textarea,select,[contenteditable="true"]')),
        isTargetLive: liveTargetId => mounted && liveTargetId === targetId
            && documentRef.defaultView === windowRef && windowRef.document === documentRef,
        getCurrentUrl: () => windowRef.location.href,
        navigate: () => windowRef.location.reload(),
        setPending: () => {
            if (!mounted)
                return;
            guidanceElement.hidden = false;
            guidanceElement.textContent = 'This recovery request could not be confirmed. Follow the app’s normal recovery guidance.';
        },
        ...(dependencies.requestId ? { requestId: dependencies.requestId } : {}),
    });
    function render() {
        if (!mounted)
            return;
        if (!bridgeReady || !snapshot) {
            statusElement.textContent = 'The current app status is unavailable.';
            guidanceElement.hidden = false;
            controlsElement.hidden = true;
            for (const { button } of buttons)
                button.disabled = true;
            return;
        }
        statusElement.textContent = statusText(snapshot);
        let hasReadyAction = false;
        for (const { button, action } of buttons) {
            const ready = Boolean(!actionPending && action && snapshot.actions.includes(action)
                && policy.canAuthorizeRecoveryAction({ action, expectedSnapshot: snapshot }));
            button.disabled = !ready;
            if (ready)
                hasReadyAction = true;
        }
        controlsElement.hidden = !hasReadyAction;
        const guidanceMessage = guidanceText(snapshot, hasReadyAction);
        guidanceElement.textContent = guidanceMessage;
        guidanceElement.hidden = guidanceMessage.length === 0;
    }
    function receiveSnapshot(incoming) {
        if (!mounted)
            return;
        try {
            snapshot = reconcileDesktopRuntimeSnapshot(snapshot, incoming);
            bridgeReady = true;
            render();
        }
        catch {
            bridgeReady = false;
            render();
        }
    }
    const buttonHandlers = buttons.map(({ button, action }) => {
        if (!action)
            return { button, handler: null };
        const handler = (event) => {
            event.preventDefault();
            if (!mounted || !bridgeReady || button.disabled || !button.isConnected
                || !controlsElement.contains(button) || button.getAttribute('data-hc-recovery-action') !== action
                || !snapshot || !snapshot.actions.includes(action)
                || !policy.canAuthorizeRecoveryAction({ action, expectedSnapshot: snapshot }))
                return;
            // This is the only client path that requests a Go recovery action.
            const expectedSnapshot = snapshot;
            actionPending = true;
            render();
            void policy.authorizeRecoveryAction({ action, expectedSnapshot }).then((result) => {
                if (!mounted)
                    return;
                actionPending = false;
                if (result.accepted && result.snapshot)
                    receiveSnapshot(result.snapshot);
                else {
                    bridgeReady = false;
                    render();
                }
            }).catch(() => {
                if (!mounted)
                    return;
                actionPending = false;
                bridgeReady = false;
                guidanceElement.hidden = false;
                guidanceElement.textContent = 'This recovery request could not be confirmed. Follow the app’s normal recovery guidance.';
                render();
            });
        };
        button.addEventListener('click', handler);
        return { button, handler };
    });
    try {
        // Install the listener before reading so a newer event wins over a stale read.
        unsubscribe = subscribe(receiveSnapshot);
        bridgeReady = true;
        render();
        void getSnapshot().then(receiveSnapshot).catch(() => {
            if (!mounted)
                return;
            bridgeReady = false;
            render();
        });
    }
    catch {
        bridgeReady = false;
        render();
    }
    const onPageHide = () => client.dispose();
    windowRef.addEventListener('pagehide', onPageHide, { once: true });
    const client = {
        dispose() {
            if (!mounted)
                return;
            mounted = false;
            unsubscribe?.();
            unsubscribe = null;
            policy.dispose();
            windowRef.removeEventListener('pagehide', onPageHide);
            for (const { button, handler } of buttonHandlers) {
                if (handler)
                    button.removeEventListener('click', handler);
            }
            for (const { button } of buttons)
                button.disabled = true;
            controlsElement.hidden = true;
        },
    };
    return client;
}
