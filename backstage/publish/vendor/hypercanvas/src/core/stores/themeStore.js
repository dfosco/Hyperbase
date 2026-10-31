/**
 * Theme Store — config-driven theming layer.
 *
 * Reads its theme + surface registry from the unified config store
 * (`getConfig("theming")`). For each configured surface this module:
 *
 *  1. Watches the DOM for `[data-sb-surface="<id>"]` elements and writes
 *     `data-sb-<id>-theme="<resolvedThemeId>"` plus every key/value pair
 *     from the active theme's `attrs` companion map on those elements.
 *  2. Writes the legacy `<html>` attribute for the canonical surfaces
 *     (`data-sb-theme`, `data-sb-toolbar-theme`, `data-sb-code-theme`,
 *     `data-sb-canvas-theme`) so existing CSS selectors keep working
 *     without migration.
 *
 * State:
 *   - `sb-color-scheme`  — the active global theme id (or "system")
 *   - `sb-theme-sync`    — `Record<surfaceId, boolean>` of per-surface sync
 *
 * Both keys are persisted in localStorage. A `storage` event listener picks
 * up cross-frame writes so prototype iframes stay in sync with the parent.
 *
 * Public API stays source-compatible with the pre-refactor module:
 *   - `setTheme`, `getTheme`, `themeState`, `THEMES` (now derived from config)
 *   - `setThemeSyncTarget`, `getThemeSyncTargets`, `themeSyncState`
 *
 * New exports:
 *   - `getSurfaceSync`, `setSurfaceSync` — config-key-aware accessors
 *   - `getResolvedFor(surfaceId)` — convenience for consumers
 */
