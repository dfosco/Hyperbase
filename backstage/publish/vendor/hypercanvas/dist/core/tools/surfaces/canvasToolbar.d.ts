/**
 * Canvas Toolbar surface — floating bar at bottom-left on canvas pages.
 *
 * Only visible when a canvas page is active. Supports menus and
 * custom render types like zoom-control.
 */
export declare const id = "canvas-toolbar";
export declare const label = "Canvas Toolbar";
export declare const position = "bottom-left";
export declare const renderTypes: readonly ["menu", "zoom-control"];
