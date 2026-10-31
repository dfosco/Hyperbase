/**
 * Widget Registry — consumer-supplied custom widget types.
 *
 * Consumers register widgets through `mountStoryboardCore({ widgets })`:
 *
 *   mountStoryboardCore(config, {
 *     widgets: {
 *       'my-thing': {
 *         component: MyThing,
 *         label: 'My Thing',
 *         icon: 'sparkle',
 *         chrome: { enabled: true },                  // optional, default true
 *         interaction: {
 *           selectable: true,                          // default true
 *           movable: true,                             // default true
 *           resize: { enabled: true, prod: false },    // default disabled
 *           expandable: false,
 *           splitScreen: false,
 *           interactGate: false,
 *           interactGateLabel: 'Click to interact',
 *         },
 *         connectors: { anchors: {...}, accept: ['*'], exclude: [] },
 *         features: [ ... ],                          // toolbar actions
 *         unlisted: false,                            // hide from "+ Add widget"
 *         props: { width: { type: 'number', default: 400 }, ... },
 *       },
 *     },
 *   })
 *
 * Definitions registered through this store are merged with — and override —
 * the built-in widget configs from `widgets.config.json` on a per-type basis.
 *
 * Built-in core widgets (sticky-note, markdown, image, etc.) ALSO live in
 * this registry once `seedCoreWidgets()` runs at module load. Consumer
 * overrides for those types replace the core entry entirely; if a consumer
 * wants to extend a core widget they should re-declare the merged definition.
 *
 * Framework-agnostic (zero npm dependencies). React typing is structural —
 * the `component` field is opaque from this store's perspective.
 *
 */
export interface WidgetChromeOptions {
    enabled?: boolean;
}
export interface WidgetResizeOptions {
    enabled: boolean;
    prod?: boolean;
}
export interface WidgetInteractionOptions {
    selectable?: boolean;
    movable?: boolean;
    resize?: WidgetResizeOptions;
    expandable?: boolean;
    splitScreen?: boolean;
    interactGate?: boolean;
    interactGateLabel?: string;
}
export interface WidgetDefinition extends Record<string, unknown> {
    component?: unknown;
    label?: string;
    icon?: string;
    chrome?: WidgetChromeOptions;
    interaction?: WidgetInteractionOptions;
    connectors?: Record<string, unknown>;
    features?: unknown[];
    unlisted?: boolean;
    props?: Record<string, object>;
    resize?: WidgetResizeOptions;
    expandable?: boolean;
    splitScreen?: boolean;
    interactGate?: boolean;
    interactGateLabel?: string;
}
/**
 * Replace the entire registry from a consumer-supplied map.
 * Pass null/undefined to clear.
 * @param {Record<string, WidgetDefinition>|null|undefined} map
 */
export declare function initWidgetRegistry(map?: Record<string, WidgetDefinition> | null): void;
/**
 * Register a single widget type (consumer-side). Replaces any existing entry.
 * @param {string} type
 * @param {WidgetDefinition} definition
 */
export declare function registerWidget(type: unknown, definition: unknown): void;
/**
 * Remove a registry entry. Built-in widgets re-seeded via seedCoreWidgets()
 * are unaffected; only the consumer override is removed.
 * @param {string} type
 */
export declare function unregisterWidget(type: string): void;
/**
 * Get the registered definition for a widget type, or null.
 * Consumers should prefer `getMergedWidgetDefinition()` which also folds in
 * the static widgets.config.json shape.
 * @param {string} type
 * @returns {WidgetDefinition|null}
 */
export declare function getWidgetDefinition(type: string): WidgetDefinition | null;
/**
 * Snapshot of the entire registry as a plain object.
 * @returns {Record<string, WidgetDefinition>}
 */
export declare function getAllWidgetDefinitions(): Record<string, WidgetDefinition>;
/**
 * Subscribe to registry changes. Returns unsubscribe fn.
 * Compatible with `useSyncExternalStore`.
 * @param {Function} callback
 * @returns {Function}
 */
export declare function subscribeToWidgetRegistry(callback: () => void): () => boolean;
/**
 * Snapshot version string for change detection.
 * Compatible with `useSyncExternalStore`.
 * @returns {string}
 */
export declare function getWidgetRegistrySnapshot(): string;
/** Reset all state. Only for tests. */
export declare function _resetWidgetRegistry(): void;
