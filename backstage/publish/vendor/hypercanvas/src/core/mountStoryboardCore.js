/**
 * mountStoryboardCore — single entry point for consumer apps.
 *
 * Initializes all storyboard systems (URL state, history, comments, devtools)
 * Consumers call this once at app startup.
 *
 * Usage:
 *   import { mountStoryboardCore } from './index.js'
 *   import storyboardConfig from '../storyboard.config.json'
 *   mountStoryboardCore(storyboardConfig, { basePath: import.meta.env.BASE_URL })
 */
import { applyHideUIFromUrl } from './session/chromeVisibility.js';
import { installHideParamListener } from './session/interceptHideParams.js';
import { installHistorySync } from './session/hideMode.js';
import { installBodyClassSync } from './session/bodyClasses.js';
import { installKnobsHighlight } from './knobs/highlight.js';
import { applyEarlyTheme as bootstrapEarlyTheme } from './stores/themeBootstrap.js';
import { getConfig as getSchemaDefaulted } from './stores/configSchema.js';
import { initPresentation } from './stores/presentationStore.js';
import { initWidgetRegistry } from './stores/widgetRegistry.js';
import { initCanvasInteraction } from './stores/canvasInteractionStore.js';
import { initCommentsConfig, isCommentsEnabled } from './comments/config.js';
import { initFeatureFlags } from './stores/featureFlags.js';
import { initPlugins } from './stores/plugins.js';
import { initUIConfig, addHiddenItems } from './stores/uiConfig.js';
import { initCanvasConfig } from './stores/canvasConfig.js';
import { initCommandPaletteConfig } from './stores/commandPaletteConfig.js';
import { initToolbarConfig, consumeClientToolbarOverrides } from './stores/toolbarConfigStore.js';
import { initCustomerModeConfig, getCustomerModeConfig, resolveHomepageTarget, isCustomerHidingAllTools, isCustomerHidingCommandPalette, isCustomerHidingBranchBar, } from './stores/customerModeConfig.js';
import { getConfig } from './stores/configStore.js';
import { deepMerge } from './data/loader.js';
import { computeEmbedNavigationSrc } from './embedNavigation.js';
export { computeEmbedNavigationSrc } from './embedNavigation.js';
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function booleanRecord(value) {
    if (!isRecord(value))
        return null;
    const entries = Object.entries(value);
    if (entries.some(([, entry]) => typeof entry !== 'boolean'))
        return null;
    return Object.fromEntries(entries);
}
function nonEmptyRecord(value) {
    return isRecord(value) && Object.keys(value).length > 0 ? value : null;
}
// Desktop shell (Tauri, macOS overlay title bar) — reserve vertical space for
// the native traffic lights so fixed top chrome renders below them. Consumers
// can override the inset by setting --sb-window-inset-top themselves.
if (typeof window !== 'undefined' && Reflect.get(window, '__TAURI_INTERNALS__') && !document.documentElement.style.getPropertyValue('--sb-window-inset-top')) {
    document.documentElement.style.setProperty('--sb-window-inset-top', '54px');
}
/**
 * Apply customer-mode side effects that need to run synchronously BEFORE
 * router instantiation: CSS classes (so first paint already shows the
 * right chrome state) and the homepage redirect (so the router reads the
 * redirected pathname instead of `/`).
 *
 * The additive `ui.hide` registrations (`tools.hide` / `branchBar`) live in
 * a separate phase (`applyCustomerModeHiddenItems`) because they MUST run
 * after `initUIConfig`, which would otherwise clobber the Set.
 *
 * - `enabled`: adds `storyboard-customer-mode` class to <html> (for CSS hooks
 *   and runtime gating of dev-only chrome).
 * - `tools === "none"`: forces all chrome hidden (toolbars, etc.) by adding
 *   the `storyboard-customer-hide-chrome`, `storyboard-chrome-hidden`, and
 *   `storyboard-chrome-completely-hidden` classes. `storyboard-customer-hide-chrome`
 *   is kept (for back-compat with consumer CSS) and is also what gates the
 *   Cmd+. toggle so it can't reveal hidden chrome.
 * - `commandPalette === false`: adds `storyboard-customer-hide-command-palette`
 *   so the Cmd+K listener in `CommandPalette.jsx` no-ops.
 * - `homepage`:
 *   - `false` → no redirect; default workspace renders.
 *   - `true`  → no redirect, but `Workspace`/`SimpleWorkspace` render empty.
 *   - string starting with `http(s)://` → `window.location.replace(url)`
 *     before mount; never returns.
 *   - string starting with `/` → `history.replaceState` to that path.
 *   - bare string (canvas id shorthand) → `history.replaceState` to
 *     `/canvas/<id>`.
 *   In all path-redirect cases, only the homepage routes (`/`,
 *   `/workspace`, `/viewfinder`) are rewritten — internal navigation is
 *   untouched.
 */
