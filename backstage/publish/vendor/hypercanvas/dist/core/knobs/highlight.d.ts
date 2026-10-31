/**
 * Knob highlight — in-page outline + label overlay for `[data-knob-id]`
 * elements while the toolbar Knobs panel is open.
 *
 * Schema:
 *   - Each knob def MAY include a `knobMeta` object.
 *   - `knobMeta.color`: hex string like `#ff8800` (3/4/6/8 digit). Optional.
 *     When absent or malformed, the default Primer blue is used.
 *
 * Consumer DX:
 *   - Sprinkle `data-knob-id="<knob.id>"` on any DOM element you want
 *     associated with a knob.
 *   - While the Knobs panel is open, that element gets a colored outline
 *     and a top-left badge showing the knob's label.
 *
 * Two halves:
 *   1. `resolveKnobColor(def)` — pure helper; safe to call from anywhere
 *      (used by both `KnobsForm.jsx` to render the panel dot AND by the
 *      installer to stamp `--sb-knob-color` on highlighted elements).
 *   2. `installKnobsHighlight({ basePath })` — one-shot side-effect that:
 *        - subscribes to the hash so it reacts to the panel open/close
 *        - subscribes to navigation (pushState/replaceState/popstate)
 *        - mounts a MutationObserver so newly-rendered marked elements
 *          inherit the highlight while the panel is open
 *        - stamps `<html data-sb-knobs-active="">` for the CSS to react
 *        - on each repaint, walks `[data-knob-id]` elements, looks up
 *          the matching knob in the current prototype's flattened knob
 *          list, and sets `--sb-knob-color` + `data-knob-label`
 *
 * Installed once from `mountStoryboardCore`. Idempotent.
 */
import type { KnobDefinition } from './contracts.js';
export declare const DEFAULT_KNOB_COLOR = "#0969da";
export declare function resolveKnobColor(def: KnobDefinition | undefined): string;
/**
 * True when a knob has explicitly opted into the in-page highlight overlay.
 *
 * Authoring intent: most knobs are just controls and shouldn't paint
 * outlines on the page when the panel is open. Only knobs that map to a
 * specific element worth pointing out should opt in via
 * `knobMeta: { highlight: true }`.
 *
 * The skill (see `storyboard-knobs/SKILL.md`) instructs authors to also
 * supply a distinct `knobMeta.color` so multiple highlights on the same
 * page don't collide — but a missing color is not an error; it falls
 * back to the default blue.
 */
export declare function isKnobHighlightEnabled(def: KnobDefinition | undefined): boolean;
/**
 * Install the in-page knob highlight overlay. Safe to call multiple
 * times; only installs once. No-op outside a browser environment.
 *
 */
export declare function installKnobsHighlight(options?: {
    basePath?: string;
}): void;
/**
 * Tear down the highlight overlay (test-only convenience).
 * Production code never calls this — install once at mount and live with it.
 */
export declare function uninstallKnobsHighlight(): void;
