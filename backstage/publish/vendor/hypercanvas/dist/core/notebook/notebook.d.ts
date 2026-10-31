/**
 * Content-only Notebook support.
 *
 * A Notebook is a user-owned folder containing portable canvas and prototype
 * content. Application code, dependencies, and runtime state stay outside it.
 */
import { FIRST_LOOK_DIAGNOSTIC_SOURCE } from './first-look/catalog.node.js';
import { type NotebookArtifactMigrationAliases } from './artifact-migration-aliases.js';
import { type NotebookNavigation, type NotebookPageType } from './navigation.js';
type JsonObject = Record<string, unknown>;
export type NotebookDiagnostic = {
    code: string;
    message: string;
    path: string | null;
    severity?: 'error' | 'warning';
    source?: typeof FIRST_LOOK_DIAGNOSTIC_SOURCE;
    field?: string;
    id?: string;
    paths?: string[];
    legacyId?: string;
    nestedArtifact?: {
        kind: NotebookArtifactKind;
        path: string;
    };
    containingArtifact?: {
        kind: NotebookArtifactKind;
        path: string;
    };
    repairParentPath?: string;
    proposedDestination?: string;
};
export type NotebookArtifactKind = 'prototype' | 'component' | 'canvas' | 'site' | 'doc';
export type NotebookArtifact = {
    id: string;
    kind: NotebookArtifactKind;
    folderPath: string;
    payloadPath: string | null;
    title: string;
    route: string | null;
    externalUrl?: string;
    visible: boolean;
    available: boolean;
    migrationAliases?: NotebookArtifactMigrationAliases;
    portable?: boolean;
    descriptorPath?: string;
    descriptor?: Record<string, unknown>;
    runtime?: {
        id?: unknown;
        version?: unknown;
    };
    entry?: string | null;
    views?: Array<{
        id?: string;
        title?: string;
        path?: string;
        [key: string]: unknown;
    }>;
    references?: string[];
    resolvedReferences?: Array<{
        id: string;
        kind: NotebookArtifactKind;
        path: string;
    }>;
    diagnostics: NotebookDiagnostic[];
};
type ManifestPage = JsonObject & {
    id?: unknown;
    type?: unknown;
    title?: unknown;
    path?: unknown;
    route?: unknown;
    siteId?: unknown;
    [key: string]: unknown;
};
type NotebookPage = ManifestPage & {
    index: number;
    path: string | null;
    route: string | null;
    available: boolean;
    diagnostics: NotebookDiagnostic[];
    productionUrl?: string | null;
};
type ValidManifestPage = JsonObject & {
    id: string;
    type: NotebookPageType;
    title: string;
    path?: string;
    siteId?: string;
    route?: string | null;
};
type NotebookManifest = JsonObject & {
    formatVersion: number;
    id: string;
    title: string;
    pages: ValidManifestPage[];
    navigation: NotebookNavigation;
};
export type NotebookSnapshot = {
    status: 'valid';
    root: string;
    manifest: NotebookManifest;
    pages: NotebookPage[];
    artifacts: NotebookArtifact[];
    diagnostics: NotebookDiagnostic[];
    sites: Array<{
        id: string;
        path: string;
    }>;
    hasMissingPayload: boolean;
    needsMigration: boolean;
    needsPageRegistration: boolean;
    needsNavigationRepair: boolean;
} | {
    status: 'invalid' | 'unavailable';
    root: string;
    manifest: JsonObject | null;
    pages: NotebookPage[];
    artifacts: NotebookArtifact[];
    diagnostics: NotebookDiagnostic[];
    sites?: Array<{
        id: string;
        path: string;
    }>;
    hasMissingPayload?: boolean;
    needsMigration?: boolean;
    needsPageRegistration?: boolean;
    needsNavigationRepair?: boolean;
};
type NotebookPaths = {
    root: string;
    manifest: string;
    canvasConfig: string;
    configFiles: string[];
    runtime: string;
    siteConfig: string;
    canvases: string;
    prototypes: string;
    widgets: string;
    tools: string;
    components: string;
    data: string;
    assets: string;
    publish: string;
};
export declare const NOTEBOOK_FORMAT_VERSION = 2;
export declare const NOTEBOOK_ARTIFACT_MARKER_FILE = ".hypercanvas-artifact.json";
export declare const NOTEBOOK_CANVAS_CONFIG_FILE = "storyboard.canvas.json";
/** Runtime directory name after the rename; existing Notebooks stay on `.storyboard/`. */
export declare const NOTEBOOK_RUNTIME_DIR = ".hypercanvas";
export declare const LEGACY_NOTEBOOK_RUNTIME_DIR = ".storyboard";
export declare const NOTEBOOK_PUBLISH_DIR = "backstage/publish";
/** Where earlier builds placed the managed publication project. */
export declare const LEGACY_NOTEBOOK_PUBLISH_DIR = "publish";
export { NOTEBOOK_BACKSTAGE_DIR, NOTEBOOK_MANIFEST_DIR, NOTEBOOK_MANIFEST_FILE, NOTEBOOK_CONTENT_DIRECTORY_NAMES, hasNotebookManifest, notebookContentPath, notebookManifestCandidates, notebookManifestRelativePath, physicalNotebookRelativePath, resolveNotebookContentDirectory, resolveNotebookManifestPath, } from './layout.js';
export declare const NOTEBOOK_SUPPORT_DIRECTORIES: readonly string[];
/** Conventional support paths prefer backstage; explicit backstage paths never fall back. */
export declare function notebookSupportCandidates(root: string, relativePath: string, preferRoot?: boolean): string[];
export declare function resolveNotebookSupportPath(root: string, relativePath: string, { preferRoot, fresh }?: {
    preferRoot?: boolean | undefined;
    fresh?: boolean | undefined;
}): string;
/** Candidate paths for imports from Notebook modules, including Vite-expanded @ aliases. */
export declare function notebookSupportImportCandidates(root: string, id: string, importer: string | undefined, applicationRoot: string): string[];
/** Optional application-config files a Notebook may override explicitly. */
export declare const NOTEBOOK_CONFIG_FILES: readonly string[];
/** All application-config filenames ever emitted — legacy projects keep theirs. */
export declare const LEGACY_NOTEBOOK_CONFIG_FILE = "storyboard.config.json";
export declare const NOTEBOOK_CONFIG_FILE_NAMES: readonly string[];
export declare const NOTEBOOK_DIRECTORIES: Readonly<{
    canvases: "canvas";
    prototypes: "prototypes";
    widgets: "widgets";
    tools: "tools";
    components: "components";
    data: "data";
    assets: "assets";
    publish: "backstage/publish";
}>;
declare function payloadState(root: string, relativePath: string, type: unknown): {
    available: boolean;
    unsafe: boolean;
};
declare function safeRelativePath(value: unknown): string | null;
declare function validateManifestShape(manifest: unknown): NotebookDiagnostic[];
declare function validatePages(root: string, manifest: unknown): {
    pages: NotebookPage[];
    diagnostics: NotebookDiagnostic[];
};
export declare function notebookManifest({ id, title, pages }?: {
    id?: string;
    title?: string;
    pages?: ValidManifestPage[];
}): NotebookManifest;
export declare function notebookPaths(root: string, { notebook }?: {
    notebook?: boolean;
}): NotebookPaths;
/**
 * Inspect without modifying the selected folder.
 * Missing payloads keep the Notebook recognizable but mark individual pages
 * unavailable, allowing the rest of the Notebook to remain usable.
 */