import { getConfig, getConfigSnapshot, subscribeToConfig } from './configStore.js';
import { configDefaults } from './configSchema.js';
import { setDesktopAppearanceMode } from '../notebook/browserBridge.js';
import { THEME_STORAGE_KEY, SYNC_STORAGE_KEY, readStoredTheme, readStoredSync, resolveTheme, computeBySurface, applyThemeToDom, markSyncDefaultsCurrent, } from './themeBootstrap.js';
function writable(initial) {
    let value = initial;
    const subs = new Set();
    return {
        set(v) { value = v; subs.forEach((fn) => fn(value)); },
        subscribe(run) {
            subs.add(run);
            run(value);
            return () => { subs.delete(run); };
        },
    };
}
function isThemeConfig(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function themesConfig() {
    // configStore may not be seeded yet (themeStore is imported at the top
    // of the core barrel, before mountStoryboardCore runs). Fall back to the
    // schema defaults so consumers always see the canonical 4-surface set
    // even if storyboard.config.json omits the `theming` block entirely.
    const fromStore = getConfig('theming');
    if (isThemeConfig(fromStore) && (fromStore.surfaces || fromStore.themes))
        return fromStore;
    const defaults = configDefaults;
    const defaultTheming = defaults.theming;
    return isThemeConfig(defaultTheming) ? defaultTheming : {};
}
function readUrlTheme() {
    if (typeof window === 'undefined')
        return null;
    const value = new URLSearchParams(window.location.search).get('theme');
    const registry = themesConfig().themes;
    return value && (value === 'system' || (isRecord(registry) && Object.hasOwn(registry, value))) ? value : null;
}
// ---------------------------------------------------------------------------
// Persistent state
// ---------------------------------------------------------------------------
let _current = readEffectiveUrlTheme() || readStoredTheme(themesConfig());
let _pendingDesktopAppearance = null;
let _syncTargets = readStoredSync(themesConfig());
function snapshot(theme) {
    return { theme, resolved: resolveTheme(theme) };
}
const _store = writable(snapshot(_current));
const _syncStore = writable(_syncTargets);
// ---------------------------------------------------------------------------
// DOM write + change broadcast
// ---------------------------------------------------------------------------
function _applyToDOM(theme, resolved) {
    if (typeof window !== 'undefined') {
        const boot = window;
        // A partial module graph may never seed config. Keep the startup client's
        // Go-owned fallback paint in that case without losing the stored theme ID.
        if (getConfigSnapshot() === '0' && boot.__HYPERCANVAS_DESKTOP_APPEARANCE__)
            return;
        if (getConfigSnapshot() !== '0') {
            boot.__HYPERCANVAS_THEME_STORE_READY__ = true;
            document.documentElement.style.removeProperty('color-scheme');
        }
    }
    const cfg = themesConfig();
    const bySurface = computeBySurface(cfg, resolved, _syncTargets);
    applyThemeToDom(cfg, bySurface);
}
function _dispatchEvent(theme, resolved) {
    if (typeof document === 'undefined')
        return;
    const cfg = themesConfig();
    const bySurface = computeBySurface(cfg, resolved, _syncTargets);
    // bySurface carries the new shape. Legacy keys (prototypeTheme,
    // prototypeResolved, toolbarResolved, codeResolved, canvasResolved) are
    // included so existing listeners — Primer's ThemeSync, embed bridges —
    // continue to work without a coordinated upgrade.
    document.dispatchEvent(new CustomEvent('storyboard:theme:changed', {
        detail: {
            theme,
            resolved,
            bySurface,
            // Legacy mirror — keep until consumers migrate.
            prototypeTheme: bySurface.prototype,
            prototypeResolved: bySurface.prototype,
            toolbarResolved: bySurface.toolbar,
            codeResolved: bySurface.codeBoxes,
            canvasResolved: bySurface.canvas,
        },
    }));
}
// ---------------------------------------------------------------------------
// MutationObserver — pick up surface elements mounted/changed post-load
// ---------------------------------------------------------------------------
let _observerInstalled = false;
function _installSurfaceObserver() {
    if (_observerInstalled)
        return;
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined')
        return;
    if (!document.body) {
        // Body not ready yet — try again once it is.
        document.addEventListener('DOMContentLoaded', _installSurfaceObserver, { once: true });
        return;
    }
    _observerInstalled = true;
    const reapply = () => _applyToDOM(_current, resolveTheme(_current));
    const observer = new MutationObserver((mutations) => {
        let needsReapply = false;
        for (const m of mutations) {
            if (m.type === 'attributes' && m.attributeName === 'data-sb-surface') {
                needsReapply = true;
                break;
            }
            if (m.type === 'childList') {
                // Only re-apply when an added node could carry/contain a surface marker.
                for (const node of m.addedNodes) {
                    if (!(node instanceof Element))
                        continue;
                    if (node.hasAttribute('data-sb-surface') ||
                        node.querySelector?.('[data-sb-surface]')) {
                        needsReapply = true;
                        break;
                    }
                }
                if (needsReapply)
                    break;
            }
        }
        if (needsReapply)
            reapply();
    });
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-sb-surface'],
    });
}
// ---------------------------------------------------------------------------
// Config change subscription — re-derive state and re-apply when the
// themes registry changes (e.g. HMR of storyboard.config.json).
// ---------------------------------------------------------------------------
subscribeToConfig(() => {
    const cfg = themesConfig();
    // Re-read sync defaults for any newly-added surfaces (they get the
    // config default if not present in storage).
    _syncTargets = readStoredSync(cfg);
    _syncStore.set(_syncTargets);
    // The module can load before the configured theme registry. Re-read the
    // authored URL once custom themes become recognizable so UI state matches
    // the theme already painted by the bootstrap script.
    const authoredTheme = readUrlTheme();
    const urlTheme = authoredTheme || readEffectiveUrlTheme();
    if (urlTheme) {
        _current = urlTheme;
        _pendingDesktopAppearance = null;
    }
    if (_pendingDesktopAppearance && getConfigSnapshot() !== '0') {
        const mode = _pendingDesktopAppearance;
        _pendingDesktopAppearance = null;
        applyDesktopAppearance(mode);
        return;
    }
    const state = snapshot(_current);
    _store.set(state);
    _applyToDOM(_current, state.resolved);
    _dispatchEvent(_current, state.resolved);
});
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function getTheme() { return _current; }
function appearanceModeForTheme(value) {
    if (value === 'system')
        return 'system';
    const registry = themesConfig().themes;
    const theme = isRecord(registry) ? registry[value] : null;
    const attrs = isRecord(theme) && isRecord(theme.attrs) ? theme.attrs : null;
    const mode = attrs?.['data-color-mode'];
    return mode === 'light' || mode === 'dark' ? mode : null;
}
function isManagedFrame() {
    if (typeof window === 'undefined')
        return false;
    const params = new URLSearchParams(window.location.search);
    const target = params.get('_sb_theme_target');
    const surfaces = themesConfig().surfaces;
    return params.has('_sb_embed') && !!target && isRecord(surfaces) && Object.hasOwn(surfaces, target);
}
/** Resolve the single theme authority for this document from its URL. */
function readEffectiveUrlTheme() {
    const authored = readUrlTheme();
    if (authored)
        return authored;
    if (!isManagedFrame() || typeof window === 'undefined')
        return null;
    const value = new URLSearchParams(window.location.search).get('_sb_canvas_theme');
    const registry = themesConfig().themes;
    return value && isRecord(registry) && Object.hasOwn(registry, value) ? value : null;
}
function writeFrameThemeToUrl(value) {
    if (typeof window === 'undefined')
        return;
    if (!isManagedFrame() && !new URLSearchParams(window.location.search).has('theme'))
        return;
    const url = new URL(window.location.href);
    url.searchParams.set('theme', value);
    url.searchParams.set('_sb_canvas_theme', value);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}
