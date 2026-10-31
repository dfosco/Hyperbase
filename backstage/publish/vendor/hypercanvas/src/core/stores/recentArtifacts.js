/**
 * Recent Artifacts — localStorage-backed recents for the workspace and
 * command palette. Routes are derived at read time from the live data index.
 * Writes are surfaced through a synthetic `storage` event for same-tab readers.
 */
const STORAGE_KEY = 'storyboard:recent-artifacts';
const MAX_ITEMS = 30;
const CHANGE_EVENT = 'storyboard-recent-artifacts-changed';
function isRecentEntry(value) {
    return typeof value === 'object' && value !== null
        && typeof Reflect.get(value, 'type') === 'string'
        && typeof Reflect.get(value, 'key') === 'string'
        && typeof Reflect.get(value, 'label') === 'string';
}
/** Push an artifact to the top, deduplicate by type and key, and cap storage. */
export function trackRecent(type, key, label) {
    if (!type || !key)
        return;
    const entries = _read();
    const deduped = entries.filter((entry) => !(entry.type === type && entry.key === key));
    deduped.unshift({ type, key, label: label || key });
    _write(deduped.slice(0, MAX_ITEMS));
}
/** Get recently visited artifacts, newest first. */
export function getRecent() {
    return _read();
}
/** Clear all recent artifacts. Useful for testing. */
export function clearRecent() {
    try {
        localStorage.removeItem(STORAGE_KEY);
        _notify();
    }
    catch { /* ignore */ }
}
/** Subscribe to same-tab and cross-tab changes. */
export function subscribeToRecent(callback) {
    if (typeof window === 'undefined')
        return () => { };
    const onStorage = (event) => {
        if (!event || !event.key || event.key === STORAGE_KEY)
            callback();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(CHANGE_EVENT, callback);
    return () => {
        window.removeEventListener('storage', onStorage);
        window.removeEventListener(CHANGE_EVENT, callback);
    };
}
/** Return the stable raw JSON snapshot consumed by `useSyncExternalStore`. */
export function getRecentSnapshot() {
    try {
        return localStorage.getItem(STORAGE_KEY) || '[]';
    }
    catch {
        return '[]';
    }
}
function _read() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(isRecentEntry) : [];
    }
    catch {
        return [];
    }
}
function _write(entries) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
        _notify();
    }
    catch { /* quota exceeded or unavailable */ }
}
function _notify() {
    if (typeof window === 'undefined')
        return;
    try {
        window.dispatchEvent(new Event(CHANGE_EVENT));
    }
    catch { /* ignore (e.g. SSR / non-browser) */ }
}
