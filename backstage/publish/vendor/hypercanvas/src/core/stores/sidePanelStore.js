/**
 * Side Panel Store — manages the open/close state and active tab of the
 * side panel UI.
 *
 * Framework-agnostic state with a subscribe/set interface.
 * Toggles the `sb-sidepanel-open` class on `<html>` so CSS can react
 * to the panel being open (e.g. shifting the main content area).
 */
import { getFlag } from './featureFlags.js';
import { subscribeToStorage } from '../session/localStorage.js';
function writable(initial) {
    let value = initial;
    const subs = new Set();
    return {
        get() { return value; },
        set(v) {
            value = v;
            subs.forEach((fn) => fn(value));
        },
        update(fn) {
            value = fn(value);
            subs.forEach((fn) => fn(value));
        },
        subscribe(run) {
            subs.add(run);
            run(value);
            return () => { subs.delete(run); };
        },
    };
}
// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------
const PANEL_CLASS = 'sb-sidepanel-open';
const DEFAULT_STATE = Object.freeze({
    open: false,
    activeTab: 'docs',
});
const _store = writable({ ...DEFAULT_STATE });
// ---------------------------------------------------------------------------
// DOM class sync
// ---------------------------------------------------------------------------
/**
 * Toggle the `sb-sidepanel-open` class on `document.documentElement`
 * to match the current open state. Guarded for SSR.
 */
function _syncDomClass(open) {
    if (typeof document === 'undefined')
        return;
    document.documentElement.classList.toggle(PANEL_CLASS, open);
}
// ---------------------------------------------------------------------------
// Readable store
// ---------------------------------------------------------------------------
/**
 * Readable store for the side panel state.
 */
export const sidePanelState = {
    subscribe(run) {
        const enforcePublishingFlag = () => {
            const state = _store.get();
            if (state.open && state.activeTab === 'publish' && !getFlag('notebook-publishing'))
                closePanel();
        };
        enforcePublishingFlag();
        const unsubscribe = _store.subscribe(run);
        const unsubscribeFlags = subscribeToStorage(enforcePublishingFlag);
        return () => { unsubscribeFlags(); unsubscribe(); };
    },
};
// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
/**
 * Open the side panel to the given tab.
 *
 * @param tab — The tab to display when the panel opens.
 */
export function openPanel(tab) {
    if (tab === 'publish' && !getFlag('notebook-publishing'))
        return;
    _store.set({ open: true, activeTab: tab });
    _syncDomClass(true);
}
/**
 * Close the side panel. The active tab is preserved so that
 * re-opening the panel returns to the same tab.
 */
export function closePanel() {
    _store.update((s) => ({ ...s, open: false }));
    _syncDomClass(false);
}
/**
 * Toggle the side panel for a specific tab.
 *
 * - If the panel is open **and** already showing this tab → close it.
 * - Otherwise → open the panel to the given tab.
 *
 * @param tab — The tab to toggle.
 */
export function togglePanel(tab) {
    if (tab === 'publish' && !getFlag('notebook-publishing'))
        return;
    _store.update((s) => {
        const shouldClose = s.open && s.activeTab === tab;
        const next = shouldClose
            ? { ...s, open: false }
            : { open: true, activeTab: tab };
        _syncDomClass(next.open);
        return next;
    });
}
// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
/**
 * Reset the side panel store to its default state.
 * Only for use in tests.
 */
export function _resetSidePanel() {
    _store.set({ ...DEFAULT_STATE });
    _syncDomClass(false);
}