export declare function inspectNotebook(root: string): NotebookSnapshot;
/** Persist the reconciled v2 registry and navigation for one Notebook. */
export declare function writeNotebookManifest(root: string, manifest: unknown): NotebookSnapshot;
/** Register a created page and place it in the requested virtual section. */
export declare function registerNotebookPage(root: string, input: unknown, { sectionId, sectionTitle, insertAfterPageId }?: {
    sectionId?: string | null;
    sectionTitle?: string | null;
    insertAfterPageId?: string | null;
}): ValidManifestPage | null;
/** Remove a primary page and all of its references from every saved layout. */
export declare function unregisterNotebookPage(root: string, selector?: {
    id?: string;
    path?: string;
    siteId?: string;
}): boolean;
/** Explicit local repair. Never infer ownership from titles or prune other missing pages. */
export declare function forgetMissingNotebookCanvas(root: string, { pageId, expectedRevision }: {
    pageId: string;
    expectedRevision: string;
}): {
    success: boolean;
    removed: string;
    path: string;
    revision: string;
};
/** Update display metadata without changing stable identity or layout order. */
export declare function updateNotebookPage(root: string, selector?: {
    id?: string;
    path?: string;
    siteId?: string;
}, updates?: unknown): ValidManifestPage | null;
/**
 * Create the portable Notebook skeleton and ignored runtime directory.
 * Existing valid Notebooks are returned unchanged. Any selected directory can
 * be adopted as a Notebook: initialization adds missing layout and identity.
 * Damaged manifests are backed up under .storyboard/recovery/ before repair.
 */
export declare function initializeNotebook(root: string, { id, title, configRoot }?: {
    id?: string;
    title?: string;
    configRoot?: string;
}): NotebookSnapshot;
/**
 * Open a Notebook session and optionally observe real filesystem changes.
 * Refresh is serialized by the event loop and never writes to the Notebook.
 */
export type NotebookSession = {
    readonly snapshot: NotebookSnapshot;
    refresh(): NotebookSnapshot;
    subscribe(listener: (snapshot: NotebookSnapshot) => void): () => void;
    close(): void;
};
export declare function openNotebook(root: string, { watch, onChange }?: {
    watch?: boolean;
    onChange?: (snapshot: NotebookSnapshot) => void;
}): NotebookSession;
export declare const __test: {
    safeRelativePath: typeof safeRelativePath;
    validateManifestShape: typeof validateManifestShape;
    validatePages: typeof validatePages;
    payloadState: typeof payloadState;
};