function applyCustomerMode(basePath) {
    if (typeof document === 'undefined')
        return;
    const cfg = getCustomerModeConfig();
    if (!cfg.enabled)
        return;
    document.documentElement.classList.add('storyboard-customer-mode');
    if (isCustomerHidingAllTools()) {
        document.documentElement.classList.add('storyboard-customer-hide-chrome');
        document.documentElement.classList.add('storyboard-chrome-hidden');
        document.documentElement.classList.add('storyboard-chrome-completely-hidden');
    }
    if (isCustomerHidingCommandPalette()) {
        document.documentElement.classList.add('storyboard-customer-hide-command-palette');
    }
    // Resolve and apply the homepage redirect. `true` means "no redirect, but
    // render the workspace empty" — handled by Workspace/SimpleWorkspace.
    const homepage = cfg.homepage;
    if (homepage && homepage !== true && typeof window !== 'undefined') {
        const resolved = resolveHomepageTarget(homepage);
        if (/^https?:\/\//i.test(resolved)) {
            // External URL — replace the location entirely so the back button
            // doesn't bounce the user back into a storyboard page that
            // immediately re-redirects.
            window.location.replace(resolved);
            return;
        }
        const base = (basePath || '/').replace(/\/+$/, '');
        let pathname = window.location.pathname;
        let rel = pathname;
        if (base && pathname.startsWith(base))
            rel = pathname.slice(base.length) || '/';
        if (rel === '/' || rel === '/workspace' || rel === '/viewfinder') {
            const target = resolved.startsWith('/') ? resolved : `/${resolved}`;
            const url = `${base}${target}${window.location.search}${window.location.hash}`;
            window.history.replaceState(null, '', url);
        }
    }
}
/**
 * Apply the customer-mode side effects that touch the shared `uiConfig`
 * hidden-items Set. MUST run AFTER `initUIConfig`, which would otherwise
 * overwrite anything we add here.
 *
 * - `tools === { hide: [keys] }` → push each key into the Set so the
 *   standard `isMenuHidden(key)` filter in `CoreUIBar` picks them up.
 *   `tools === { only: [...] }` is handled at render time by
 *   `isCustomerToolHidden(key)` — see `CoreUIBar.jsx`.
 * - `branchBar === false` → push `"branch-bar"` so `BranchBar` skips render.
 */
function applyCustomerModeHiddenItems() {
    const cfg = getCustomerModeConfig();
    if (!cfg.enabled)
        return;
    if (cfg.tools && typeof cfg.tools === 'object' &&
        !Array.isArray(cfg.tools) && 'hide' in cfg.tools && Array.isArray(cfg.tools.hide)) {
        addHiddenItems(cfg.tools.hide);
    }
    if (isCustomerHidingBranchBar()) {
        addHiddenItems(['branch-bar']);
    }
}
/**
 * Resolve a `canvasHomepage` config value to an internal route path.
 *
 * @deprecated Use `resolveHomepageTarget` from `customerModeConfig` instead.
 *   Kept exported for back-compat with consumers that imported this helper
 *   directly. Note: this legacy variant does NOT pass through `http(s)://`
 *   URLs — `resolveHomepageTarget` is the superset.
 *
 * Accepted shapes:
 *   - "landing"          → "/canvas/landing"
 *   - "research/intake"  → "/canvas/research/intake"
 *   - "/canvas/landing"  → "/canvas/landing" (passthrough)
 *   - "/landing"         → "/landing" (passthrough — supports custom canvas _route)
 */
