/**
 * Customer Mode Config — runtime store for the `customerMode` block of
 * `storyboard.config.json`.
 *
 * Framework-agnostic (zero npm dependencies).
 *
 * Canonical (current) shape:
 *
 *   {
 *     enabled: boolean,
 *     // Homepage control.
 *     //   false   → keep default workspace homepage
 *     //   true    → hide workspace; render empty page
 *     //   string  → redirect /, /workspace, /viewfinder to:
 *     //               "/canvas/x"   → passthrough
 *     //               "/MyProto"    → passthrough (prototype path / custom route)
 *     //               "landing"     → /canvas/landing (canvas id shorthand)
 *     //               "https://..." → external URL (replace location)
 *     homepage: false | true | string,
 *
 *     // Tools control (replaces blanket hideChrome for toolbar buttons).
 *     //   "all"            → show every tool (default)
 *     //   "none"           → hide every tool & toolbar wrapper
 *     //   { hide: [keys] } → hide listed tool keys; show rest
 *     //   { only: [keys] } → show only listed tool keys; hide rest
 *     tools: "all" | "none" | { hide?: string[] } | { only?: string[] },
 *
 *     // Independent toggles.
 *     commandPalette: boolean, // false → hide & disable Cmd+K
 *     branchBar:      boolean, // false → hide the dev/branch bar
 *   }
 *
 * Legacy shape (still accepted for back-compat — auto-mapped at init):
 *
 *   { hideChrome, hideHomepage, protoHomepage, canvasHomepage }
 *
 * Legacy fields are preserved as read-only properties on the returned config
 * (mirroring the new shape) so existing consumers continue to work without
 * change for one cycle. New code should consume the helpers below.
 */
type CustomerTools = 'all' | 'none' | {
    hide: string[];
} | {
    only: string[];
};
type Homepage = boolean | string;
interface CustomerModeConfig {
    enabled: boolean;
    homepage: Homepage;
    tools: CustomerTools;
    commandPalette: boolean;
    branchBar: boolean;
    hideChrome: boolean;
    hideHomepage: boolean;
    protoHomepage: string;
    canvasHomepage: string;
}
/**
 * Initialize customer mode config from `storyboard.config.json`'s
 * `customerMode` block. Accepts both the canonical and legacy shapes.
 *
 * @param {object} config
 */
export declare function initCustomerModeConfig(config: unknown): void;
/**
 * Get the current customer mode config in canonical shape.
 * Legacy aliases are also present on the returned object.
 */
export declare function getCustomerModeConfig(): CustomerModeConfig;
/** Master toggle. */
export declare function isCustomerMode(): boolean;
/**
 * The canonical homepage value (`false | true | string`).
 * Does NOT resolve a string to a route; use `resolveHomepageTarget` for that.
 */
export declare function getCustomerModeHomepage(): Homepage;
/**
 * True when customer mode is enabled AND the homepage should be empty or
 * redirected away (i.e. `homepage` is anything other than `false`).
 * Workspace/SimpleWorkspace use this to short-circuit to an empty render.
 */
export declare function isCustomerHidingHomepage(): boolean;
/** True when every tool is hidden via `tools: "none"`. */
export declare function isCustomerHidingAllTools(): boolean;
/**
 * Check whether a specific toolbar tool key is hidden by customer mode.
 *
 * Logic:
 *   1. `commandPalette: false` hides the `command-palette` tool (the Cmd+K
 *      trigger button) — this complements the keyboard-shortcut gating that
 *      happens via the `storyboard-customer-hide-command-palette` class.
 *   2. `tools === "none"` → all tools hidden.
 *   3. `tools === { hide: [keys] }` → hide listed.
 *   4. `tools === { only: [keys] }` → hide everything except listed.
 *
 * Returns false when customer mode is off.
 *
 * @param {string} key
 * @returns {boolean}
 */
export declare function isCustomerToolHidden(key: string): boolean;
/** True when the command palette is hidden + Cmd+K is disabled. */
export declare function isCustomerHidingCommandPalette(): boolean;
/** True when the branch bar is hidden. */
export declare function isCustomerHidingBranchBar(): boolean;
/**
 * Resolve a homepage string value to an internal route path.
 *
 * Accepted shapes:
 *   - "landing"          → "/canvas/landing"
 *   - "research/intake"  → "/canvas/research/intake"
 *   - "/canvas/landing"  → "/canvas/landing"   (passthrough)
 *   - "/landing"         → "/landing"          (passthrough — custom canvas _route)
 *   - "/MyProto"         → "/MyProto"          (passthrough — prototype path)
 *   - "https://..."      → "https://..."       (passthrough — external URL)
 *
 * Returns empty string for non-string, true, false, or empty input. Callers
 * differentiate external URLs by testing `/^https?:\/\//`.
 *
 * @param {*} homepage
 * @returns {string}
 */
export declare function resolveHomepageTarget(homepage: unknown): string;
/** @internal — reset to canonical defaults. Test-only. */
export declare function _resetCustomerModeConfig(): void;
export {};
