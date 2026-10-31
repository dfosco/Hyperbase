/**
 * Theme Store — config-driven theming layer.
 *
 * Reads its theme + surface registry from the unified config store
 * (`getConfig("theming")`). For each configured surface this module:
 *
 *  1. Watches the DOM for `[data-sb-surface="<id>"]` elements and writes
 *     `data-sb-<id>-theme="<resolvedThemeId>"` plus every key/value pair
 *     from the active theme's `attrs` companion map on those elements.
 *  2. Writes the legacy `<html>` attribute for the canonical surfaces
 *     (`data-sb-theme`, `data-sb-toolbar-theme`, `data-sb-code-theme`,
 *     `data-sb-canvas-theme`) so existing CSS selectors keep working
 *     without migration.
 *
 * State:
 *   - `sb-color-scheme`  — the active global theme id (or "system")
 *   - `sb-theme-sync`    — `Record<surfaceId, boolean>` of per-surface sync
 *
 * Both keys are persisted in localStorage. A `storage` event listener picks
 * up cross-frame writes so prototype iframes stay in sync with the parent.
 *
 * Public API stays source-compatible with the pre-refactor module:
 *   - `setTheme`, `getTheme`, `themeState`, `THEMES` (now derived from config)
 *   - `setThemeSyncTarget`, `getThemeSyncTargets`, `themeSyncState`
 *
 * New exports:
 *   - `getSurfaceSync`, `setSurfaceSync` — config-key-aware accessors
 *   - `getResolvedFor(surfaceId)` — convenience for consumers
 */
import { type DesktopAppearanceMode } from '../notebook/browserBridge.js';
export type ThemeOption = {
    name: string;
    value: string;
};
export type ThemeValue = string;
export interface ThemeState {
    theme: ThemeValue;
    resolved: string;
}
type Subscriber<T> = (value: T) => void;
type Unsubscriber = () => void;
interface Readable<T> {
    subscribe(run: Subscriber<T>): Unsubscriber;
}
export declare function getTheme(): ThemeValue;
/** Apply an embed host's theme update without changing the shared preference. */
export declare function applyEmbeddedFrameTheme(value: string, inheritedTheme?: string): boolean;
/** Apply a local theme selection and mirror its effective mode to MyGo when available. */
export declare function setTheme(value: ThemeValue): void;
/** Apply a Go-owned appearance snapshot without writing it back as a new preference. */
export declare function applyDesktopAppearance(mode: DesktopAppearanceMode): boolean;
export declare const themeState: Readable<ThemeState>;
/**
 * Get a copy of the current per-surface sync map.
 */
export declare function getSurfaceSync(): Record<string, boolean>;
/**
 * Set the sync flag for a single surface. Persisted to localStorage.
 */
export declare function setSurfaceSync(surfaceId: string, value: boolean): void;
export declare const surfaceSyncState: Readable<Record<string, boolean>>;
/**
 * Convenience accessor — what theme is the given surface currently
 * resolving to?
 */
export declare function getResolvedFor(surfaceId: string): string;
/**
 * Derived from the active config. Kept so existing switchers
 * (ThemeMenuButton, CoreUIBar, paletteTheme) keep working until they migrate
 * to the config-driven shape. Always reflects the current registry.
 */
export declare const THEMES: ThemeOption[];
/** Deprecated alias for getSurfaceSync — typed shape kept for old call sites. */
export interface ThemeSyncTargets {
    prototype: boolean;
    toolbar: boolean;
    codeBoxes: boolean;
    canvas: boolean;
    [key: string]: boolean;
}
export declare function getThemeSyncTargets(): ThemeSyncTargets;
export declare function setThemeSyncTarget(target: keyof ThemeSyncTargets, value: boolean): void;
export declare const themeSyncState: Readable<ThemeSyncTargets>;
export {};
