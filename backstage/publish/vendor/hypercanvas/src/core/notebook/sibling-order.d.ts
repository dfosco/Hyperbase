export type NotebookSiblingRef = {
    kind: 'folder';
    path: string;
} | {
    kind: 'artifact';
    id: string;
};
export type NotebookSibling = {
    ref: NotebookSiblingRef;
    kind: 'folder' | 'artifact';
    name: string;
    /** Unique pre-marker identities accepted for reads and normalized on writes. */
    legacyArtifactIds?: string[];
};
export type SiblingOrderChange = 'order-only' | 'other' | 'unchanged';
export declare function classifySiblingOrderConfigChange(previousRaw: unknown, nextRaw: unknown): SiblingOrderChange;
/** Each watcher owns its baseline so one plugin cannot consume another's change. */
export declare function createSiblingOrderChangeTracker(initialRaw: unknown): {
    observe(nextRaw: unknown): SiblingOrderChange;
};
export declare function isNotebookSiblingRef(value: unknown): value is NotebookSiblingRef;
export declare function defaultNotebookSiblingOrder(siblings: NotebookSibling[]): NotebookSibling[];
/** Apply a saved per-parent sequence, ignoring removed refs and appending new siblings by default rank. */
export declare function resolveNotebookSiblingOrder(siblings: NotebookSibling[], savedOrder?: NotebookSiblingRef[] | null): NotebookSibling[];
export type ReorderSiblingsRequest = {
    parentPath: string;
    sibling: NotebookSiblingRef;
    insertBefore?: NotebookSiblingRef;
    insertAfter?: NotebookSiblingRef;
    expectedSiblingOrder: NotebookSiblingRef[];
};
/** Move one existing direct child before or after another direct child. */
export declare function applySiblingReorder(current: NotebookSiblingRef[], request: ReorderSiblingsRequest): NotebookSiblingRef[];
