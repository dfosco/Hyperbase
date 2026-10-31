import type { CanvasAutoPlaceConfig } from '../stores/canvasConfig.js';
import type { CanvasState, CanvasWidget } from './materializer.js';
import type { AutoPlacePoint } from './autoPlace.js';
/** Resolve each request independently; never mutate the browser config singleton. */
export declare function readCreationAutoPlaceConfig(root: string, canvasId: string): CanvasAutoPlaceConfig;
/**
 * New-widget placement only. Call after asynchronous preparation and just before
 * appending events, so concurrent creations see the latest persisted blockers.
 */
export declare function planWidgetCreation(root: string, canvasId: string, canvas: CanvasState, widget: CanvasWidget): Map<string, AutoPlacePoint> | null;
