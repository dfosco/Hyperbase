import { installHideParamListener } from './session/interceptHideParams.js';
import { installHistorySync } from './session/hideMode.js';
import { installBodyClassSync } from './session/bodyClasses.js';
import { installKnobsHighlight } from './knobs/highlight.js';
import { applyEarlyTheme } from './stores/themeBootstrap.js';
import { getConfig } from './stores/configStore.js';
import { computeEmbedNavigationSrc } from './embedNavigation.js';
import { getDesktopRuntimeSnapshot, reconcileDesktopRuntimeSnapshot, requestDesktopRecoveryAction, subscribeDesktopRuntimeState, } from './notebook/browserBridge.js';
import { createDocumentReloadPolicy } from '../internals/documentReloadPolicy.js';
const WORKSPACE_STYLE_ASSET = /(?:^|\/)(?:vendor-primer-[^/]+\.css|tailwind-[^/]+\.css|ui-entry-[^/]+\.css|workspace-entry[^/]*\.css|comment-layout[^/]*\.css|_app\.module[^/]*\.css)(?:\?|$)/i;
function removeWorkspaceStyles() {
    const remove = (node) => {
        if (!(node instanceof HTMLLinkElement) || node.rel !== 'stylesheet')
            return;
        if (WORKSPACE_STYLE_ASSET.test(node.href))
            node.remove();
    };
    document.head.querySelectorAll('link[rel="stylesheet"]').forEach(remove);
    const observer = new MutationObserver(records => {
        for (const record of records)
            record.addedNodes.forEach(remove);
    });
    observer.observe(document.head, { childList: true });
}
/** Initialize the behavior needed by authored content, without loading Core UI. */
export function mountIsolatedContent({ basePath = '/', role, hot, } = {}) {
    removeWorkspaceStyles();
    installHideParamListener();
    installHistorySync();
    installBodyClassSync();
    applyEarlyTheme(getConfig().theming);
    installKnobsHighlight({ basePath });
    let runtimeSnapshot = null;
    let unsubscribeRuntime = () => { };
    let unsubscribePending = () => { };
    let policy = null;
    let active = true;
    const reconcile = (incoming) => {
        if (!active)
            return;
        try {
            runtimeSnapshot = reconcileDesktopRuntimeSnapshot(runtimeSnapshot, incoming);
        }
        catch { /* Invalid status cannot authorize document navigation. */ }
    };
    const persistPending = (detail) => {
        try {
            window.sessionStorage.setItem('__hypercanvas_reload_pending__', JSON.stringify(detail));
        }
        catch { /* The pending reason remains in the emitted event when storage is unavailable. */ }
        window.dispatchEvent(new CustomEvent('storyboard:reload-pending', { detail }));
    };
    if (role && typeof window !== 'undefined' && hot) {
        const targetId = globalThis.crypto?.randomUUID?.()
            || `isolated-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        policy = createDocumentReloadPolicy({
            hot,
            role,
            targetId,
            authorizeAction: requestDesktopRecoveryAction,
            getCurrentSnapshot: async () => {
                const snapshot = await getDesktopRuntimeSnapshot();
                reconcile(snapshot);
                return runtimeSnapshot;
            },
            // An isolated router has no document-wide save-state authority.
            isUnsavedStateKnownClean: () => false,
            isTargetLive: () => active && document.documentElement?.isConnected === true,
            getCurrentUrl: () => window.location.href,
            setPending: persistPending,
        });
        const onPendingReload = (detail) => persistPending(detail);
        hot.on('storyboard:reload-pending', onPendingReload);
        unsubscribePending = () => hot.off?.('storyboard:reload-pending', onPendingReload);
        try {
            unsubscribeRuntime = subscribeDesktopRuntimeState(reconcile);
        }
        catch { /* Browser and unavailable desktop bridge remain pending/manual. */ }
        try {
            getDesktopRuntimeSnapshot().then(reconcile).catch(() => { });
        }
        catch { /* Missing bridge does not fabricate a ready snapshot. */ }
    }
    const dispose = () => {
        if (!active)
            return;
        active = false;
        unsubscribeRuntime();
        unsubscribePending();
        policy?.dispose();
        policy = null;
    };
    hot?.dispose(dispose);
    if (typeof window === 'undefined' || window.parent === window)
        return dispose;
    let lastHref = window.location.pathname + window.location.search + window.location.hash;
    const broadcastNavigation = (replace = false) => {
        const currentHref = window.location.pathname + window.location.search + window.location.hash;
        if (currentHref === lastHref)
            return;
        lastHref = currentHref;
        const src = computeEmbedNavigationSrc(window.location.pathname, window.location.hash, basePath, window.location.search);
        window.parent.postMessage({ type: 'storyboard:embed:navigate', src, replace }, '*');
    };
    const originalPush = history.pushState.bind(history);
    const originalReplace = history.replaceState.bind(history);
    const hosted = window.frameElement?.hasAttribute('data-hypercanvas-content');
    history.pushState = (...args) => {
        ;
        (hosted ? originalReplace : originalPush)(...args);
        broadcastNavigation();
    };
    history.replaceState = (...args) => {
        originalReplace(...args);
        broadcastNavigation(true);
    };
    window.addEventListener('popstate', () => broadcastNavigation(true));
    window.addEventListener('hashchange', () => broadcastNavigation(true));
    document.addEventListener('wheel', (event) => {
        if (!event.metaKey && !event.ctrlKey)
            return;
        event.preventDefault();
        window.parent.postMessage({
            type: 'storyboard:embed:wheel',
            deltaY: event.deltaY,
            clientX: event.clientX,
            clientY: event.clientY,
            altKey: event.altKey,
        }, '*');
    }, { passive: false });
    return dispose;
}