export function resolveCanvasHomepageTarget(canvasHomepage) {
    if (typeof canvasHomepage !== 'string' || !canvasHomepage)
        return '';
    if (canvasHomepage.startsWith('/'))
        return canvasHomepage;
    return `/canvas/${canvasHomepage}`;
}
let _mounted = false;
/**
 * Migrate localStorage keys renamed in 4.3.0.
 * Runs once at startup, idempotent: only copies if new key doesn't exist yet.
 */
function migrateLocalStorageKeys() {
    if (typeof localStorage === 'undefined')
        return;
    const renames = [
        ['sb-viewfinder-starred', 'sb-workspace-starred'],
        ['sb-viewfinder-recent', 'sb-workspace-recent'],
        ['sb-viewfinder-group-folders', 'sb-workspace-group-folders'],
    ];
    for (const [oldKey, newKey] of renames) {
        const newValue = localStorage.getItem(newKey);
        const oldValue = localStorage.getItem(oldKey);
        if (newValue === null && oldValue !== null) {
            localStorage.setItem(newKey, oldValue);
        }
    }
    migrateLegacyWorkspaceRecent();
}
/**
 * Merge legacy workspace recents into the unified recent artifacts store.
 *
 * Before unification, the workspace tracked recents in
 * `sb-workspace-recent` as an array of `"type:key"` strings, while the
 * command palette tracked the same concept in `storyboard:recent-artifacts`
 * as an array of `{type, key, label}`. The two never synced.
 *
 * This migration converts the legacy strings into typed entries and
 * merges them into the unified store (palette entries win for dedup, so
 * we preserve the freshest labels). Idempotent: tracked via
 * `sb-workspace-recent-migrated-v1` so subsequent boots skip the merge.
 */
function migrateLegacyWorkspaceRecent() {
    if (typeof localStorage === 'undefined')
        return;
    const MIGRATION_KEY = 'sb-workspace-recent-migrated-v1';
    const LEGACY_KEY = 'sb-workspace-recent';
    const UNIFIED_KEY = 'storyboard:recent-artifacts';
    const MAX_ITEMS = 30;
    try {
        if (localStorage.getItem(MIGRATION_KEY) === '1')
            return;
        const legacyRaw = localStorage.getItem(LEGACY_KEY);
        if (!legacyRaw) {
            localStorage.setItem(MIGRATION_KEY, '1');
            return;
        }
        let legacyIds;
        try {
            legacyIds = JSON.parse(legacyRaw);
        }
        catch {
            legacyIds = null;
        }
        if (!Array.isArray(legacyIds)) {
            localStorage.setItem(MIGRATION_KEY, '1');
            return;
        }
        const legacyEntries = [];
        for (const id of legacyIds) {
            if (typeof id !== 'string')
                continue;
            const colonIdx = id.indexOf(':');
            if (colonIdx <= 0)
                continue;
            const prefix = id.slice(0, colonIdx);
            const key = id.slice(colonIdx + 1);
            if (!key)
                continue;
            let type = null;
            if (prefix === 'proto')
                type = 'prototype';
            else if (prefix === 'canvas')
                type = 'canvas';
            else if (prefix === 'component')
                type = 'story';
            if (!type)
                continue;
            legacyEntries.push({ type, key, label: key });
        }
        let existing = [];
        const unifiedRaw = localStorage.getItem(UNIFIED_KEY);
        if (unifiedRaw) {
            try {
                const parsed = JSON.parse(unifiedRaw);
                if (Array.isArray(parsed))
                    existing = parsed;
            }
            catch { /* ignore */ }
        }
        const seen = new Set(existing.map(e => `${e?.type}:${e?.key}`));
        const merged = [...existing];
        for (const entry of legacyEntries) {
            const dedupKey = `${entry.type}:${entry.key}`;
            if (seen.has(dedupKey))
                continue;
            seen.add(dedupKey);
            merged.push(entry);
        }
        if (merged.length > 0) {
            localStorage.setItem(UNIFIED_KEY, JSON.stringify(merged.slice(0, MAX_ITEMS)));
        }
        localStorage.setItem(MIGRATION_KEY, '1');
    }
    catch {
        /* migration is best-effort */
    }
}
/**
 * Apply the saved theme immediately, before React mount. Delegates to the
 * shared bootstrap helper which works against the config-driven theme +
 * surface registry. Falls back to schema defaults so consumers that don't
 * define `themes` in storyboard.config.json still get the canonical
 * 4-surface setup.
 */
