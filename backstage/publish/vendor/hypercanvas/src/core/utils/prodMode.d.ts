/**
 * Production mode simulation.
 *
 * When `?prodMode` is in the URL, the UI renders as if in production
 * even when running on a local dev server. Toggling is done via the
 * devtools submenu or by manually adding/removing the URL param.
 */
declare global {
    interface Window {
        __SB_LOCAL_DEV__?: boolean;
    }
}
/** Returns true when the app should behave as local dev. */
export declare function isLocalDev(): boolean;
/** Returns true when prod-mode simulation is active. */
export declare function isProdMode(): boolean;
/** Toggle prodMode URL param and reload. */
export declare function toggleProdMode(): void;
