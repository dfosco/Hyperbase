/**
 * Artifact disk operations — create, edit, delete artifacts on the filesystem.
 *
 * Each operation validates first, then performs the FS mutation.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateArtifact, resolvePrototypeDir, resolveNotebookPrototypeDir, toPascalCase } from './validate.js';
import { buildTemplateRecipeIndex, resolveTemplateRecipeEntry } from '../workshop/features/templateIndex.js';
import { renderPartialIndexJsx, findComponentFile, readWorkshopPartials } from '../workshop/features/partialRender.js';
import { SiteStore, siteConfigRelativePath, siteDescriptorRelativePath, updateSiteDescriptor } from '../site/site.js';
import { inspectNotebook, registerNotebookPage, unregisterNotebookPage, updateNotebookPage, NOTEBOOK_ARTIFACT_MARKER_FILE, notebookManifestRelativePath, hasNotebookManifest } from '../notebook/notebook.js';
import { assertCanvasWritable } from '../canvas/canvasEventWriter.js';
import { materializeFromText } from '../canvas/materializer.js';
import { toCanvasId } from '../canvas/identity.js';
import { canvasPayloadRevision, deleteCanvasArtifact, deleteCanvasPage, writeCanvasPage } from '../canvas/page-lifecycle.js';
import { closeWidgetSession } from '../canvas/widget-session-lifecycle.js';
import { canvasArtifactDirectoryForPayload, notebookCanvasArtifactPaths, resolveNotebookCanvasParent } from '../canvas/artifact-paths.js';
import { artifactFolderLogicalName, artifactFolderVisibilityPrefix } from './visibility.js';
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isArtifactType(type) {
    return ['prototype', 'canvas', 'component', 'flow', 'object', 'record', 'page', 'site'].includes(type);
}
function stringField(values, key) {
    const value = values[key];
    return typeof value === 'string' ? value : undefined;
}
function normalizedParent(value) {
    const normalized = value.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '');
    return normalized === '.' ? '' : normalized;
}
function notebookParentScope(values) {
    const parentPath = stringField(values, 'parentPath');
    const folder = stringField(values, 'folder');
    for (const value of [parentPath, folder]) {
        if (value === undefined)
            continue;
        const normalizedSlashes = value.replaceAll('\\', '/');
        if (normalizedSlashes.startsWith('/') || /^[A-Za-z]:/.test(normalizedSlashes)) {
            return { scoped: true, parentPath: '', error: 'Notebook parent must be a relative ordinary folder.' };
        }
    }
    if (parentPath !== undefined && folder !== undefined && normalizedParent(parentPath) !== normalizedParent(folder)) {
        return { scoped: true, parentPath: '', error: 'parentPath and folder must refer to the same Notebook parent when both are provided.' };
    }
    const selected = parentPath ?? folder;
    if (selected === undefined)
        return { scoped: false, parentPath: '' };
    return { scoped: true, parentPath: normalizedParent(selected) };
}
function notebookArtifactParent(folderPath) {
    return normalizedParent(path.posix.dirname(folderPath));
}
function invalidStringField(type, values) {
    for (const field of ['sectionId', 'insertAfterPageId']) {
        if (values[field] !== undefined && typeof values[field] !== 'string')
            return field;
    }
    const fields = {
        prototype: ['name', 'folder', 'parentPath', 'url', 'partial'],
        canvas: ['name', 'folder', 'parentPath', 'folderKind'],
        component: ['name', 'directory', 'folder', 'parentPath'],
        flow: ['name', 'prototype', 'folder', 'copy-from'],
        object: ['name', 'prototype', 'folder'],
        record: ['name', 'prototype', 'folder'],
        page: ['prototype', 'path', 'folder'],
        site: ['name', 'folder', 'parentPath'],
    };
    for (const field of fields[type] ?? []) {
        if (values[field] !== undefined && typeof values[field] !== 'string')
            return field;
    }
    return null;
}
function contentDir(root, name) {
    return hasNotebookManifest(root)
        ? path.join(root, name)
        : path.join(root, 'src', name);
}
// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------
function prototypeJson(values) {
    const meta = {};
    if (values.title)
        meta.title = values.title;
    if (values.description)
        meta.description = values.description;
    if (values.author)
        meta.author = values.author;
    if (values.icon)
        meta.icon = values.icon;
    if (values.tags)
        meta.tags = values.tags;
    if (values.team)
        meta.team = values.team;
    const obj = { meta };
    if (values.url)
        obj.url = values.url;
    return JSON.stringify(obj, null, 2) + '\n';
}
function prototypeIndexJsx(name) {
    const pascal = toPascalCase(name);
    return `export default function ${pascal}() {
  return (
    <div>
      <h1>${pascal}</h1>
    </div>
  )
}
`;
}
function flowJson(globals = []) {
    return JSON.stringify({ $global: globals }, null, 2) + '\n';
}
function canvasJsonl(settings = {}) {
    const { grid, gridSize, colorMode, title, description, author, autoPlace, snapToGrid, ...rest } = settings;
    const event = {
        event: 'canvas_created',
        timestamp: new Date().toISOString(),
        title: title || '',
        grid: grid !== false,
        gridSize: gridSize ?? 24,
        colorMode: colorMode ?? 'auto',
        autoPlace: autoPlace ?? snapToGrid ?? false,
        widgets: [],
        ...rest,
    };
    if (description)
        event.description = description;
    if (author)
        event.author = author;
    return JSON.stringify(event) + '\n';
}
function canvasJsx(name) {
    const pascal = toPascalCase(name);
    return `export default function ${pascal}Canvas() {
  return null
}
`;
}
function componentJsx(pascal) {
    return `import styles from './${pascal}.module.css'

export default function ${pascal}({ children }) {
  return (
    <div className={styles.root}>
      {children}
    </div>
  )
}
`;
}
function componentCss() {
    return `.root {
}
`;
}
function componentStory(pascal, kebab) {
    return `import ${pascal} from './${pascal}.jsx'

export const name = '${kebab}'

export function Default() {
  return <${pascal}>Hello</${pascal}>
}
`;
}
function pageJsx(pageName) {
    const pascal = toPascalCase(pageName.split('/').pop() || 'Page');
    return `export default function ${pascal}Page() {
  return (
    <div>
      <h1>${pascal}</h1>
    </div>
  )
}
`;
}
function objectJson(body = {}) {
    return JSON.stringify(body, null, 2) + '\n';
}
function recordJson(entries = []) {
    return JSON.stringify(entries, null, 2) + '\n';
}
function createSite(values, root) {
    const store = new SiteStore(root);
    if (store.get(values.name))
        return { success: false, errors: [{ field: 'name', message: `Site "${values.name}" already exists` }] };
    let site;
    try {
        site = store.upsert(updateSiteDescriptor({ id: values.name, title: values.title || values.name }, {
            title: values.title || values.name,
            description: values.description,
            productionBaseUrl: values.productionBaseUrl,
        }), { parentPath: notebookRoot(root) ? stringField(values, 'folder') || '' : '' });
    }
    catch (error) {
        return { success: false, errors: [{ field: 'folder', message: error instanceof Error ? error.message : String(error) }] };
    }
    const bindingUpdates = {
        ...(values.developmentBaseUrl ? { source: 'url', developmentBaseUrl: values.developmentBaseUrl } : {}),
        ...(values.startCommand ? { startCommand: values.startCommand } : {}),
    };
    const binding = Object.keys(bindingUpdates).length ? store.upsertBinding(site.id, bindingUpdates) : null;
    const folderPath = store.listEntries().find(entry => entry.site.id === site.id)?.folderPath;
    return {
        success: true,
        created: values.name,
        site: { ...site, ...(binding ? { binding } : {}) },
        route: `/sites/${encodeURIComponent(site.id)}`,
        files: [
            folderPath ? siteDescriptorRelativePath(folderPath) : siteConfigRelativePath(root),
            ...(binding ? [siteConfigRelativePath(root)] : []),
        ],
    };
}
function resolveCanvasFile(root, name, folder) {
    if (notebookRoot(root)) {
        const snapshot = inspectNotebook(root);
        if (snapshot.status !== 'valid')
            throw new Error('A valid Notebook is required for canvas mutations.');
        const scoped = typeof folder === 'string';
        const normalizedFolder = scoped ? normalizedParent(folder) : '';
        const normalizedSlashes = typeof folder === 'string' ? folder.replaceAll('\\', '/') : '';
        if (scoped && (normalizedSlashes.startsWith('/') || /^[A-Za-z]:/.test(normalizedSlashes))) {
            throw new Error('Canvas parent must be a notebook-relative ordinary folder.');
        }
        const folderPath = path.posix.join(normalizedFolder, `${name}.canvas`);
        let artifact = snapshot.artifacts.find(item => item.kind === 'canvas'
            && (item.id === name || item.folderPath === folderPath)
            && (!scoped || notebookArtifactParent(item.folderPath) === normalizedFolder));
        if (!artifact && !scoped) {
            const aliases = snapshot.artifacts.filter(item => item.kind === 'canvas'
                && path.posix.basename(item.folderPath).replace(/\.canvas$/, '') === name);
            if (aliases.length > 1)
                throw new Error(`Canvas name "${name}" is ambiguous; select its artifact ID or parent folder.`);
            artifact = aliases[0];
        }
        if (artifact) {
            if (!artifact.available || !artifact.payloadPath) {
                const issue = artifact.diagnostics[0]?.message || `Canvas artifact "${artifact.folderPath}" has no usable primary payload.`;
                throw new Error(issue);
            }
            const artifactDirectory = path.join(root, artifact.folderPath);
            const primaryFiles = fs.readdirSync(artifactDirectory, { withFileTypes: true })
                .filter(entry => entry.isFile() && entry.name.endsWith('.canvas.jsonl'));
            if (primaryFiles.length !== 1 || primaryFiles[0]?.name !== path.posix.basename(artifact.payloadPath)) {
                throw new Error(`Canvas artifact "${artifact.folderPath}" has ambiguous primary payloads: ${primaryFiles.map(entry => entry.name).join(', ') || 'none'}.`);
            }
            return path.join(root, artifact.payloadPath);
        }
        const candidates = [];
        const artifactPaths = notebookCanvasArtifactPaths(root, name, folder);
        candidates.push(artifactPaths.payloadFile);
        const legacyBase = scoped ? path.join(root, normalizedFolder) : contentDir(root, 'canvas');
        const legacyPath = path.join(legacyBase, `${name}.canvas.jsonl`);
        if (!candidates.includes(legacyPath))
            candidates.push(legacyPath);
        const matches = candidates.filter(filePath => fs.existsSync(filePath));
        if (matches.length > 1)
            throw new Error(`Canvas "${name}" is ambiguous in "${normalizedFolder || '.'}"; select one exact canvas path.`);
        return matches[0] || null;
    }
    const canvasDir = contentDir(root, 'canvas');
    const fileName = `${name}.canvas.jsonl`;
    const candidates = folder
        ? [path.join(canvasDir, folder, fileName), path.join(canvasDir, `${folder}.folder`, fileName)]
        : [path.join(canvasDir, fileName)];
    return candidates.find(filePath => fs.existsSync(filePath)) ?? null;
}
function canvasFiles(root, filePath) {
    const artifactDirectory = canvasArtifactDirectoryForPayload(filePath);
    if (artifactDirectory)
        return listAffectedFiles(root, artifactDirectory);
    const files = [rootRelativePath(root, filePath)];
    const jsxPath = filePath.replace('.canvas.jsonl', '.canvas.jsx');
    if (fs.existsSync(jsxPath))
        files.push(rootRelativePath(root, jsxPath));
    return files;
}
function notebookRoot(root) {
    return hasNotebookManifest(root);
}
function notebookComponentMatches(root, name, parentPath) {
    const snapshot = inspectNotebook(root);
    if (snapshot.status !== 'valid')
        throw new Error('A valid Notebook is required for component mutations.');
    const normalizedParent = typeof parentPath === 'string' ? parentPath.replaceAll('\\', '/').replace(/\/+$/, '') : null;
    const matches = snapshot.artifacts.filter(artifact => {
        if (artifact.kind !== 'component')
            return false;
        const folderName = path.posix.basename(artifact.folderPath);
        const artifactName = artifactFolderLogicalName(folderName);
        if (artifact.id !== name && artifact.folderPath !== name
            && artifactName?.toLocaleLowerCase('en-US') !== toPascalCase(name).toLocaleLowerCase('en-US'))
            return false;
        return normalizedParent === null || path.posix.dirname(artifact.folderPath) === (normalizedParent || '.');
    });
    if (matches.length > 1)
        throw new Error(`Component "${name}" is ambiguous. Select its artifact ID or parent folder.`);
    return matches[0] ?? null;
}
function notebookPrototypeMatches(root, name, parentPath) {
    const snapshot = inspectNotebook(root);
    if (snapshot.status !== 'valid')
        throw new Error('A valid Notebook is required for prototype mutations.');
    const normalizedParent = typeof parentPath === 'string' ? normalizedParentValue(parentPath) : null;
    const matches = snapshot.artifacts.filter(artifact => {
        if (artifact.kind !== 'prototype')
            return false;
        if (normalizedParent !== null && normalizedParentValue(path.posix.dirname(artifact.folderPath)) !== normalizedParent)
            return false;
        const logicalName = artifactFolderLogicalName(artifact.folderPath);
        return artifact.id === name || artifact.folderPath === name
            || logicalName?.toLocaleLowerCase('en-US') === name.toLocaleLowerCase('en-US');
    });
    const routable = matches.filter(artifact => artifact.visible && artifact.route);
    const candidates = routable.length ? routable : matches;
    if (candidates.length > 1)
        throw new Error(`Prototype "${name}" is ambiguous. Select its artifact ID or parent folder.`);
    return candidates[0] ?? null;
}
function normalizedParentValue(value) {
    const normalized = value.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '');
    return normalized === '.' ? '' : normalized;
}
function prototypeDirectory(root, name, parentPath) {
    return notebookRoot(root)
        ? resolveNotebookPrototypeDir(root, name, parentPath)
        : resolvePrototypeDir(contentDir(root, 'prototypes'), name, parentPath);
}
function prototypeRoute(root, directory, fallbackName) {
    if (!notebookRoot(root))
        return `/${fallbackName}`;
    const folderPath = rootRelativePath(root, directory);
    const artifact = inspectNotebook(root).artifacts.find(item => item.kind === 'prototype' && item.folderPath === folderPath);
    if (artifact)
        return artifact.route;
    return `/${fallbackName}`;
}
function editNotebookPrototype(root, current, name, updates) {
    if (!current)
        return { success: false, error: `Prototype "${name}" not found` };
    if (!current.available)
        return { success: false, error: current.diagnostics[0]?.message || `Prototype artifact "${current.folderPath}" is unavailable.` };
    if (typeof updates.parentPath === 'string' && typeof updates.folder === 'string'
        && normalizedParentValue(updates.parentPath) !== normalizedParentValue(updates.folder)) {
        return { success: false, error: 'parentPath and folder must refer to the same creation parent when both are provided.' };
    }
    const oldFolder = current.folderPath;
    const oldPhysicalName = path.posix.basename(oldFolder);
    const oldName = artifactFolderLogicalName(oldPhysicalName);
    if (!oldName)
        return { success: false, error: `Prototype artifact "${oldFolder}" has an invalid folder name.` };
    const nextName = updates.name === undefined ? oldName : String(updates.name);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(nextName) || nextName.length > 64 || ['index', 'app', '_app'].includes(nextName)) {
        return { success: false, error: 'Prototype name must be a non-reserved kebab-case slug of at most 64 characters.' };
    }
    const oldParentPath = path.posix.dirname(oldFolder) === '.' ? '' : path.posix.dirname(oldFolder);
    const requestedParent = stringField(updates, 'parentPath') ?? stringField(updates, 'folder');
    const parent = resolveNotebookCanvasParent(root, requestedParent === undefined ? oldParentPath : requestedParent);
    const prefix = artifactFolderVisibilityPrefix(oldPhysicalName);
    const nextPhysicalName = updates.name === undefined ? oldPhysicalName : `${prefix}${nextName}.prototype`;
    const targetFolder = path.posix.join(parent.path, nextPhysicalName).replace(/^\.\//, '');
    const currentDirectory = path.join(root, oldFolder);
    const targetDirectory = path.join(parent.directory, nextPhysicalName);
    const sameDirectory = fs.existsSync(currentDirectory)
        ? fs.realpathSync.native(currentDirectory) === path.resolve(targetDirectory)
        : path.resolve(currentDirectory) === path.resolve(targetDirectory);
    if (!sameDirectory && fs.existsSync(targetDirectory)) {
        return { success: false, error: `Prototype artifact "${targetFolder}" already exists.` };
    }
    const snapshot = inspectNotebook(root);
    if (snapshot.status !== 'valid')
        return { success: false, error: 'A valid Notebook is required for prototype mutations.' };
    // `_` is sidebar visibility only, so hidden prototypes carry their canonical
    // route like visible artifacts and participate in route collision checks.
    const targetRoute = `/${encodeURIComponent(nextName)}.prototype`;
    const collision = snapshot.artifacts.find(artifact => artifact.kind === 'prototype' && artifact.id !== current.id
        && artifact.route?.toLocaleLowerCase('en-US') === targetRoute.toLocaleLowerCase('en-US'));
    if (collision)
        return { success: false, error: `Prototype route "${targetRoute}" is already used by "${collision.folderPath}"` };
    const nested = snapshot.diagnostics.find(diagnostic => diagnostic.code === 'NESTED_ARTIFACT'
        && (diagnostic.containingArtifact?.path === oldFolder || diagnostic.nestedArtifact?.path.startsWith(`${oldFolder}/`)));
    if (nested)
        return { success: false, error: nested.message };
    const metadataSource = path.join(currentDirectory, `${oldName}.prototype.json`);
    const hasMetadata = fs.existsSync(metadataSource);
    const metadataTargetName = `${nextName}.prototype.json`;
    const metadataTargetInCurrent = path.join(currentDirectory, metadataTargetName);
    if (oldName !== nextName && fs.existsSync(metadataTargetInCurrent)) {
        return { success: false, error: `Prototype rename target already exists: ${rootRelativePath(root, metadataTargetInCurrent)}` };
    }
    let metadataContent = null;
    if (hasMetadata) {
        const parsed = JSON.parse(fs.readFileSync(metadataSource, 'utf8'));
        if (!isRecord(parsed))
            return { success: false, error: `Prototype metadata for "${name}" must be an object` };
        const metadata = parsed;
        const meta = isRecord(metadata.meta) ? metadata.meta : {};
        metadata.meta = meta;
        if (updates.title !== undefined)
            meta.title = updates.title;
        if (updates.description !== undefined)
            meta.description = updates.description;
        if (updates.author !== undefined)
            meta.author = typeof updates.author === 'string'
                ? updates.author.split(',').map(author => author.trim()).filter(Boolean) : updates.author;
        for (const field of ['icon', 'tags', 'team'])
            if (updates[field] !== undefined)
                meta[field] = updates[field];
        if (updates.url !== undefined)
            metadata.url = updates.url;
        metadataContent = JSON.stringify(metadata, null, 2) + '\n';
    }
    else if (typeof updates.title === 'string'
        && Object.keys(updates).every(field => ['title', 'name', 'parentPath', 'folder', 'currentParentPath'].includes(field))) {
        metadataContent = JSON.stringify({ meta: { title: updates.title } }, null, 2) + '\n';
    }
    else if (Object.keys(updates).some(field => !['title', 'name', 'parentPath', 'folder', 'currentParentPath'].includes(field))) {
        return { success: false, error: `No .prototype.json file found in "${name}"` };
    }
    let movedDirectory = false;
    let movedMetadata = false;
    const metadataTarget = path.join(targetDirectory, metadataTargetName);
    try {
        if (!sameDirectory) {
            fs.renameSync(currentDirectory, targetDirectory);
            movedDirectory = true;
        }
        if (hasMetadata && oldName !== nextName) {
            fs.renameSync(path.join(targetDirectory, `${oldName}.prototype.json`), metadataTarget);
            movedMetadata = true;
        }
        if (metadataContent !== null)
            fs.writeFileSync(metadataTarget, metadataContent, 'utf8');
    }
    catch (error) {
        if (movedMetadata) {
            try {
                fs.renameSync(metadataTarget, path.join(targetDirectory, `${oldName}.prototype.json`));
            }
            catch { /* preserve original error */ }
        }
        if (movedDirectory) {
            try {
                fs.renameSync(targetDirectory, currentDirectory);
            }
            catch { /* preserve original error */ }
        }
        throw error;
    }
    // `_` is sidebar visibility only: hidden prototypes keep their route and
    // their manifest page registration, exactly like visible artifacts.
    {
        const previousPage = snapshot.manifest.pages.find(page => page.type === 'prototype' && page.path === oldFolder);
        const pageInput = {
            type: 'prototype',
            title: typeof updates.title === 'string' ? updates.title : current.title,
            path: targetFolder,
            route: targetRoute,
        };
        const page = previousPage
            ? updateNotebookPage(root, { id: previousPage.id }, pageInput)
            : registerNotebookPage(root, pageInput);
        if (previousPage && !page)
            return { success: false, error: `Prototype moved to "${targetFolder}" but its Notebook page registration could not be updated.` };
    }
    const directoryChanged = !sameDirectory || oldName !== nextName;
    const files = directoryChanged ? listAffectedFiles(root, targetDirectory) : [];
    if (!directoryChanged && metadataContent !== null)
        files.push(rootRelativePath(root, metadataTarget));
    if (directoryChanged)
        files.push(notebookManifestRelativePath(root));
    if (updates.title !== undefined)
        files.push(notebookManifestRelativePath(root));
    return {
        success: true,
        updated: nextName,
        id: current.id,
        path: targetFolder,
        route: targetRoute,
        files: [...new Set(files)].sort(),
    };
}
function rootRelativePath(root, target) {
    const canonicalTarget = notebookRoot(root)
        ? (fs.existsSync(target)
            ? fs.realpathSync.native(target)
            : path.join(fs.realpathSync.native(path.dirname(target)), path.basename(target)))
        : target;
    return path.relative(notebookRoot(root) ? fs.realpathSync.native(root) : root, canonicalTarget).replaceAll('\\', '/');
}
function listAffectedFiles(root, directory) {
    const files = [];
    const visit = (current) => {
        let entries = [];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            const target = path.join(current, entry.name);
            if (entry.isDirectory() && !entry.isSymbolicLink())
                visit(target);
            else
                files.push(rootRelativePath(root, target));
        }
    };
    visit(directory);
    return files.sort();
}
function confirmationRequired(affectedFiles, options) {
    const expected = [...affectedFiles].sort();
    const supplied = Array.isArray(options?.confirmedFiles) ? [...options.confirmedFiles].sort() : null;
    if (supplied && supplied.length === expected.length && supplied.every((file, index) => file === expected[index]))
        return null;
    return {
        success: false,
        code: 'CONFIRMATION_REQUIRED',
        error: 'Review and confirm the affected files before deleting this page.',
        affectedFiles: expected,
    };
}
// ---------------------------------------------------------------------------
// Create operations
// ---------------------------------------------------------------------------
function createPrototype(values, root) {
    const name = stringField(values, 'name') ?? '';
    const folder = stringField(values, 'folder');
    const url = stringField(values, 'url');
    const title = values.title || name;
    const prototypesDir = contentDir(root, 'prototypes');
    const isNotebook = notebookRoot(root);
    let parent = { path: '', directory: prototypesDir };
    if (isNotebook)
        parent = resolveNotebookCanvasParent(root, folder);
    const targetDir = isNotebook
        ? path.join(parent.directory, `${name}.prototype`)
        : folder ? path.join(prototypesDir, `${folder}.folder`, name) : path.join(prototypesDir, name);
    const files = [];
    const relDir = isNotebook
        ? path.posix.join(parent.path, `${name}.prototype`)
        : path.relative(root, targetDir);
    // Resolve partial (template/recipe) — if set, we'll write a templated
    // index.jsx and inject any $global objects into prototype.json.
    let partialEntry = null;
    let partialError = null;
    if (values.partial && !url) {
        const partials = buildTemplateRecipeIndex(root, readWorkshopPartials(root));
        partialEntry = resolveTemplateRecipeEntry(partials, stringField(values, 'partial'));
        if (!partialEntry) {
            partialError = `Unknown template/recipe "${values.partial}"`;
        }
    }
    if (partialError) {
        return { success: false, errors: [{ message: partialError }] };
    }
    // Pre-resolve the partial's component file *before* writing anything.
    // If the partial's template/recipe directory is missing or empty we'd
    // otherwise leave an orphan .prototype.json on disk and Vite would
    // then try (and fail) to lazy-load a non-existent index.jsx. Validate
    // first, write second.
    let componentFile = null;
    if (partialEntry && !url) {
        const partialDir = contentDir(root, path.join(partialEntry.baseDir, partialEntry.name));
        componentFile = findComponentFile(partialDir);
        if (!componentFile) {
            return { success: false, errors: [{ message: `No .jsx or .tsx file found in src/${partialEntry.baseDir}/${partialEntry.name}/` }] };
        }
    }
    fs.mkdirSync(targetDir, { recursive: !isNotebook });
    // Write .prototype.json (with $global from partial when applicable)
    const protoFile = `${name}.prototype.json`;
    const artifactId = isNotebook ? randomUUID() : undefined;
    if (artifactId) {
        fs.writeFileSync(path.join(targetDir, NOTEBOOK_ARTIFACT_MARKER_FILE), JSON.stringify({
            formatVersion: 1,
            id: artifactId,
            kind: 'prototype',
        }, null, 2) + '\n', 'utf-8');
        files.push(path.posix.join(relDir, NOTEBOOK_ARTIFACT_MARKER_FILE));
    }
    const parsedProtoBody = JSON.parse(prototypeJson(values));
    if (!isRecord(parsedProtoBody))
        throw new Error('Generated Prototype metadata must be an object');
    const protoBody = parsedProtoBody;
    if (partialEntry?.globals?.length && Array.isArray(partialEntry.globals)) {
        protoBody.$global = partialEntry.globals;
    }
    fs.writeFileSync(path.join(targetDir, protoFile), JSON.stringify(protoBody, null, 2) + '\n', 'utf-8');
    files.push(`${relDir}/${protoFile}`);
    // Write index.jsx (only for non-external prototypes)
    if (!url) {
        const body = partialEntry
            ? renderPartialIndexJsx({
                partialEntry,
                componentFile: componentFile,
                componentName: toPascalCase(name),
                title: title,
            })
            : prototypeIndexJsx(name);
        fs.writeFileSync(path.join(targetDir, 'index.jsx'), body, 'utf-8');
        files.push(`${relDir}/index.jsx`);
    }
    // Optionally create flow
    if (values.flow && !url) {
        const flowFile = `${name}.flow.json`;
        fs.writeFileSync(path.join(targetDir, flowFile), flowJson(), 'utf-8');
        files.push(`${relDir}/${flowFile}`);
    }
    const artifact = isNotebook
        ? inspectNotebook(root).artifacts.find(item => item.kind === 'prototype' && item.id === artifactId)
        : undefined;
    const route = isNotebook ? artifact?.route ?? null : `/${name}`;
    return {
        success: true,
        type: 'prototype',
        ...(artifactId ? { id: artifactId } : {}),
        name,
        path: relDir,
        ...(isNotebook ? { parentPath: parent.path } : {}),
        route,
        files,
    };
}
function createCanvas(values, root) {
    const name = stringField(values, 'name') ?? '';
    const folder = stringField(values, 'folder');
    const canvasDir = contentDir(root, 'canvas');
    // Folder resolution mirrors the canvas-server /create endpoint:
    //   - if folder is empty → write at root
    //   - if <folder>.folder/ exists → use it (workspace grouping)
    //   - if <folder>/ exists       → use it (multi-page grouping)
    //   - otherwise create a new dir per `folderKind`
    //     ("workspace" → .folder/, default "pages" → plain dir)
    let targetDir = canvasDir;
    let usedFolderKind = null;
    const notebookRoot = hasNotebookManifest(root);
    if (notebookRoot) {
        const artifact = notebookCanvasArtifactPaths(root, name, folder);
        targetDir = artifact.folderDirectory;
    }
    else if (folder) {
        const dotFolderDir = path.join(canvasDir, `${folder}.folder`);
        const plainDir = path.join(canvasDir, folder);
        if (fs.existsSync(dotFolderDir)) {
            targetDir = dotFolderDir;
            usedFolderKind = 'workspace';
        }
        else if (fs.existsSync(plainDir) && fs.statSync(plainDir).isDirectory()) {
            targetDir = plainDir;
            usedFolderKind = 'pages';
        }
        else {
            const useWorkspace = values.folderKind === 'workspace';
            targetDir = useWorkspace ? dotFolderDir : plainDir;
            usedFolderKind = useWorkspace ? 'workspace' : 'pages';
        }
    }
    fs.mkdirSync(targetDir, { recursive: notebookRoot ? false : true });
    const files = [];
    const fileName = `${name}.canvas.jsonl`;
    const filePath = path.join(targetDir, fileName);
    const relPath = rootRelativePath(root, filePath);
    const jsxPath = path.join(targetDir, `${name}.canvas.jsx`);
    const pageId = writeCanvasPage(root, filePath, canvasJsonl({
        grid: values.grid,
        autoPlace: values.autoPlace,
        snapToGrid: values.snapToGrid,
        title: values.title || values.name,
        description: values.description,
    }), {
        title: String(values.title || values.name),
        ...(values.jsx ? { companion: { file: jsxPath, content: canvasJsx(name) } } : {}),
        placement: {
            sectionId: stringField(values, 'sectionId') || null,
            sectionTitle: !notebookRoot && !values.sectionId && folder ? folder : null,
            insertAfterPageId: stringField(values, 'insertAfterPageId') || null,
        },
    });
    files.push(relPath);
    if (notebookRoot)
        files.push(path.posix.join(rootRelativePath(root, targetDir), '.hypercanvas-artifact.json'));
    if (values.jsx)
        files.push(rootRelativePath(root, jsxPath));
    // Route always strips `.folder/` (per the data plugin), so both kinds
    // produce the same `/canvas/<folder>/<name>` URL shape.
    const canvasRoute = notebookRoot
        ? `/canvas/${name}`
        : `/canvas/${folder ? `${folder}/` : ''}${name}`;
    return {
        success: true,
        type: 'canvas',
        name,
        path: rootRelativePath(root, targetDir),
        route: canvasRoute,
        ...(usedFolderKind ? { folderKind: usedFolderKind } : {}),
        ...(pageId ? { pageId } : {}),
        files,
    };
}
function createComponent(values, root) {
    const name = stringField(values, 'name') ?? '';
    const directory = stringField(values, 'directory');
    const componentsDir = contentDir(root, 'components');
    const pascal = toPascalCase(name);
    const isNotebook = notebookRoot(root);
    let targetDir;
    let parent = { path: '', directory: componentsDir };
    if (isNotebook) {
        parent = resolveNotebookCanvasParent(root, stringField(values, 'parentPath') ?? stringField(values, 'folder'));
        targetDir = path.join(parent.directory, `${pascal}.component`);
    }
    else {
        targetDir = directory
            ? path.join(componentsDir, directory, pascal)
            : path.join(componentsDir, pascal);
    }
    fs.mkdirSync(targetDir, { recursive: !isNotebook });
    const files = [];
    const relDir = rootRelativePath(root, targetDir);
    const artifactId = isNotebook ? randomUUID() : undefined;
    if (isNotebook) {
        fs.writeFileSync(path.join(targetDir, NOTEBOOK_ARTIFACT_MARKER_FILE), JSON.stringify({
            formatVersion: 1,
            id: artifactId,
            kind: 'component',
        }, null, 2) + '\n', 'utf-8');
        files.push(path.posix.join(relDir, NOTEBOOK_ARTIFACT_MARKER_FILE));
    }
    fs.writeFileSync(path.join(targetDir, `${pascal}.jsx`), componentJsx(pascal), 'utf-8');
    files.push(path.posix.join(relDir, `${pascal}.jsx`));
    fs.writeFileSync(path.join(targetDir, `${pascal}.module.css`), componentCss(), 'utf-8');
    files.push(path.posix.join(relDir, `${pascal}.module.css`));
    const storyName = isNotebook ? pascal : name;
    fs.writeFileSync(path.join(targetDir, `${storyName}.story.jsx`), componentStory(pascal, name), 'utf-8');
    files.push(path.posix.join(relDir, `${storyName}.story.jsx`));
    return {
        success: true,
        type: 'component',
        ...(artifactId ? { id: artifactId } : {}),
        name: isNotebook ? pascal : name,
        path: relDir,
        ...(isNotebook ? { route: `/components/${encodeURIComponent(pascal)}`, parentPath: parent.path } : {}),
        files,
    };
}
function createFlow(values, root) {
    const name = stringField(values, 'name') ?? '';
    const prototype = stringField(values, 'prototype') ?? '';
    const copyFrom = stringField(values, 'copy-from');
    const protoDir = prototypeDirectory(root, prototype, stringField(values, 'folder'));
    if (!protoDir) {
        return { success: false, error: `Prototype "${prototype}" not found` };
    }
    const flowFile = `${name}.flow.json`;
    const flowPath = path.join(protoDir, flowFile);
    const relPath = path.relative(root, flowPath);
    let content;
    if (copyFrom) {
        const sourceFlow = path.join(protoDir, `${copyFrom}.flow.json`);
        if (fs.existsSync(sourceFlow)) {
            content = fs.readFileSync(sourceFlow, 'utf-8');
        }
        else {
            content = flowJson(Array.isArray(values.globals) ? values.globals : []);
        }
    }
    else {
        content = flowJson(Array.isArray(values.globals) ? values.globals : []);
    }
    fs.writeFileSync(flowPath, content, 'utf-8');
    const baseRoute = prototypeRoute(root, protoDir, prototype);
    return { success: true, type: 'flow', name, path: relPath, route: baseRoute ? `${baseRoute}?flow=${encodeURIComponent(name)}` : null, files: [relPath] };
}
function createObject(values, root) {
    const name = stringField(values, 'name') ?? '';
    const prototype = stringField(values, 'prototype');
    let targetDir;
    if (prototype) {
        const protoDir = prototypeDirectory(root, prototype, stringField(values, 'folder'));
        if (!protoDir)
            return { success: false, error: `Prototype "${prototype}" not found` };
        targetDir = protoDir;
    }
    else {
        targetDir = contentDir(root, 'data');
    }
    fs.mkdirSync(targetDir, { recursive: true });
    const fileName = `${name}.object.json`;
    const filePath = path.join(targetDir, fileName);
    const relPath = path.relative(root, filePath);
    fs.writeFileSync(filePath, objectJson(values.body || {}), 'utf-8');
    return { success: true, type: 'object', name, path: relPath, files: [relPath] };
}
function createRecord(values, root) {
    const name = stringField(values, 'name') ?? '';
    const prototype = stringField(values, 'prototype');
    let targetDir;
    if (prototype) {
        const protoDir = prototypeDirectory(root, prototype, stringField(values, 'folder'));
        if (!protoDir)
            return { success: false, error: `Prototype "${prototype}" not found` };
        targetDir = protoDir;
    }
    else {
        targetDir = contentDir(root, 'data');
    }
    fs.mkdirSync(targetDir, { recursive: true });
    const fileName = `${name}.record.json`;
    const filePath = path.join(targetDir, fileName);
    const relPath = path.relative(root, filePath);
    fs.writeFileSync(filePath, recordJson(Array.isArray(values.entries) ? values.entries : []), 'utf-8');
    return { success: true, type: 'record', name, path: relPath, files: [relPath] };
}
function createPage(values, root) {
    const prototype = stringField(values, 'prototype') ?? '';
    const pageName = stringField(values, 'path') ?? '';
    const protoDir = prototypeDirectory(root, prototype, stringField(values, 'folder'));
    if (!protoDir) {
        return { success: false, error: `Prototype "${prototype}" not found` };
    }
    const pagesDir = path.join(protoDir, 'pages');
    const pagePath = path.join(pagesDir, `${pageName}.jsx`);
    const pageDir = path.dirname(pagePath);
    fs.mkdirSync(pageDir, { recursive: true });
    const relPath = path.relative(root, pagePath);
    fs.writeFileSync(pagePath, pageJsx(pageName), 'utf-8');
    const baseRoute = prototypeRoute(root, protoDir, prototype);
    return { success: true, type: 'page', name: pageName, path: relPath, route: baseRoute ? `${baseRoute}/${pageName}` : null, files: [relPath] };
}
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
const creators = {
    prototype: createPrototype,
    canvas: createCanvas,
    component: createComponent,
    flow: createFlow,
    object: createObject,
    record: createRecord,
    page: createPage,
    site: createSite,
};
/**
 * Create an artifact. Validates first, then performs FS operations.
 */