function applyEarlyTheme(config) {
    if (typeof document === 'undefined')
        return;
    const merged = getSchemaDefaulted(config || {});
    bootstrapEarlyTheme(merged.themes);
}
async function loadUiRuntime() {
    const loaded = await import('@dfosco/hypercanvas/ui-runtime');
    if (!isRecord(loaded) || typeof loaded.mountDevTools !== 'function' || typeof loaded.mountComments !== 'function') {
        throw new Error('The Hypercanvas UI runtime does not expose the expected mount functions');
    }
    const mountDevTools = loaded.mountDevTools;
    const mountComments = loaded.mountComments;
    return { mountDevTools, mountComments };
}
function viteBasePath() {
    const meta = import.meta;
    return meta.env?.BASE_URL || '/';
}
let _cmdClickForwarderInstalled = false;
const STUDIO_HOST_FRAME_NAME = 'storyboard-studio-host';
const STUDIO_HOST_URL_PARAM = '_sb_studio_host';
/**
 * Forward cmd/ctrl+click on `<a>` links to the host shell when this page
 * runs as a top-level tab inside Storyboard Studio's WKWebView shell.
 *
 * Webview engines — notably WKWebView powering Tauri on macOS — often
 * drop the modifier on cross-origin iframe link clicks and either
 * navigate the iframe in-place or ignore the click entirely. Calling
 * `window.open(url, '_blank')` from the click handler routes through
 * the host's window-open interceptor (Tauri's `on_new_window`), which
 * Studio uses to open a new tab. As a fallback for cases where the
 * popup is denied without the host handling it, we postMessage the URL
 * to the parent frame — Studio recognises the `studio:cmd-click`
 * payload and re-issues the open from its own context.
 *
 * Gate (must be all true):
 *   1. We are running inside an iframe (`window.parent !== window`).
 *   2. Either the host frame's `window.name` is `storyboard-studio-host`
 *      OR the URL carries `?_sb_studio_host=1`.
 *
 * Studio stamps both signals on its outer tab iframes. Canvas-internal
 * widget iframes (`PrototypeEmbed`, `StoryWidget`, `StorySetWidget`, and
 * their iframe shells served by the prototypes.html / stories.html
 * isolation middlewares) inherit neither — `window.name` is per-frame and
 * the widget URLs are built locally without the marker — so the forwarder
 * stays dormant inside them and modifier-clicks fall through to the
 * browser's default behaviour.
 */
function installCmdClickForwarder() {
    if (_cmdClickForwarderInstalled)
        return;
    if (typeof window === 'undefined' || window.parent === window)
        return;
    if (typeof document === 'undefined')
        return;
    let hasUrlMarker = false;
    try {
        hasUrlMarker = new URLSearchParams(window.location.search).has(STUDIO_HOST_URL_PARAM);
    }
    catch {
        // Malformed URL — treat as no marker.
    }
    if (window.name !== STUDIO_HOST_FRAME_NAME && !hasUrlMarker)
        return;
    _cmdClickForwarderInstalled = true;
    document.addEventListener('click', (e) => {
        if (!(e.metaKey || e.ctrlKey))
            return;
        if (e.shiftKey || e.altKey)
            return;
        if (e.button !== 0)
            return;
        if (e.defaultPrevented)
            return;
        const target = e.target;
        if (!(target instanceof Element))
            return;
        const anchor = target.closest('a[href]');
        if (!anchor)
            return;
        // Allow empty / _self / _blank. Leave named frame targets alone —
        // the page may want to drive a specific frame itself.
        const targetAttr = anchor.getAttribute('target');
        if (targetAttr && targetAttr !== '_self' && targetAttr !== '_blank')
            return;
        const href = anchor.getAttribute('href');
        if (!href)
            return;
        let resolved;
        try {
            resolved = new URL(href, window.location.href);
        }
        catch {
            return;
        }
        // Only intercept real web navigation — leave mailto:, tel:,
        // javascript:, data:, blob:, etc. to the browser's default handler.
        if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:')
            return;
        e.preventDefault();
        e.stopPropagation();
        const fullUrl = resolved.toString();
        let popup = null;
        try {
            popup = window.open(fullUrl, '_blank', 'noopener');
        }
        catch {
            // Some sandbox configurations throw on window.open — fall through
            // to the postMessage fallback below.
        }
        if (!popup) {
            // The host may have intercepted the popup (returning a denied
            // response after recording the URL) or a popup blocker stopped
            // us. Either way, broadcasting to the parent lets the host
            // re-issue the open in case the popup didn't reach it.
            try {
                window.parent.postMessage({ type: 'studio:cmd-click', url: fullUrl }, '*');
            }
            catch {
                // Nothing more we can do without parent access.
            }
        }
    }, true);
}
/**
 * Mount the full storyboard core system.
 *
 * @param {object} [config={}] - Contents of storyboard.config.json
 * @param {object} [options={}]
 * @param {string} [options.basePath='/'] - Base URL path (e.g. import.meta.env.BASE_URL)
 * @param {HTMLElement} [options.container=document.body] - Where to mount devtools
 * @param {Record<string, () => Promise<unknown>>} [options.handlers={}] - Custom tool handlers (key → lazy loader)
 * @param {Record<string, object>} [options.presentation] - Optional, advanced: per-chrome-element presentation overrides. See `core/stores/presentationStore.js` for the shape. Keep undocumented — power-user surface for landing pages and heavy chrome customization.
 * @param {Record<string, object>} [options.widgets] - Optional: custom widget registrations. Maps widget type string → WidgetDefinition. Defines the React component, label/icon, chrome wrapper opts, interaction switches (selectable/movable/resize/expandable/splitScreen/interactGate), connector anchors, toolbar features, and prop schema. Consumer entries override built-in widgets of the same type. See `DOCS/custom-widgets.md` and `core/stores/widgetRegistry.js` for the full shape.
 */
