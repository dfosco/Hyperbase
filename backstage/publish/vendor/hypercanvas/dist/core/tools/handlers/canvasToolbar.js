/**
 * Canvas toolbar tool module — shared actions for all canvas toolbar tools.
 *
 * Each canvas tool (zoom, zoom-to-fit, undo-redo, snap) references this
 * handler. The component() export returns the component matching the tool's
 * render type, resolved at load time via the toolConfig passed to component().
 */
import { getCanvasZoom } from '../../index.js';
import { loadUiComponent } from '../uiComponentRegistry.js';
export const id = 'canvas-toolbar';
export async function handler() {
    const { min: ZOOM_MIN, max: ZOOM_MAX, step: ZOOM_STEP } = getCanvasZoom();
    return {
        zoomIn(currentZoom) {
            const next = Math.min(ZOOM_MAX, currentZoom + ZOOM_STEP);
            document.dispatchEvent(new CustomEvent('storyboard:canvas:set-zoom', { detail: { zoom: next } }));
        },
        zoomOut(currentZoom) {
            const next = Math.max(ZOOM_MIN, currentZoom - ZOOM_STEP);
            document.dispatchEvent(new CustomEvent('storyboard:canvas:set-zoom', { detail: { zoom: next } }));
        },
        zoomReset() {
            document.dispatchEvent(new CustomEvent('storyboard:canvas:set-zoom', { detail: { zoom: 100 } }));
        },
        zoomToFit() {
            document.dispatchEvent(new CustomEvent('storyboard:canvas:zoom-to-fit'));
        },
        undo() {
            document.dispatchEvent(new CustomEvent('storyboard:canvas:undo'));
        },
        redo() {
            document.dispatchEvent(new CustomEvent('storyboard:canvas:redo'));
        },
        toggleAutoPlace() {
            document.dispatchEvent(new CustomEvent('storyboard:canvas:toggle-auto-place'));
        },
        ZOOM_MIN,
        ZOOM_MAX,
    };
}
const componentMap = {
    'canvas-zoom': () => loadUiComponent('CanvasZoomControl'),
    'canvas-zoom-to-fit': () => loadUiComponent('CanvasZoomToFit'),
    'canvas-undo-redo': () => loadUiComponent('CanvasUndoRedo'),
    'canvas-snap': () => loadUiComponent('CanvasSnap'),
};
export async function component(renderType) {
    const loader = componentMap[renderType];
    if (!loader)
        return null;
    const mod = await loader();
    return mod.default;
}
