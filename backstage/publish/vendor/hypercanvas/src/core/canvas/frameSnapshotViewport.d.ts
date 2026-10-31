/**
 * Pure, dependency-free viewport math for Frame snapshots.
 *
 * Shared by the browser Frame renderers (PrototypeEmbed, SiteFrame) and the
 * Node-only capture service so both agree on the exact content viewport a
 * snapshot represents: widget chrome (the title bar) is excluded, Prototype
 * zoom scales the embedded document, and dimensions are integer-rounded.
 */
export declare const FRAME_HEADER_HEIGHT = 37;
interface SizeInput {
    width?: unknown;
    height?: unknown;
}
interface PrototypeViewportInput extends SizeInput {
    zoom?: unknown;
}
interface FrameTargetIdentity {
    kind?: unknown;
    src?: unknown;
    siteId?: unknown;
    route?: unknown;
    zoom?: unknown;
}
/** Content viewport of a Prototype Frame widget at its persisted zoom. */
export declare function prototypeContentViewport({ width, height, zoom }?: PrototypeViewportInput): {
    width: number;
    height: number;
};
/** Content viewport of a Site Frame widget (title bar excluded). */
export declare function siteContentViewport({ width, height }?: SizeInput): {
    width: number;
    height: number;
};
/** Hard bounds applied to any capture viewport before launching a browser. */
export declare function clampCaptureViewport(viewport?: SizeInput): {
    width: number;
    height: number;
};
/**
 * Stable identity of a Frame target excluding its viewport, used client-side
 * to decide whether a previous preview may be retained as a stale fallback
 * across resizes (same logical route) or must be discarded (new route).
 */
export declare function frameTargetIdentityKey(target?: FrameTargetIdentity): string;
export {};
