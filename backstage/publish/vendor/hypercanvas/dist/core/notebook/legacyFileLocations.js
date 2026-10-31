import fs from 'node:fs';
import path from 'node:path';
import { notebookContentPath } from './layout.js';
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
export function migrateLegacyNotebookFileLocations(root) {
    const moved = [];
    const isDirectory = (candidate) => {
        try {
            return fs.statSync(candidate).isDirectory();
        }
        catch {
            return false;
        }
    };
    const legacyRuntime = path.join(root, '.storyboard');
    const primaryRuntime = path.join(root, '.hypercanvas');
    if (isDirectory(legacyRuntime)) {
        fs.mkdirSync(primaryRuntime, { recursive: true });
        for (const entry of fs.readdirSync(legacyRuntime)) {
            const target = path.join(primaryRuntime, entry);
            if (fs.existsSync(target))
                continue;
            try {
                fs.renameSync(path.join(legacyRuntime, entry), target);
                moved.push(`.storyboard/${entry}`);
            }
            catch { /* partial moves are retried on the next open */ }
        }
        try {
            if (fs.readdirSync(legacyRuntime).length === 0)
                fs.rmdirSync(legacyRuntime);
        }
        catch { /* keep */ }
    }
    const legacyPublic = notebookContentPath(root, 'assets', '.storyboard-public');
    const primaryPublic = notebookContentPath(root, 'assets', '.hypercanvas-public');
    if (isDirectory(legacyPublic) && !fs.existsSync(primaryPublic)) {
        fs.mkdirSync(path.dirname(primaryPublic), { recursive: true });
        try {
            fs.renameSync(legacyPublic, primaryPublic);
            moved.push('assets/.storyboard-public');
        }
        catch { /* retried on the next open */ }
    }
    const legacyPublish = path.join(root, 'publish');
    const primaryPublish = path.join(root, 'backstage', 'publish');
    if (isDirectory(legacyPublish) && !fs.existsSync(primaryPublish)) {
        fs.mkdirSync(path.dirname(primaryPublish), { recursive: true });
        try {
            fs.renameSync(legacyPublish, primaryPublish);
            moved.push('publish');
        }
        catch { /* retried on the next open */ }
    }
    return { moved };
}
