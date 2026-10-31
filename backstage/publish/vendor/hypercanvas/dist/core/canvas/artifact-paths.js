import fs from 'node:fs';
import path from 'node:path';
import { artifactFolderLogicalName } from '../artifact/visibility.js';
const ARTIFACT_SUFFIX = /\.(?:prototype|component|canvas|site)$/;
/** Resolve a selected Notebook parent without crossing a symlink or artifact boundary. */
export function resolveNotebookCanvasParent(root, parentPath) {
    const rawNormalized = typeof parentPath === 'string' ? parentPath.replaceAll('\\', '/') : '';
    if (rawNormalized.startsWith('/') || /^[A-Za-z]:/.test(rawNormalized)) {
        throw new Error('Canvas parent must be a notebook-relative ordinary folder outside every artifact.');
    }
    const normalized = rawNormalized.replace(/^\.\/$/, '').replace(/\/+$/, '');
    const segments = normalized ? normalized.split('/') : [];
    if (/^[A-Za-z]:/.test(normalized)
        || segments.some(segment => !segment || segment === '.' || segment === '..' || ARTIFACT_SUFFIX.test(segment))) {
        throw new Error('Canvas parent must be a notebook-relative ordinary folder outside every artifact.');
    }
    const rootPath = fs.realpathSync.native(root);
    let directory = rootPath;
    for (const segment of segments) {
        directory = path.join(directory, segment);
        let stat;
        try {
            stat = fs.lstatSync(directory);
        }
        catch {
            throw new Error(`Canvas parent folder "${normalized}" does not exist.`);
        }
        if (stat.isSymbolicLink() || !stat.isDirectory()) {
            throw new Error(`Canvas parent folder "${normalized}" must contain only ordinary directories.`);
        }
    }
    const resolved = path.resolve(directory);
    const relative = path.relative(rootPath, resolved);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        throw new Error('Canvas parent is outside the Notebook.');
    }
    return { path: segments.join('/'), directory: resolved };
}
export function notebookCanvasArtifactPaths(root, name, parentPath, visibilityPrefix = '') {
    if (!/^_*$/u.test(visibilityPrefix))
        throw new Error('Canvas artifact visibility prefix must contain only leading underscores.');
    const parent = resolveNotebookCanvasParent(root, parentPath);
    const folderName = `${visibilityPrefix}${name}.canvas`;
    const folderDirectory = path.join(parent.directory, folderName);
    return {
        parentPath: parent.path,
        parentDirectory: parent.directory,
        folderName,
        folderDirectory,
        payloadName: `${name}.canvas.jsonl`,
        payloadFile: path.join(folderDirectory, `${name}.canvas.jsonl`),
    };
}
/** Return the artifact directory only for its canonical `<name>.canvas.jsonl` payload. */
export function canvasArtifactDirectoryForPayload(payloadFile) {
    const filename = path.basename(payloadFile);
    const match = /^(.+)\.canvas\.jsonl$/.exec(filename);
    const folderName = path.basename(path.dirname(payloadFile));
    if (!match || !folderName.endsWith('.canvas') || artifactFolderLogicalName(folderName) !== match[1])
        return null;
    return path.dirname(payloadFile);
}
