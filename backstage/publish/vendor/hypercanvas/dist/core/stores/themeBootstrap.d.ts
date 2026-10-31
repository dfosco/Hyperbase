/**
 * Theme bootstrap — shared early-paint helper.
 *
 * The runtime path (`applyEarlyTheme`) runs at the top of mountStoryboardCore
 * before React mounts so the first paint already has the correct theme.
 * The inline-script generator path (`renderInlineBootstrapScript`) emits a
 * minimal `<script>` block embedded in the iframe HTML for the prototype
 * embed shell — that script runs before the JS bundle loads, also avoiding
 * a flash of wrong-theme content.
 *
 * Both paths consume the same registry shape:
 *
 *   {
 *     themes:   Record<id, { label, attrs }>,
 *     surfaces: Record<id, { label, sync }>,
 *     default:  string,  // theme id (may be "system")
 *   }
 *
 * Storage keys (kept stable from the legacy themeStore):
 *   - `sb-color-scheme`     — the active global theme id (or "system")
 *   - `sb-theme-sync`       — JSON Record<surfaceId, boolean>
 *
 * Legacy compat attrs on <html> (mapped from canonical surface ids):
 *   data-sb-theme           ← prototype
 *   data-sb-toolbar-theme   ← toolbar
 *   data-sb-code-theme      ← codeBoxes
 *   data-sb-canvas-theme    ← canvas
 *
 * These are kept so that the ~30 CSS files that select on them continue to
 * work without modification.
 */
export declare const THEME_STORAGE_KEY = "sb-color-scheme";
export declare const SYNC_STORAGE_KEY = "sb-theme-sync";
export declare function markSyncDefaultsCurrent(): void;
/** Map surface id → legacy <html> attribute kept for backward compatibility. */
export declare const LEGACY_SURFACE_ATTR: Record<string, string>;
type SyncMap = Record<string, boolean>;
/**
 * Read the stored global theme id from localStorage, falling back to the
 * registry's configured `default` (or "system" if not set).
 *
 * @param {object} themesCfg
 * @returns {string}
 */
export declare function readStoredTheme(themesCfg: unknown): string;
/**
 * Read the persisted per-surface sync state, falling back to each surface's
 * configured `sync` default. Unknown surfaces (present in storage but not in
 * config) are silently dropped.
 *
 * @param {object} themesCfg
 * @returns {Record<string, boolean>}
 */
export declare function readStoredSync(themesCfg: unknown): SyncMap;
/**
 * Resolve "system" to "light" or "dark" via prefers-color-scheme. Other
 * theme ids pass through unchanged.
 */
export declare function resolveTheme(themeId: string): string;
/**
 * Compute the resolved theme id for every configured surface, given the
 * resolved global theme and the per-surface sync map. Unsynced surfaces
 * resolve to "light".
 *
 * @returns {Record<string, string>}
 */
export declare function computeBySurface(themesCfg: unknown, globalResolved: string, syncMap: SyncMap): Record<string, string>;
/**
 * Apply the resolved theme set to the DOM.
 *
 * Per-surface attrs land on every `[data-sb-surface="<id>"]` element:
 *   - data-sb-<id>-theme  = "<resolved>"
 *   - every key/value pair from themesCfg.themes[resolved].attrs
 *
 * Legacy compat attrs land on <html> exactly as before.
 *
 * Safe to call repeatedly — writes are idempotent.
 */
export declare function applyThemeToDom(themesCfg: unknown, bySurface: Record<string, string>): void;
/**
 * Apply the saved theme immediately — runtime path called from
 * mountStoryboardCore before React mounts.
 *
 * Honours the `_sb_theme_target` URL param: when set to "prototype" or
 * "toolbar" the runtime forces that surface to follow the global theme
 * regardless of the persisted sync map. Used by the canvas iframes that
 * embed prototypes in a forced-dark canvas.
 */
export declare function applyEarlyTheme(themesCfg: unknown): void;
/**
 * Serialize a minimal `<script>` body that runs the same bootstrap logic
 * in a fresh document context — used for the prototype iframe HTML shell
 * which loads BEFORE the JS bundle and needs to paint with the correct
 * theme on first frame.
 *
 * Emits a `<style>` block that paints the html background based on
 * `data-color-mode` (dark or light) so the iframe never flashes
 * Chromium's default white during reload before the prototype's CSS
 * loads — followed by an IIFE that:
 *   1. Reads `sb-color-scheme` and `sb-theme-sync` from localStorage,
 *      falling back to the inlined registry defaults
 *   2. Resolves "system" via prefers-color-scheme
 *   3. Honours `_sb_theme_target` URL param
 *   4. Writes data-sb-<id>-theme on every `[data-sb-surface]` element
 *   5. Writes the legacy data-sb-theme / data-sb-toolbar-theme /
 *      data-sb-code-theme / data-sb-canvas-theme on <html>
 *   6. Writes the prototype theme's companion attrs on <html>
 *      (including `data-color-mode` which the style block reads)
 *
 * @param {object} themesCfg
 * @returns {string} `<script>...</script>` markup
 */
export declare function renderInlineBootstrapScript(themesCfg: unknown): string;
export {};