/** Apply an embed host's theme update without changing the shared preference. */
export function applyEmbeddedFrameTheme(value, inheritedTheme) {
    const registry = themesConfig().themes;
    const inherit = value === 'inherit';
    const nextInherited = inheritedTheme && isRecord(registry) && Object.hasOwn(registry, inheritedTheme)
        ? inheritedTheme
        : readStoredTheme(themesConfig());
    if (!isRecord(registry) || (!inherit && value !== 'system' && !Object.hasOwn(registry, value)) || !isManagedFrame())
        return false;
    const url = new URL(window.location.href);
    if (inherit)
        url.searchParams.delete('theme');
    else
        url.searchParams.set('theme', value);
    url.searchParams.set('_sb_canvas_theme', inherit ? nextInherited : value);
    const next = inherit ? nextInherited : value;
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    _current = next;
    const state = snapshot(next);
    _store.set(state);
    _applyToDOM(next, state.resolved);
    _dispatchEvent(next, state.resolved);
    return true;
}
function syncEmbeddedFrameTheme(value) {
    const registry = themesConfig().themes;
    if (!isRecord(registry) || (value !== 'system' && !Object.hasOwn(registry, value)) || !isManagedFrame())
        return false;
    if (readUrlTheme())
        return false;
    const url = new URL(window.location.href);
    url.searchParams.set('_sb_canvas_theme', value);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    _current = value;
    const state = snapshot(value);
    _store.set(state);
    _applyToDOM(value, state.resolved);
    _dispatchEvent(value, state.resolved);
    return true;
}
function applyTheme(value, persistDesktop) {
    const managedFrame = isManagedFrame();
    writeFrameThemeToUrl(value);
    _current = value;
    if (!managedFrame && typeof localStorage !== 'undefined') {
        if (value === 'system')
            localStorage.removeItem(THEME_STORAGE_KEY);
        else
            localStorage.setItem(THEME_STORAGE_KEY, value);
    }
    const state = snapshot(value);
    _store.set(state);
    _applyToDOM(value, state.resolved);
    _dispatchEvent(value, state.resolved);
    if (persistDesktop && !managedFrame) {
        const mode = appearanceModeForTheme(value);
        const bridge = typeof window === 'undefined'
            ? null
            : window.mygo;
        if (mode && typeof bridge?.call === 'function') {
            void setDesktopAppearanceMode(mode).catch(error => {
                console.warn('Could not persist the Hypercanvas desktop appearance preference.', error);
            });
        }
    }
}
/** Apply a local theme selection and mirror its effective mode to MyGo when available. */
export function setTheme(value) {
    applyTheme(value, true);
}
/** Apply a Go-owned appearance snapshot without writing it back as a new preference. */
export function applyDesktopAppearance(mode) {
    // This barrel can load before the virtual config module. Choosing from the
    // fallback registry now would overwrite a stored custom theme that arrives
    // in the real registry a moment later. Reconcile when config is seeded.
    if (getConfigSnapshot() === '0') {
        _pendingDesktopAppearance = mode;
        return false;
    }
    // Effective URL state wins over desktop snapshots, including a managed
    // frame's inherited `_sb_canvas_theme` transport value. Startup events must
    // not turn inheritance into a new explicit per-frame override.
    if (readEffectiveUrlTheme()) {
        _pendingDesktopAppearance = null;
        return true;
    }
    if (mode === 'system') {
        applyTheme('system', false);
        return true;
    }
    const registry = themesConfig().themes;
    if (!isRecord(registry))
        return false;
    const currentMode = appearanceModeForTheme(_current);
    const selected = currentMode === mode
        ? _current
        : Object.entries(registry).find(([, theme]) => {
            const attrs = isRecord(theme) && isRecord(theme.attrs) ? theme.attrs : null;
            return attrs?.['data-color-mode'] === mode;
        })?.[0] || null;
    if (!selected)
        return false;
    applyTheme(selected, false);
    return true;
}
export const themeState = { subscribe: _store.subscribe };
/**
 * Get a copy of the current per-surface sync map.
 */
