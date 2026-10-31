/**
 * One-time startup migration of legacy Notebook file locations, before any
 * service reads runtime paths. Never overwrites an existing target at the new
 * location: leftovers stay where they are and can be removed by hand.
 *
 * - `.storyboard/` runtime state moves into `.hypercanvas/` (the Storyboard →
 *   Hypercanvas rename). Fresh state was always created under `.hypercanvas`;
 *   folders the rename touched carry both, so with `.storyboard` present
 *   writes landed there and `.hypercanvas` only ever received part of the
 *   state. After the merge the split never happens again.
 * - `assets/.storyboard-public` becomes `assets/.hypercanvas-public` the same
 *   way — committed public snapshots stay a single consistent directory.
 * - The managed publication project moves from `publish/` into
 *   `backstage/publish`, so a generated site lives under the support tree
 *   instead of a Notebook-visible top-level folder.
 *
 * Machine-local runtime names keep working for reading, so an unmigrated
 * Notebook still opens; this only runs at open time to converge everything.
 */
export declare function migrateLegacyNotebookFileLocations(root: string): {
    moved: string[];
};
