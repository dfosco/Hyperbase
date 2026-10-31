/**
 * Portable publication project generator.
 *
 * Materializes a Notebook as ONE self-contained site project: exact pinned
 * dependencies, an embedded deterministic lockfile, embedded canvas states,
 * copied Notebook sources and assets, the regular Storyboard application,
 * and an identity marker. The project builds with `npm ci`, `npm run build`,
 * and `npm run preview` anywhere it is copied — no Notebook, no Hypercanvas
 * checkout. See DOCS/publishing.md for the contract.
 *
 * Generation is deterministic: repeated generation from the same Notebook is
 * byte-stable (no timestamps, no machine paths). Regeneration updates managed
 * scopes in place and never deletes `.git`, the Pages workflow, `node_modules/`,
 * committed `dist/`, or unrelated user files.
 */
import { Buffer } from 'node:buffer';
import type { CanvasState } from '../../canvas/materializer.js';
type DataObject = Record<string, unknown>;
type NotebookPage = {
    id: string;
    type: string;
    index: number;
    path: string | null;
    title: string;
    route?: string | null;
    available?: boolean;
    diagnostics?: unknown;
    siteId?: string;
};
type Notebook = {
    status: string;
    root: string;
    manifest: {
        id: string;
        title: string;
        navigation: unknown;
        pages?: NotebookPage[];
    };
    pages: NotebookPage[];
    artifacts?: unknown[];
    sites?: Array<{
        id: string;
        path: string;
    }>;
    diagnostics?: unknown;
};
type PublishedPage = NotebookPage & {
    slug: string;
    state?: CanvasState;
    entry?: string | null;
    prototypeName?: string | null;
};
type FrameMap = Map<string, Record<string, unknown>>;
type SitePage = {
    available?: boolean;
    diagnostics?: unknown;
    productionUrl?: string | null;
    snapshot?: unknown;
    snapshotDark?: unknown;
    publicationStatus?: string;
};
type GeneratedFileContent = string | Buffer | null;
type GeneratedFiles = Record<string, GeneratedFileContent>;
type PublicationMarker = DataObject & {
    notebook: DataObject & {
        id: string;
        title?: string;
    };
    sourceFiles?: unknown;
    generatedNotebookFiles?: unknown;
};
export declare const PUBLICATION_MARKER_FILE = "hypercanvas.publication.json";
export declare const PUBLICATION_FORMAT_VERSION = 1;
export declare const LOCKFILE_SCAFFOLD = "../../../../scaffold/publish/package-lock.json";
export declare function pageSlug(page: NotebookPage): string;
export declare function publicationMarker(notebook: Notebook, sourceFiles?: string[], generatedNotebookFiles?: string[]): DataObject;
export declare function readMarker(projectDir: string): PublicationMarker | null;
/**
 * A project directory may only be reused when it is an empty folder or a
 * recognized publication of the same Notebook. Anything else is refused so a
 * publish never overwrites unrelated work (see DOCS/publishing.md).
 */
export declare function verifyMarker(projectDir: string, notebook: Notebook, { mode }?: {
    mode?: 'default' | 'external';
}): PublicationMarker;
/**
 * Validate and prepare the project directory without destructive behavior.
 * Default mode targets the Notebook's managed publish project directory
 * (`backstage/publish`, or the legacy `publish/` project of a build that put
 * it there); external mode targets a folder outside the Notebook that must be
 * empty or a recognized publication of this Notebook.
 */
export declare function ensureProjectDirectory({ destination, notebookRoot, mode }: {
    destination: string;
    notebookRoot: string;
    mode: 'default' | 'external';
}): {
    directory: string;
    managed: boolean;
};
declare function notebookSourceFiles(notebookRoot: string): string[];
declare function packageNameFromSpecifier(specifier: unknown): string | null;
declare function prototypeModuleSpecifiers(source: string, extension: string): Set<string>;
declare function prototypeDependencies(notebook: Notebook, sourceFiles?: string[]): Record<string, string>;
export declare function lockfileMatchesDependencies(lockfile: unknown, dependencies: unknown): boolean;
declare function publishedPages(notebook: Notebook): PublishedPage[];
/** Give manifest-listed prototypes a workspace card even when they have no metadata or flows. */
declare function generatedPrototypeMetadata(pages: PublishedPage[], sourceFiles: string[]): Record<string, string>;
declare function normalRuntimeFiles(notebook: Notebook, sourceFiles: string[], basePath?: string): GeneratedFiles;
declare function generatedFiles(notebook: Notebook, pages: PublishedPage[], frames: FrameMap, sourceFiles: string[], basePath?: string, generatedNotebookFiles?: Record<string, string>, publishedSites?: Array<{
    id: string;
    title: string;
    description?: string;
    productionUrl: string | null;
}>, sitePages?: Map<string, SitePage>, generatedOutputPaths?: string[]): GeneratedFiles;
declare function preflightSourceFiles({ notebookRoot, destination, sourceFiles, generatedPaths, previousMarker }: {
    notebookRoot: string;
    destination: string;
    sourceFiles: string[];
    generatedPaths: string[];
    previousMarker: PublicationMarker | null;
}): void;
declare function selectedNotebookAppConfig(sourceFiles: string[]): string | null;
declare function notebookDestinationPaths(relativePath: string, selectedAppConfig?: string | null, selectedCanvasConfig?: string | null): string[];
declare function selectedNotebookConfigFile(sourceFiles: string[], filename: string): string | null;
/** Remove only legacy-scope files or source paths previously owned by publishing. */
declare function cleanupStale(destination: string, desired: Set<string>, previousSourceFiles?: unknown, previousGeneratedNotebookFiles?: unknown): void;
/**
 * Materialize (or non-destructively update) the portable project for a valid
 * Notebook. Returns the project summary. The Notebook itself is never modified.
 */
export declare function materializeProject({ notebookRoot, destination, mode, basePath }: {
    notebookRoot: string;
    destination: string;
    mode?: 'default' | 'external';
    basePath?: string;
}): Promise<{
    destination: string;
    mode: 'default' | 'external';
    marker: unknown;
    pages: Array<{
        id: string;
        type: string;
        title: string;
        slug: string;
    }>;
    warnings: unknown;
}>;
export declare const __test: {
    normalRuntimeFiles: typeof normalRuntimeFiles;
    generatedFiles: typeof generatedFiles;
    publishedPages: typeof publishedPages;
    generatedPrototypeMetadata: typeof generatedPrototypeMetadata;
    cleanupStale: typeof cleanupStale;
    notebookSourceFiles: typeof notebookSourceFiles;
    packageNameFromSpecifier: typeof packageNameFromSpecifier;
    prototypeModuleSpecifiers: typeof prototypeModuleSpecifiers;
    prototypeDependencies: typeof prototypeDependencies;
    preflightSourceFiles: typeof preflightSourceFiles;
    notebookDestinationPaths: typeof notebookDestinationPaths;
    selectedNotebookAppConfig: typeof selectedNotebookAppConfig;
    selectedNotebookConfigFile: typeof selectedNotebookConfigFile;
};
export {};
