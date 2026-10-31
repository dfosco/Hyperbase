/**
 * Canvas Server API — CRUD operations for .canvas.jsonl files.
 *
 * Canvas data is stored as an append-only JSONL event stream.
 * Each line is a JSON event object. The first line is always a
 * `canvas_created` event containing the full initial state.
 * Subsequent lines are atomic change events. Current state is
 * derived by replaying the stream via the materializer.
 *
 * Routes (mounted at /_hypercanvas/canvas/):
 *   GET    /read     — read materialized canvas state
 *   GET    /list     — list all canvases
 *   GET    /folders  — list canvas folders
 *   PUT    /update   — append update events (widgets, sources, settings)
 *   POST   /undo     — append the inverse of a previously-applied event
 *   POST   /redo     — re-apply an undone event (mirror of /undo)
 *   PUT    /rename-page — rename a canvas page file
 *   PUT    /reorder-pages — save page order for a canvas folder
 *   GET    /page-order — read page order for a folder
 *   PUT    /update-folder-meta — update folder .meta.json title
 *   POST   /widget   — append a widget_added event
 *   PATCH  /widget   — update a single widget's props/position
 *   DELETE /widget   — append a widget_removed event
 *   POST   /connector — append a connector_added event
 *   DELETE /connector — append a connector_removed event
 *   POST   /batch    — execute multiple operations in one request (refs, single HMR push)
 *   POST   /create   — create a new .canvas.jsonl file
 *   GET    /stories  — list all .story.{jsx,tsx} files with exports
 *   POST   /create-story — scaffold a new .story.{jsx,tsx} file
 *   GET    /github/available — check if local gh CLI is installed
 *   POST   /github/embed — fetch GitHub issue/discussion/PR/comment metadata via gh
 *   POST   /image    — upload a pasted image to src/canvas/images/
 *   GET    /images/* — serve an image file from src/canvas/images/
 *   POST   /image/toggle-private — toggle ~prefix on image filename
 *   GET    /terminal-buffer/:id — read private terminal buffer (with ?length=N)
 *   GET    /terminal-snapshot/:id — read public terminal snapshot
 */
import { Buffer } from 'node:buffer';
type UnknownRecord = Record<string, unknown>;
type CanvasRequest = {
    socket?: {
        localPort?: number;
    } | null;
    url?: string | null;
} | null;
type CanvasResponse = {
    writeHead: (status: number, headers?: Record<string, string | number>) => void;
    end: (body?: string | Buffer) => void;
};
type CanvasRouteContext = {
    body: UnknownRecord;
    path: string;
    method: string;
    __viteWs?: {
        send: (payload: unknown) => void;
    };
};
type HotPoolApi = {
    has: (poolId: string) => boolean;
    acquire: (poolId: string) => WarmSession | null;
    consume: (poolId: string, sessionId: string) => void;
    release: (poolId: string, sessionId: string) => void;
    peek: (poolId: string) => {
        ready: boolean;
    };
};
type WarmSession = {
    id: string;
    runtimeSessionId: string;
};
type CanvasHandlerContext = {
    root: string;
    sendJson: (response: unknown, status: number, body: unknown) => void;
    resolveCanvasSourceExports?: (canvasFilePath: string, jsxReference: string) => Promise<readonly string[] | null>;
    hotPool?: HotPoolApi | null;
    workspaceIdResolver?: (root: string) => Promise<string | null> | string | null;
};
/**
 * Create the canvas API route handler.
 */
export declare function createCanvasHandler(ctx: CanvasHandlerContext): (req: CanvasRequest, res: CanvasResponse, { body, path: routePath, method, __viteWs }: CanvasRouteContext) => Promise<void>;
export {};
