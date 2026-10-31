/**
 * Server-side Custom Widget Registry
 *
 * Consumer widget metadata loaded from `storyboard.config.json.widgets` at
 * dev-server startup. Server-side modules (collision detection, widget
 * placement, prop validation) consult this registry to resolve widget
 * metadata for consumer-registered widget types.
 *
 * Mirrors the browser-side `core/stores/widgetRegistry.js` but holds only
 * the JSON-serializable subset — no React components (those live in the
 * browser only). The `definition` shape is otherwise identical:
 *
 *   {
 *     label, icon,
 *     chrome: { enabled },
 *     interaction: { selectable, movable, resize, expandable, splitScreen, interactGate, interactGateLabel },
 *     connectors: { anchors, accept, exclude, defaults },
 *     features: [...],
 *     unlisted,
 *     props: { width: { type, default, ... }, ... }
 *   }
 *
 * Consumer entries OVERRIDE the built-in `widgets.config.json` entry of the
 * same type. The merge is whole-entry replacement (consumer wins) to match
 * the browser-side behavior — consumers that want to extend a core widget
 * must re-declare the merged definition.
 */
/** Widget metadata stays extensible so consumers can supply their own fields. */
export interface ServerWidgetDefinition {
    [extensionField: string]: unknown;
}
/**
 * Replace the entire registry from a consumer-supplied map.
 * @param {Record<string, object>|null|undefined} map
 */
export declare function initServerWidgets(map?: Record<string, unknown> | null): void;
/**
 * Register a single widget type. Replaces any existing entry.
 * @param {string} type
 * @param {object} definition
 */
export declare function registerServerWidget(type: string, definition: ServerWidgetDefinition): void;
/**
 * Resolve the effective server-side widget definition for a type.
 * Returns the consumer entry if present, otherwise the built-in entry from
 * `widgets.config.json`, otherwise null.
 * @param {string} type
 * @returns {object|null}
 */
export declare function getServerWidgetDefinition(type: string): ServerWidgetDefinition | null;
/**
 * Snapshot all definitions (consumer + built-in) keyed by type.
 * Consumer entries override built-ins.
 * @returns {Record<string, object>}
 */
export declare function getAllServerWidgetDefinitions(): Record<string, ServerWidgetDefinition>;
/** Reset all state. Only for tests. */
export declare function _resetServerWidgets(): void;
