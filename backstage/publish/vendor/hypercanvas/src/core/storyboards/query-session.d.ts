/** Statefully's session surface consumed by PrototypeProvider and its hooks. */
export interface StatefullySession {
    getParam(key: string): string | null;
    getAllParams(): Record<string, string>;
    setParam(key: string, value: unknown): void;
    removeParam(key: string): void;
    replaceParams(values?: Record<string, unknown>): void;
    subscribe(listener: () => void): () => void;
    getSnapshot(): string;
    getLocal<T = unknown>(key: string, fallback?: T): T | string | undefined;
    setLocal(key: string, value: unknown): void;
    removeLocal(key: string): void;
    getAllLocal(): Record<string, string | null>;
    subscribeToStorage(listener: () => void): () => void;
    getStorageSnapshot(): string;
    notifyChange(): void;
    getRoute(): unknown;
    dispose(): void;
}
export interface StatefullySessionOptions {
    targetWindow?: unknown;
    storage?: StoryboardStorage;
    namespace?: string;
    route?: unknown;
}
export type StatefullySessionFactory = (options?: StatefullySessionOptions) => StatefullySession;
export interface StoryboardStorage {
    readonly length: number;
    key(index: number): string | null;
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
    clear(): void;
}
interface BrowserLocation {
    href: string;
    pathname: string;
    search: string;
    hash: string;
}
export interface StoryboardBrowserEventListener {
    (event: unknown): void;
}
/** Minimal browser surface injected by the Storyboard runtime host. */
export interface StoryboardBrowserWindow {
    location: BrowserLocation;
    history: {
        state: unknown;
        pushState(state: unknown, unused: string, url?: string | URL | null): void;
    };
    addEventListener(type: string, listener: StoryboardBrowserEventListener): void;
    removeEventListener(type: string, listener: StoryboardBrowserEventListener): void;
}
/**
 * Bind Statefully's existing session API to ordinary query parameters.
 * Runtime values live only in the browser URL. Route parameters, branch paths,
 * anchors, and unrelated query values stay owned by the host router.
 *
 * Statefully sees its familiar unprefixed session keys while the URL uses the
 * `sb.<key>` namespace, which prevents route query values becoming overrides.
 */
export declare function createStoryboardQuerySession(createSessionStore: StatefullySessionFactory, browserWindow: StoryboardBrowserWindow): {
    session: StatefullySession;
    dispose(): void;
};
export {};
//# sourceMappingURL=query-session.d.ts.map