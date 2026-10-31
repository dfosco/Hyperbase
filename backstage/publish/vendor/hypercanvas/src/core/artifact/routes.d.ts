/**
 * Artifact HTTP routes — REST API for artifact CRUD.
 *
 * Mounted at /_hypercanvas/artifact/ by server-plugin.js.
 *
 * Routes:
 *   POST   /           — Create artifact
 *   PATCH  /           — Edit artifact metadata
 *   DELETE /           — Delete artifact
 *   GET    /list       — List artifacts by type
 *   GET    /schema     — Get JSON Schema for a type
 */
import type { ArtifactValues } from './validate.js';
type JsonResponder = (res: unknown, status: number, body: unknown) => void;
type RouteRequest = {
    url?: unknown;
};
type RouteContext = {
    method?: unknown;
    path?: unknown;
    subpath?: unknown;
    body?: unknown;
};
type DeleteSite = (name: string, options: ArtifactValues) => unknown | Promise<unknown>;
export declare function createArtifactRoutes({ root, sendJson, deleteSite }: {
    root: string;
    sendJson: JsonResponder;
    deleteSite?: DeleteSite;
}): (req: RouteRequest, res: unknown, ctx: RouteContext) => Promise<void>;
export {};
