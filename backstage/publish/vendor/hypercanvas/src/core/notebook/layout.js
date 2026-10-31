import fs from 'node:fs';
import path from 'node:path';
/**
 * Notebook folder layout. Everything that is not authored content lives under
 * `backstage/`, but no folder here is ever required: a root-level copy keeps
 * working, and a missing `backstage/` is created on demand, never an error.
 */
export const NOTEBOOK_MANIFEST_FILE = 'hypercanvas.notebook.json';
export const NOTEBOOK_BACKSTAGE_DIR = 'backstage';
/** Where new Notebooks keep their manifest; existing root manifests stay readable and writable in place. */
export const NOTEBOOK_MANIFEST_DIR = 'backstage/config';
/** Media and data folders: `backstage/<name>` for new Notebooks, root `<name>` when it already exists. */
export const NOTEBOOK_CONTENT_DIRECTORY_NAMES = Object.freeze(['assets', 'data']);
function isFile(filePath) {
    try {
        return fs.statSync(filePath).isFile();
    }
    catch {
        return false;
    }
}
function isDirectory(filePath) {
    try {
        return fs.statSync(filePath).isDirectory();
    }
    catch {
        return false;
    }
}
/** Candidate manifest locations, preferred first. A missing backstage never fails resolution. */
export function notebookManifestCandidates(root) {
    return [path.join(root, NOTEBOOK_MANIFEST_DIR, NOTEBOOK_MANIFEST_FILE), path.join(root, NOTEBOOK_MANIFEST_FILE)];
}
/** The manifest that exists, else where a new one is written (backstage/config). */
export function resolveNotebookManifestPath(root) {
    const candidates = notebookManifestCandidates(root);
    return candidates.find(candidate => isFile(candidate)) ?? candidates[0];
}
/** Manifest path relative to the Notebook root, with `/` separators. */
export function notebookManifestRelativePath(root) {
    return path.relative(root, resolveNotebookManifestPath(root)).split(path.sep).join('/');
}
export function hasNotebookManifest(root) {
    return notebookManifestCandidates(root).some(candidate => isFile(candidate));
}
/**
 * Physical `assets/` or `data/` directory. An existing root folder wins so older
 * Notebooks (and adopted folders that already have one) are left as they are.
 * Otherwise Notebooks use `backstage/<name>`. A folder that is not a Notebook,
 * such as a client prototype repository, keeps the root location unless the
 * caller is scaffolding a Notebook (`notebook: true`).
 */
export function resolveNotebookContentDirectory(root, name, { notebook = hasNotebookManifest(root) } = {}) {
    const legacy = path.join(root, name);
    if (isDirectory(legacy) || !notebook)
        return legacy;
    return path.join(root, NOTEBOOK_BACKSTAGE_DIR, name);
}
/** `assets/...` or `data/...` path under its physical directory. */
export function notebookContentPath(root, name, ...segments) {
    return path.join(resolveNotebookContentDirectory(root, name), ...segments);
}
/** Map a logical `assets/x` or `data/x` Notebook path to its physical path relative to the root. */
export function physicalNotebookRelativePath(root, relativePath) {
    const segments = relativePath.split('/');
    const name = NOTEBOOK_CONTENT_DIRECTORY_NAMES.find(candidate => candidate === segments[0]);
    if (!name)
        return relativePath;
    return path.relative(root, notebookContentPath(root, name, ...segments.slice(1))).split(path.sep).join('/');
}
