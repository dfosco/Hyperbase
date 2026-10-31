/** @type {Map<string, WidgetDefinition>} */
let _registry = new Map();
/** @type {Set<Function>} */
const _listeners = new Set();
let _snapshotVersion = 0;
/**
 * Replace the entire registry from a consumer-supplied map.
 * Pass null/undefined to clear.
 * @param {Record<string, WidgetDefinition>|null|undefined} map
 */
export function initWidgetRegistry(map) {
    _registry = new Map();
    if (map && typeof map === 'object') {
        for (const [type, def] of Object.entries(map)) {
            if (def && typeof def === 'object') {
                _registry.set(type, def);
            }
        }
    }
    _notify();
}
/**
 * Register a single widget type (consumer-side). Replaces any existing entry.
 * @param {string} type
 * @param {WidgetDefinition} definition
 */
export function registerWidget(type, definition) {
    if (!type || typeof type !== 'string') {
        throw new Error('[storyboard] registerWidget: type must be a non-empty string');
    }
    if (!definition || typeof definition !== 'object') {
        throw new Error(`[storyboard] registerWidget("${type}"): definition must be an object`);
    }
    _registry.set(type, definition);
    _notify();
}
/**
 * Remove a registry entry. Built-in widgets re-seeded via seedCoreWidgets()
 * are unaffected; only the consumer override is removed.
 * @param {string} type
 */
export function unregisterWidget(type) {
    if (_registry.delete(type))
        _notify();
}
/**
 * Get the registered definition for a widget type, or null.
 * Consumers should prefer `getMergedWidgetDefinition()` which also folds in
 * the static widgets.config.json shape.
 * @param {string} type
 * @returns {WidgetDefinition|null}
 */
export function getWidgetDefinition(type) {
    return _registry.get(type) || null;
}
/**
 * Snapshot of the entire registry as a plain object.
 * @returns {Record<string, WidgetDefinition>}
 */
export function getAllWidgetDefinitions() {
    return Object.fromEntries(_registry);
}
/**
 * Subscribe to registry changes. Returns unsubscribe fn.
 * Compatible with `useSyncExternalStore`.
 * @param {Function} callback
 * @returns {Function}
 */
export function subscribeToWidgetRegistry(callback) {
    _listeners.add(callback);
    return () => _listeners.delete(callback);
}
/**
 * Snapshot version string for change detection.
 * Compatible with `useSyncExternalStore`.
 * @returns {string}
 */
export function getWidgetRegistrySnapshot() {
    return String(_snapshotVersion);
}
function _notify() {
    _snapshotVersion++;
    for (const cb of _listeners) {
        try {
            cb();
        }
        catch (err) {
            console.error('[storyboard] Error in widgetRegistry subscriber:', err);
        }
    }
}
/** Reset all state. Only for tests. */
export function _resetWidgetRegistry() {
    _registry = new Map();
    _listeners.clear();
    _snapshotVersion = 0;
}