export function createArtifact(type, values, root) {
    if (!isRecord(values))
        return { success: false, errors: [{ field: '_values', message: 'Artifact values must be an object' }] };
    const invalidField = invalidStringField(type, values);
    if (invalidField)
        return { success: false, errors: [{ field: invalidField, message: `${invalidField} must be a string` }] };
    const validation = validateArtifact(type, values, root);
    if (!validation.valid) {
        return { success: false, errors: validation.errors };
    }
    const creator = isArtifactType(type) ? creators[type] : undefined;
    if (!creator) {
        return { success: false, errors: [{ field: '_type', message: `No creator for type: ${type}` }] };
    }
    try {
        const normalized = validation.normalized;
        if (hasNotebookManifest(root) && normalized.sectionId) {
            const state = inspectNotebook(root);
            const sections = state.status === 'valid' ? state.manifest.navigation.files.sections : undefined;
            if (!Array.isArray(sections) || !sections.some((section) => section.id === normalized.sectionId)) {
                return { success: false, errors: [{ field: 'sectionId', message: `Section "${normalized.sectionId}" not found` }] };
            }
        }
        const result = creator(normalized, root);
        if (result.success && hasNotebookManifest(root) && ['prototype', 'site'].includes(type)
            && (type !== 'prototype' || (typeof result.route === 'string' && result.route))) {
            const payloadPath = type === 'prototype' && typeof result.path === 'string' ? result.path : null;
            const page = Reflect.apply(registerNotebookPage, undefined, [root, {
                    type,
                    title: normalized.title || normalized.name,
                    ...(payloadPath ? { path: payloadPath } : {}),
                    ...(type === 'site' ? { siteId: normalized.name } : {}),
                    ...(result.route ? { route: result.route } : {}),
                }, {
                    sectionId: stringField(normalized, 'sectionId') || null,
                    sectionTitle: !normalized.sectionId && stringField(normalized, 'folder') ? stringField(normalized, 'folder') : null,
                    insertAfterPageId: stringField(normalized, 'insertAfterPageId') || null,
                }]);
            if (page && isRecord(page) && typeof page.id === 'string')
                result.pageId = page.id;
        }
        return result;
    }
    catch (err) {
        return { success: false, errors: [{ field: '_fs', message: err instanceof Error ? err.message : String(err) }] };
    }
}
/**
 * Edit artifact metadata.
 */
