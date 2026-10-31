/**
 * Durable Notebook-owned storage for Frame snapshots.
 *
 * Layout (portable Notebook content):
 *   assets/canvas/snapshots/frames/<sourceKey>/manifest.json
 *   assets/canvas/snapshots/frames/<sourceKey>/<digest>-light.png
 *   assets/canvas/snapshots/frames/<sourceKey>/<digest>-dark.png
 *
 * Private, runtime-only freshness/error metadata:
 *   .hypercanvas/frame-captures/<sourceKey>.json
 *
 * Writes are atomic: image bytes are validated, written to a temporary file,
 * renamed into place, and only then is the manifest atomically replaced. The
 * manifest is the single source of truth for which images are live; older
 * image files are pruned once unreferenced and past a grace period so
 * concurrent readers never observe a missing referenced file.
 */
import type { FrameSnapshotTarget } from './frameSnapshotContract.js';
type SnapshotVariant = 'light' | 'dark';
interface SnapshotImageEntry {
    file: string;
    digest: string;
    bytes: number;
    width: number;
    height: number;
    stale?: boolean;
    updatedAt?: string;
}
interface SnapshotVariantDescriptor {
    dataUrl: string;
    file: string;
    digest: string;
    bytes: number;
    stale: boolean;
}
export interface FrameSnapshotDescriptor {
    sourceKey: string;
    kind: string | null;
    target: FrameSnapshotTarget | null;
    viewport: {
        width: number;
        height: number;
    } | null;
    status: 'ready' | 'error' | 'missing';
    partial?: boolean;
    light: SnapshotVariantDescriptor | null;
    dark: SnapshotVariantDescriptor | null;
    updatedAt: string | null;
    error?: unknown;
}
/** Read PNG pixel dimensions from the IHDR chunk, or null for invalid data. */
export declare function readPngSize(image: Buffer | Uint8Array): {
    width: number;
    height: number;
} | null;
/**
 * Read the live snapshot descriptor for one target: data URLs for each
 * captured theme variant plus a status. Never throws for missing or corrupt
 * assets — absent previews surface as status 'missing'.
 */
export declare function readFrameSnapshot(notebookRoot: string, sourceKey: string): Promise<FrameSnapshotDescriptor>;
/**
 * Persist one captured theme variant. The image is written and validated
 * first; the manifest — which publishes the variant — is replaced only after
 * the image bytes are durable.
 */
export declare function writeFrameSnapshot({ notebookRoot, sourceKey, target, variant, image, stale }: {
    notebookRoot: string;
    sourceKey: string;
    target: FrameSnapshotTarget | null;
    variant: SnapshotVariant;
    image: Buffer | Uint8Array;
    stale?: boolean;
}): Promise<SnapshotImageEntry>;
/** Best-effort private record of the last capture failure for a target. */
export declare function writeFrameCaptureError(notebookRoot: string, sourceKey: string, error: unknown): Promise<void>;
/**
 * Adopt a legacy `.storyboard/site-captures` PNG into the portable store.
 * Legacy captures cover the full widget height (including the title bar), so
 * they are marked stale: they remain a visible last-good fallback until a
 * fresh content-viewport capture replaces them. The legacy file is retained.
 */
export declare function adoptLegacySiteCapture({ notebookRoot, sourceKey, target, variant, legacyPath }: {
    notebookRoot: string;
    sourceKey: string;
    target: FrameSnapshotTarget;
    variant: SnapshotVariant;
    legacyPath: string;
}): Promise<boolean>;
export {};
