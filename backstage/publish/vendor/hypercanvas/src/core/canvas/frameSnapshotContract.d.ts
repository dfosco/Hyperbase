export declare const FRAME_SNAPSHOT_FORMAT_VERSION = 1;
export interface FrameSnapshotTargetInput {
    [extensionField: string]: unknown;
    kind?: unknown;
    siteId?: unknown;
    route?: unknown;
    src?: unknown;
    viewport?: unknown;
    width?: unknown;
    height?: unknown;
    zoom?: unknown;
}
export interface FrameSnapshotViewport {
    width: number;
    height: number;
}
export type FrameSnapshotTarget = {
    kind: 'site';
    siteId: string;
    route: string;
    viewport: FrameSnapshotViewport;
} | {
    kind: 'prototype';
    src: string;
    zoom: number;
    viewport: FrameSnapshotViewport;
};
/**
 * Canonical snapshot target for one Frame widget. Throws with stable error
 * codes for invalid input so callers can surface actionable messages.
 */
export declare function normalizeFrameSnapshotTarget(input?: FrameSnapshotTargetInput): FrameSnapshotTarget;
/** 128-bit portable identity of a snapshot target (stable across sessions). */
export declare function frameSnapshotSourceKey(target: FrameSnapshotTarget | Record<string, unknown>): string;
/** Identity of one theme variant of a target. */
export declare function frameSnapshotVariantKey(sourceKey: string, theme: unknown): string;
export declare function normalizeSnapshotTheme(value: unknown): 'light' | 'dark';
/** Expand a requested theme option into the concrete variants to capture. */
export declare function frameSnapshotThemes(value: unknown): ('light' | 'dark')[];
/**
 * Validate and absolutize a capture URL supplied by a Frame renderer. Only
 * same-origin relative paths and loopback http(s) URLs are allowed — this is
 * Frame identity, not an arbitrary screenshot service.
 */
export declare function normalizeFrameCaptureUrl(value: unknown, { origin }?: {
    origin?: unknown;
}): string;
