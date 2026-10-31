/**
 * Canvas undo/redo: build inverse forward events.
 *
 * Pure module — given a target canvas event (with inverse payload `prev*`
 * fields or full `widget`/`connector` objects on removes), returns the
 * inverse event that, when appended to the JSONL and materialized, restores
 * the state to what it was before the target event was applied.
 *
 * The inverse events are real, valid forward events (widget_added,
 * widget_removed, widget_updated, etc.) — the materializer folds them with
 * no special handling. We tag them with `meta.kind = 'undo' | 'redo'` and
 * `meta.of = <targetEventId>` purely for human readability and DX.
 */
import type { CanvasEventFields } from './canvasEvents.js';
/**
 * Compute the inverse forward event for a given canvas event.
 *
 * @param {object} targetEvent — the event being undone/redone (must have id)
 * @param {'undo'|'redo'} kind — meta.kind to stamp on the returned event
 * @returns {object|null} the inverse event (without timestamp/id — the
 *   caller stamps those via appendEvent), or null if the event is not
 *   undoable (legacy events without inverse payloads, widgets_replaced,
 *   connectors_replaced, canvas_created, etc.).
 */
export declare function buildInverseEvent(targetEvent: unknown, kind: 'undo' | 'redo'): CanvasEventFields | null;
