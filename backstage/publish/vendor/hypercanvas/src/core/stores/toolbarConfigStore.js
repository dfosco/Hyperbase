/**
 * Toolbar Config Store — reactive toolbar configuration with layered overrides.
 *
 * Override priority (highest wins):
 *   core (toolbar.config.json) → custom (client repo) → prototype → user (future)
 *
 * Framework-agnostic (zero npm dependencies).
 */
import { deepMerge } from '../data/loader.js';
// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------
/** Merged core + custom config (set once at startup) */
let _baseConfig = {};
/** Active prototype toolbar overrides */
let _prototypeConfig = null;
/** Final merged config (base + prototype) */
let _mergedConfig = {};
const _listeners = new Set();
/** Client-repo toolbar overrides (set by virtual module before mount) */
let _clientOverrides = null;
let _snapshotVersion = 0;
// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------
/**
 * Set the base toolbar config (core defaults merged with client overrides).
 * Called once at app startup by mountStoryboardCore.
 *
 */
export function initToolbarConfig(config) {
    _baseConfig = config;
    _prototypeConfig = null;
    _recompute();
}
// ---------------------------------------------------------------------------
// Prototype overrides
// ---------------------------------------------------------------------------
/**
 * Set toolbar overrides for the active prototype.
 * Called on route change when entering a prototype that has a toolbar.config.json.
 *
 */
export function setPrototypeToolbarConfig(config) {
    _prototypeConfig = config || null;
    _recompute();
}
/**
 * Clear prototype overrides (e.g. when navigating to viewfinder or a
 * prototype without its own toolbar.config.json).
 */
export function clearPrototypeToolbarConfig() {
    if (_prototypeConfig === null)
        return;
    _prototypeConfig = null;
    _recompute();
}
// ---------------------------------------------------------------------------
// Access
// ---------------------------------------------------------------------------
/**
 * Get the current merged toolbar config.
 *
 */
export function getToolbarConfig() {
    return _mergedConfig;
}
// ---------------------------------------------------------------------------
// Reactivity
// ---------------------------------------------------------------------------
/**
 * Subscribe to toolbar config changes. Compatible with external stores.
 *
 */
export function subscribeToToolbarConfig(callback) {
    _listeners.add(callback);
    callback(_mergedConfig);
    return () => _listeners.delete(callback);
}
/**
 * Snapshot for useSyncExternalStore.
 *
 */
export function getToolbarConfigSnapshot() {
    return String(_snapshotVersion);
}
// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------
function _recompute() {
    _mergedConfig = _prototypeConfig
        ? deepMerge(_baseConfig, _prototypeConfig)
        : _baseConfig;
    _snapshotVersion++;
    for (const cb of _listeners) {
        try {
            cb(_mergedConfig);
        }
        catch (err) {
            console.error('[storyboard] Error in toolbar config subscriber:', err);
        }
    }
}
// ---------------------------------------------------------------------------
// Client overrides (set by Vite data plugin before mountStoryboardCore runs)
// ---------------------------------------------------------------------------
/**
 * Store client-repo toolbar overrides from a root toolbar.config.json.
 * Called from the generated virtual module at import time.
 *
 */
export function setClientToolbarOverrides(config) {
    _clientOverrides = config;
}
/**
 * Consume and clear pending client overrides.
 * Called once by mountStoryboardCore during toolbar config init.
 *
 */
export function consumeClientToolbarOverrides() {
    const overrides = _clientOverrides;
    _clientOverrides = null;
    return overrides;
}
// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
export function _resetToolbarConfig() {
    _baseConfig = {};
    _prototypeConfig = null;
    _clientOverrides = null;
    _mergedConfig = {};
    _listeners.clear();
    _snapshotVersion = 0;
}
