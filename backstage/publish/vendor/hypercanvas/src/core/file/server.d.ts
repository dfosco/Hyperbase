/**
 * File Widget Server API — read/write/list repo files.
 *
 * Mounted at /_hypercanvas/file/ by server-plugin.js.
 *
 * Routes:
 *   GET  /tree[?root=...]   — file tree (text files only)
 *   GET  /read?path=...     — read file contents
 *   PUT  /write             — overwrite a file
 *   POST /rename            — rename (same-dir only)
 *   POST /upload            — write into destDir (with collision suffix)
 *   GET  /exists?path=...   — check if path exists
 *   POST /resolve           — resolve absolute file paths (e.g. from VSCode
 *                             Explorer drops) to repo-relative paths,
 *                             copying images into assets/canvas/images
 *                             when not already there
 */
interface ValidationSuccess {
    ok: true;
    absPath: string;
}
interface ValidationFailure {
    ok: false;
    error: string;
}
type PathValidation = ValidationSuccess | ValidationFailure;
type PathValidator = (root: string, relPath: unknown) => PathValidation;
type JsonBody = Record<string, unknown>;
interface FileRequest {
    url?: string;
}
interface ViteWebSocket {
    send(event: {
        type: 'custom';
        event: string;
        data: {
            path: string;
        };
    }): void;
}
interface RouteContext {
    body?: unknown;
    path: string;
    method: string;
    __viteWs?: ViteWebSocket | null;
}
type SendJson = (response: unknown, status: number, body: JsonBody) => void;
interface CreateFileHandlerOptions {
    root: string;
    sendJson: SendJson;
    validatePath?: PathValidator;
}
export declare function validateNotebookPath(root: string, relPath: unknown): PathValidation;
export declare function createFileHandler({ root, sendJson, validatePath }: CreateFileHandlerOptions): (req: FileRequest, res: unknown, { body, path: routePath, method, __viteWs }: RouteContext) => Promise<void>;
export {};