export function editArtifact(type, name, updates, root) {
    if (typeof name !== 'string')
        return { success: false, error: 'Artifact name must be a string' };
    if (!isRecord(updates))
        return { success: false, error: 'Artifact updates must be an object' };
    if (type === 'component' && notebookRoot(root)) {
        try {
            if (typeof updates.parentPath === 'string' && typeof updates.folder === 'string'
                && normalizedParent(updates.parentPath) !== normalizedParent(updates.folder)) {
                return { success: false, error: 'parentPath and folder must refer to the same creation parent when both are provided.' };
            }
            const requestedParent = stringField(updates, 'parentPath') ?? stringField(updates, 'folder');
            const current = notebookComponentMatches(root, name, stringField(updates, 'currentParentPath'));
            if (!current)
                return { success: false, error: `Component "${name}" not found` };
            if (!current.available)
                return { success: false, error: current.diagnostics[0]?.message || `Component artifact "${current.folderPath}" is unavailable.` };
            const oldFolder = current.folderPath;
            const oldPhysicalFolderName = path.posix.basename(oldFolder);
            const oldName = artifactFolderLogicalName(oldPhysicalFolderName);
            if (!oldName)
                return { success: false, error: `Component artifact "${oldFolder}" has an invalid folder name.` };
            const visibilityPrefix = artifactFolderVisibilityPrefix(oldPhysicalFolderName);
            const newName = updates.name === undefined ? oldName : toPascalCase(String(updates.name));
            const oldParent = path.posix.dirname(oldFolder) === '.' ? '' : path.posix.dirname(oldFolder);
            const parent = resolveNotebookCanvasParent(root, requestedParent === undefined ? oldParent : requestedParent);
            const newPhysicalFolderName = updates.name === undefined
                ? oldPhysicalFolderName
                : `${visibilityPrefix}${newName}.component`;
            const targetFolder = path.posix.join(parent.path, newPhysicalFolderName).replace(/^\./, '');
            const targetDirectory = path.join(parent.directory, newPhysicalFolderName);
            const currentDirectory = path.join(root, oldFolder);
            if (path.resolve(currentDirectory) !== path.resolve(targetDirectory) && fs.existsSync(targetDirectory)) {
                return { success: false, error: `Component artifact "${targetFolder}" already exists.` };
            }
            const renameFiles = [];
            if (oldName !== newName) {
                for (const extension of ['jsx', 'tsx']) {
                    const source = `${oldName}.${extension}`;
                    if (fs.existsSync(path.join(currentDirectory, source)))
                        renameFiles.push({ source, target: `${newName}.${extension}` });
                    const story = `${oldName}.story.${extension}`;
                    if (fs.existsSync(path.join(currentDirectory, story)))
                        renameFiles.push({ source: story, target: `${newName}.story.${extension}` });
                }
                const style = `${oldName}.module.css`;
                if (fs.existsSync(path.join(currentDirectory, style)))
                    renameFiles.push({ source: style, target: `${newName}.module.css` });
                const occupiedTargets = renameFiles
                    .filter(({ target }) => fs.existsSync(path.join(currentDirectory, target)))
                    .map(({ target }) => rootRelativePath(root, path.join(currentDirectory, target)));
                if (occupiedTargets.length) {
                    return { success: false, error: `Component rename targets already exist: ${occupiedTargets.join(', ')}` };
                }
            }
            const targetRoute = `/components/${encodeURIComponent(newName)}`.toLocaleLowerCase('en-US');
            const collision = inspectNotebook(root).artifacts.find(artifact => {
                if (artifact.kind !== 'component' || artifact.id === current.id)
                    return false;
                const logicalName = artifactFolderLogicalName(artifact.folderPath);
                const artifactRoute = artifact.route ?? (logicalName ? `/components/${encodeURIComponent(logicalName)}` : undefined);
                return artifactRoute?.toLocaleLowerCase('en-US') === targetRoute;
            });
            if (collision)
                return { success: false, error: `Component route "/components/${encodeURIComponent(newName)}" is already used by "${collision.folderPath}"` };
            if (path.resolve(currentDirectory) !== path.resolve(targetDirectory))
                fs.renameSync(currentDirectory, targetDirectory);
            if (oldName !== newName) {
                for (const { source, target } of renameFiles) {
                    fs.renameSync(path.join(targetDirectory, source), path.join(targetDirectory, target));
                }
                const escapedOldName = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const oldSlug = oldName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
                const newSlug = newName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
                for (const entry of fs.readdirSync(targetDirectory, { withFileTypes: true })) {
                    if (!entry.isFile() || !/\.(?:jsx|tsx|js|ts)$/.test(entry.name))
                        continue;
                    const file = path.join(targetDirectory, entry.name);
                    const contents = fs.readFileSync(file, 'utf8')
                        .replaceAll(`./${oldName}.jsx`, `./${newName}.jsx`)
                        .replaceAll(`./${oldName}.tsx`, `./${newName}.tsx`)
                        .replaceAll(`./${oldName}.module.css`, `./${newName}.module.css`)
                        .replace(new RegExp(`\\b${escapedOldName}\\b`, 'g'), newName)
                        .replaceAll(`'${oldSlug}'`, `'${newSlug}'`);
                    fs.writeFileSync(file, contents, 'utf8');
                }
            }
            if (typeof updates.title === 'string') {
                for (const extension of ['jsx', 'tsx']) {
                    const story = path.join(targetDirectory, `${newName}.story.${extension}`);
                    if (!fs.existsSync(story))
                        continue;
                    const contents = fs.readFileSync(story, 'utf8')
                        .replace(/export const name = ['"][^'"]*['"]/, `export const name = ${JSON.stringify(updates.title)}`);
                    fs.writeFileSync(story, contents, 'utf8');
                }
            }
            return {
                success: true,
                updated: newName,
                id: current.id,
                path: targetFolder,
                route: `/components/${encodeURIComponent(newName)}`,
                files: listAffectedFiles(root, targetDirectory),
            };
        }
        catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    }
    if (type === 'site') {
        const store = new SiteStore(root);
        const current = store.get(name);
        if (!current)
            return { success: false, error: `Site "${name}" not found` };
        const updated = store.upsert(updateSiteDescriptor(current, updates));
        const bindingUpdates = {
            ...(updates.startCommand !== undefined ? { startCommand: updates.startCommand } : {}),
            ...(updates.developmentBaseUrl !== undefined ? { developmentBaseUrl: updates.developmentBaseUrl } : {}),
        };
        const binding = Object.keys(bindingUpdates).length ? store.upsertBinding(current.id, bindingUpdates) : store.getBinding(current.id);
        if (notebookRoot(root) && updates.title !== undefined) {
            updateNotebookPage(root, { siteId: name }, { title: updates.title });
        }
        const folderPath = store.listEntries().find(entry => entry.site.id === updated.id)?.folderPath;
        return {
            success: true,
            updated: { ...updated, ...(binding ? { binding } : {}) },
            files: [folderPath ? siteDescriptorRelativePath(folderPath) : siteConfigRelativePath(root), ...(Object.keys(bindingUpdates).length ? [siteConfigRelativePath(root)] : [])],
        };
    }
    if (type === 'prototype') {
        if (notebookRoot(root)) {
            const current = notebookPrototypeMatches(root, name, stringField(updates, 'currentParentPath'));
            if (current) {
                try {
                    return editNotebookPrototype(root, current, name, updates);
                }
                catch (error) {
                    return { success: false, error: error instanceof Error ? error.message : String(error) };
                }
            }
        }
        const prototypesDir = contentDir(root, 'prototypes');
        const protoDir = resolvePrototypeDir(prototypesDir, name, updates.folder);
        if (!protoDir) {
            return { success: false, error: `Prototype "${name}" not found` };
        }
        const files = fs.readdirSync(protoDir);
        const protoJsonFile = files.find(f => f.endsWith('.prototype.json'));
        if (!protoJsonFile) {
            // Notebook pages can consist only of an index module. Their display title
            // belongs to the manifest even when optional prototype metadata is absent.
            if (notebookRoot(root) && updates.title !== undefined && Object.keys(updates).every(key => key === 'title' || key === 'folder')) {
                const page = updateNotebookPage(root, { path: path.relative(root, protoDir).replaceAll('\\', '/') }, { title: updates.title });
                if (page)
                    return { success: true, updated: name, files: [notebookManifestRelativePath(root)] };
            }
            return { success: false, error: `No .prototype.json file found in "${name}"` };
        }
        const protoJsonPath = path.join(protoDir, protoJsonFile);
        const parsedJson = JSON.parse(fs.readFileSync(protoJsonPath, 'utf-8'));
        if (!isRecord(parsedJson))
            return { success: false, error: `Prototype metadata for "${name}" must be an object` };
        const json = parsedJson;
        const meta = isRecord(json.meta) ? json.meta : {};
        json.meta = meta;
        if (updates.title !== undefined)
            meta.title = updates.title;
        if (updates.description !== undefined)
            meta.description = updates.description;
        if (updates.author !== undefined) {
            meta.author = typeof updates.author === 'string'
                ? updates.author.split(',').map(a => a.trim()).filter(Boolean)
                : updates.author;
        }
        if (updates.icon !== undefined)
            meta.icon = updates.icon;
        if (updates.tags !== undefined)
            meta.tags = updates.tags;
        if (updates.team !== undefined)
            meta.team = updates.team;
        if (updates.url !== undefined)
            json.url = updates.url;
        fs.writeFileSync(protoJsonPath, JSON.stringify(json, null, 2) + '\n', 'utf-8');
        if (notebookRoot(root) && updates.title !== undefined) {
            updateNotebookPage(root, { path: path.relative(root, protoDir).replaceAll('\\', '/') }, { title: updates.title });
        }
        return { success: true, updated: name, files: [path.relative(root, protoJsonPath)] };
    }
    if (type === 'canvas') {
        let filePath;
        try {
            filePath = resolveCanvasFile(root, name, stringField(updates, 'folder'));
        }
        catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
        if (!filePath)
            return { success: false, error: `Canvas "${name}" not found` };
        const dir = path.dirname(filePath);
        const metaPath = path.join(dir, `${path.basename(dir).replace(/\.folder$/, '')}.meta.json`);
        if (fs.existsSync(metaPath)) {
            const parsedMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            if (!isRecord(parsedMeta))
                return { success: false, error: `Canvas metadata for "${name}" must be an object` };
            const meta = parsedMeta;
            for (const key of ['title', 'description', 'author']) {
                if (updates[key] !== undefined)
                    meta[key] = updates[key];
            }
            fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf-8');
            if (notebookRoot(root) && updates.title !== undefined) {
                updateNotebookPage(root, { path: rootRelativePath(root, filePath) }, { title: updates.title });
            }
            return { success: true, updated: name, files: [rootRelativePath(root, metaPath)] };
        }
        const text = fs.readFileSync(filePath, 'utf-8');
        const lines = text.split('\n').filter(Boolean);
        if (lines.length === 0)
            return { success: false, error: `Canvas "${name}" is empty` };
        const firstLine = lines[0];
        if (firstLine === undefined)
            return { success: false, error: `Canvas "${name}" is empty` };
        const parsedEvent = JSON.parse(firstLine);
        if (!isRecord(parsedEvent))
            return { success: false, error: `Canvas "${name}" has an invalid first event` };
        const firstEvent = parsedEvent;
        for (const key of ['title', 'description', 'author']) {
            if (updates[key] !== undefined)
                firstEvent[key] = updates[key];
        }
        lines[0] = JSON.stringify(firstEvent);
        fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
        if (notebookRoot(root) && updates.title !== undefined) {
            updateNotebookPage(root, { path: rootRelativePath(root, filePath) }, { title: updates.title });
        }
        return { success: true, updated: name, files: [rootRelativePath(root, filePath)] };
    }
    return { success: false, error: `Edit not yet supported for type: ${type}` };
}
/**
 * Delete an artifact.
 */
