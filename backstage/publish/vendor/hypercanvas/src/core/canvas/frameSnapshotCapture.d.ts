/**
 * Core-owned headless capture service for Frame snapshots.
 *
 * One shared Playwright Chromium instance serves all Frame captures; each
 * target/theme pair gets an isolated browser context. Captures are
 * deduplicated and serialized (one active capture at a time, bounded queue)
 * so a canvas full of Frames cannot stampede the host. Successful variants
 * are committed atomically through the snapshot store and announced with a
 * small targeted event. Failures never destroy previously captured images.
 */
import type { FrameSnapshotDescriptor } from './frameSnapshotStore.js';
import type { FrameSnapshotTargetInput } from './frameSnapshotContract.js';
interface CaptureIdentity {
    widgetId?: string;
    canvasId?: string;
}
interface CaptureTargetInput extends FrameSnapshotTargetInput {
    captureUrl?: unknown;
}
interface CaptureOptions {
    theme?: unknown;
    force?: boolean;
    origin?: unknown;
    identity?: CaptureIdentity | null;
}
interface CaptureEvent {
    type: 'custom';
    event: 'storyboard:frame-snapshot:updated';
    data: {
        sourceKey: string;
        kind: string;
        widgetId?: string;
        canvasId?: string;
    };
}
/** Close any pooled capture browser (used by server shutdown). */
export declare function closeFrameSnapshotBrowser(): Promise<void>;
/**
 * Create a Frame snapshot capture service bound to one Notebook root.
 *
 * `resolveSiteUrl(siteId, route)` must be injected by the host (Core routes
 * or CLI) and resolves the validated development URL of a running Site; it
 * throws a `SITE_NOT_RUNNING`-coded error when the Site is stopped.
 */
export declare function createFrameSnapshotCapture({ notebookRoot, eventSender, resolveSiteUrl }: {
    notebookRoot: string;
    eventSender?: ((event: CaptureEvent) => void) | null;
    resolveSiteUrl?: ((siteId: string, route: string) => string) | null;
}): {
    capture(target: CaptureTargetInput, options?: CaptureOptions): Promise<FrameSnapshotDescriptor & {
        cached?: boolean;
    }>;
    read(target: FrameSnapshotTargetInput): Promise<FrameSnapshotDescriptor>;
};
export {};
