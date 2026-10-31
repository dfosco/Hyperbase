/**
 * Canvas add-widget tool module — dropdown menu for adding widgets to canvas.
 *
 * Wraps the CanvasCreateMenu component. Only active on canvas pages.
 */
import { loadUiComponent } from '../uiComponentRegistry.js';
export const id = 'canvas-add-widget';
export async function component() {
    const mod = await loadUiComponent('CanvasCreateMenu');
    return mod.default;
}
