/**
 * File Watcher (formerly Rename Watcher)
 *
 * Detects file and directory renames under watched directories and updates:
 *   - Canvas embed URLs (prototype and canvas widgets) to stay current.
 *   - File widget `props.path` references when the underlying repo file moves.
 * Auto-commits the changes with a configurable prefix.
 *
 * Uses snapshot-based diffing: on any fs event, re-scans the watched
 * directories and compares old vs new file sets. Only unambiguous renames
 * (1:1 file or directory mappings) are acted on.
 *
 * Configuration is loaded from config.json in this directory.
 */
import type { CanvasWidget } from '../canvas/materializer.js';
type WatchType = 'prototype' | 'canvas' | 'file-ref';
interface WatchEntry {
    path: string;
    extensions: string[];
    type: WatchType;
}
interface WatcherConfig {
    watch: WatchEntry[];
    exclude: {
        directories: string[];
        filePrefixes: string[];
    };
    debounceMs: number;
    autocommit: {
        enabled: boolean;
        prefix: string;
    };
}
interface Rename {
    oldPath: string;
    newPath: string;
    oldRoute: string | null;
    newRoute: string | null;
}
interface DraftFlip {
    oldPath: string;
    newPath: string;
    oldDraft: boolean;
    newDraft: boolean;
}
interface FileOperation {
    type: 'add' | 'rm';
    path: string;
}
type SnapshotMap = Map<string, Set<string>>;
declare function loadConfig(): WatcherConfig;
/**
 * Scan a watched directory and return a Set of relative file paths
 * matching the configured extensions and exclusions.
 */
declare function scanDirectory(root: string, watchEntry: WatchEntry, config: WatcherConfig): Set<string>;
/**
 * Detect canvas files that crossed the `drafts/` boundary. A flip is an
 * unambiguous 1:1 pair of (removed, added) `.canvas.jsonl` files whose
 * paths agree after stripping `drafts` segments but differ in draft status.
 *
 * This complements detectRenames(), which intentionally ignores in/out-of-drafts
 * moves because the public route (canvasRoute) strips `drafts` segments and so
 * sees both sides as the same route.
 *
 * Returns an array of `{ oldPath, newPath, oldDraft, newDraft }`.
 */
declare function detectDraftsFlips(oldSnapshot: Set<string>, newSnapshot: Set<string>): DraftFlip[];
/**
 * Rewrite a repo-relative file path if it matches a renamed file or directory.
 * Checks exact matches first, then directory-prefix matches. Prefix matching
 * only fires for directory renames (where the file's parent dir changed), not
 * for in-directory file renames — this prevents false positives when two files
 * share the same parent directory but only one was renamed.
 */
declare function rewriteFilePath(oldPath: string, fileRenames: Map<string, string>): string;
/**
 * Update widget embed refs for detected renames.
 * Returns the updated widgets array if any changed, null if unchanged.
 */
declare function updateWidgetRefs(widgets: CanvasWidget[], renames: Rename[], fileRenames: Map<string, string>): CanvasWidget[] | null;
/**
 * Move image files referenced by a canvas that crossed the drafts boundary,
 * and produce the rewritten widget array.
 *
 * Strategy per image widget:
 *   - parse `props.src`; compute oldDir/newDir from old/new draft status
 *   - if file not present on disk → just rewrite src
 *   - if target collides → pick a unique basename
 *   - if image is shared with another canvas → COPY (preserve source)
 *   - otherwise → RENAME (atomic move)
 *
 * Returns { widgets, fileOps } where fileOps is the list of disk changes
 * for the autocommit pass to surface to git.
 */
declare function processDraftsFlipImages(root: string, flip: DraftFlip, canvasFiles: string[]): {
    widgets: CanvasWidget[];
    fileOps: FileOperation[];
} | null;
/**
 * Process a detected change — rescan, detect renames + drafts flips, update
 * embeds, move drafts-flip image files, commit.
 */
declare function processChange(root: string, snapshots: SnapshotMap, config: WatcherConfig): void;
/**
 * Start the file watcher.
 * @param {string} root — project root directory
 * @returns {{ close: () => void }}
 */
export declare function startFileWatcher(root: string): {
    close: () => void;
};
export declare const __test: {
    detectDraftsFlips: typeof detectDraftsFlips;
    processDraftsFlipImages: typeof processDraftsFlipImages;
    processChange: typeof processChange;
    scanDirectory: typeof scanDirectory;
    loadConfig: typeof loadConfig;
    rewriteFilePath: typeof rewriteFilePath;
    updateWidgetRefs: typeof updateWidgetRefs;
};
export {};
