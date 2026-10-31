/**
 * Read-only first-look discovery for a Notebook content root.
 *
 * Discovery never writes, migrates, or repairs files. Ordinary directories are
 * navigation groups. Artifact boundaries are `name.prototype/`, `name.canvas/`,
 * `name.site/`, `name.doc.mdx`, and `name.doc/name.doc.mdx`.
 *
 * Existing Hypercanvas folder-model artifacts that lack portable identity
 * (`name.prototype.json` with `meta`, canvas headers without `canvasId`) are
 * reported as `legacy` for the Hypercanvas notebook reader. They are not
 * diagnosed as broken first-look artifacts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseJsonc } from 'jsonc-parser';
import { parseDocument } from 'yaml';
import { FIRST_LOOK_DIRECTORY_SUFFIXES, FIRST_LOOK_EXCLUDED_DIRECTORIES, FIRST_LOOK_PROTOTYPE_RUNTIME, isFirstLookId, } from './contract.js';
import { isPortableRelativePath, validateFirstLookDescriptor } from './descriptors.js';
function inside(root, candidate) {
    const relative = path.relative(root, candidate);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}
function diagnostic(code, message, pathName, extra = {}) {
    return { code, message, path: pathName, severity: 'error', ...extra };
}
function issueDiagnostic(issue, pathName) {
    return diagnostic(issue.code, issue.message, pathName, issue.field ? { field: issue.field } : {});
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
/** Resolve a portable path from a notebook-relative base; throws when it escapes the notebook. */
export function resolveNotebookPath(root, basePath, relativePath) {
    const rootReal = fs.realpathSync.native(path.resolve(root));
    for (const [value, label] of [[basePath, 'basePath'], [relativePath, 'relativePath']]) {
        if (value !== null && (typeof value !== 'string' || value.includes('\\') || value.startsWith('/') || /^[A-Za-z]:/.test(value))) {
            throw new Error(`${label} must be a forward-slash relative path`);
        }
    }
    const base = basePath ? path.resolve(rootReal, ...basePath.split('/')) : rootReal;
    if (!inside(rootReal, base))
        throw new Error(`Path base escapes the notebook: ${basePath}`);
    const target = path.resolve(base, ...relativePath.split('/'));
    if (!inside(rootReal, target))
        throw new Error(`Relative path escapes the notebook: ${relativePath}`);
    let existing = target;
    while (!fs.existsSync(existing) && existing !== rootReal)
        existing = path.dirname(existing);
    if (!inside(rootReal, fs.realpathSync.native(existing)))
        throw new Error(`Resolved path escapes the notebook: ${relativePath}`);
    return target;
}
function directoryKind(name) {
    for (const [kind, suffix] of Object.entries(FIRST_LOOK_DIRECTORY_SUFFIXES)) {
        if (name.endsWith(suffix) && name.length > suffix.length)
            return kind;
    }
    return null;
}
function documentWrapperName(directoryName) {
    return directoryName.endsWith('.doc') && directoryName.length > '.doc'.length
        ? directoryName.slice(0, -'.doc'.length)
        : null;
}
function listEntries(directory, relativePath, diagnostics) {
    try {
        return fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'));
    }
    catch (error) {
        diagnostics.push(diagnostic('UNREADABLE_DIRECTORY', `Cannot read directory: ${errorMessage(error)}`, relativePath || '.'));
        return [];
    }
}
function readText(absolutePath) {
    try {
        return fs.readFileSync(absolutePath, 'utf8');
    }
    catch {
        return null;
    }
}
function parseJsonObject(text) {
    const errors = [];
    const value = parseJsonc(text, errors);
    if (errors.length)
        return { value: null, error: `offset ${errors[0]?.offset ?? 0}` };
    return isRecord(value) ? { value, error: null } : { value: null, error: 'expected a JSON object' };
}
/**
 * A `name.prototype.json` is first-look only when it declares portable identity.
 * Legacy Hypercanvas prototype metadata (`meta`, `knobs`, ...) has none of these keys.
 */
