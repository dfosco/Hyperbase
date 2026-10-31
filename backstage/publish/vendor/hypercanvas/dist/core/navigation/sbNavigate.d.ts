/**
 * sbNavigate(url) — SPA navigation when possible, hard navigation otherwise.
 *
 * Many call sites use `window.location.href = url` for internal navigation,
 * which always triggers a full page reload. When the target is same-origin
 * and shares the app's BASE_URL (i.e. a normal in-app route), prefer the
 * router's client-side navigation so the shell stays mounted across moves
 * between prototype flows, palette actions, page selections, etc.
 *
 * The router instance is captured at install time by hashPreserver via
 * `setNavigationRouter(router, base)`; until that happens, sbNavigate
 * always falls back to hard navigation.
 *
 * @param {string} url - target URL (absolute or path-relative)
 * @param {object} [opts]
 * @param {boolean} [opts.replace] - history.replaceState semantics
 * @param {boolean} [opts.forceReload] - always fall back to location.href
 */
export interface NavigationOptions {
    replace?: boolean;
}
export interface NavigationRouter {
    navigate(path: string, options?: NavigationOptions): unknown;
}
export interface NavigateOptions {
    replace?: boolean;
    forceReload?: boolean;
}
/** Called by hashPreserver after it patches the router. */
export declare function setNavigationRouter(router: NavigationRouter | null, basename?: string): void;
export declare function getNavigationRouter(): NavigationRouter | null;
export declare function sbNavigate(url: string, opts?: NavigateOptions): void;
