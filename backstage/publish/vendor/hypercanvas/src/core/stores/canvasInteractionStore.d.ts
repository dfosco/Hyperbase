/**
 * Canvas Interaction Store — runtime gates for canvas scroll + zoom behavior.
 *
 * Runtime gates for zoom and surface behavior:
 *
 *   - `scrollAxis` — accepted only as a legacy compatibility field. CanvasPage
 *     reads the axis from the active canvas document instead of this global store.
 *
 *   - `zoomGestures` — when false, disables the cmd+wheel zoom, the
 *     trackpad pinch zoom, and the iframe-forwarded wheel-zoom message
 *     handler. The +/- toolbar buttons and keyboard shortcuts still work —
 *     only the gesture inputs are gated. Useful for landing pages where
 *     you want users to scroll the canvas like a normal webpage instead
 *     of accidentally zooming it.
 *
 *   - `zoomOrigin` — anchor point used by toolbar / keyboard zoom (and
 *     any other zoom invocation that doesn't pass an explicit cursor
 *     position). `"center"` (default) keeps the viewport-center point
 *     pinned, matching native canvas tools. `"top-left"` keeps the
 *     canvas's (0, 0) pinned to the viewport's top-left — useful for
 *     landing canvases where content is anchored to the top-left and
 *     center-anchored zoom would slide it off-screen.
 *     Wheel zoom anchors on the cursor; holding Alt selects the viewport
 *     center. Touch pinch keeps its gesture center.
 *
 *   - `surface` — sizes the underlying canvas surface (`.tc-canvas`)
 *     per axis. `{ width, height }` each accept `"auto"` (default,
 *     keeps the `max(100vw, 10000px)` floor so users can pan into a
 *     large workspace) or `"viewport"` (sizes to exactly `100vw` /
 *     `100vh`, so the unscaled surface matches the visible window
 *     exactly and zooming >100% surfaces real scroll). The store
 *     toggles `data-canvas-surface-width="viewport"` and
 *     `data-canvas-surface-height="viewport"` on `<html>` so CSS can
 *     pick up the override without React having to re-render.
 *
 * Defaults for zoom and surface are seeded from `canvas.zoom.gestures`,
 * `canvas.zoom.origin`, and `canvas.surface.{width,height}` in
 * `storyboard.config.json`. Canvas scroll axis is document state. Runtime
 * overrides can be applied at any time via `setCanvasInteraction(partial)`.
 *
 * This is an **advanced, undocumented** extension surface — see
 * `core/stores/presentationStore.js` for the sibling system.
 *
 * Framework-agnostic (zero npm dependencies).
 */
type ScrollAxis = 'both' | 'vertical' | 'horizontal' | 'none';
type ZoomOrigin = 'center' | 'top-left';
type SurfaceSize = 'auto' | 'viewport';
interface CanvasInteractionState {
    scrollAxis: ScrollAxis;
    zoomGestures: boolean;
    zoomOrigin: ZoomOrigin;
    surface: {
        width: SurfaceSize;
        height: SurfaceSize;
    };
}
interface CanvasInteractionConfig {
    scrollAxis?: unknown;
    zoomGestures?: unknown;
    zoomOrigin?: unknown;
    surface?: unknown;
}
/**
 * Seed the store from a partial config (typically from
 * `storyboard.config.json` → `canvas.zoom.gestures`, `canvas.zoom.origin`,
 * and `canvas.surface`). Replaces any previous
 * overrides. Called once at app startup.
 *
 * @param {{
 *   scrollAxis?: string,
 *   zoomGestures?: boolean,
 *   zoomOrigin?: string,
 *   surface?: { width?: string, height?: string },
 * }} [config]
 */
export declare function initCanvasInteraction(config?: CanvasInteractionConfig | null): void;
/**
 * Apply a partial runtime override. Unspecified keys keep their current value.
 * @param {{
 *   scrollAxis?: string,
 *   zoomGestures?: boolean,
 *   zoomOrigin?: string,
 *   surface?: { width?: string, height?: string },
 * }} partial
 */
export declare function setCanvasInteraction(partial: CanvasInteractionConfig | null | undefined): void;
/**
 * @returns {{
 *   scrollAxis: 'both'|'vertical'|'horizontal'|'none',
 *   zoomGestures: boolean,
 *   zoomOrigin: 'center'|'top-left',
 *   surface: { width: 'auto'|'viewport', height: 'auto'|'viewport' },
 * }}
 */
export declare function getCanvasInteraction(): CanvasInteractionState;
/**
 * Subscribe to interaction changes. Returns an unsubscribe fn.
 * Compatible with `useSyncExternalStore`.
 * @param {Function} callback
 * @returns {Function}
 */
export declare function subscribeToCanvasInteraction(callback: () => void): () => boolean;
/**
 * Snapshot version for change detection. Compatible with `useSyncExternalStore`.
 * @returns {string}
 */
export declare function getCanvasInteractionSnapshot(): string;
/** Reset all state. Only for tests. */
export declare function _resetCanvasInteraction(): void;
export {};
