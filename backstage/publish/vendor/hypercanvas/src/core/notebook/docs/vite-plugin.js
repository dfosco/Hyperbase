import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { resolveDocAsset } from './discovery.node.js';
import { documentCatalog } from './catalog.node.js';
import { compileDocument, DOCS_IMPORT_PATH } from './compiler.js';
import { inspectNotebook } from '../notebook.js';
import { buildNotebookNavigationTree } from '../navigation-tree.js';
const INDEX = 'virtual:hypercanvas-documents';
const CONTENT = 'virtual:hypercanvas-document:';
const renderer = fileURLToPath(new URL('../../../internals/Document/Document.jsx', import.meta.url.replace('/dist/core/', '/src/core/')));
/** Vite module/assets transport. Replace catalog/discovery downstream, not the renderer. */
export default function documentsPlugin(host) {
    let projectRoot = process.cwd();
    let mode = host?.mode || 'local';
    const root = () => host?.root() || process.env.HYPERCANVAS_NOTEBOOK_ROOT || path.join(projectRoot, 'src');
    const watchedAssets = new Set();
    const sourceCache = new Map();
    const compiled = new Map();
    return {
        name: 'hypercanvas-documents', enforce: 'pre',
        config() { return process.env.VITE_NOTEBOOK_PUBLISHED === '1' ? { define: { 'globalThis.__HYPERCANVAS_NOTEBOOK_PUBLICATION__': 'true' } } : {}; },
        configResolved(config) { projectRoot = config.root; if (!host?.mode)
            mode = config.command === 'build' ? 'static' : 'local'; },
        transformIndexHtml(html) {
            if (mode !== 'static' || process.env.VITE_NOTEBOOK_PUBLISHED !== '1' || html.includes('window.__HYPERCANVAS_NOTEBOOK_PUBLICATION__='))
                return html;
            const snapshot = inspectNotebook(root());
            if (snapshot.status !== 'valid')
                return html;
            const tree = buildNotebookNavigationTree(root(), snapshot);
            const payload = JSON.stringify({ notebookId: snapshot.manifest.id, title: snapshot.manifest.title, navigation: snapshot.manifest.navigation, pages: snapshot.pages, tree }).replaceAll('<', '\\u003c');
            return html.replace('</head>', `<script>window.__HYPERCANVAS_NOTEBOOK_PUBLICATION__=${payload}</script></head>`);
        },
        resolveId(id) {
            if (id === DOCS_IMPORT_PATH)
                return renderer;
            if (id === INDEX || id.startsWith(CONTENT))
                return `\0${id}`;
            return null;
        },
        async load(id) {
            if (id === `\0${INDEX}`) {
                const notebookRoot = path.resolve(root());
                const catalog = documentCatalog(inspectNotebook(notebookRoot));
                const docs = structuredClone(await host?.documents?.() || catalog.documents);
                const hostArtifacts = (await host?.catalog?.() || catalog.artifacts)
                    .filter(artifact => (artifact.kind || artifact.type) !== 'doc')
                    .map(artifact => {
                    if (mode !== 'static' || (artifact.kind || artifact.type) !== 'site')
                        return artifact;
                    const exported = structuredClone(artifact);
                    delete exported.local;
                    delete exported.binding;
                    delete exported.developmentUrl;
                    if (exported.descriptor && typeof exported.descriptor === 'object')
                        delete exported.descriptor.local;
                    return exported;
                });
                for (const doc of docs)
                    if (hostArtifacts.some(artifact => artifact.id === doc.id)) {
                        doc.available = false;
                        doc.diagnostics.push({ code: 'DUPLICATE_DOCUMENT_ID', message: `ID conflicts with another artifact: ${doc.id}`, path: doc.path });
                    }
                const artifacts = [...hostArtifacts, ...docs];
                const imports = [];
                const entries = [];
                const assetEntries = [];
                const activeSources = new Set(docs.map(doc => path.join(notebookRoot, doc.path)));
                for (const file of sourceCache.keys())
                    if (!activeSources.has(file))
                        sourceCache.delete(file);
                compiled.clear();
                watchedAssets.clear();
                for (const [index, doc] of docs.entries()) {
                    let result = null;
                    try {
                        const file = path.join(notebookRoot, doc.path);
                        this.addWatchFile(file);
                        const source = host?.loadSource ? await host.loadSource(doc) : fs.readFileSync(file, 'utf8');
                        const cached = sourceCache.get(file);
                        result = cached?.source === source ? cached.result : await compileDocument(source, doc.path);
                        sourceCache.set(file, { source, result });
                    }
                    catch { /* Discovery already reports missing payloads. */ }
                    if (doc.available && result?.available && result.compiledSource) {
                        const key = doc.path + '?revision=' + createHash('sha256').update(result.source).digest('hex');
                        compiled.set(key, result);
                        imports.push(`import Content${index} from ${JSON.stringify(CONTENT + key)};`);
                    }
                    entries.push(`${JSON.stringify(doc.path)}: {Content: ${doc.available && result?.available ? `Content${index}` : 'null'}, source: ${JSON.stringify(result?.source || '')}, diagnostics: ${JSON.stringify(result?.diagnostics || [])}}`);
                    for (const [assetIndex, reference] of (result?.assets || []).entries()) {
                        const absolute = resolveDocAsset(notebookRoot, doc.folderPath, reference);
                        if (!absolute)
                            continue;
                        watchedAssets.add(absolute);
                        const name = `asset${index}_${assetIndex}`;
                        imports.push(`import ${name} from ${JSON.stringify(`${absolute}?url`)};`);
                        assetEntries.push(`${JSON.stringify(`${doc.folderPath}/${reference}`)}: ${name}`);
                    }
                }
                for (const [index, artifact] of hostArtifacts.entries())
                    for (const [viewIndex, view] of (artifact.views || artifact.descriptor?.views || []).entries()) {
                        if (!view.screenshot)
                            continue;
                        const folder = typeof artifact.folderPath === 'string' ? artifact.folderPath : '';
                        const absolute = resolveDocAsset(notebookRoot, folder, view.screenshot);
                        if (!absolute)
                            continue;
                        const name = `poster${index}_${viewIndex}`;
                        watchedAssets.add(absolute);
                        imports.push(`import ${name} from ${JSON.stringify(`${absolute}?url`)};`);
                        assetEntries.push(`${JSON.stringify(`${folder}/${view.screenshot}`)}: ${name}`);
                    }
                return `${imports.join('\n')}\nexport const documents=${JSON.stringify(docs)};\nexport const artifacts=${JSON.stringify(artifacts)};\nexport const contents={${entries.join(',')}};\nexport const assets={${assetEntries.join(',')}};\nexport const mode=${JSON.stringify(mode)};\nexport function getDocumentSnapshot(){return import.meta.hot?.data.latest || {documents,artifacts,contents,assets,mode}};\nif(import.meta.hot)import.meta.hot.accept(next=>{if(next){import.meta.hot.data.latest=next;window.dispatchEvent(new CustomEvent('hypercanvas:documents-updated',{detail:next}));window.dispatchEvent(new Event('storyboard:sites-changed'));}});`;
            }
            if (id.startsWith(`\0${CONTENT}`)) {
                const locator = id.slice(CONTENT.length + 1);
                // Index validation is authoritative; never accept arbitrary virtual paths.
                return compiled.get(locator)?.compiledSource || 'export default function MissingDocument(){return null}';
            }
            return null;
        },
        configureServer(server) {
            server.watcher.add(root());
            let timer;
            const update = (file) => {
                const relative = path.relative(path.resolve(root()), file);
                const catalogFile = /\.(?:prototype|site)\.jsonc?$/.test(file) || /(?:^|[/\\])(?:hypercanvas\.notebook\.json|\.hypercanvas-artifact\.json)$/.test(file);
                if ((!file.endsWith('.doc.mdx') && !watchedAssets.has(file) && !catalogFile) || relative.startsWith('..') || relative.split(path.sep).some(part => ['.git', '.hypercanvas', '.storyboard', 'node_modules', 'dist', 'publish'].includes(part)))
                    return;
                clearTimeout(timer);
                timer = setTimeout(() => {
                    for (const module of server.moduleGraph.idToModuleMap.values())
                        if (module.id?.startsWith('\0virtual:hypercanvas-document'))
                            server.moduleGraph.invalidateModule(module);
                    const index = server.moduleGraph.getModuleById(`\0${INDEX}`);
                    if (index)
                        void server.reloadModule(index);
                }, 60);
            };
            server.watcher.on('add', update).on('change', update).on('unlink', update);
            server.httpServer?.once('close', () => { clearTimeout(timer); server.watcher.off('add', update).off('change', update).off('unlink', update); });
        },
    };
}
