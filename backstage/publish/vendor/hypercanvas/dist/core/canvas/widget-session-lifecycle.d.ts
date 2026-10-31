/**
 * Close execution owned by a removed canvas widget.
 *
 * Deletion shares the startup lock so an in-flight terminal/agent launch cannot
 * finish after removal. The persisted tombstone rejects later reconnects.
 */
import type { CanvasWidget } from './materializer.js';
export declare function closeWidgetSession(root: string, canvasId: string, widget: CanvasWidget): Promise<void>;
/** Undo may restore the widget, but never resurrects a killed process. */
export declare function restoreWidgetSession(root: string, canvasId: string, widget: CanvasWidget): void;
