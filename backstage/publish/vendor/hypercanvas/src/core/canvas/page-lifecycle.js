import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { inspectNotebook, registerNotebookPage, unregisterNotebookPage, hasNotebookManifest } from '../notebook/notebook.js';
import { canvasArtifactDirectoryForPayload } from './artifact-paths.js';
export function canvasPayloadRevision(file) {
    return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function notebookSnapshot(root) {
    if (!hasNotebookManifest(root))
        return null;
    const snapshot = inspectNotebook(root);
    if (snapshot.status !== 'valid')
        throw new Error('A valid Notebook is required for canvas mutations.');
    return snapshot;
}
/** Synchronous payload + registry commit: watcher callbacks cannot discover partial creations. */
export function writeCanvasPage(root, file, content, { title, companion, placement = {}, }) {
    const canonicalRoot = fs.realpathSync.native(root);
    // The parent directory is created lazily: artifact-shaped Notebooks no
    // longer pre-create legacy grouping directories on open.
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const canonicalFile = path.join(fs.realpathSync.native(path.dirname(file)), path.basename(file));
    const relative = path.relative(canonicalRoot, canonicalFile).replaceAll('\\', '/');
    const snapshot = notebookSnapshot(root);
    if (snapshot?.manifest.pages.some(page => page.path === relative)) {
        throw new Error(`Canvas "${relative}" is already registered; restore its missing source explicitly.`);
    }
    const created = [];
    try {
        for (const entry of [{ file, content }, ...(companion ? [companion] : [])]) {
            // Publish complete files exclusively. A racing creator or existing companion
            // must never be overwritten or removed by this operation's rollback.
            const temporary = `${entry.file}.${randomUUID()}.tmp`;
            try {
                fs.writeFileSync(temporary, entry.content, { encoding: 'utf8', flag: 'wx' });
                fs.linkSync(temporary, entry.file);
                created.push(entry.file);
            }
            finally {
                fs.rmSync(temporary, { force: true });
            }
        }
        if (!snapshot)
            return null;
        const candidate = inspectNotebook(root).pages.find(page => page.path === relative);
        if (!candidate?.available)
            throw new Error('Canvas payload is unavailable or its route conflicts with another page.');
        const page = registerNotebookPage(root, { type: 'canvas', title, path: relative }, placement);
        if (!page)
            throw new Error('Canvas page registration failed.');
        return page.id;
    }
    catch (error) {
        for (const target of created.reverse())
            fs.unlinkSync(target);
        // registerNotebookPage can fail after committing (for example during its
        // final inspection). Only this new locator is eligible for rollback.
        if (snapshot && created.length)
            unregisterNotebookPage(root, { path: relative });
        throw error;
    }
}
/** Remove the payload before unregistering so discovery cannot add it back. Roll back on registry failure. */
export function deleteCanvasPage(root, file, expectedPayloadRevision) {
    if (canvasArtifactDirectoryForPayload(file))
        return deleteCanvasArtifact(root, file, expectedPayloadRevision);
    const canonicalRoot = fs.realpathSync.native(root);
    const relative = path.relative(canonicalRoot, file).replaceAll('\\', '/');
    const snapshot = notebookSnapshot(root);
    if (expectedPayloadRevision && canvasPayloadRevision(file) !== expectedPayloadRevision) {
        throw new Error('Canvas changed while its sessions were closing; retry deletion.');
    }
    const targets = [file, file.replace(/\.canvas\.jsonl$/, '.canvas.jsx')]
        .filter((target, index, entries) => entries.indexOf(target) === index && fs.existsSync(target));
    const relativeTargets = targets.map(target => path.relative(canonicalRoot, fs.realpathSync.native(target)).replaceAll('\\', '/'));
    const staged = [];
    try {
        for (const target of targets) {
            const temporary = `${target}.${randomUUID()}.deleting`;
            fs.renameSync(target, temporary);
            staged.push({ file: target, temporary });
        }
        if (snapshot)
            unregisterNotebookPage(root, { path: relative });
    }
    catch (error) {
        for (const entry of staged.reverse())
            fs.renameSync(entry.temporary, entry.file);
        throw error;
    }
    // The committed deletion is complete even if a staging-file removal fails.
    // Such files have no discoverable canvas suffix and cannot resurrect a page.
    for (const entry of staged)
        fs.rmSync(entry.temporary, { force: true });
    return relativeTargets;
}
/** Stage and remove one complete suffix-folder canvas without touching its parent or siblings. */
export function deleteCanvasArtifact(root, file, expectedPayloadRevision) {
    const directory = canvasArtifactDirectoryForPayload(file);
    if (!directory)
        throw new Error('Canvas payload is not inside its canonical .canvas artifact folder.');
    const snapshot = notebookSnapshot(root);
    if (expectedPayloadRevision && canvasPayloadRevision(file) !== expectedPayloadRevision) {
        throw new Error('Canvas changed while its sessions were closing; retry deletion.');
    }
    const canonicalRoot = fs.realpathSync.native(root);
    const canonicalFile = path.join(fs.realpathSync.native(path.dirname(file)), path.basename(file));
    const relativePayload = path.relative(canonicalRoot, canonicalFile).replaceAll('\\', '/');
    const targets = [];
    const visit = (current) => {
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const target = path.join(current, entry.name);
            if (entry.isDirectory() && !entry.isSymbolicLink())
                visit(target);
            else
                targets.push(path.relative(canonicalRoot, target).replaceAll('\\', '/'));
        }
    };
    visit(directory);
    const temporary = `${directory}.${randomUUID()}.deleting`;
    fs.renameSync(directory, temporary);
    try {
        if (snapshot)
            unregisterNotebookPage(root, { path: relativePayload });
    }
    catch (error) {
        fs.renameSync(temporary, directory);
        throw error;
    }
    fs.rmSync(temporary, { recursive: true, force: true });
    return targets;
}
