/**
 * Canvas Collision Detection — Find collision-free positions for widgets.
 *
 * When placing or moving widgets, this module checks for overlaps with
 * existing widgets and adjusts the position until no collisions remain.
 *
 * Widget default sizes are resolved from the merged widget registry
 * (consumer-registered via `storyboard.config.json.widgets` over built-in
 * `widgets.config.json`) so custom widget types autoplace correctly.
 */
interface WidgetSize {
    width: number;
    height: number;
}
interface Point {
    x: number;
    y: number;
}
interface Rect extends Point {
    width: number;
    height: number;
}
interface CanvasWidget extends Record<string, unknown> {
    id?: string;
    type: string;
    position?: Point;
    props?: {
        width?: number;
        height?: number;
        [key: string]: unknown;
    };
}
interface PlacementOptions extends WidgetSize, Point {
    widgets: CanvasWidget[];
    excludeId?: string | null;
    gridSize?: number;
    gap?: number | null;
    maxIterations?: number;
    preferAxis?: 'horizontal' | 'vertical';
}
/**
 * Snapshot of default sizes for all known widget types. Re-resolved on
 * every access so consumer-registered widget sizes are reflected without
 * a server restart.
 */
export declare const DEFAULT_SIZES: Record<string, WidgetSize>;
/**
 * Get the default size for a widget type. Resolves from the merged registry
 * (consumer-registered widgets override built-ins).
 * @param {string} type - Widget type
 * @returns {{ width: number, height: number }}
 */
export declare function getDefaultSize(type: string): WidgetSize;
/**
 * Get the bounding box of a widget.
 * @param {object} widget - Widget with position and props
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
export declare function getWidgetBounds(widget: CanvasWidget): Rect;
/**
 * Compute persistent bounds metadata for a widget.
 * Returns { width, height, startX, startY, endX, endY }.
 * @param {object} widget - Widget with position, props, and type
 * @returns {{ width: number, height: number, startX: number, startY: number, endX: number, endY: number }}
 */
export declare function computeWidgetBounds(widget: CanvasWidget): WidgetSize & {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
};
/**
 * Stamp bounds metadata onto a widget, returning a new widget object.
 * @param {object} widget
 * @returns {object} Widget with `bounds` field
 */
export declare function stampBounds<T extends CanvasWidget>(widget: T): T & {
    bounds: ReturnType<typeof computeWidgetBounds>;
};
/**
 * Stamp bounds on every widget in an array.
 * @param {object[]} widgets
 * @returns {object[]}
 */
export declare function stampBoundsAll<T extends CanvasWidget>(widgets: T[]): Array<T & {
    bounds: ReturnType<typeof computeWidgetBounds>;
}>;
/**
 * Check if two rectangles overlap.
 * @param {{ x: number, y: number, width: number, height: number }} a
 * @param {{ x: number, y: number, width: number, height: number }} b
 * @returns {boolean}
 */
export declare function rectsOverlap(a: Rect, b: Rect): boolean;
/**
 * Check if a proposed position collides with any existing widget.
 * @param {{ x: number, y: number, width: number, height: number }} rect - Proposed bounds
 * @param {object[]} widgets - Existing widgets array
 * @param {string} [excludeId] - Widget ID to exclude (for move operations)
 * @returns {object[]} - All colliding widgets (empty array if none)
 */
export declare function findCollisions(rect: Rect, widgets: CanvasWidget[], excludeId?: string | null): CanvasWidget[];
/**
 * Check if a proposed position collides with any existing widget.
 * Returns the first colliding widget (for backwards compatibility).
 * @param {{ x: number, y: number, width: number, height: number }} rect - Proposed bounds
 * @param {object[]} widgets - Existing widgets array
 * @param {string} [excludeId] - Widget ID to exclude (for move operations)
 * @returns {object|null} - The first colliding widget, or null if no collision
 */
export declare function findCollision(rect: Rect, widgets: CanvasWidget[], excludeId?: string | null): CanvasWidget | null;
/**
 * Snap a value to grid.
 * @param {number} value
 * @param {number} gridSize
 * @returns {number}
 */
export declare function snapToGrid(value: number, gridSize: number): number;
/**
 * Find a collision-free position for a widget.
 *
 * Strategy:
 * 1. Try the initial position
 * 2. Phase 1 — move along the primary axis (default horizontal) past colliders
 * 3. Phase 2 — fall back to the orthogonal axis (default vertical) past colliders
 * 4. Snap final position to grid
 *
 * Use `preferAxis: 'vertical'` to swap the phase order — useful when widgets
 * are being fanned out around a reference widget (e.g. hub layouts) where
 * moving horizontally further away from the reference defeats the placement
 * intent. Examples: 'right' / 'left' / 'above-right' / 'below-right'.
 *
 * @param {object} options
 * @param {number} options.x - Initial X position
 * @param {number} options.y - Initial Y position
 * @param {number} options.width - Widget width
 * @param {number} options.height - Widget height
 * @param {object[]} options.widgets - Existing widgets array
 * @param {string} [options.excludeId] - Widget ID to exclude (for move operations)
 * @param {number} [options.gridSize=24] - Grid size for snapping
 * @param {number} [options.gap] - Gap between widgets (defaults to gridSize)
 * @param {number} [options.maxIterations=50] - Max collision resolution attempts
 * @param {'horizontal'|'vertical'} [options.preferAxis='horizontal'] - Which axis to try first
 * @returns {{ x: number, y: number, adjusted: boolean }}
 */
export declare function findFreePosition({ x, y, width, height, widgets, excludeId, gridSize, gap, maxIterations, preferAxis, }: PlacementOptions): Point & {
    adjusted: boolean;
};
/**
 * Resolve collision for a widget being placed or moved.
 * Convenience wrapper that extracts size from widget type/props.
 *
 * @param {object} options
 * @param {number} options.x - Target X position
 * @param {number} options.y - Target Y position
 * @param {string} options.type - Widget type
 * @param {object} [options.props={}] - Widget props (may contain width/height)
 * @param {object[]} options.widgets - Existing widgets array
 * @param {string} [options.excludeId] - Widget ID to exclude
 * @param {number} [options.gridSize=24] - Grid size
 * @returns {{ x: number, y: number, adjusted: boolean }}
 */
export declare function resolvePosition({ x, y, type, props, widgets, excludeId, gridSize, gap, preferAxis, }: Pick<PlacementOptions, 'x' | 'y' | 'widgets' | 'excludeId' | 'gridSize' | 'gap' | 'preferAxis'> & {
    type: string;
    props?: {
        width?: number;
        height?: number;
        [key: string]: unknown;
    };
}): Point & {
    adjusted: boolean;
};
/**
 * Find the best anchor pair between two widgets.
 * Considers both distance and overlap avoidance:
 * 1. Prefers paths that don't overlap either widget
 * 2. Among valid paths, picks the shortest
 * 3. Falls back to shortest path if all overlap
 *
 * @param {object} widgetA — source widget
 * @param {object} widgetB — target widget
 * @returns {{ startAnchor: string, endAnchor: string }}
 */
export declare function findBestAnchors(widgetA: CanvasWidget, widgetB: CanvasWidget): {
    startAnchor: string;
    endAnchor: string;
};
export {};
