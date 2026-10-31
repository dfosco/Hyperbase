import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readAppConfig } from '../configFile.js';
import { normalizeCanvasAutoPlace } from '../stores/canvasConfig.js';
import { getAutoPlacePreview, isAutoPlaceEnabled } from './autoPlace.js';
import { getWidgetBounds } from './collision.js';
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
function record(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : undefined;
}
function point(value) {
    const candidate = record(value);
    return {
        x: typeof candidate?.x === 'number' && Number.isFinite(candidate.x) ? candidate.x : 0,
        y: typeof candidate?.y === 'number' && Number.isFinite(candidate.y) ? candidate.y : 0,
    };
}
/** Resolve each request independently; never mutate the browser config singleton. */
export function readCreationAutoPlaceConfig(root, canvasId) {
    const internal = record(readAppConfig(packageRoot)?.canvas);
    const notebook = record(readAppConfig(root)?.canvas);
    const internalDefaults = normalizeCanvasAutoPlace(internal?.autoPlace);
    const notebookDefaults = normalizeCanvasAutoPlace(notebook?.autoPlace, internalDefaults);
    const overrides = record((notebook ?? internal)?.overrides);
    const override = overrides && Object.hasOwn(overrides, canvasId) ? record(overrides[canvasId]) : undefined;
    return normalizeCanvasAutoPlace(override?.autoPlace, notebookDefaults);
}
function widgetRectangle(widget) {
    if (typeof widget.type !== 'string')
        return undefined;
    const props = record(widget.props) ?? {};
    const bounds = getWidgetBounds({ type: widget.type, position: point(widget.position), props });
    return { id: widget.id, position: { x: bounds.x, y: bounds.y }, width: bounds.width, height: bounds.height };
}
/**
 * New-widget placement only. Call after asynchronous preparation and just before
 * appending events, so concurrent creations see the latest persisted blockers.
 */
export function planWidgetCreation(root, canvasId, canvas, widget) {
    if (!isAutoPlaceEnabled(canvas) || canvas.layout === 'flow')
        return null;
    const moving = widgetRectangle(widget);
    if (!moving)
        return null;
    const stationary = (canvas.widgets ?? [])
        .map(widgetRectangle)
        .filter((rectangle) => Boolean(rectangle))
        .map((rectangle) => ({ ...rectangle, ...rectangle.position }));
    for (const value of canvas.sources ?? []) {
        const source = record(value);
        if (typeof source?.export !== 'string')
            continue;
        const position = point(source.position);
        stationary.push({
            id: `jsx-${source.export}`, position, ...position,
            width: typeof source.width === 'number' && source.width > 0 ? source.width : 200,
            height: typeof source.height === 'number' && source.height > 0 ? source.height : 150,
        });
    }
    return getAutoPlacePreview({
        moving: [moving], stationary, primaryId: widget.id, primaryPosition: moving.position,
        nudgeOffsets: readCreationAutoPlaceConfig(root, canvasId),
        boundaryPad: typeof canvas.gridSize === 'number' && canvas.gridSize >= 0 ? canvas.gridSize : 18,
    }).placements;
}
