import { type NotebookSibling, type NotebookSiblingRef } from './sibling-order.js';
import type { NotebookNavigationTree } from './navigation-tree-model.js';
/** Directories required for safe/internal traversal, independent of user rules. */
export declare const NOTEBOOK_TREE_INTERNAL_DIRECTORIES: Set<string>;
export type NotebookTreeSource = {
    manifest?: {
        id?: unknown;
        title?: unknown;
    };
    pages?: unknown[];
    artifacts?: unknown[];
    sites?: Array<{
        id?: unknown;
        path?: unknown;
    }>;
};
/** Return the same visible, direct sibling list used to validate reorder requests. */
export declare function readDirectNotebookSiblings(root: string, parentPath: string, source: NotebookTreeSource, savedOrder?: NotebookSiblingRef[] | null): NotebookSibling[];
export declare function buildNotebookNavigationTree(root: string, source: NotebookTreeSource, siblingOrders?: Record<string, NotebookSiblingRef[]>, reorderSiblings?: boolean, excludedGeneratedOutputPaths?: string[]): NotebookNavigationTree;
