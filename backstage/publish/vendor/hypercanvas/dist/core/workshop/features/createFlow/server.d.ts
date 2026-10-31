/**
 * Workshop API — flow creation and listing.
 *
 * Routes (mounted at /_hypercanvas/workshop/):
 *   GET  /flows  — list prototypes, existing flows, and available objects
 *   POST /flows  — create a new flow file
 */
import type { PartialConfig } from '../partialRender.js';
type DataRecord = Record<string, unknown>;
type WorkshopContext = {
    root: string;
    sendJson: (res: unknown, status: number, body: unknown) => void;
    workshopConfig?: {
        partials?: PartialConfig[];
    };
};
type RouteContext = {
    body: DataRecord;
    path: string;
    method: string;
};
/**
 * Create the flows API route handler.
 * @param {object} ctx - Server context ({ root, sendJson, workshopConfig })
 */
export declare function createFlowsHandler(ctx: WorkshopContext): (_req: unknown, res: unknown, { body, path: routePath, method }: RouteContext) => Promise<void>;
export {};
