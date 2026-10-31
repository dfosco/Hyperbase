/**
 * Docs API — serve README and source files for the docs viewer.
 *
 * Routes (mounted at /_hypercanvas/docs/):
 *   GET /readme          — project README.md content
 *   GET /source?path=... — single source file (restricted to src/)
 *   GET /files           — tree of component files in src/prototypes/
 *   GET /repo            — repository owner/name (from git remote or config)
 */
import type { ApiRequest, ApiResponse, ApiRouteContext, JsonSender } from './api-router.js';
/**
 * Recursively collect files matching allowed extensions.
 * @param {string} dir - Absolute directory path
 * @param {string} rootDir - Project root for computing relative paths
 * @returns {Promise<string[]>} Relative file paths from project root
 */
export declare function collectFiles(dir: string, rootDir: string): Promise<string[]>;
/**
 * Create the docs API route handler.
 * @param {object} ctx
 * @param {string} ctx.root - Project root directory
 * @param {(res: import('http').ServerResponse, status: number, data: unknown) => void} ctx.sendJson
 * @returns {(req: import('http').IncomingMessage, res: import('http').ServerResponse, opts: { path: string, method: string }) => Promise<void>}
 */
export declare function docsHandler({ root, sendJson }: {
    root: string;
    sendJson: JsonSender;
}): (req: ApiRequest, res: ApiResponse, { path: routePath, method }: ApiRouteContext) => Promise<void>;
