/**
 * Presentation Store — consumer-supplied overrides for storyboard chrome elements.
 *
 * A chrome element is any rendered piece of storyboard UI that is wrapped in
 * `<ChromeSlot id="...">` (toolbar buttons, canvas title, page selector, etc.).
 *
 * Consumers seed this registry through `mountStoryboardCore({ presentation })`
 * and the store applies per-element overrides at render time:
 *
 *   {
 *     "tool:command-palette": {
 *       style:     { transform: 'translateY(20px)', opacity: 0 },
 *       className: 'landing-floating-button',
 *       props:     { onPointerEnter: handleHover },
 *       decorator: (Element, ctx) => <ScrollAnimator>{Element}</ScrollAnimator>,
 *     },
 *     "canvas:title": { hidden: true },
 *   }
 *
 * This is an **advanced, undocumented** extension surface — intended for
 * landing-page / hero canvas use cases where the consumer needs heavy
 * customization of storyboard chrome. Not part of the public API.
 *
 * Framework-agnostic (zero npm dependencies).
 */
export interface PresentationOverride {
    /** Spread onto the chrome element root style. */
    style?: object;
    /** Appended to the chrome element root className. */
    className?: string;
    /** Spread as additional props on the chrome element. */
    props?: Record<string, unknown>;
    /** Wrap an element in a consumer-provided decorator. */
    decorator?: (element: unknown, context: unknown) => unknown;
    /** If true, render null. */
    hidden?: boolean;
}
/**
 * Seed the presentation registry from a consumer-supplied map.
 * Replaces any previous overrides. Called once at app startup.
 *
 * @param {Record<string, PresentationOverride>} [map]
 */
export declare function initPresentation(map?: Record<string, PresentationOverride> | null): void;
/**
 * Set or replace a single chrome element's presentation override.
 * @param {string} id
 * @param {PresentationOverride|null|undefined} override Pass null/undefined to clear.
 */
export declare function setPresentation(id: string, override?: PresentationOverride | null): void;
/**
 * Get the presentation override for a chrome element ID, or null if none.
 * @param {string} id
 * @returns {PresentationOverride|null}
 */
export declare function getPresentation(id: string): PresentationOverride | null;
/**
 * Subscribe to presentation registry changes. Returns an unsubscribe fn.
 * Compatible with `useSyncExternalStore` shape.
 * @param {Function} callback
 * @returns {Function}
 */
export declare function subscribeToPresentation(callback: () => void): () => boolean;
/**
 * Snapshot version for change detection. Compatible with `useSyncExternalStore`.
 * @returns {string}
 */
export declare function getPresentationSnapshot(): string;
/** Reset all state. Only for tests. */
export declare function _resetPresentation(): void;
