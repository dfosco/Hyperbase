/**
 * HTTP routes for Frame snapshots: `/_hypercanvas/frame-snapshot`.
 *
 *   GET  /            — read the persisted descriptor for a Frame target (query params)
 *   POST /            — capture one Frame target (JSON body), bounded and queued
 *   GET  /capability  — capture browser availability and actionable diagnostics
 *
 * GET is side-effect free and works without a running source server. For Site
 * Frames whose portable snapshot is missing, the legacy `.storyboard/site-captures`
 * image for the current binding revision is adopted (marked stale) when present.
 */
import { normalizeSnapshotTheme } from './frameSnapshotContract.js';
import type { FrameSnapshotDescriptor } from './frameSnapshotStore.js';
import type { FrameSnapshotTargetInput } from './frameSnapshotContract.js';
interface SnapshotIdentity {
    canvasId?: string;
    widgetId?: string;
}
interface RouteRequest {
    url: string;
}
interface RouteResponse {
    writeHead(status: number, headers?: Record<string, string>): unknown;
    end(payload?: string): unknown;
}
interface RouteContext {
    body?: Record<string, unknown>;
    path?: string;
    method?: string;
}
interface SendJson {
    (response: RouteResponse, status: number, data: unknown): unknown;
}
interface SnapshotCapture {
    capture(target: FrameSnapshotTargetInput & {
        captureUrl?: string;
    }, options: {
        theme: unknown;
        force: boolean;
        origin: unknown;
        identity: SnapshotIdentity;
    }): Promise<FrameSnapshotDescriptor & {
        cached?: boolean;
    }>;
}
interface SiteStoreLike {
    getBinding(siteId: string): {
        revision?: unknown;
    } | null;
}
interface SnapshotRouteOptions {
    root: string;
    sendJson: SendJson;
    capture: SnapshotCapture;
    siteStore?: SiteStoreLike | null;
    eventSender?: ((event: {
        type: 'custom';
        event: string;
        data: Record<string, unknown>;
    }) => void) | null;
}
export declare function createFrameSnapshotRoutes({ root, sendJson, capture, siteStore, eventSender }: SnapshotRouteOptions): (req: RouteRequest, res: RouteResponse, { body, path: routePath, method }: RouteContext) => Promise<unknown>;
export { normalizeSnapshotTheme };
