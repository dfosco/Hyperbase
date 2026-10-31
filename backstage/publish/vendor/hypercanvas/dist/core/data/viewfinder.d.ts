type FlowMetadata = Record<string, unknown> & {
    title?: string;
    description?: string;
    author?: string | string[];
    icon?: string;
    team?: string;
    tags?: string[];
    default?: boolean;
    hideFlows?: boolean;
};
type CanvasMetadata = FlowMetadata & {
    pageOrder?: Array<string | {
        name?: string;
    }>;
};
interface FlowIndexEntry {
    key: string;
    name: string;
    route: string;
    meta: FlowMetadata | null;
}
interface PrototypeIndexEntry {
    name: string;
    dirName: string;
    route?: string | null;
    description: string | null;
    author: string | string[] | null;
    gitAuthor: string | null;
    lastModified: string | null;
    icon: string | null;
    team: string | null;
    tags: string[] | null;
    hideFlows: boolean;
    folder: string | null;
    isExternal: boolean;
    externalUrl: string | null;
    isPrivate: boolean;
    flows: FlowIndexEntry[];
}
interface CanvasPage {
    id: string;
    name: string;
    route: string;
    isPrivate: boolean;
}
interface CanvasIndexEntry {
    name: string;
    dirName: string;
    description: string | null;
    route: string;
    folder: string | null;
    isCanvas?: boolean;
    isPrivate: boolean;
    author?: string | string[] | null;
    gitAuthor?: string | null;
    _canvasMeta?: CanvasMetadata | null;
    _group?: string | null;
    pages?: CanvasPage[];
    lastModified?: string | null;
}
interface FolderIndexEntry {
    name: string;
    dirName: string;
    description: string | null;
    icon: string | null;
    isPrivate: boolean;
    prototypes: PrototypeIndexEntry[];
    canvases?: CanvasIndexEntry[];
}
interface PrototypeIndex {
    folders: FolderIndexEntry[];
    prototypes: PrototypeIndexEntry[];
    canvases: CanvasIndexEntry[];
    globalFlows: FlowIndexEntry[];
    sorted: {
        title: {
            prototypes: PrototypeIndexEntry[];
            canvases: CanvasIndexEntry[];
            folders: FolderIndexEntry[];
        };
        updated: {
            prototypes: PrototypeIndexEntry[];
            canvases: CanvasIndexEntry[];
            folders: FolderIndexEntry[];
        };
    };
}
/**
 * Deterministic hash from a string — used for seeding generative placeholders.
 * @param {string} str
 * @returns {number}
 */
export declare function hash(str: string): number;
/**
 * Append `tokens` from flow/prototype data as URL search params.
 * Filters out reserved keys (`flow`, `scene`) and non-scalar values.
 *
 * @param {string} url - Base URL (may already contain query params)
 * @param {object|null|undefined} tokens - Key-value pairs to append
 * @returns {string} URL with token params appended
 */
export declare function appendTokens(url: string, tokens: unknown): string;
/**
 * Resolve the target route path for a flow.
 *
 * Priority:
 * 1. If flow name matches a known route (case-insensitive), use that route
 * 2. If flow data has an explicit top-level `route`, or `meta.route` / `flowMeta.route`, use that
 * 3. If flow data has `_route` (inferred from file path by Vite plugin), use that
 * 4. Fall back to root "/"
 *
 * Flows with `meta.default: true` targeting a route omit the `?flow=` param.
 * If the flow data contains a `tokens` object, its entries are appended as query params.
 *
 * @param {string} flowName
 * @param {string[]} knownRoutes - Array of route names (e.g. ["Dashboard", "Repositories"])
 * @returns {string} Full path with optional ?flow= param
 */
export declare function resolveFlowRoute(flowName: string, knownRoutes?: string[]): string;
/** @deprecated Use resolveFlowRoute() */
export declare const resolveSceneRoute: typeof resolveFlowRoute;
/**
 * Get meta for a flow (title, description, author, etc).
 *
 * @param {string} flowName
 * @returns {{ title?: string, description?: string, author?: string | string[] } | null}
 */
export declare function getFlowMeta(flowName: string): FlowMetadata | null;
/** @deprecated Use getFlowMeta() */
export declare const getSceneMeta: typeof getFlowMeta;
/**
 * Build a structured prototype index grouping flows by prototype,
 * and prototypes by folder.
 *
 * Returns an object with:
 * - folders: array of folder entries containing their prototypes
 * - prototypes: array of ungrouped prototype entries (not in any folder)
 * - globalFlows: flows not belonging to any prototype
 *
 * @param {string[]} [knownRoutes] - Array of known route names
 * @returns {{ folders: Array, prototypes: Array, globalFlows: Array }}
 */
export declare function buildPrototypeIndex(knownRoutes?: string[]): PrototypeIndex;
export {};
