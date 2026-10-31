import { readDocMetadata } from './metadata.js';
export const DOCS_IMPORT_PATH = 'design-notebook/docs';
const BUILTINS = new Set(['Prototype', 'Site', 'Image', 'CanvasWidget']);
/** Host-independent MDX compiler. Hosts supply imports, catalog and asset URLs. */
export async function compileDocument(source, sourcePath) {
    const parsed = readDocMetadata(source, sourcePath);
    const diagnostics = [...parsed.diagnostics];
    const assets = new Set();
    const bindings = new Set();
    const components = [];
    const diagnostic = (code, message, line) => diagnostics.push({ code, message, path: sourcePath, ...(line ? { line: line + parsed.lineOffset } : {}) });
    const inspect = () => (tree) => {
        function visit(node) {
            const line = node.position?.start?.line ?? 1;
            if (node.type === 'mdxjsEsm')
                for (const statement of node.data?.estree?.body ?? []) {
                    if (statement.type !== 'ImportDeclaration')
                        continue;
                    if (statement.source?.value !== DOCS_IMPORT_PATH)
                        diagnostic('UNSUPPORTED_DOCUMENT_IMPORT', `Unsupported import: ${String(statement.source?.value)}`, line);
                    for (const specifier of statement.specifiers ?? []) {
                        if (specifier.type !== 'ImportSpecifier' || !BUILTINS.has(specifier.imported?.name ?? ''))
                            diagnostic('UNSUPPORTED_DOCUMENT_IMPORT', 'Only named Prototype, Site, Image and CanvasWidget imports are supported.', line);
                        if (specifier.local?.name)
                            bindings.add(specifier.local.name);
                    }
                }
            if ((node.type === 'image' || node.type === 'definition') && node.url)
                assets.add(node.url);
            if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
                if (node.name && /^[A-Z]/.test(node.name))
                    components.push({ name: node.name.split('.')[0], line });
                for (const attribute of node.attributes ?? [])
                    if (attribute.name === 'src' && typeof attribute.value === 'string')
                        assets.add(attribute.value);
            }
            node.children?.forEach(visit);
        }
        visit(tree);
    };
    let compiledSource = null;
    try {
        const mdx = await import(/* @vite-ignore */ '@mdx-js/mdx').catch(() => null);
        if (!mdx)
            diagnostic('DOCUMENT_COMPILER_UNAVAILABLE', 'MDX compilation is unavailable. Install @mdx-js/mdx in the host.');
        else
            compiledSource = String(await mdx.compile(parsed.body, { outputFormat: 'program', development: false, remarkPlugins: [inspect] }));
    }
    catch (error) {
        const problem = error;
        diagnostic('INVALID_DOCUMENT_MDX', problem.message || String(error), problem.line);
    }
    for (const component of components)
        if (!bindings.has(component.name))
            diagnostic('UNIMPORTED_DOCUMENT_COMPONENT', `Import ${component.name} explicitly from ${DOCS_IMPORT_PATH}.`, component.line);
    return { ...parsed, source, compiledSource, assets: [...assets], diagnostics, available: !diagnostics.length && compiledSource !== null };
}
