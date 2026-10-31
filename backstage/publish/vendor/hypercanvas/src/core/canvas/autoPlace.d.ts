import type { CanvasAutoPlaceInput } from '../stores/canvasConfig.js';
export interface AutoPlacePoint {
    x: number;
    y: number;
}
export interface AutoPlaceMoving {
    id: string;
    position: AutoPlacePoint;
    width: number;
    height: number;
}
export interface AutoPlaceStationary extends AutoPlacePoint {
    id: string;
    width: number;
    height: number;
}
export interface AutoPlaceOptions {
    moving: AutoPlaceMoving[];
    stationary: AutoPlaceStationary[];
    primaryId: string;
    primaryPosition: AutoPlacePoint;
    zoom?: number;
    align?: boolean;
    nudgeOffsets?: CanvasAutoPlaceInput;
    boundaryPad?: number;
    preserveMovingOffsets?: boolean;
    /** Stationary rectangles that must remain fixed while other peers make room. */
    fixedStationaryIds?: string[];
    /** Pointer drops keep the moving widget/group in place and resolve collisions by moving peers. */
    movingPriority?: boolean;
}
/** Shared geometry for drop nudges and live nudge/overlap feedback. */
export declare function getAutoPlacePreview({ moving, stationary, primaryId, primaryPosition, zoom, align, nudgeOffsets, boundaryPad, preserveMovingOffsets, fixedStationaryIds, movingPriority }: AutoPlaceOptions): {
    placements: Map<string, AutoPlacePoint>;
    inRangeIds: Set<string>;
};
export declare function resolveAutoPlaceDrop(options: AutoPlaceOptions): Map<string, AutoPlacePoint>;
/** Prefer the current setting while continuing to read canvases saved before Auto place existed. */
export declare function isAutoPlaceEnabled(canvas?: {
    autoPlace?: unknown;
    snapToGrid?: unknown;
    [key: string]: unknown;
} | null): {};