export async function deleteArtifact(type, name, options, root) {
    if (typeof name !== 'string')
        return { success: false, error: 'Artifact name must be a string' };
    const safeOptions = isRecord(options) ? options : {};
    const folder = stringField(safeOptions, 'folder');
    if (type === 'site') {
        const store = new SiteStore(root);
        const entry = store.listEntries().find(candidate => candidate.site.id === name);
        const site = entry ? store.get(entry.site.id) : store.get(name);
        if (!site)
            return { success: false, error: `Site "${name}" not found` };
        const projectRoot = site.binding?.root ?? Reflect.get(site, 'projectRoot');
        const preservedProjectRoot = typeof projectRoot === 'string' ? projectRoot : null;
        const files = [
            entry?.folderPath ? siteDescriptorRelativePath(entry.folderPath) : siteConfigRelativePath(root),
            ...(site.binding ? [siteConfigRelativePath(root)] : []),
        ];
        if (notebookRoot(root) && safeOptions.confirmed !== true) {
            return {
                success: false,
                code: 'CONFIRMATION_REQUIRED',
                error: `Unregister Site "${site.title || name}"? Its external project will remain at ${preservedProjectRoot || 'its current location'}.`,
                affectedFiles: files,
                preservedProjectRoot,
            };
        }
        const removed = store.remove(site.id);
        if (removed && notebookRoot(root))
            unregisterNotebookPage(root, { siteId: site.id });
        return removed ? { success: true, deleted: site.id, files, preservedProjectRoot } : { success: false, error: `Site "${name}" not found` };
    }
    if (type === 'prototype') {
        if (notebookRoot(root)) {
            if (typeof safeOptions.parentPath === 'string' && typeof safeOptions.folder === 'string'
                && normalizedParentValue(safeOptions.parentPath) !== normalizedParentValue(safeOptions.folder)) {
                return { success: false, error: 'parentPath and folder must refer to the same creation parent when both are provided.' };
            }
            try {
                const selectedParent = stringField(safeOptions, 'parentPath') ?? folder;
                const artifact = notebookPrototypeMatches(root, name, selectedParent);
                if (artifact) {
                    if (!artifact.available)
                        return { success: false, error: artifact.diagnostics[0]?.message || `Prototype artifact "${artifact.folderPath}" is unavailable.` };
                    const snapshot = inspectNotebook(root);
                    const nested = snapshot.status === 'valid' && snapshot.diagnostics.find(diagnostic => diagnostic.code === 'NESTED_ARTIFACT'
                        && (diagnostic.containingArtifact?.path === artifact.folderPath || diagnostic.nestedArtifact?.path.startsWith(`${artifact.folderPath}/`)));
                    if (nested)
                        return { success: false, error: nested.message, diagnostics: [nested] };
                    const directory = path.join(root, artifact.folderPath);
                    const files = listAffectedFiles(root, directory);
                    const legacyCanvases = files.filter(file => file.endsWith('.canvas.jsonl'));
                    if (legacyCanvases.length) {
                        return { success: false, code: 'UNSUPPORTED_CANVAS_LOCATION', error: 'This Prototype contains legacy Canvas pages. Resolve those unsupported locations before deleting the Prototype.', affectedFiles: legacyCanvases };
                    }
                    const confirmation = confirmationRequired(files, safeOptions);
                    if (confirmation)
                        return confirmation;
                    fs.rmSync(directory, { recursive: true, force: true });
                    unregisterNotebookPage(root, { path: artifact.folderPath });
                    return { success: true, deleted: artifactFolderLogicalName(artifact.folderPath), id: artifact.id, files };
                }
            }
            catch (error) {
                return { success: false, error: error instanceof Error ? error.message : String(error) };
            }
        }
        const prototypesDir = contentDir(root, 'prototypes');
        const protoDir = resolvePrototypeDir(prototypesDir, name, folder);
        if (!protoDir) {
            return { success: false, error: `Prototype "${name}" not found` };
        }
        const resolved = path.resolve(protoDir);
        if (!resolved.startsWith(path.resolve(prototypesDir))) {
            return { success: false, error: 'Invalid path — outside prototypes directory' };
        }
        const files = listAffectedFiles(root, protoDir);
        const legacyCanvases = files.filter(file => file.endsWith('.canvas.jsonl'));
        if (legacyCanvases.length) {
            return { success: false, code: 'UNSUPPORTED_CANVAS_LOCATION', error: 'This Prototype contains legacy Canvas pages. Resolve those unsupported locations before deleting the Prototype.', affectedFiles: legacyCanvases };
        }
        if (notebookRoot(root)) {
            const confirmation = confirmationRequired(files, safeOptions);
            if (confirmation)
                return confirmation;
        }
        fs.rmSync(protoDir, { recursive: true, force: true });
        if (notebookRoot(root))
            unregisterNotebookPage(root, { path: path.relative(root, protoDir).replaceAll('\\', '/') });
        return { success: true, deleted: name, files };
    }
    if (type === 'canvas') {
        let filePath;
        const scope = notebookRoot(root) ? notebookParentScope(safeOptions) : null;
        if (scope?.error)
            return { success: false, error: scope.error };
        const selectedFolder = scope ? (scope.scoped ? scope.parentPath : undefined) : folder;
        try {
            filePath = resolveCanvasFile(root, name, selectedFolder);
        }
        catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
        if (!filePath) {
            return { success: false, error: `Canvas "${name}" not found` };
        }
        const files = canvasFiles(root, filePath);
        if (notebookRoot(root)) {
            const confirmation = confirmationRequired(files.map(file => file.replaceAll('\\', '/')), safeOptions);
            if (confirmation)
                return confirmation;
        }
        try {
            assertCanvasWritable(filePath);
            const revision = canvasPayloadRevision(filePath);
            const canvas = materializeFromText(fs.readFileSync(filePath, 'utf8'));
            const pathId = notebookRoot(root)
                ? toCanvasId(rootRelativePath(root, filePath))
                : toCanvasId(`src/canvas/${path.relative(contentDir(root, 'canvas'), filePath)}`);
            const artifactId = notebookRoot(root)
                ? inspectNotebook(root).artifacts.find(artifact => artifact.kind === 'canvas' && artifact.payloadPath === rootRelativePath(root, filePath))?.id
                : undefined;
            for (const widget of canvas.widgets || []) {
                if (artifactId && artifactId !== pathId)
                    await closeWidgetSession(root, artifactId, widget);
                await closeWidgetSession(root, pathId, widget);
            }
            if (canvasArtifactDirectoryForPayload(filePath))
                deleteCanvasArtifact(root, filePath, revision);
            else
                deleteCanvasPage(root, filePath, revision);
        }
        catch (error) {
            return { success: false, code: 'CANVAS_DELETE_FAILED', error: error instanceof Error ? error.message : String(error) };
        }
        return { success: true, deleted: name, files };
    }
    if (type === 'component') {
        if (notebookRoot(root)) {
            try {
                const scope = notebookParentScope(safeOptions);
                if (scope.error)
                    return { success: false, error: scope.error };
                const component = notebookComponentMatches(root, name, scope.scoped ? scope.parentPath : undefined);
                if (!component)
                    return { success: false, error: `Component "${name}" not found` };
                const directory = path.join(root, component.folderPath);
                const files = listAffectedFiles(root, directory);
                const confirmation = confirmationRequired(files, safeOptions);
                if (confirmation)
                    return confirmation;
                fs.rmSync(directory, { recursive: true, force: true });
                return { success: true, deleted: component.folderPath, id: component.id, files };
            }
            catch (error) {
                return { success: false, error: error instanceof Error ? error.message : String(error) };
            }
        }
        const componentsDir = contentDir(root, 'components');
        const pascal = toPascalCase(name);
        const directory = stringField(safeOptions, 'directory');
        const targetDir = directory
            ? path.join(componentsDir, directory, pascal)
            : path.join(componentsDir, pascal);
        if (!fs.existsSync(targetDir)) {
            return { success: false, error: `Component "${name}" not found` };
        }
        fs.rmSync(targetDir, { recursive: true, force: true });
        return { success: true, deleted: name };
    }
    if (type === 'flow') {
        const prototypesDir = contentDir(root, 'prototypes');
        const protoDir = resolvePrototypeDir(prototypesDir, safeOptions.prototype, folder);
        if (!protoDir) {
            return { success: false, error: `Prototype "${stringField(safeOptions, 'prototype') ?? ''}" not found` };
        }
        const flowPath = path.join(protoDir, `${name}.flow.json`);
        if (!fs.existsSync(flowPath)) {
            return { success: false, error: `Flow "${name}" not found` };
        }
        fs.unlinkSync(flowPath);
        return { success: true, deleted: name };
    }
    if (type === 'object') {
        const filePath = path.join(contentDir(root, 'data'), `${name}.object.json`);
        if (!fs.existsSync(filePath)) {
            return { success: false, error: `Object "${name}" not found` };
        }
        fs.unlinkSync(filePath);
        return { success: true, deleted: name };
    }
    if (type === 'record') {
        const filePath = path.join(contentDir(root, 'data'), `${name}.record.json`);
        if (!fs.existsSync(filePath)) {
            return { success: false, error: `Record "${name}" not found` };
        }
        fs.unlinkSync(filePath);
        return { success: true, deleted: name };
    }
    return { success: false, error: `Delete not supported for type: ${type}` };
}
/**
 * List artifacts of a given type.
 */
