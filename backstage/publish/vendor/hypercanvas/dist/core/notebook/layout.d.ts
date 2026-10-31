/**
 * Notebook folder layout. Everything that is not authored content lives under
 * `backstage/`, but no folder here is ever required: a root-level copy keeps
 * working, and a missing `backstage/` is created on demand, never an error.
 */
export declare const NOTEBOOK_MANIFEST_FILE = "hypercanvas.notebook.json";
export declare const NOTEBOOK_BACKSTAGE_DIR = "backstage";
/** Where new Notebooks keep their manifest; existing root manifests stay readable and writable in place. */
export declare const NOTEBOOK_MANIFEST_DIR = "backstage/config";
/** Media and data folders: `backstage/<name>` for new Notebooks, root `<name>` when it already exists. */
export declare const NOTEBOOK_CONTENT_DIRECTORY_NAMES: readonly ["assets", "data"];
export type NotebookContentDirectoryName = typeof NOTEBOOK_CONTENT_DIRECTORY_NAMES[number];
/** Candidate manifest locations, preferred first. A missing backstage never fails resolution. */
export declare function notebookManifestCandidates(root: string): string[];
/** The manifest that exists, else where a new one is written (backstage/config). */
export declare function resolveNotebookManifestPath(root: string): string;
/** Manifest path relative to the Notebook root, with `/` separators. */
export declare function notebookManifestRelativePath(root: string): string;
export declare function hasNotebookManifest(root: string): boolean;
/**
 * Physical `assets/` or `data/` directory. An existing root folder wins so older
 * Notebooks (and adopted folders that already have one) are left as they are.
 * Otherwise Notebooks use `backstage/<name>`. A folder that is not a Notebook,
 * such as a client prototype repository, keeps the root location unless the
 * caller is scaffolding a Notebook (`notebook: true`).
 */
export declare function resolveNotebookContentDirectory(root: string, name: NotebookContentDirectoryName, { notebook }?: {
    notebook?: boolean | undefined;
}): string;
/** `assets/...` or `data/...` path under its physical directory. */
export declare function notebookContentPath(root: string, name: NotebookContentDirectoryName, ...segments: string[]): string;
/** Map a logical `assets/x` or `data/x` Notebook path to its physical path relative to the root. */
export declare function physicalNotebookRelativePath(root: string, relativePath: string): string;
