/**
 * Inspector Mouse Mode — DOM element selection via hover + click.
 *
 * When activated, draws a highlight overlay on the hovered element and
 * shows a tooltip with the React component name.  Clicking selects the
 * element and returns its info via the onSelect callback.
 *
 * Usage:
 *   import { createMouseMode } from './mouseMode.js'
 *   const mode = createMouseMode({
 *     onSelect: (el) => console.log('Selected:', el),
 *     onDeactivate: () => console.log('Cancelled'),
 *   })
 *   mode.activate()
 *   // later: mode.deactivate()
 */
export interface MouseModeOptions {
    onSelect?: (element: Element) => void;
    onDeactivate?: () => void;
}
export interface MouseModeHandle {
    activate: () => void;
    deactivate: () => void;
    isActive: () => boolean;
    showHighlight: (element: Element) => void;
    hideHighlight: () => void;
}
/** Create an inspector mouse mode instance. */
export declare function createMouseMode(options?: MouseModeOptions): MouseModeHandle;
