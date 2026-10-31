/**
 * Workshop API — prototype creation and listing.
 *
 * Routes (mounted at /_hypercanvas/workshop/):
 *   GET  /prototypes  — list available folders and partials
 *   POST /prototypes  — create a new prototype (dir + metadata + page + optional flow)
 *
 * Recipes are defined in storyboard.config.json under workshop.partials.
 * Each entry has { type, name, globals? } where:
 *   - directory: "recipe" or "template" — maps to src/recipes/ or src/templates/
 *   - name: subdirectory name containing the component file
 *   - globals: optional array of $global names for prototype.json
 *
 * The server auto-discovers the main *.jsx or *.tsx component file
 * in that directory and generates the appropriate index.jsx import.
 */
import type { PartialConfig } from '../partialRender.js';
type DataRecord = Record<string, unknown> & {
    files?: string[];
    meta?: DataRecord;
};
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
 * Create the prototypes API route handler.
 * @param {object} ctx - Server context ({ root, sendJson, workshopConfig })
 */
export declare function createPrototypesHandler(ctx: WorkshopContext): (_req: unknown, res: unknown, { body, path: routePath, method }: RouteContext) => Promise<void>;
export {};
