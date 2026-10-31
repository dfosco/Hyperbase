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
import type { PresentationOverride } from './stores/presentationStore.js';
import type { WidgetDefinition } from './stores/widgetRegistry.js';
export { computeEmbedNavigationSrc } from './embedNavigation.js';
type UnknownRecord = Record<string, unknown>;
type ToolbarConfig = UnknownRecord & {
    tools?: UnknownRecord & {
        repository?: UnknownRecord;
    };
    menus?: {
        command?: {
            actions?: Array<UnknownRecord & {
                id?: string;
                url?: string;
            }>;
        };
    };
};
type StoryboardConfig = UnknownRecord & {
    customerMode?: unknown;
    featureFlags?: Record<string, boolean>;
    plugins?: Record<string, boolean>;
    ui?: UnknownRecord;
    canvas?: UnknownRecord;
    commandPalette?: UnknownRecord & {
        sections?: Array<UnknownRecord & {
            id: string;
        }>;
    };
    comments?: {
        discussions?: {
            category?: string | null;
        } | null;
    } | null;
    repository?: {
        owner?: string | null;
        name?: string | null;
    } | null;
    toolbar?: ToolbarConfig;
};
type ToolHandlers = Record<string, (...args: unknown[]) => Promise<unknown>>;
interface MountOptions {
    basePath?: string;
    container?: HTMLElement;
    handlers?: ToolHandlers;
    presentation?: Record<string, PresentationOverride>;
    widgets?: Record<string, WidgetDefinition>;
    loadUIStyles?: boolean;
    replace?: boolean;
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
export declare function resolveCanvasHomepageTarget(canvasHomepage: unknown): string;
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
export declare function mountStoryboardCore(config?: StoryboardConfig, options?: MountOptions): Promise<void>;