export function getSurfaceSync() { return { ..._syncTargets }; }
/**
 * Set the sync flag for a single surface. Persisted to localStorage.
 */
export function setSurfaceSync(surfaceId, value) {
    _syncTargets = { ..._syncTargets, [surfaceId]: value };
    _syncStore.set(_syncTargets);
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(_syncTargets));
        markSyncDefaultsCurrent();
    }
    const state = snapshot(_current);
    _applyToDOM(_current, state.resolved);
    _dispatchEvent(_current, state.resolved);
}
export const surfaceSyncState = { subscribe: _syncStore.subscribe };
/**
 * Convenience accessor — what theme is the given surface currently
 * resolving to?
 */
export function getResolvedFor(surfaceId) {
    const resolved = resolveTheme(_current);
    return computeBySurface(themesConfig(), resolved, _syncTargets)[surfaceId] || 'light';
}
// ---------------------------------------------------------------------------
// Backward-compat exports
// ---------------------------------------------------------------------------
/**
 * Derived from the active config. Kept so existing switchers
 * (ThemeMenuButton, CoreUIBar, paletteTheme) keep working until they migrate
 * to the config-driven shape. Always reflects the current registry.
 */
export const THEMES = new Proxy([], {
    get(_target, prop) {
        const configuredThemes = themesConfig().themes;
        const themes = isRecord(configuredThemes) ? configuredThemes : {};
        const list = Object.entries(themes).map(([value, definition]) => ({
            value,
            name: isRecord(definition) && typeof definition.label === 'string' && definition.label
                ? definition.label
                : value,
        }));
        // "system" is a synthetic theme — surface it at the top if not present
        // and the default is system. (Matches the legacy fixed ordering.)
        if (!list.some(t => t.value === 'system')) {
            list.unshift({ name: 'System', value: 'system' });
        }
        const value = Reflect.get(list, prop, list);
        return typeof value === 'function' ? value.bind(list) : value;
    },
});
export function getThemeSyncTargets() {
    return getSurfaceSync();
}
export function setThemeSyncTarget(target, value) {
    setSurfaceSync(String(target), value);
}
export const themeSyncState = {
    subscribe(run) { return _syncStore.subscribe((v) => run(v)); },
};
// ---------------------------------------------------------------------------
// OS preference + cross-frame storage listeners
// ---------------------------------------------------------------------------
if (typeof window !== 'undefined') {
    const historyWithObserver = window.history;
    if (!historyWithObserver.__hypercanvasThemeUrlObserver) {
        for (const method of ['pushState', 'replaceState']) {
            const original = window.history[method];
            window.history[method] = function (...args) {
                const result = original.apply(this, args);
                window.dispatchEvent(new Event('storyboard:url-state-changed'));
                return result;
            };
        }
        historyWithObserver.__hypercanvasThemeUrlObserver = true;
    }
    const syncThemeFromUrl = () => {
        const next = readEffectiveUrlTheme() || readStoredTheme(themesConfig());
        if (next === _current)
            return;
        _current = next;
        const state = snapshot(next);
        _store.set(state);
        _applyToDOM(next, state.resolved);
        _dispatchEvent(next, state.resolved);
    };
    window.addEventListener('storyboard:url-state-changed', syncThemeFromUrl);
    window.addEventListener('popstate', syncThemeFromUrl);
    window.addEventListener('message', event => {
        if (event.source !== window.parent || !isRecord(event.data) || typeof event.data.theme !== 'string')
            return;
        if (event.data.type === 'storyboard:embed:set-theme') {
            applyEmbeddedFrameTheme(event.data.theme, typeof event.data.inheritedTheme === 'string' ? event.data.inheritedTheme : undefined);
        }
        if (event.data.type === 'storyboard:embed:sync-theme')
            syncEmbeddedFrameTheme(event.data.theme);
    });
    window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', () => {
        if (_current !== 'system')
            return;
        const state = snapshot('system');
        _store.set(state);
        _applyToDOM('system', state.resolved);
        _dispatchEvent('system', state.resolved);
    });
    // Cross-frame sync via the storage event: prototype iframes share the
    // same origin as the parent, so a localStorage write from the toolbar
    // theme switcher needs to repaint the iframe too.
    window.addEventListener('storage', (e) => {
        if (e.storageArea !== localStorage)
            return;
        if (e.key === THEME_STORAGE_KEY || e.key === null) {
            const next = readEffectiveUrlTheme() || readStoredTheme(themesConfig());
            _current = next;
            const state = snapshot(next);
            _store.set(state);
            _applyToDOM(next, state.resolved);
            _dispatchEvent(next, state.resolved);
        }
        else if (e.key === SYNC_STORAGE_KEY) {
            _syncTargets = readStoredSync(themesConfig());
            _syncStore.set(_syncTargets);
            const state = snapshot(_current);
            _applyToDOM(_current, state.resolved);
            _dispatchEvent(_current, state.resolved);
        }
    });
}
// ---------------------------------------------------------------------------
// Boot — install observer and paint immediately
// ---------------------------------------------------------------------------
// The startup client can receive Go's preference before React or this module
// loads. Adopt it before painting, then keep receiving it even if React fails.
if (typeof window !== 'undefined') {
    let appearanceSequence = -1;
    const receive = (incoming) => {
        if (!isRecord(incoming) || incoming.schemaVersion !== 1
            || !Number.isSafeInteger(incoming.sequence) || Number(incoming.sequence) < 0
            || Number(incoming.sequence) <= appearanceSequence
            || !['system', 'light', 'dark'].includes(String(incoming.mode))
            || !['light', 'dark'].includes(String(incoming.resolved)))
            return;
        appearanceSequence = Number(incoming.sequence);
        applyDesktopAppearance(incoming.mode);
    };
    receive(window.__HYPERCANVAS_DESKTOP_APPEARANCE__);
    window.addEventListener('hypercanvas:desktop-appearance', event => receive(event.detail));
}
_installSurfaceObserver();
_applyToDOM(_current, resolveTheme(_current));
