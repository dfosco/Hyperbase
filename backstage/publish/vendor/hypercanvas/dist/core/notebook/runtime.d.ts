/** Runtime-owned adapter for one active, content-only Notebook. */
import { inspectNotebook, notebookPaths } from './notebook.js';
type NotebookPathSet = ReturnType<typeof notebookPaths>;
interface RecentEntry extends Record<string, unknown> {
    root: string;
    id?: string | null;
    title?: string;
    lastOpened?: string;
}
type RecentNotebook = RecentEntry & {
    title: string;
    id: string | null;
    available: boolean;
};
interface ActiveNotebook {
    root: string;
    notebook: ReturnType<typeof inspectNotebook>;
    paths: NotebookPathSet;
    generation: number;
}
export interface NotebookRuntimeStatus {
    active: boolean;
    root: string | null;
    notebook: ReturnType<typeof inspectNotebook> | null;
    generation: number;
}
interface NotebookRuntimeOptions {
    initialRoot?: string | null;
    applicationRoot?: string;
    stateDirectory?: string | null;
    globalRoots?: Array<{
        root: string;
        access?: string[];
    }>;
}
interface ResolveOptions {
    scope?: 'notebook' | 'application-default' | 'global' | string;
    access?: string;
    globalRoot?: string | null;
}
/** Return the newest valid Notebook saved in Core's recent Notebook history. */
export declare function resolveLastOpenedNotebookRoot({ stateDirectory, }?: {
    stateDirectory?: string;
}): string | null;
export declare function resolveNotebookPath(root: string, relativePath: string): string;
export declare function resolveNotebookRuntimePath(root: string, relativePath?: string): string;
export declare function resolvePathWithinRoot(root: string, relativePath: string): string;
/**
 * Keep the Vite project root stable while exposing only the selected
 * Notebook's manifest-owned content. The owner can swap roots atomically.
 */
export declare function createNotebookRuntime(options?: NotebookRuntimeOptions | string | null): {
    applicationRoot: string;
    open(root: string): NotebookRuntimeStatus;
    create(root: string, options?: {
        title?: unknown;
        id?: unknown;
    }): NotebookRuntimeStatus;
    close(): NotebookRuntimeStatus;
    recent(): RecentNotebook[];
    forget(root: string): {
        forgotten: boolean;
        notebooks: RecentNotebook[];
    };
    status(): NotebookRuntimeStatus;
    refreshNotebook(): NotebookRuntimeStatus;
    requireNotebookRoot(): string;
    resolve(relativePath: string, options?: ResolveOptions): string;
    resolveAppConfigWritePath(): string;
    read(relativePath: string): string;
    write(relativePath: string, content: string): void;
    subscribe(listener: (event: {
        previous: ActiveNotebook | null;
        current: ActiveNotebook | null;
    }) => void): () => boolean;
    watchPaths(): string[];
    viteAllowRoots(): string[];
};
export {};
