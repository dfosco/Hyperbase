import fs from 'node:fs';
import { hasNotebookManifest } from '../notebook/notebook.js';
import { legacySessionEnv as legacyEnv } from '../envCompat.js';
import path from 'node:path';
export function resolveNotebookRoot(explicitRoot = null) {
    const candidate = explicitRoot
        || (process.env.HYPERCANVAS_PROJECT_ROOT ?? legacyEnv('STORYBOARD_PROJECT_ROOT'))
        || process.env.HYPERCANVAS_NOTEBOOK_ROOT
        || process.cwd();
    const root = path.resolve(candidate);
    if (!hasNotebookManifest(root)) {
        throw Object.assign(new Error('No active Notebook is available for this operation.'), { code: 'NO_ACTIVE_NOTEBOOK' });
    }
    return fs.realpathSync.native(root);
}
export function resolveApplicationRoot() {
    const bundleRoot = process.env.HYPERCANVAS_BUNDLE_ROOT;
    const fallback = bundleRoot ? path.join(bundleRoot, 'storyboard') : process.cwd();
    return path.resolve(process.env.HYPERCANVAS_APPLICATION_ROOT || fallback);
}
