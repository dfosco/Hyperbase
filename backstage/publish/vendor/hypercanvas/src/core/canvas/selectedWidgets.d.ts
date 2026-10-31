/**
 * Selected Widgets Bridge — real-time canvas selection & viewport context for agents.
 *
 * Writes `.selectedwidgets.json` at the project root with the currently
 * focused canvas, selected widgets, and user viewport position/zoom.
 * Agents read this file on every prompt to understand what the user is
 * looking at and where to place new widgets.
 *
 * Communication flow:
 *   Browser (CanvasPage.jsx) → HMR events → this module → file on disk
 *
 * Events listened for:
 *   storyboard:canvas-focused     — tab gained focus or canvas mounted
 *   storyboard:selection-changed  — widget selection changed (debounced client-side)
 *   storyboard:viewport-changed   — user scrolled/zoomed (debounced 500ms)
 *   storyboard:canvas-unfocused   — canvas unmounted or tab lost focus
 */
import type { ViteDevServer } from 'vite';
interface Viewport {
    centerX: number;
    centerY: number;
    zoom: number;
    topLeftX: number;
    topLeftY: number;
    width: number;
    height: number;
}
interface SelectedWidgetsState {
    canvasId: string | null;
    canvasFile: string | null;
    selectedWidgetIds: string[];
    widgets: unknown[];
    viewport: Viewport | null;
}
/**
 * Read the current viewport from `.selectedwidgets.json`.
 * Returns the viewport object or null if unavailable.
 *
 * @param {string} root — project root directory
 * @returns {{ centerX: number, centerY: number, zoom: number, topLeftX: number, topLeftY: number, width: number, height: number } | null}
 */
export declare function readCurrentViewport(root: string): Viewport | null;
/**
 * Read the full `.selectedwidgets.json` bridge state.
 * Returns { canvasId, selectedWidgetIds, widgets, viewport } or null.
 *
 * @param {string} root — project root directory
 */
export declare function readSelectedWidgets(root: string): SelectedWidgetsState | null;
/**
 * Set up the selected-widgets bridge on a Vite dev server.
 *
 * @param {import('vite').ViteDevServer} server
 * @param {string} root — project root directory
 */
export declare function setupSelectedWidgets(server: ViteDevServer, root: string): void;
export {};
