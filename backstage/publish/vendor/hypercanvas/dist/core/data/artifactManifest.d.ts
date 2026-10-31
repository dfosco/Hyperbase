export declare const ARTIFACT_MANIFEST_SCHEMA_VERSION = 1;
export declare function sanitizeBranchName(branch: unknown): string;
export declare function resolveManifestEnv(options?: {
    env?: unknown;
    cwd?: unknown;
}): {
    branch: string;
    deployBranch: string;
    folder: {} | null;
    sha: {} | null;
    generatedAt: string;
    basePath: string;
};
type PrototypeManifestEntry = {
    id: string;
    dirName: string;
    title: string;
    description: unknown;
    folder: unknown;
    isExternal: boolean;
    externalUrl: unknown;
    route: string | null;
    isPrivate: boolean;
    crossBranch: boolean;
    lastModified: string | null;
};
type CanvasPageEntry = {
    id: string;
    name: unknown;
    route: string;
    isPrivate: boolean;
};
type CanvasManifestEntry = {
    id: string;
    name: string;
    folder: unknown;
    route: string;
    isPrivate: boolean;
    crossBranch: boolean;
    group: string | null;
    pages: CanvasPageEntry[] | null;
    lastModified: string | null;
};
type FolderManifestEntry = {
    name: string;
    title: string;
    isPrivate: boolean;
};
export declare function buildArtifactManifest(options?: {
    discovery?: unknown;
    env?: unknown;
}): {
    schemaVersion: number;
    branch: string;
    deployBranch: string;
    folder: {} | null;
    sha: {} | null;
    generatedAt: string;
    basePath: string;
    prototypes: PrototypeManifestEntry[];
    canvases: CanvasManifestEntry[];
    folders: FolderManifestEntry[];
};
export {};
