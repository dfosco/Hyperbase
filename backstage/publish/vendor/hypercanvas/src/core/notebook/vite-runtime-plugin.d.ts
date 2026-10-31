import { createNotebookRuntime } from './runtime.js';
import type { Plugin } from 'vite';
import { createFilesystemGrants } from '../system/filesystem-grants.js';
type NotebookRuntime = ReturnType<typeof createNotebookRuntime>;
type NotebookRuntimeStatus = ReturnType<NotebookRuntime['status']>;
type FilesystemGrants = ReturnType<typeof createFilesystemGrants>;
interface StatefulAdapter {
    setNotebookRoot?(root: string | null, artifacts?: Array<Record<string, unknown>>): void;
    update?(): void;
    dispose?(): void;
}
interface RuntimePluginOptions {
    initialRoot?: string;
    runtime?: NotebookRuntime;
    filesystemGrants?: FilesystemGrants | null;
    statefullyAdapter?: StatefulAdapter | null;
}
type AvailabilityStatus = NotebookRuntimeStatus;
export declare function shouldReloadNotebookFile(file: string, watchedPaths: string[]): boolean;
/**
 * Detect the active Notebook folder disappearing (deleted, moved, or renamed)
 * while the runtime keeps serving. When the folder vanishes, scan the old
 * parent directory once for a sibling folder whose manifest carries the same
 * stable notebook id — that recovers renames/moves within the same parent so
 * the client can offer to reopen it in place. Anything else is reported as
 * removed-or-renamed.
 */
export declare function createAvailabilityTracker(): (status: AvailabilityStatus) => Record<string, unknown>;
/**
 * Make one external content-only Notebook available to a stable Vite runtime.
 * The process itself never changes root, avoiding stale watchers and module
 * graphs caused by swapping a project-root symlink.
 */
export default function notebookRuntimePlugin({ initialRoot, runtime, filesystemGrants: suppliedFilesystemGrants, statefullyAdapter, }?: RuntimePluginOptions): Plugin;
export {};