function isFirstLookPrototypeDescriptor(value) {
    return value.formatVersion !== undefined || value.runtime !== undefined || value.id !== undefined;
}
function artifactShell(kind, name, relativePath, wrapped = false) {
    const documentPath = wrapped ? `${relativePath}/${name}.doc.mdx` : relativePath;
    let descriptorPath;
    if (kind === 'doc')
        descriptorPath = documentPath;
    else if (kind === 'canvas')
        descriptorPath = `${relativePath}/${name}${FIRST_LOOK_DIRECTORY_SUFFIXES.canvas}.jsonl`;
    else
        descriptorPath = `${relativePath}/${name}${FIRST_LOOK_DIRECTORY_SUFFIXES[kind]}.json`;
    let folderPath;
    if (kind === 'doc') {
        folderPath = wrapped ? relativePath : path.posix.dirname(relativePath) === '.' ? '' : path.posix.dirname(relativePath);
    }
    else {
        folderPath = relativePath;
    }
    return {
        id: null,
        kind,
        title: name,
        folderPath,
        path: documentPath,
        descriptorPath,
        // A Canvas payload is its JSONL file; other kinds keep the artifact folder or Doc path.
        payloadPath: kind === 'canvas' ? descriptorPath : documentPath,
        descriptor: null,
        references: [],
        views: [],
        diagnostics: [],
        available: false,
    };
}
function finish(artifact) {
    artifact.available = !artifact.diagnostics.some(item => item.severity === 'error') && artifact.id !== null;
    return artifact;
}
function applyIdentityFields(artifact, descriptor) {
    if (Array.isArray(descriptor.references)) {
        artifact.references = descriptor.references.filter((value) => typeof value === 'string');
    }
    if (typeof descriptor.id === 'string')
        artifact.id = descriptor.id;
    if (typeof descriptor.title === 'string' && descriptor.title.trim())
        artifact.title = descriptor.title;
}
function validatePrototypeEntry(root, artifact, entry) {
    if (!isPortableRelativePath(entry)) {
        artifact.diagnostics.push(diagnostic('INVALID_RELATIVE_PATH', 'entry must be a non-empty, forward-slash relative path.', artifact.descriptorPath, { field: 'entry' }));
        return;
    }
    const normalized = path.posix.normalize(entry);
    if (normalized === '..' || normalized.startsWith('../')) {
        artifact.diagnostics.push(diagnostic('INVALID_RELATIVE_PATH', 'Prototype entry must remain inside its artifact directory.', artifact.descriptorPath, { field: 'entry' }));
        return;
    }
    const artifactDirectory = path.resolve(root, ...artifact.folderPath.split('/').filter(Boolean));
    const absoluteEntry = path.resolve(artifactDirectory, ...entry.split('/'));
    try {
        const realEntry = fs.realpathSync.native(absoluteEntry);
        const realArtifact = fs.realpathSync.native(artifactDirectory);
        if (!inside(realArtifact, realEntry) || !fs.statSync(realEntry).isFile()) {
            artifact.diagnostics.push(diagnostic('INVALID_PROTOTYPE_ENTRY', 'Prototype entry must be an existing file inside its artifact directory.', artifact.descriptorPath, { field: 'entry' }));
        }
    }
    catch {
        artifact.diagnostics.push(diagnostic('MISSING_PROTOTYPE_ENTRY', `Prototype entry does not exist: ${entry}`, artifact.descriptorPath, { field: 'entry' }));
    }
}
function validateSiteScreenshots(root, artifact, views) {
    views.forEach((view, index) => {
        if (!isRecord(view) || typeof view.screenshot !== 'string' || !isPortableRelativePath(view.screenshot))
            return;
        try {
            resolveNotebookPath(root, artifact.folderPath, view.screenshot);
        }
        catch {
            artifact.diagnostics.push(diagnostic('INVALID_RELATIVE_PATH', `views[${index}].screenshot must resolve inside the notebook root.`, artifact.descriptorPath, { field: `views.${index}.screenshot` }));
        }
    });
}
/** Prototype and Site descriptors: `name.prototype/name.prototype.json` and `name.site/name.site.json`. */
function discoverJsonArtifact(root, kind, absoluteDirectory, relativePath, name) {
    const absoluteDescriptor = path.join(absoluteDirectory, `${name}${FIRST_LOOK_DIRECTORY_SUFFIXES[kind]}.json`);
    const text = readText(absoluteDescriptor);
    if (text === null)
        return { legacy: { kind, name, path: relativePath, reason: 'missing-first-look-payload' } };
    const artifact = artifactShell(kind, name, relativePath);
    const parsed = parseJsonObject(text);
    if (parsed.value === null) {
        artifact.diagnostics.push(diagnostic('INVALID_DESCRIPTOR_JSON', `Descriptor is not valid JSON: ${parsed.error}`, artifact.descriptorPath));
        return { artifact: finish(artifact) };
    }
    const descriptor = parsed.value;
    if (kind === 'prototype' && !isFirstLookPrototypeDescriptor(descriptor)) {
        return { legacy: { kind, name, path: relativePath, reason: 'no-first-look-identity' } };
    }
    artifact.descriptor = structuredClone(descriptor);
    for (const issue of validateFirstLookDescriptor(kind, descriptor))
        artifact.diagnostics.push(issueDiagnostic(issue, artifact.descriptorPath));
    applyIdentityFields(artifact, descriptor);
    artifact.views = Array.isArray(descriptor.views) ? structuredClone(descriptor.views).filter(isRecord) : [];
    if (kind === 'prototype') {
        const runtime = isRecord(descriptor.runtime) ? descriptor.runtime : null;
        if (runtime && runtime.id === FIRST_LOOK_PROTOTYPE_RUNTIME.id && runtime.version === FIRST_LOOK_PROTOTYPE_RUNTIME.version) {
            artifact.runtime = { ...FIRST_LOOK_PROTOTYPE_RUNTIME };
        }
        artifact.entry = typeof descriptor.entry === 'string' ? descriptor.entry : null;
        if (typeof descriptor.entry === 'string')
            validatePrototypeEntry(root, artifact, descriptor.entry);
    }
    else {
        artifact.local = isRecord(descriptor.local) ? { ...descriptor.local } : null;
        artifact.published = isRecord(descriptor.published) ? { ...descriptor.published } : null;
        if (Array.isArray(descriptor.views))
            validateSiteScreenshots(root, artifact, descriptor.views);
    }
    return { artifact: finish(artifact) };
}
/** Canvas: `name.canvas/name.canvas.jsonl`. Identity lives in the first `canvas_created` record. */
function discoverCanvas(absoluteDirectory, relativePath, name) {
    const artifact = artifactShell('canvas', name, relativePath);
    const source = readText(path.join(absoluteDirectory, path.posix.basename(artifact.descriptorPath)));
    if (source === null)
        return { legacy: { kind: 'canvas', name, path: relativePath, reason: 'missing-first-look-payload' } };
    const firstLine = source.split(/\r?\n/).find(line => line.trim().length > 0);
    let header = null;
    if (firstLine !== undefined) {
        try {
            header = JSON.parse(firstLine);
        }
        catch {
            artifact.diagnostics.push(diagnostic('CANVAS_MALFORMED_JSON', 'The first canvas record is not valid JSON.', artifact.descriptorPath, { line: 1 }));
            return { artifact: finish(artifact) };
        }
    }
    if (!isRecord(header) || header.event !== 'canvas_created' || header.canvasId === undefined) {
        return { legacy: { kind: 'canvas', name, path: relativePath, reason: 'no-first-look-identity' } };
    }
    artifact.descriptor = structuredClone(header);
    if (header.formatVersion !== 1) {
        artifact.diagnostics.push(diagnostic('UNSUPPORTED_FORMAT_VERSION', 'Canvas formatVersion must be 1.', artifact.descriptorPath, { field: 'formatVersion' }));
    }
    if (isFirstLookId(header.canvasId))
        artifact.id = header.canvasId;
    else
        artifact.diagnostics.push(diagnostic('MISSING_OR_INVALID_ID', 'Canvas header must contain a stable canvasId.', artifact.descriptorPath, { field: 'canvasId' }));
    return { artifact: finish(artifact) };
}
/** Doc: `name.doc.mdx` or the wrapper `name.doc/name.doc.mdx`. */
function discoverDocument(absolutePath, relativePath, name, wrapped) {
    const artifact = { ...artifactShell('doc', name, relativePath, wrapped), wrapped };
    const source = readText(absolutePath);
    if (source === null) {
        artifact.diagnostics.push(diagnostic('MISSING_DOCUMENT', 'Cannot read document.', artifact.payloadPath));
        return finish(artifact);
    }
    const frontmatter = readFrontmatter(source, artifact);
    if (frontmatter) {
        artifact.descriptor = structuredClone(frontmatter);
        for (const issue of validateFirstLookDescriptor('doc', frontmatter))
            artifact.diagnostics.push(issueDiagnostic(issue, artifact.payloadPath));
        applyIdentityFields(artifact, frontmatter);
    }
    return finish(artifact);
}
function readFrontmatter(source, artifact) {
    const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!match) {
        artifact.diagnostics.push(diagnostic('MISSING_DOCUMENT_FRONTMATTER', 'A .doc.mdx file must begin with YAML frontmatter.', artifact.payloadPath));
        return null;
    }
    const document = parseDocument(match[1] ?? '', { uniqueKeys: true, version: '1.2' });
    for (const issue of [...document.errors, ...document.warnings]) {
        const line = issue.linePos?.[0]?.line;
        artifact.diagnostics.push(diagnostic('INVALID_DOCUMENT_FRONTMATTER', issue.message, artifact.payloadPath, {
            ...(line ? { line: line + 1 } : {}),
            severity: document.errors.includes(issue) ? 'error' : 'warning',
        }));
    }
    if (document.errors.length)
        return null;
    const value = document.toJS({ mapAsMap: false });
    if (!isRecord(value)) {
        artifact.diagnostics.push(diagnostic('INVALID_DOCUMENT_FRONTMATTER', 'YAML frontmatter must be a mapping.', artifact.payloadPath));
        return null;
    }
    return value;
}
function nestedDiagnostic(kind, relativePath, containing) {
    return diagnostic('NESTED_ARTIFACT', `${kind} artifact ${relativePath} is inside ${containing.kind} artifact ${containing.path}; artifact folders cannot contain other artifacts.`, relativePath, { nestedArtifact: { kind, path: relativePath }, containingArtifact: containing });
}
/** Artifact folders cannot contain other artifacts, even through ordinary groups. */
function scanNestedArtifacts(rootReal, absoluteDirectory, relativeDirectory, containing, diagnostics, allowedDocumentPath = null) {
    for (const entry of listEntries(absoluteDirectory, relativeDirectory, diagnostics)) {
        if (entry.isSymbolicLink() || FIRST_LOOK_EXCLUDED_DIRECTORIES.has(entry.name))
            continue;
        let realPath;
        try {
            realPath = fs.realpathSync.native(path.join(absoluteDirectory, entry.name));
        }
        catch {
            continue;
        }
        if (!inside(rootReal, realPath))
            continue;
        const relativePath = path.posix.join(relativeDirectory, entry.name);
        if (entry.isFile() && entry.name.endsWith('.doc.mdx')) {
            if (relativePath === allowedDocumentPath)
                continue;
            diagnostics.push(nestedDiagnostic('doc', relativePath, containing));
            continue;
        }
        if (!entry.isDirectory())
            continue;
        const kind = directoryKind(entry.name);
        const absolutePath = path.join(absoluteDirectory, entry.name);
        if (kind) {
            diagnostics.push(nestedDiagnostic(kind, relativePath, containing));
            scanNestedArtifacts(rootReal, absolutePath, relativePath, { kind, path: relativePath }, diagnostics);
        }
        else {
            scanNestedArtifacts(rootReal, absolutePath, relativePath, containing, diagnostics, allowedDocumentPath);
        }
    }
}
function wrapperPayload(absoluteDirectory, wrapperName) {
    const payloadName = `${wrapperName}.doc.mdx`;
    try {
        const stat = fs.lstatSync(path.join(absoluteDirectory, payloadName));
        if (stat.isFile() && !stat.isSymbolicLink())
            return { status: 'matched', payloadName, documentFiles: [] };
    }
    catch {
        // A missing payload is reported below as a wrapper diagnostic.
    }
    let documentFiles = [];
    try {
        documentFiles = fs.readdirSync(absoluteDirectory, { withFileTypes: true })
            .filter(child => child.isFile() && child.name.endsWith('.doc.mdx'))
            .map(child => child.name)
            .sort((a, b) => a.localeCompare(b, 'en'));
    }
    catch {
        // An unreadable wrapper has no discoverable Doc files; the missing-payload diagnostic stands.
    }
    return { status: documentFiles.length ? 'mismatched' : 'missing', payloadName, documentFiles };
}
/** Discover first-look artifacts and the ordinary folder tree. Read-only. */
export function discoverFirstLookNotebook(notebookRoot) {
    const root = fs.realpathSync.native(path.resolve(notebookRoot));
    const artifacts = [];
    const legacy = [];
    const diagnostics = [];
    function addArtifact(artifact, target) {
        artifacts.push(artifact);
        target.push({ type: 'artifact', artifact });
    }
    function walk(directory, relativeDirectory, targetEntries) {
        for (const entry of listEntries(directory, relativeDirectory, diagnostics)) {
            if (entry.isSymbolicLink() || FIRST_LOOK_EXCLUDED_DIRECTORIES.has(entry.name))
                continue;
            const absolutePath = path.join(directory, entry.name);
            const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
            // Managed publication output contains copies of the source artifacts.
            if (entry.isDirectory() && (relativePath === 'backstage/publish' || relativePath === 'publish'))
                continue;
            let realPath;
            try {
                realPath = fs.realpathSync.native(absolutePath);
            }
            catch {
                continue;
            }
            if (!inside(root, realPath))
                continue;
            if (entry.isDirectory()) {
                const kind = directoryKind(entry.name);
                if (kind) {
                    const name = entry.name.slice(0, -FIRST_LOOK_DIRECTORY_SUFFIXES[kind].length);
                    const result = kind === 'canvas'
                        ? discoverCanvas(absolutePath, relativePath, name)
                        : discoverJsonArtifact(root, kind, absolutePath, relativePath, name);
                    if (result.artifact)
                        addArtifact(result.artifact, targetEntries);
                    if (result.legacy) {
                        legacy.push(result.legacy);
                        targetEntries.push({ type: 'legacy', kind, name, path: relativePath });
                    }
                    scanNestedArtifacts(root, absolutePath, relativePath, { kind, path: relativePath }, diagnostics);
                    continue;
                }
                const wrapperName = documentWrapperName(entry.name);
                if (wrapperName) {
                    const payload = wrapperPayload(absolutePath, wrapperName);
                    if (payload.status === 'matched') {
                        const artifact = discoverDocument(path.join(absolutePath, payload.payloadName), relativePath, wrapperName, true);
                        addArtifact(artifact, targetEntries);
                        scanNestedArtifacts(root, absolutePath, relativePath, { kind: 'doc', path: artifact.path }, diagnostics, artifact.payloadPath);
                        continue;
                    }
                    diagnostics.push(diagnostic(payload.status === 'mismatched' ? 'MISMATCHED_DOCUMENT_WRAPPER' : 'MISSING_DOCUMENT_WRAPPER_PAYLOAD', payload.status === 'mismatched'
                        ? `Document wrapper ${relativePath} must contain ${payload.payloadName}; found ${payload.documentFiles.join(', ')}.`
                        : `Document wrapper ${relativePath} remains an ordinary folder until it contains ${payload.payloadName}.`, relativePath, { expectedPath: path.posix.join(relativePath, payload.payloadName), ...(payload.documentFiles.length ? { found: payload.documentFiles } : {}) }));
                }
                const children = [];
                walk(absolutePath, relativePath, children);
                targetEntries.push({ type: 'group', name: entry.name, path: relativePath, children });
            }
            else if (entry.isFile() && entry.name.endsWith('.doc.mdx')) {
                addArtifact(discoverDocument(absolutePath, relativePath, entry.name.slice(0, -'.doc.mdx'.length), false), targetEntries);
            }
        }
    }
    const entries = [];
    walk(root, '', entries);
    resolveIdentity(artifacts);
    for (const artifact of artifacts)
        diagnostics.push(...artifact.diagnostics);
    return { root, entries, artifacts, legacy, diagnostics };
}
function resolveIdentity(artifacts) {
    const ids = new Map();
    for (const artifact of artifacts) {
        if (artifact.id === null)
            continue;
        ids.set(artifact.id, [...(ids.get(artifact.id) ?? []), artifact]);
    }
    for (const [id, matches] of ids) {
        if (matches.length < 2)
            continue;
        const paths = matches.map(artifact => artifact.path);
        for (const artifact of matches) {
            artifact.diagnostics.push(diagnostic('DUPLICATE_ARTIFACT_ID', `Artifact id "${id}" is used by ${paths.join(' and ')}.`, artifact.path, { id, paths }));
            artifact.available = false;
        }
    }
    for (const artifact of artifacts) {
        artifact.resolvedReferences = [];
        for (const id of artifact.references) {
            const matches = ids.get(id) ?? [];
            const [target] = matches;
            if (matches.length === 1 && target) {
                artifact.resolvedReferences.push({ id, kind: target.kind, path: target.path });
                continue;
            }
            artifact.diagnostics.push(diagnostic(matches.length ? 'AMBIGUOUS_REFERENCE' : 'UNRESOLVED_REFERENCE', matches.length
                ? `Reference "${id}" is ambiguous because multiple artifacts use that ID.`
                : `Reference "${id}" does not match a discovered artifact ID.`, artifact.path, { id, matches: matches.map(target => target.path), severity: 'warning' }));
        }
    }
}
