import fs from 'node:fs';
import path from 'node:path';
import { DOC_ID, readDocMetadata } from './metadata.js';
const EXCLUDED = new Set(['.git', '.hypercanvas', '.storyboard', '.design-notebook', '.vite', '.cache', '.next', '.turbo', 'node_modules', 'dist', 'build', 'out', 'coverage', 'storybook-static', 'publish']);
/** Bounded Doc discovery. The downstream first-look catalog can replace this adapter. */
export function discoverDocs(root) {
    const docs = [];
    function add(file, extra = []) {
        const relative = path.relative(root, file).split(path.sep).join('/');
        let parsed;
        try {
            parsed = readDocMetadata(fs.readFileSync(file, 'utf8'), relative);
        }
        catch {
            parsed = { metadata: {}, body: '', lineOffset: 0, diagnostics: [{ code: 'UNREADABLE_DOCUMENT', message: 'Cannot read document source.', path: relative }] };
        }
        const id = typeof parsed.metadata.id === 'string' && DOC_ID.test(parsed.metadata.id) ? parsed.metadata.id : `invalid:${relative}`;
        docs.push({ id, type: 'doc', kind: 'doc', title: typeof parsed.metadata.title === 'string' && parsed.metadata.title.trim() ? parsed.metadata.title : path.basename(file),
            path: relative, payloadPath: relative, folderPath: path.posix.dirname(relative) === '.' ? '' : path.posix.dirname(relative),
            route: `/docs/${encodeURIComponent(id)}`, portable: true, metadata: parsed.metadata,
            available: !parsed.diagnostics.length && !extra.length, diagnostics: [...parsed.diagnostics, ...extra] });
    }
    function walk(directory) {
        let entries;
        try {
            entries = fs.readdirSync(directory, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
            const absolute = path.join(directory, entry.name);
            if (entry.isSymbolicLink())
                continue;
            if (entry.isFile() && entry.name.endsWith('.doc.mdx'))
                add(absolute);
            else if (entry.isDirectory() && !EXCLUDED.has(entry.name)) {
                if (/\.(prototype|canvas|site|component)$/.test(entry.name))
                    continue;
                if (entry.name.endsWith('.doc')) {
                    const expected = path.join(absolute, `${entry.name.slice(0, -4)}.doc.mdx`);
                    if (fs.existsSync(expected) && fs.lstatSync(expected).isFile())
                        add(expected);
                    else {
                        const relative = path.relative(root, expected).split(path.sep).join('/');
                        const id = `invalid:${relative}`;
                        docs.push({ id, type: 'doc', kind: 'doc', title: entry.name, path: relative, payloadPath: relative,
                            folderPath: path.posix.dirname(relative), route: `/docs/${encodeURIComponent(id)}`, portable: true,
                            metadata: {}, available: false, diagnostics: [{ code: 'MISSING_DOCUMENT', message: `Doc wrapper requires ${path.basename(expected)}.`, path: relative }] });
                    }
                }
                else
                    walk(absolute);
            }
        }
    }
    walk(root);
    for (const doc of docs)
        if (docs.filter(other => other.id === doc.id).length > 1) {
            doc.available = false;
            doc.diagnostics.push({ code: 'DUPLICATE_DOCUMENT_ID', message: `Duplicate document ID: ${doc.id}`, path: doc.path });
        }
    return docs;
}
/** Only discovered payloads and explicitly requested contained assets are readable. */
export function resolveDocAsset(root, folder, reference) {
    if (!reference || /^(?:[a-z]+:|\/|\\)/i.test(reference) || reference.includes('\\'))
        return null;
    let decoded;
    try {
        decoded = decodeURIComponent(reference.split(/[?#]/)[0]);
    }
    catch {
        return null;
    }
    const target = path.resolve(root, folder, decoded);
    const relative = path.relative(root, target);
    if (!relative || (relative === '..' || relative.startsWith(`..${path.sep}`)) || path.isAbsolute(relative) || relative.split(path.sep).some(segment => EXCLUDED.has(segment)))
        return null;
    try {
        const realRelative = path.relative(fs.realpathSync(root), fs.realpathSync(target));
        if ((realRelative === '..' || realRelative.startsWith(`..${path.sep}`)) || path.isAbsolute(realRelative) || !fs.statSync(target).isFile())
            return null;
        return target;
    }
    catch {
        return null;
    }
}
