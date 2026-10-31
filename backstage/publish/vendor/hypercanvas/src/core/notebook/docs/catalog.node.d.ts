import type { NotebookSnapshot } from '../notebook.js';
import type { DocArtifact } from './discovery.node.js';
/** Adapt the authoritative catalog without rescanning or mutating its snapshots. */
export declare function documentCatalog(snapshot: NotebookSnapshot): {
    documents: DocArtifact[];
    artifacts: (Record<string, unknown> & {
        id: string;
    })[];
};
