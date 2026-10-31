type JsonRecord = Record<string, unknown>;
/**
 * Folder-independent identity for a canvas, mirroring how prototypes are
 * matched across branches by their (folder-independent) `dirName`.
 *
 * The full canvas id is path-based (e.g. `widget/design-system`), so the same
 * canvas living at the root on one branch and inside a folder on another would
 * otherwise key differently and render as duplicate cross-branch cards. We key
 * by the canvas name instead — proto-scoped canvases keep their prototype
 * segment so two prototypes with same-named canvases never collide.
 */
export declare function canvasMatchKey(id: unknown): string;
export declare function fetchArtifactIndex(basePath: unknown): Promise<JsonRecord | null>;
export declare function buildBranchArtifactHref(branchBasePath: unknown, folder: unknown, route: unknown): string;
export declare function mergeArtifactIndexIntoPrototypeIndex(localIndex: unknown, remoteIndex: unknown, currentBranch?: string): unknown;
export {};
