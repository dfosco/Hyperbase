const PARAM_PREFIX = 'sb.';
const noStorage = Object.freeze({
    length: 0,
    key: () => null,
    getItem: () => null,
    setItem: () => { },
    removeItem: () => { },
    clear: () => { },
});
function toSearchParamKey(key) {
    return `${PARAM_PREFIX}${key}`;
}
function fromSearchParamKey(key) {
    return key.startsWith(PARAM_PREFIX) ? key.slice(PARAM_PREFIX.length) : null;
}
function visibleSessionParams(location) {
    const query = new URLSearchParams(location.search);
    const params = new URLSearchParams();
    for (const [key, value] of query) {
        const sessionKey = fromSearchParamKey(key);
        if (sessionKey !== null)
            params.append(sessionKey, value);
    }
    return params;
}
function createSessionWindow(browserWindow) {
    const listeners = new Map();
    const notify = (event) => {
        for (const listener of listeners.values())
            listener.call(targetWindow, event);
    };
    const location = Object.defineProperties({}, {
        hash: {
            enumerable: true,
            get: () => visibleSessionParams(browserWindow.location).toString(),
            set: (value) => {
                const nextParams = new URLSearchParams(String(value).replace(/^#/, ''));
                const url = new URL(browserWindow.location.href);
                for (const key of [...url.searchParams.keys()]) {
                    if (fromSearchParamKey(key) !== null)
                        url.searchParams.delete(key);
                }
                for (const [key, paramValue] of nextParams) {
                    url.searchParams.set(toSearchParamKey(key), paramValue);
                }
                const nextUrl = `${url.pathname}${url.search}${url.hash}`;
                const currentUrl = `${browserWindow.location.pathname}${browserWindow.location.search}${browserWindow.location.hash}`;
                if (nextUrl !== currentUrl)
                    browserWindow.history.pushState(browserWindow.history.state, '', nextUrl);
            },
        },
    });
    const targetWindow = {
        location,
        addEventListener(type, listener) {
            if (type !== 'hashchange' || listeners.has(listener))
                return;
            listeners.set(listener, listener);
            browserWindow.addEventListener('popstate', notify);
            browserWindow.addEventListener('hashchange', notify);
        },
        removeEventListener(type, listener) {
            if (type !== 'hashchange' || !listeners.delete(listener))
                return;
            if (listeners.size === 0) {
                browserWindow.removeEventListener('popstate', notify);
                browserWindow.removeEventListener('hashchange', notify);
            }
        },
    };
    return {
        targetWindow,
        dispose() {
            listeners.clear();
            browserWindow.removeEventListener('popstate', notify);
            browserWindow.removeEventListener('hashchange', notify);
        },
    };
}
/**
 * Bind Statefully's existing session API to ordinary query parameters.
 * Runtime values live only in the browser URL. Route parameters, branch paths,
 * anchors, and unrelated query values stay owned by the host router.
 *
 * Statefully sees its familiar unprefixed session keys while the URL uses the
 * `sb.<key>` namespace, which prevents route query values becoming overrides.
 */
export function createStoryboardQuerySession(createSessionStore, browserWindow) {
    const bridge = createSessionWindow(browserWindow);
    const session = createSessionStore({
        targetWindow: bridge.targetWindow,
        storage: noStorage,
        namespace: 'storyboard-url-only',
    });
    return Object.freeze({
        session,
        dispose() {
            session.dispose();
            bridge.dispose();
        },
    });
}
//# sourceMappingURL=query-session.js.map