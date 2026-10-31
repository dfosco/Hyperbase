import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';
const skippedDirectories = new Set(['node_modules', 'dist', 'build', 'publish', 'coverage', 'test', 'tests', '__tests__', 'server', 'scripts']);
const serverPackages = new Set(['vite', 'vitest', 'typescript', '@vitejs/plugin-react', '@tailwindcss/vite', '@getpaseo/server', '@getpaseo/client']);
const builtins = new Set(builtinModules.map(name => name.replace(/^node:/, '')));
const escapePattern = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Parse authored imports, never execute Notebook modules or traverse package trees. */
export async function discoverNotebookDependencies({ notebookRoot, applicationRoot, aliases = [] }) {
    const empty = { include: [], aliases: [], missing: [] };
    if (!notebookRoot || !fs.existsSync(notebookRoot))
        return empty;
    const ts = await import(/* @vite-ignore */ 'typescript').catch(() => null);
    if (!ts)
        return empty;
    const imports = new Set();
    function visit(directory) {
        let entries;
        try {
            entries = fs.readdirSync(directory, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (entry.isSymbolicLink() || entry.name.startsWith('.'))
                continue;
            const filename = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                // `_`-prefixed folders are sidebar-only visibility; their imports are
                // still real dependencies and must be detected.
                if (!skippedDirectories.has(entry.name))
                    visit(filename);
                continue;
            }
            if (!/\.[cm]?[jt]sx?$/.test(entry.name) || /(?:\.(?:test|spec|server|config)\.[^.]+|\.d\.[cm]?ts)$/.test(entry.name))
                continue;
            let source;
            try {
                source = fs.readFileSync(filename, 'utf8');
            }
            catch {
                continue;
            }
            const tree = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, /[jt]sx$/.test(filename) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
            const add = (node) => { if (node && ts.isStringLiteralLike(node))
                imports.add(node.text); };
            const collect = (node) => {
                if (ts.isImportDeclaration(node)) {
                    const clause = node.importClause;
                    const bindings = clause?.namedBindings;
                    const onlyTypes = clause?.isTypeOnly || (!clause?.name && bindings && ts.isNamedImports(bindings) && bindings.elements.length > 0 && bindings.elements.every(item => item.isTypeOnly));
                    if (!onlyTypes)
                        add(node.moduleSpecifier);
                }
                else if (ts.isExportDeclaration(node)) {
                    const onlyTypes = node.isTypeOnly || (node.exportClause && ts.isNamedExports(node.exportClause) && node.exportClause.elements.length > 0 && node.exportClause.elements.every(item => item.isTypeOnly));
                    if (!onlyTypes)
                        add(node.moduleSpecifier);
                }
                else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require')))
                    add(node.arguments[0]);
                ts.forEachChild(node, collect);
            };
            collect(tree);
        }
    }
    visit(path.resolve(notebookRoot));
    const vite = await import(/* @vite-ignore */ 'vite').catch(() => null);
    if (!vite)
        return empty;
    // Use the client resolver's import/browser export conditions. require.resolve
    // would pick server/CJS entries or miss packages exposing only ESM imports.
    const resolverConfig = await vite.resolveConfig({ root: applicationRoot, configFile: false, envFile: false, logLevel: 'silent' }, 'serve');
    const resolveImport = resolverConfig.createResolver({ asSrc: false });
    // Vite's glob importer anchors resolution even when no index file exists.
    const runtimeImporter = path.join(path.resolve(applicationRoot), '*');
    const notebookImporter = path.join(path.resolve(notebookRoot), '*');
    const result = { include: [], aliases: [], missing: [] };
    for (const id of [...imports].sort()) {
        if (!/^(?:@[\w.-]+\/[\w.-]+|[\w-])/.test(id) || /^(?:node:|https?:|virtual:|#|~|\.)/.test(id))
            continue;
        const packageName = id.startsWith('@') ? id.split('/').slice(0, 2).join('/') : id.split('/')[0];
        if (builtins.has(packageName) || serverPackages.has(packageName) || packageName === '@dfosco/statefully' || id.startsWith('@dfosco/hypercanvas') || /\.(?:css|scss|sass|less|styl|json|svg|png|jpe?g|wasm)(?:\?|$)/i.test(id) || /\/server(?:\.|\/|$)/.test(id))
            continue;
        if (aliases.some(alias => typeof alias.find === 'string' ? id === alias.find || id.startsWith(`${alias.find}/`) : alias.find.test(id)))
            continue;
        let resolved;
        try {
            resolved = await resolveImport(id, runtimeImporter);
        }
        catch { /* Notebook-only package. */ }
        if (!resolved && !['react', 'react-dom', '@dfosco/statefully'].includes(packageName)) {
            try {
                resolved = await resolveImport(id, notebookImporter);
            }
            catch { /* Missing imports stay ordinary document errors. */ }
        }
        if (!resolved) {
            result.missing.push(id);
            continue;
        }
        result.include.push(id);
        result.aliases.push({ find: new RegExp(`^${escapePattern(id)}$`), replacement: resolved });
    }
    return result;
}
/** Included imports must finish prebundling before desktop document readiness. */
export async function prepareNotebookDependencies(server, onProgress = () => { }) {
    const optimizer = server.environments?.client?.depsOptimizer;
    if (optimizer) {
        await optimizer.init();
        await optimizer.scanProcessing;
    }
    onProgress('dependencies-scanned');
    if (optimizer)
        await Promise.all(optimizer.metadata.depInfoList.map(info => info.processing));
    onProgress('dependencies-ready');
}