export async function mountStoryboardCore(config = {}, options = {}) {
    if (_mounted)
        return;
    _mounted = true;
    const basePath = options.basePath || '/';
    const customHandlers = options.handlers || {};
    // Seed the presentation store before any UI mounts so first render already
    // sees consumer overrides (no FOUC on hidden/decorated chrome).
    if (options.presentation) {
        initPresentation(options.presentation);
    }
    // Seed the widget registry before any canvas mounts so the first canvas
    // render already resolves custom widget components, chrome opts, and
    // interaction switches. Consumer entries override core widgets of the
    // same type entirely.
    if (options.widgets) {
        initWidgetRegistry(options.widgets);
    }
    // Migrate renamed localStorage keys (4.3.0: viewfinder → workspace)
    migrateLocalStorageKeys();
    // Plain links must ignore legacy global visibility preferences.
    applyHideUIFromUrl();
    // Apply saved theme to DOM immediately — before React mount
    applyEarlyTheme(config);
    // Apply customer mode synchronously, before any `await`. The homepage
    // redirect (`canvasHomepage` / `protoHomepage`) must mutate
    // window.location.pathname BEFORE the consumer's router reads it — and
    // because most consumers call `createBrowserRouter` and
    // `mountStoryboardCore` back-to-back without awaiting, any await in
    // this function would push the redirect past router instantiation and
    // the wrong route would render.
    //
    // Reads config.customerMode directly (skips the unified-config store)
    // so it works even when the virtual `initConfig()` hasn't run yet.
    if (config.customerMode) {
        initCustomerModeConfig(config.customerMode);
        applyCustomerMode(basePath);
    }
    // Forward cmd/ctrl+click on links to the host shell when running in
    // an iframe. Installed early so it covers both the embed-only path
    // and the full canvas/workspace mount below.
    installCmdClickForwarder();
    // Initialize framework-agnostic systems
    installHideParamListener();
    installHistorySync();
    installBodyClassSync();
    // Initialize config-driven systems.
    // The unified config store is already seeded by the virtual module's initConfig().
    // Individual stores are initialized here for backward compatibility — consumers
    // that import directly from these stores still work.
    const uc = getConfig();
    const ucFeatureFlags = booleanRecord(uc.featureFlags);
    const ucPlugins = booleanRecord(uc.plugins);
    const ucUi = nonEmptyRecord(uc.ui);
    const ucCanvas = nonEmptyRecord(uc.canvas);
    const ucCommandPalette = nonEmptyRecord(uc.commandPalette);
    const ucCustomerMode = nonEmptyRecord(uc.customerMode);
    if (ucFeatureFlags && Object.keys(ucFeatureFlags).length > 0) {
        initFeatureFlags(ucFeatureFlags);
    }
    else if (config.featureFlags) {
        initFeatureFlags(config.featureFlags);
    }
    if (ucPlugins && Object.keys(ucPlugins).length > 0) {
        initPlugins(ucPlugins);
    }
    else if (config.plugins) {
        initPlugins(config.plugins);
    }
    if (ucUi) {
        initUIConfig(ucUi);
    }
    else if (config.ui) {
        initUIConfig(config.ui);
    }
    if (ucCanvas) {
        initCanvasConfig(ucCanvas);
    }
    else if (config.canvas) {
        initCanvasConfig(config.canvas);
    }
    // Seed canvas-interaction store from the same canvas config block. Scroll
    // axis is canvas-document state; only zoom and surface remain global.
    const canvasCfg = ucCanvas || config.canvas || {};
    const zoom = isRecord(canvasCfg.zoom) ? canvasCfg.zoom : {};
    initCanvasInteraction({
        zoomGestures: zoom.gestures,
        zoomOrigin: zoom.origin,
        surface: canvasCfg.surface,
    });
    // Load and merge command palette config.
    // If the unified store has commandPalette data, use it directly.
    // Otherwise fall back to legacy merging with bundled defaults.
    if (ucCommandPalette) {
        initCommandPaletteConfig(ucCommandPalette);
    }
    else {
        const defaultCmdPaletteConfig = (await import('../../commandpalette.config.json')).default;
        if (config.commandPalette) {
            const merged = { ...defaultCmdPaletteConfig, ...config.commandPalette };
            if (config.commandPalette.sections && defaultCmdPaletteConfig.sections) {
                const clientIds = new Set(config.commandPalette.sections.map((section) => section.id));
                const preserved = defaultCmdPaletteConfig.sections.filter(s => !clientIds.has(s.id));
                merged.sections = [...config.commandPalette.sections, ...preserved];
            }
            initCommandPaletteConfig(merged);
        }
        else {
            initCommandPaletteConfig({ ...defaultCmdPaletteConfig });
        }
    }
    // Initialize customer mode config — fall back to the unified config store
    // when the consumer didn't pass customerMode directly. The early sync path
    // at the top of this function already handled the synchronous redirect for
    // consumers passing `config.customerMode` directly; this branch covers
    // consumers that seed customer-mode purely through the unified store.
    if (!config.customerMode && ucCustomerMode) {
        initCustomerModeConfig(ucCustomerMode);
        applyCustomerMode(basePath);
    }
    // Phase 2 of customer-mode application: fold per-tool/branch-bar hiding
    // into the shared `uiConfig` Set. MUST run after `initUIConfig` above so
    // those additions aren't clobbered.
    applyCustomerModeHiddenItems();
    // Initialize comments config (framework-agnostic)
    const commentsConfig = nonEmptyRecord(uc.comments) || config.comments;
    if (commentsConfig) {
        const commentBlock = isRecord(commentsConfig) ? commentsConfig : null;
        if (commentBlock) {
            const discussions = isRecord(commentBlock.discussions)
                ? { category: typeof commentBlock.discussions.category === 'string' ? commentBlock.discussions.category : null }
                : null;
            initCommentsConfig({ ...config, comments: { discussions } }, { basePath });
        }
    }
    // Inject compiled UI styles (await to prevent late restyle / FOUC). Isolated
    // prototype entries opt out so prototypes remain unstyled unless they import
    // their own Tailwind/CSS explicitly.
    if (options.loadUIStyles !== false) {
        const { injectUIStyles } = await import('./injectUIStyles.js');
        await injectUIStyles();
    }
    // Load toolbar config from the unified store.
    // The unified store already has core defaults merged with client overrides.
    // Fall back to legacy merging if unified store wasn't seeded.
    const unifiedToolbar = nonEmptyRecord(uc.toolbar);
    let toolbarConfig = unifiedToolbar ? { ...unifiedToolbar } : null;
    if (!toolbarConfig) {
        // Legacy path: unified store not seeded, merge manually
        const defaultConfig = (await import('../../toolbar.config.json')).default;
        const clientOverrides = consumeClientToolbarOverrides();
        const explicitToolbar = config.toolbar;
        if (explicitToolbar && clientOverrides) {
            toolbarConfig = deepMerge(deepMerge(defaultConfig, clientOverrides), explicitToolbar);
        }
        else if (explicitToolbar) {
            toolbarConfig = deepMerge(defaultConfig, explicitToolbar);
        }
        else if (clientOverrides) {
            toolbarConfig = deepMerge(defaultConfig, clientOverrides);
        }
        else {
            toolbarConfig = { ...defaultConfig };
        }
    }
    // Inject repository URL into the toolbar config
    const repo = isRecord(uc.repository) ? uc.repository : config.repository;
    if (typeof repo?.owner === 'string' && repo.owner && typeof repo.name === 'string' && repo.name) {
        const repoUrl = `https://github.com/${repo.owner}/${repo.name}`;
        // New tools schema
        const tools = isRecord(toolbarConfig.tools) ? toolbarConfig.tools : null;
        const repositoryTool = tools && isRecord(tools.repository) ? tools.repository : null;
        if (repositoryTool) {
            repositoryTool.url = repoUrl;
        }
        // Legacy menus schema
        const menus = isRecord(toolbarConfig.menus) ? toolbarConfig.menus : null;
        const commandMenu = menus && isRecord(menus.command) ? menus.command : null;
        if (commandMenu && Array.isArray(commandMenu.actions)) {
            const repoAction = commandMenu.actions.find((action) => isRecord(action) && action.id === 'core/repository');
            if (isRecord(repoAction))
                repoAction.url = repoUrl;
        }
    }
    // Seed the reactive toolbar config store (core → custom merge)
    initToolbarConfig(toolbarConfig);
    // Install the in-page knob highlight overlay BEFORE the embed-iframe
    // early-return so prototypes rendered inside `prototypes.html` (canvas
    // PrototypeEmbed) get the outline + label badge for `[data-knob-id]`
    // too. In iframe context the installer activates based on a
    // `?sb_knobs=1` URL param (added by PrototypeEmbed when a Knobs widget
    // is connected); in the top-frame consumer context it activates based
    // on the toolbar panel-open hash state. Idempotent.
    installKnobsHighlight({ basePath });
    // Skip all UI mounting when loaded inside a prototype embed iframe
    const isEmbed = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('_sb_embed');
    if (isEmbed) {
        // Broadcast route and hash changes to the parent canvas via postMessage
        if (window.parent !== window) {
            let lastHref = window.location.pathname + window.location.search + window.location.hash;
            function broadcastNavigation(options = {}) {
                const currentHref = window.location.pathname + window.location.search + window.location.hash;
                if (currentHref !== lastHref) {
                    lastHref = currentHref;
                    const basePath = viteBasePath().replace(/\/$/, '');
                    const src = computeEmbedNavigationSrc(window.location.pathname, window.location.hash, basePath, window.location.search);
                    window.parent.postMessage({ type: 'storyboard:embed:navigate', src, replace: options.replace === true }, '*');
                }
            }
            // Intercept pushState/replaceState, popstate, and hashchange
            const origPush = history.pushState.bind(history);
            const origReplace = history.replaceState.bind(history);
            // A full-page content host owns browser history. Avoid a second joint
            // history entry in its child frame for every React Router navigation.
            const hosted = window.frameElement?.hasAttribute('data-hypercanvas-content');
            history.pushState = (...args) => { (hosted ? origReplace : origPush)(...args); broadcastNavigation(); };
            history.replaceState = (...args) => { origReplace(...args); broadcastNavigation({ replace: true }); };
            window.addEventListener('popstate', () => broadcastNavigation({ replace: true }));
            window.addEventListener('hashchange', () => broadcastNavigation({ replace: true }));
        }
        // Forward cmd+wheel events to parent so canvas zoom works while
        // an iframe is focused. The parent's wheel handler on `document`
        // can't see events fired inside the iframe's document.
        if (window.parent !== window) {
            document.addEventListener('wheel', (e) => {
                if (!e.metaKey && !e.ctrlKey)
                    return;
                e.preventDefault();
                window.parent.postMessage({
                    type: 'storyboard:embed:wheel',
                    deltaY: e.deltaY,
                    clientX: e.clientX,
                    clientY: e.clientY,
                    altKey: e.altKey,
                }, '*');
            }, { passive: false });
        }
        return;
    }
    // Dynamically import the compiled UI bundle.
    // Uses the package self-reference so resolution differs by context:
    //   Source repo: Vite alias overrides to src/ui-entry.js (source, HMR)
    //   Consumer repos: package.json exports resolve to dist/storyboard-ui.js (compiled)
    const ui = await loadUiRuntime();
    // Mount devtools (CoreUIBar)
    if (globalThis.__HYPERCANVAS_NOTEBOOK_PUBLICATION__ !== true)
        await ui.mountDevTools({
            ...(options.container ? { container: options.container } : {}),
            basePath,
            toolbarConfig,
            customHandlers,
        });
    // Mount comments system if configured
    if (isCommentsEnabled()) {
        ui.mountComments();
    }
    // Show pending workshop notifications (e.g. canvas created before Vite reload)
    showPendingNotification(basePath);
    // Handle pending navigation (e.g. after PageSelector created a new canvas page)
    handlePendingNavigation();
}
/**
 * Check sessionStorage for a pending navigation target.
 * Used by PageSelector when creating a new canvas page — Vite does a full-reload
 * after detecting the new file, so we stash the target URL and navigate after reload.
 */
