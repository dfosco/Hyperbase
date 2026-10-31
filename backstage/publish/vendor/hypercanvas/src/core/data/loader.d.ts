/**
 * Deep merges two objects. Source values take priority over target.
 * Arrays are replaced, not concatenated.
 */
type DataMap = Record<string, unknown>;
declare function deepMerge(target: object, source: object): DataMap;
/**
 * Seed the data index. Call once at app startup before any load functions.
 * The Vite data plugin calls this automatically via the generated virtual module.
 *
 * @param {{ flows?: object, scenes?: object, objects: object, records: object, prototypes?: object, folders?: object, canvases?: object, stories?: object }} index
 */
export declare function init(index: unknown): void;
/**
 * Returns the names of all registered flows.
 * @returns {string[]}
 */
export declare function listFlows(): string[];
/** @deprecated Use listFlows() */
export declare const listScenes: typeof listFlows;
/**
 * Returns flows scoped to a specific prototype, with resolved metadata.
 *
 * @param {string} prototypeName - e.g., "Signup", "Dashboard"
 * @returns {Array<{ key: string, name: string, meta: object|null }>}
 */
export declare function getFlowsForPrototype(prototypeName: string): Array<{
    key: string;
    name: string;
    meta: null;
}>;
/**
 * Checks whether a flow file exists for the given name.
 * @param {string} flowName - e.g., "Overview"
 * @returns {boolean}
 */
export declare function flowExists(flowName: string): boolean;
/** @deprecated Use flowExists() */
export declare const sceneExists: typeof flowExists;
/**
 * Loads a flow file and resolves $global and $ref references.
 *
 * - $global: array of data names merged into root (flow wins on conflicts)
 * - $ref: inline object replacement at any nesting level
 *
 * @param {string} flowName - Name of the flow (e.g., "default")
 * @returns {object} Resolved flow data
 */
export declare function loadFlow(flowName?: string): DataMap;
/** @deprecated Use loadFlow() */
export declare const loadScene: typeof loadFlow;
/**
 * Loads a record collection by name.
 * @param {string} recordName - Name of the record file (e.g., "posts")
 * @returns {Array} Parsed record collection
 */
export declare function loadRecord(recordName: string): unknown[];
/**
 * Finds a single record entry by id within a collection.
 * @param {string} recordName - Record collection name (e.g., "posts")
 * @param {string} id - The id to match
 * @returns {object|null} The matched entry, or null
 */
export declare function findRecord(recordName: string, id: string): DataMap | null;
/**
 * Loads an object data file by name, resolves any nested $ref references,
 * and returns a deep clone.
 *
 * @param {string} objectName - Name of the object file (e.g., "jane-doe")
 * @param {string|null} [scope] - Optional prototype scope for name resolution
 * @returns {object|Array} Resolved object data
 */
export declare function loadObject(objectName: string, scope?: string | null): unknown;
/**
 * Resolve a flow name within a prototype scope.
 * Tries the scoped name first ({scope}/{name}), then falls back to the plain name.
 *
 * @param {string|null} scope - Prototype name (e.g. "Dashboard"), or null for global-only
 * @param {string} name - Flow name (e.g. "default" or "Dashboard/signup")
 * @returns {string} The resolved flow name that exists in the index
 */
export declare function resolveFlowName(scope: string | null, name: string): string;
/**
 * Resolve a record name within a prototype scope.
 * Tries the scoped name first ({scope}/{name}), then falls back to the plain name.
 *
 * @param {string|null} scope - Prototype name (e.g. "Dashboard"), or null for global-only
 * @param {string} name - Record name (e.g. "posts")
 * @returns {string} The resolved record name that exists in the index
 */
export declare function resolveRecordName(scope: string | null, name: string): string;
/**
 * Resolve an object name within a prototype scope.
 * Tries the scoped name first ({scope}/{name}), then falls back to the plain name.
 *
 * @param {string|null} scope - Prototype name (e.g. "Dashboard"), or null for global-only
 * @param {string} name - Object name (e.g. "jane-doe")
 * @returns {string} The resolved object name that exists in the index
 */
export declare function resolveObjectName(scope: string | null, name: string): string;
/**
 * Returns the names of all registered prototypes.
 * @returns {string[]}
 */
export declare function listPrototypes(): string[];
/**
 * Returns prototype metadata by name.
 * @param {string} name - Prototype name (e.g. "Example")
 * @returns {object|null} Metadata from the .prototype.json file, or null
 */
export declare function getPrototypeMetadata(name: string): unknown | null;
/**
 * Returns the names of all registered folders.
 * @returns {string[]}
 */
export declare function listFolders(): string[];
/**
 * Returns folder metadata by name.
 * @param {string} name - Folder name (e.g. "Getting Started")
 * @returns {object|null} Metadata from the .folder.json file, or null
 */
export declare function getFolderMetadata(name: string): unknown | null;
/**
 * Returns the names of all registered canvases.
 * @returns {string[]}
 */
export declare function listCanvases(): string[];
/**
 * Returns canvas data by name.
 * @param {string} name - Canvas name (e.g. "design-overview")
 * @returns {object|null} Data from the .canvas.json file, or null
 */
export declare function getCanvasData(name: string): unknown | null;
/**
 * Returns the names of all registered stories.
 * @returns {string[]}
 */
export declare function listStories(): string[];
/**
 * Returns story data by name.
 * Story entries include `_storyModule` (path) and `_storyImport` (dynamic import function).
 * Accepts both flat names ("product-card") and scoped names ("folder/product-card") —
 * if an exact match isn't found and the name contains a slash, tries the basename.
 * @param {string} name - Story name (e.g. "button-patterns" or "explorations/button-patterns")
 * @returns {object|null} Story data with import function, or null
 */
export declare function getStoryData(name: string): unknown | null;
export { deepMerge };
