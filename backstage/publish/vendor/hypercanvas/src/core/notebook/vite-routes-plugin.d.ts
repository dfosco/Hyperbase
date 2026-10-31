import type { Plugin } from 'vite';
interface NotebookRoutesRuntime {
    status(): {
        root?: string | null;
    };
}
/** Whether a Notebook file event can change the generated prototype route map. */
export declare function isNotebookPrototypeRouteMapEvent(root: string | null | undefined, file: string, event: 'add' | 'change' | 'unlink'): boolean;
/**
 * Build the source of the notebook prototype route map for a given root.
 *
 * Shared by `notebookRoutesPlugin` (which owns `virtual:hypercanvas-notebook-routes`
 * for the canvas SPA) and the storyboard data plugin (which serves the same map
 * under `virtual:storyboard-notebook-prototype-routes` so the library's isolated
 * iframe entry — `prototypes.html` — can route to Notebook prototypes too; the
 * data plugin is registered by every consumer config, the routes plugin only by
 * notebook-runtime ones).
 */
export declare function notebookPrototypeRouteSource(root: string | null | undefined): string;
export default function notebookRoutesPlugin({ runtime }?: {
    runtime?: NotebookRoutesRuntime | null;
}): Plugin;
export {};
