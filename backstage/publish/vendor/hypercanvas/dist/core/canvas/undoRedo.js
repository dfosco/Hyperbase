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
import { decodeCanvasEvent } from './canvasEvents.js';
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
export function buildInverseEvent(targetEvent, kind) {
    const decoded = decodeCanvasEvent(targetEvent);
    if (!decoded)
        return null;
    if (!decoded.id || typeof decoded.id !== 'string')
        return null;
    const meta = { kind, of: decoded.id };
    switch (decoded.event) {
        case 'widget_added': {
            const widgetId = decoded.widget.id;
            if (!widgetId)
                return null;
            // Inverse of add is remove. Carry the full widget so the inverse
            // event itself is undoable (redo-of-undo brings it back).
            return {
                event: 'widget_removed',
                widgetId,
                widget: decoded.widget,
                meta,
            };
        }
        case 'widget_removed': {
            // Inverse of remove is add. Requires the full widget payload.
            const widget = decoded.widget;
            if (!widget || !widget.id)
                return null;
            return {
                event: 'widget_added',
                widget,
                meta,
            };
        }
        case 'widget_updated': {
            if (!decoded.widgetId || !decoded.prevProps)
                return null;
            const props = { ...decoded.prevProps };
            // JSONL omits an undefined previous override. An empty merge patch
            // cannot remove the new value; null is the frame's inheritance value.
            if (Object.hasOwn(decoded.props, 'frameThemeOverride') && props.frameThemeOverride === undefined) {
                props.frameThemeOverride = null;
            }
            return {
                event: 'widget_updated',
                widgetId: decoded.widgetId,
                props,
                // The inverse of the inverse is the original — capture so redo works.
                prevProps: decoded.props,
                meta,
            };
        }
        case 'widget_moved': {
            if (!decoded.widgetId || !decoded.prevPosition)
                return null;
            return {
                event: 'widget_moved',
                widgetId: decoded.widgetId,
                position: decoded.prevPosition,
                prevPosition: decoded.position,
                meta,
            };
        }
        case 'connector_added': {
            const connectorId = decoded.connector?.id;
            if (!connectorId)
                return null;
            return {
                event: 'connector_removed',
                connectorId,
                connector: decoded.connector,
                meta,
            };
        }
        case 'connector_removed': {
            const connector = decoded.connector;
            if (!connector || !connector.id)
                return null;
            return {
                event: 'connector_added',
                connector,
                meta,
            };
        }
        case 'connector_updated': {
            if (!decoded.connectorId || !decoded.prevUpdates)
                return null;
            return {
                event: 'connector_updated',
                connectorId: decoded.connectorId,
                updates: decoded.prevUpdates,
                prevUpdates: decoded.updates,
                meta,
            };
        }
        case 'connector_waypoints_set': {
            if (!decoded.connectorId)
                return null;
            const prev = decoded.prevWaypoints;
            // prevWaypoints null means there were no manual waypoints before —
            // inverse is `cleared` (which itself carries the current waypoints
            // as prevWaypoints so redo can re-set them).
            if (prev === null) {
                return {
                    event: 'connector_waypoints_cleared',
                    connectorId: decoded.connectorId,
                    prevWaypoints: decoded.waypoints,
                    meta,
                };
            }
            if (!Array.isArray(prev))
                return null;
            return {
                event: 'connector_waypoints_set',
                connectorId: decoded.connectorId,
                waypoints: prev,
                prevWaypoints: decoded.waypoints,
                meta,
            };
        }
        case 'connector_waypoints_cleared': {
            if (!decoded.connectorId)
                return null;
            // Clearing had no prior manual routing: there's nothing to restore.
            const prev = decoded.prevWaypoints;
            if (!Array.isArray(prev))
                return null;
            return {
                event: 'connector_waypoints_set',
                connectorId: decoded.connectorId,
                waypoints: prev,
                prevWaypoints: null,
                meta,
            };
        }
        case 'source_updated': {
            if (!Array.isArray(decoded.prevSources))
                return null;
            return {
                event: 'source_updated',
                sources: decoded.prevSources,
                prevSources: decoded.sources,
                meta,
            };
        }
        case 'settings_updated': {
            if (!decoded.prevSettings || typeof decoded.prevSettings !== 'object')
                return null;
            return {
                event: 'settings_updated',
                settings: decoded.prevSettings,
                prevSettings: decoded.settings,
                meta,
            };
        }
        // widgets_replaced, connectors_replaced, canvas_created are compaction
        // / baseline events and intentionally not undoable.
        default:
            return null;
    }
}