export function listArtifacts(type, options, root) {
    const safeOptions = isRecord(options) ? options : {};
    const folder = stringField(safeOptions, 'folder');
    if (type === 'site')
        return { type, items: new SiteStore(root).list() };
    if (type === 'prototype') {
        const prototypesDir = contentDir(root, 'prototypes');
        if (notebookRoot(root)) {
            const snapshot = inspectNotebook(root);
            if (snapshot.status !== 'valid')
                return { type, items: [] };
            const parentPath = stringField(safeOptions, 'parentPath');
            if (parentPath !== undefined && folder !== undefined && normalizedParentValue(parentPath) !== normalizedParentValue(folder))
                return { type, items: [] };
            const requestedParent = parentPath ?? folder;
            const normalizedFolder = requestedParent === undefined ? undefined : normalizedParentValue(requestedParent);
            const artifacts = snapshot.artifacts.filter(artifact => artifact.kind === 'prototype'
                && (normalizedFolder === undefined || normalizedParentValue(path.posix.dirname(artifact.folderPath)) === normalizedFolder))
                .map(artifact => ({
                id: artifact.id,
                name: artifactFolderLogicalName(artifact.folderPath) || path.posix.basename(artifact.folderPath),
                title: artifact.title,
                path: artifact.folderPath,
                folder: path.posix.dirname(artifact.folderPath) === '.' ? '' : path.posix.dirname(artifact.folderPath),
                folderPath: artifact.folderPath,
                route: artifact.route,
                available: artifact.available,
                diagnostics: artifact.diagnostics,
                visible: artifact.visible,
                files: listAffectedFiles(root, path.join(root, artifact.folderPath)),
            }));
            const suffixArtifact = /\.(?:prototype|component|canvas|site)$/i;
            const legacy = fs.existsSync(prototypesDir)
                ? scanPrototypes(prototypesDir, normalizedFolder)
                    .filter(item => !suffixArtifact.test(path.posix.basename(item.path || '')))
                    .map(item => ({
                    ...item,
                    path: (item.path || '').replace(/^src\/prototypes\//, 'prototypes/'),
                    folder: typeof item.folder === 'string' ? item.folder : '',
                    legacy: true,
                    files: listAffectedFiles(root, path.join(root, (item.path || '').replace(/^src\/prototypes\//, 'prototypes/'))),
                }))
                : [];
            const legacyFiltered = normalizedFolder === undefined
                ? legacy
                : legacy.filter(item => normalizedParentValue(String(item.folder || '')) === normalizedFolder);
            const seenPaths = new Set(artifacts.map(item => item.path));
            return { type, items: [...artifacts, ...legacyFiltered.filter(item => !seenPaths.has(String(item.path)))] };
        }
        if (!fs.existsSync(prototypesDir))
            return { type, items: [] };
        return { type, items: scanPrototypes(prototypesDir, folder) };
    }
    if (type === 'canvas') {
        const canvasDir = contentDir(root, 'canvas');
        if (notebookRoot(root)) {
            const snapshot = inspectNotebook(root);
            if (snapshot.status !== 'valid')
                return { type, items: [] };
            const scope = notebookParentScope(safeOptions);
            if (scope.error)
                return { type, items: [] };
            const artifacts = snapshot.artifacts.filter(artifact => artifact.kind === 'canvas'
                && (!scope.scoped || notebookArtifactParent(artifact.folderPath) === scope.parentPath));
            const artifactPaths = new Set(artifacts.flatMap(artifact => artifact.payloadPath ? [artifact.payloadPath] : []));
            const items = artifacts.map(artifact => {
                const parent = path.posix.dirname(artifact.folderPath);
                let diagnostics = artifact.diagnostics;
                let available = artifact.available;
                if (artifact.payloadPath) {
                    const directory = path.join(root, artifact.folderPath);
                    const payloads = fs.readdirSync(directory, { withFileTypes: true })
                        .filter(entry => entry.isFile() && entry.name.endsWith('.canvas.jsonl'));
                    if (payloads.length !== 1 || payloads[0]?.name !== path.posix.basename(artifact.payloadPath)) {
                        available = false;
                        diagnostics = [...diagnostics, {
                                code: 'AMBIGUOUS_CANVAS_PAYLOAD',
                                message: `Canvas artifact "${artifact.folderPath}" must contain exactly one primary .canvas.jsonl payload; found ${payloads.map(entry => entry.name).join(', ') || 'none'}.`,
                                path: artifact.folderPath,
                            }];
                    }
                }
                return {
                    id: artifact.id,
                    name: path.posix.basename(artifact.folderPath).replace(/\.canvas$/, ''),
                    title: artifact.title,
                    folder: parent === '.' ? '' : parent,
                    path: artifact.payloadPath || artifact.folderPath,
                    folderPath: artifact.folderPath,
                    files: listAffectedFiles(root, path.join(root, artifact.folderPath)),
                    available,
                    diagnostics,
                };
            });
            for (const page of snapshot.pages.filter(item => item.type === 'canvas')) {
                if (!page.path || artifactPaths.has(page.path))
                    continue;
                const parent = path.posix.dirname(page.path);
                if (scope.scoped && normalizedParent(parent) !== scope.parentPath)
                    continue;
                items.push({
                    ...(typeof page.id === 'string' ? { id: page.id } : {}),
                    name: path.posix.basename(page.path).replace(/\.canvas\.jsonl$/, ''),
                    ...(typeof page.title === 'string' ? { title: page.title } : {}),
                    folder: parent === '.' ? '' : parent,
                    path: page.path,
                    files: canvasFiles(root, path.join(root, page.path)),
                    available: page.available,
                    diagnostics: page.diagnostics,
                    legacy: true,
                });
            }
            return { type, items };
        }
        if (!fs.existsSync(canvasDir))
            return { type, items: [] };
        return { type, items: scanCanvases(canvasDir, folder, root) };
    }
    if (type === 'component') {
        if (notebookRoot(root)) {
            const snapshot = inspectNotebook(root);
            if (snapshot.status !== 'valid')
                return { type, items: [] };
            const scope = notebookParentScope(safeOptions);
            if (scope.error)
                return { type, items: [] };
            const artifacts = snapshot.artifacts.filter(artifact => artifact.kind === 'component'
                && (!scope.scoped || notebookArtifactParent(artifact.folderPath) === scope.parentPath));
            return {
                type,
                items: artifacts.map(artifact => ({
                    id: artifact.id,
                    name: artifactFolderLogicalName(artifact.folderPath) ?? path.posix.basename(artifact.folderPath),
                    title: artifact.title,
                    path: artifact.payloadPath || artifact.folderPath,
                    folder: path.posix.dirname(artifact.folderPath) === '.' ? '' : path.posix.dirname(artifact.folderPath),
                    folderPath: artifact.folderPath,
                    route: artifact.route,
                    available: artifact.available,
                    diagnostics: artifact.diagnostics,
                    files: listAffectedFiles(root, path.join(root, artifact.folderPath)),
                })),
            };
        }
        const componentsDir = contentDir(root, 'components');
        if (!fs.existsSync(componentsDir))
            return { type, items: [] };
        return { type, items: scanComponents(componentsDir, root) };
    }
    return { type, items: [] };
}
function scanPrototypes(prototypesDir, filterFolder) {
    const items = [];
    const entries = fs.readdirSync(prototypesDir, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory())
            continue;
        if (entry.name.endsWith('.folder')) {
            const folderName = entry.name.replace('.folder', '');
            if (filterFolder && filterFolder !== folderName)
                continue;
            const folderPath = path.join(prototypesDir, entry.name);
            const subs = fs.readdirSync(folderPath, { withFileTypes: true });
            for (const sub of subs) {
                if (!sub.isDirectory())
                    continue;
                items.push({ name: sub.name, folder: folderName, path: `src/prototypes/${entry.name}/${sub.name}` });
            }
        }
        else if (!filterFolder) {
            items.push({ name: entry.name, folder: null, path: `src/prototypes/${entry.name}` });
        }
    }
    return items;
}
function scanCanvases(canvasDir, filterFolder, root) {
    const items = [];
    const scanDir = (dir, folder) => {
        if (!fs.existsSync(dir))
            return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                scanDir(path.join(dir, entry.name), entry.name);
            }
            else if (entry.name.endsWith('.canvas.jsonl')) {
                const name = entry.name.replace('.canvas.jsonl', '');
                if (!filterFolder || folder === filterFolder) {
                    items.push({ name, folder: folder || null, path: path.relative(root, path.join(dir, entry.name)) });
                }
            }
        }
    };
    scanDir(canvasDir, null);
    return items;
}
function scanComponents(componentsDir, root) {
    const items = [];
    const entries = fs.readdirSync(componentsDir, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory())
            continue;
        items.push({ name: entry.name, path: path.relative(root, path.join(componentsDir, entry.name)) });
    }
    return items;
}