function handlePendingNavigation() {
    try {
        const target = sessionStorage.getItem('sb-pending-navigate');
        if (!target)
            return;
        sessionStorage.removeItem('sb-pending-navigate');
        window.location.href = target;
    }
    catch { /* ignore */ }
}
/**
 * Check sessionStorage for a pending workshop creation notification.
 * Vite does a full-reload when new files are created, so the create form's
 * success message is lost. This shows a temporary toast with the link.
 */
function showPendingNotification(basePath) {
    const KEYS = ['sb-canvas-created', 'sb-prototype-created', 'sb-flow-created', 'sb-story-created'];
    for (const key of KEYS) {
        try {
            const raw = sessionStorage.getItem(key);
            if (!raw)
                continue;
            sessionStorage.removeItem(key);
            const parsed = JSON.parse(raw);
            if (!isRecord(parsed) || typeof parsed.success !== 'string' || !parsed.success)
                continue;
            const message = parsed.success;
            const route = typeof parsed.route === 'string' ? parsed.route : undefined;
            const filePath = typeof parsed.path === 'string' ? parsed.path : undefined;
            // Skip toast if we're already on the created page
            if (route) {
                const currentPath = window.location.pathname;
                const fullRoute = route.startsWith('/') ? (basePath.replace(/\/$/, '') + route) : route;
                if (currentPath === fullRoute || currentPath === fullRoute + '/')
                    continue;
            }
            showToast(message, route, basePath, filePath);
            return;
        }
        catch { /* ignore malformed session entry */ }
    }
}
function showToast(message, route, basePath, filePath) {
    const toast = document.createElement('div');
    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '7rem',
        right: '1.5rem',
        zIndex: '10000',
        padding: '0.75rem 1rem',
        borderRadius: '0.75rem',
        background: 'var(--hc-color-popover, #fff)',
        color: 'var(--hc-color-foreground, #1e293b)',
        fontSize: '0.8125rem',
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        border: '1px solid var(--hc-color-border, #cbd5e1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        opacity: '0',
        transition: 'opacity 0.15s ease',
        maxWidth: '320px',
    });
    const href = route?.startsWith('/') ? (basePath.replace(/\/$/, '') + route) : route;
    const escAttr = (value) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let html = `<span style="font-weight:500">✓ ${message.replace(/</g, '&lt;')}</span>`;
    if (href) {
        html += `<a href="${escAttr(href)}" style="color:var(--hc-color-primary, #0969da);text-decoration:underline;font-size:0.8125rem">Open canvas</a>`;
    }
    if (filePath) {
        html += `<span style="font-size:0.75rem;color:var(--hc-color-muted, #64748b)">To edit your component, go to <code style="background:var(--hc-color-muted, #f1f5f9);padding:1px 4px;border-radius:3px;font-size:0.75rem">${filePath.replace(/</g, '&lt;')}</code></span>`;
    }
    toast.innerHTML = html;
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; });
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 8000);
}
