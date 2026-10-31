/**
 * Artifact validation — schema + semantic validation for all artifact types.
 *
 * Validates against JSON Schema definitions and performs semantic checks
 * (uniqueness, reference existence, mutual exclusivity).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { notebookCanvasArtifactPaths, resolveNotebookCanvasParent } from '../canvas/artifact-paths.js';
import { inspectNotebook, hasNotebookManifest } from '../notebook/notebook.js';
import { SiteStore, siteFolderPath } from '../site/site.js';
import { artifactFolderLogicalName } from './visibility.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Cache loaded schemas
const schemaCache = new Map();
const VALID_TYPES = ['prototype', 'canvas', 'component', 'flow', 'object', 'record', 'page', 'site'];
const RESERVED_NAMES = new Set(['index', 'app', '_app']);
function isArtifactType(type) {
    return VALID_TYPES.includes(type);
}
function contentDir(root, name) {
    return hasNotebookManifest(root)
        ? path.join(root, name)
        : path.join(root, 'src', name);
}
/**
 * Load a schema by artifact type.
 */
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isSchemaProperty(value) {
    if (!isRecord(value))
        return false;
    if (value.pattern !== undefined && typeof value.pattern !== 'string')
        return false;
    if (value.maxLength !== undefined && typeof value.maxLength !== 'number')
        return false;
    if (value.format !== undefined && typeof value.format !== 'string')
        return false;
    return true;
}
function isArtifactSchema(value) {
    if (!isRecord(value))
        return false;
    if (value.properties !== undefined && (!isRecord(value.properties) ||
        !Object.values(value.properties).every(isSchemaProperty)))
        return false;
    if (value.required !== undefined && (!Array.isArray(value.required) ||
        !value.required.every(field => typeof field === 'string')))
        return false;
    if (value.mutuallyExclusive !== undefined && (!Array.isArray(value.mutuallyExclusive) ||
        !value.mutuallyExclusive.every(group => Array.isArray(group) && group.every(field => typeof field === 'string'))))
        return false;
    return true;
}
function loadSchema(type) {
    if (!isArtifactType(type))
        return null;
    const cached = schemaCache.get(type);
    if (cached)
        return cached;
    const schemaPath = path.join(__dirname, 'schemas', `${type}.schema.json`);
    if (!fs.existsSync(schemaPath))
        return null;
    const parsed = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    if (!isArtifactSchema(parsed))
        return null;
    const schema = parsed;
    schemaCache.set(type, schema);
    return schema;
}
/**
 * Normalize input values (coerce types, apply defaults).
 */
function normalizeValues(type, values) {
    const normalized = { ...values };
    if (['prototype', 'canvas', 'component', 'site'].includes(type)
        && typeof normalized.parentPath === 'string' && normalized.folder === undefined) {
        normalized.folder = normalized.parentPath;
    }
    if (['prototype', 'canvas', 'component', 'site'].includes(type)) {
        for (const field of ['parentPath', 'folder']) {
            if (typeof normalized[field] === 'string') {
                const rawParent = normalized[field];
                const portableParent = rawParent.replaceAll('\\', '/');
                const isAbsoluteParent = portableParent.startsWith('/') || /^[A-Za-z]:/.test(portableParent);
                normalized[field] = isAbsoluteParent ? portableParent : portableParent.replace(/\/+$/, '');
            }
        }
    }
    // Map 'content' field to type-specific fields (UI sends 'content' for objects/records)
    if (normalized.content && type === 'object' && !normalized.body) {
        try {
            normalized.body = JSON.parse(String(normalized.content));
        }
        catch {
            normalized.body = {};
        }
        delete normalized.content;
    }
    if (normalized.content && type === 'record' && !normalized.entries) {
        try {
            normalized.entries = JSON.parse(String(normalized.content));
        }
        catch {
            normalized.entries = [];
        }
        delete normalized.content;
    }
    // Coerce author string to array
    if (typeof normalized.author === 'string') {
        normalized.author = normalized.author.split(',').map(a => a.trim()).filter(Boolean);
    }
    // Coerce globals string to array
    if (typeof normalized.globals === 'string') {
        normalized.globals = normalized.globals.split(',').map(g => g.trim()).filter(Boolean);
    }
    // Normalize name to kebab-case (skip for components which use PascalCase)
    if (normalized.name && typeof normalized.name === 'string' && type !== 'component') {
        normalized.name = normalized.name
            .replace(/[^a-zA-Z0-9\s_-]/g, '')
            .trim()
            .replace(/[\s_]+/g, '-')
            .toLowerCase()
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }
    return normalized;
}
function normalizeParentValue(value) {
    const normalized = value.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '');
    return normalized === '.' ? '' : normalized;
}
/**
 * Validate schema constraints (required fields, patterns, types).
 */
function validateSchema(type, values) {
    const schema = loadSchema(type);
    if (!schema)
        return [{ field: '_type', message: `Unknown artifact type: ${type}` }];
    const errors = [];
    const props = schema.properties ?? {};
    const required = schema.required || [];
    // Check required fields
    for (const field of required) {
        if (values[field] === undefined || values[field] === null || values[field] === '') {
            errors.push({ field, message: `${field} is required` });
        }
    }
    // Check field constraints
    for (const [field, value] of Object.entries(values)) {
        if (value === undefined || value === null)
            continue;
        const prop = props[field];
        if (!prop)
            continue;
        // Pattern check (for strings)
        if (prop.pattern && typeof value === 'string') {
            const re = new RegExp(prop.pattern);
            if (!re.test(value)) {
                errors.push({ field, message: `${field} must match pattern ${prop.pattern}` });
            }
        }
        // Max length
        if (prop.maxLength && typeof value === 'string' && value.length > prop.maxLength) {
            errors.push({ field, message: `${field} must be at most ${prop.maxLength} characters` });
        }
        // URL format
        if (prop.format === 'uri' && typeof value === 'string') {
            try {
                new URL(value);
            }
            catch {
                errors.push({ field, message: `${field} must be a valid URL` });
            }
        }
    }
    // Mutual exclusivity
    if (schema.mutuallyExclusive) {
        for (const group of schema.mutuallyExclusive) {
            const present = group.filter(f => values[f] !== undefined && values[f] !== false);
            if (present.length > 1) {
                errors.push({ field: present.join(', '), message: `${present.join(' and ')} are mutually exclusive` });
            }
        }
    }
    return errors;
}
/**
 * Validate semantic constraints (uniqueness, references, reserved names).
 */
function validateSemantic(type, values, root) {
    const errors = [];
    const name = typeof values.name === 'string' ? values.name : undefined;
    const folder = typeof values.folder === 'string' ? values.folder : undefined;
    const prototype = typeof values.prototype === 'string' ? values.prototype : undefined;
    if (['prototype', 'canvas', 'component', 'site'].includes(type)
        && typeof values.parentPath === 'string' && typeof values.folder === 'string'
        && normalizeParentValue(values.parentPath) !== normalizeParentValue(values.folder)) {
        errors.push({ field: 'parentPath', message: 'parentPath and folder must refer to the same creation parent when both are provided.' });
    }
    // Reserved name check
    if (name && ['prototype', 'page'].includes(type) && RESERVED_NAMES.has(name)) {
        errors.push({ field: 'name', message: `"${name}" is a reserved name` });
    }
    // Uniqueness checks
    if (type === 'prototype') {
        const prototypesDir = contentDir(root, 'prototypes');
        const isNotebook = hasNotebookManifest(root);
        if (isNotebook && name) {
            try {
                const parent = resolveNotebookCanvasParent(root, folder);
                const targetDir = path.join(parent.directory, `${name}.prototype`);
                if (fs.existsSync(targetDir)) {
                    errors.push({ field: 'name', message: `Prototype artifact "${path.posix.join(parent.path, `${name}.prototype`)}" already exists` });
                }
                const route = `/${encodeURIComponent(name)}.prototype`;
                // `_` (sidebar-only visibility) and hidden artifacts still hold the
                // canonical logical route, so they block duplicates at creation.
                const collision = inspectNotebook(root).artifacts.find(artifact => artifact.kind === 'prototype'
                    && artifact.route?.toLocaleLowerCase('en-US') === route.toLocaleLowerCase('en-US'));
                if (collision)
                    errors.push({ field: 'name', message: `Prototype route "${route}" is already used by "${collision.folderPath}"` });
            }
            catch (error) {
                errors.push({ field: 'parentPath', message: error instanceof Error ? error.message : String(error) });
            }
        }
        else {
            const targetDir = folder
                ? path.join(prototypesDir, `${folder}.folder`, name ?? '')
                : path.join(prototypesDir, name ?? '');
            if (name && fs.existsSync(targetDir)) {
                errors.push({ field: 'name', message: `Prototype "${name}" already exists${folder ? ` in folder "${folder}"` : ''}` });
            }
        }
    }
    if (type === 'canvas') {
        const canvasDir = contentDir(root, 'canvas');
        const fileName = `${name ?? ''}.canvas.jsonl`;
        const isNotebook = hasNotebookManifest(root);
        let candidates;
        if (isNotebook && name) {
            try {
                const artifact = notebookCanvasArtifactPaths(root, name, folder);
                candidates = [artifact.folderDirectory, artifact.payloadFile];
                if (fs.existsSync(artifact.folderDirectory) || fs.existsSync(artifact.payloadFile)) {
                    errors.push({ field: 'name', message: `Canvas artifact "${artifact.folderName}" already exists in "${artifact.parentPath || '.'}"` });
                }
            }
            catch (error) {
                errors.push({ field: 'folder', message: error instanceof Error ? error.message : String(error) });
                candidates = [];
            }
            const snapshot = inspectNotebook(root);
            const route = `/canvas/${name}`;
            const collision = snapshot.artifacts.find(artifact => artifact.kind === 'canvas' && artifact.route === route);
            if (collision)
                errors.push({ field: 'name', message: `Canvas route "${route}" is already used by "${collision.folderPath}"` });
        }
        else {
            candidates = folder
                ? [path.join(canvasDir, folder, fileName), path.join(canvasDir, `${folder}.folder`, fileName)]
                : [path.join(canvasDir, fileName)];
        }
        if (!isNotebook && name && candidates.some(candidate => fs.existsSync(candidate))) {
            errors.push({ field: 'name', message: `Canvas "${name}" already exists` });
        }
    }
    if (type === 'site' && name) {
        const store = new SiteStore(root);
        if (store.get(name)) {
            errors.push({ field: 'name', message: `Site "${name}" already exists` });
        }
        else {
            try {
                const folderPath = siteFolderPath(root, name, folder || '');
                if (fs.existsSync(path.join(root, ...folderPath.split('/')))) {
                    errors.push({ field: 'name', message: `Site artifact "${folderPath}" already exists` });
                }
            }
            catch (error) {
                errors.push({ field: 'folder', message: error instanceof Error ? error.message : String(error) });
            }
        }
    }
    if (type === 'component') {
        const componentsDir = contentDir(root, 'components');
        const pascal = toPascalCase(name ?? '');
        const directory = typeof values.directory === 'string' ? values.directory : undefined;
        if (hasNotebookManifest(root)) {
            if (directory !== undefined) {
                errors.push({ field: 'directory', message: 'Notebook components use parentPath (or folder), not the legacy components directory.' });
            }
            try {
                const parent = resolveNotebookCanvasParent(root, folder);
                const targetDir = path.join(parent.directory, `${pascal}.component`);
                if (name && fs.existsSync(targetDir)) {
                    errors.push({ field: 'name', message: `Component artifact "${pascal}.component" already exists in "${parent.path || '.'}"` });
                }
                if (name) {
                    const route = `/components/${encodeURIComponent(pascal)}`;
                    const collision = inspectNotebook(root).artifacts.find(artifact => {
                        if (artifact.kind !== 'component')
                            return false;
                        const logicalName = artifactFolderLogicalName(artifact.folderPath);
                        const catalogRoute = artifact.route ?? (logicalName ? `/components/${encodeURIComponent(logicalName)}` : undefined);
                        return catalogRoute?.toLocaleLowerCase('en-US') === route.toLocaleLowerCase('en-US');
                    });
                    if (collision)
                        errors.push({ field: 'name', message: `Component route "${route}" is already used by "${collision.folderPath}"` });
                }
            }
            catch (error) {
                errors.push({ field: 'folder', message: error instanceof Error ? error.message : String(error) });
            }
        }
        else {
            const targetDir = directory
                ? path.join(componentsDir, directory, pascal)
                : path.join(componentsDir, pascal);
            if (name && fs.existsSync(targetDir)) {
                errors.push({ field: 'name', message: `Component "${name}" already exists` });
            }
        }
    }
    // Reference existence checks
    if (type === 'flow' || type === 'page') {
        const prototypesDir = contentDir(root, 'prototypes');
        let protoDir = null;
        try {
            protoDir = prototype
                ? hasNotebookManifest(root)
                    ? resolveNotebookPrototypeDir(root, prototype, folder)
                    : resolvePrototypeDir(prototypesDir, prototype, folder)
                : null;
        }
        catch (error) {
            errors.push({ field: 'prototype', message: error instanceof Error ? error.message : String(error) });
        }
        if (!protoDir) {
            errors.push({ field: 'prototype', message: `Prototype "${prototype ?? ''}" not found` });
        }
        else if (type === 'flow') {
            // Check duplicate flow name
            const flowName = typeof values.name === 'string' ? values.name : '';
            const flowFile = path.join(protoDir, `${flowName}.flow.json`);
            if (fs.existsSync(flowFile)) {
                errors.push({ field: 'name', message: `Flow "${flowName}" already exists in prototype "${prototype}"` });
            }
        }
    }
    return errors;
}
/**
 * Resolve a prototype directory by name, searching in folder and root.
 */
function resolvePrototypeDir(prototypesDir, name, folder) {
    if (typeof name !== 'string')
        return null;
    const folderName = typeof folder === 'string' ? folder : undefined;
    if (!fs.existsSync(prototypesDir))
        return null;
    // Try with folder
    if (folderName) {
        const folderPath = path.join(prototypesDir, `${folderName}.folder`, name);
        if (fs.existsSync(folderPath))
            return folderPath;
        const altPath = path.join(prototypesDir, folderName, name);
        if (fs.existsSync(altPath))
            return altPath;
    }
    // Try root
    const rootPath = path.join(prototypesDir, name);
    if (fs.existsSync(rootPath))
        return rootPath;
    // Search all folders
    if (fs.existsSync(prototypesDir)) {
        const entries = fs.readdirSync(prototypesDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory() && entry.name.endsWith('.folder')) {
                const candidate = path.join(prototypesDir, entry.name, name);
                if (fs.existsSync(candidate))
                    return candidate;
            }
        }
    }
    return null;
}
/** Resolve a Notebook prototype by its logical name, marker ID, or folder path. */
export function resolveNotebookPrototypeDir(root, name, parentPath) {
    if (typeof name !== 'string')
        return null;
    const snapshot = inspectNotebook(root);
    if (snapshot.status !== 'valid')
        throw new Error('A valid Notebook is required for prototype operations.');
    const requestedParent = typeof parentPath === 'string' ? normalizeParentValue(parentPath) : null;
    const matches = snapshot.artifacts.filter(artifact => {
        if (artifact.kind !== 'prototype')
            return false;
        if (requestedParent !== null && normalizeParentValue(path.posix.dirname(artifact.folderPath)) !== requestedParent)
            return false;
        const logicalName = artifactFolderLogicalName(artifact.folderPath);
        return artifact.id === name || artifact.folderPath === name
            || logicalName?.toLocaleLowerCase('en-US') === name.toLocaleLowerCase('en-US');
    });
    const routable = matches.filter(artifact => artifact.visible && artifact.route);
    const candidates = routable.length ? routable : matches;
    if (candidates.length > 1) {
        throw new Error(`Prototype "${name}" is ambiguous. Select its artifact ID or parent folder.`);
    }
    const match = candidates[0];
    if (match) {
        if (!match.available) {
            throw new Error(match.diagnostics[0]?.message || `Prototype artifact "${match.folderPath}" is unavailable.`);
        }
        return path.join(root, ...match.folderPath.split('/'));
    }
    // Keep legacy Notebook prototypes readable while new artifacts use the catalog.
    return resolvePrototypeDir(contentDir(root, 'prototypes'), name, parentPath);
}
function toPascalCase(kebab) {
    return kebab
        .split('-')
        .map(s => s.charAt(0).toUpperCase() + s.slice(1))
        .join('');
}
/**
 * Main validation entry point.
 *
 * @param {string} type - Artifact type
 * @param {object} values - Input values
 * @param {string} root - Project root directory
 * @returns {{ valid: boolean, errors?: Array<{field: string, message: string}>, normalized?: object }}
 */
export function validateArtifact(type, values, root) {
    if (!isArtifactType(type)) {
        return { valid: false, errors: [{ field: '_type', message: `Unknown artifact type: "${type}". Valid types: ${VALID_TYPES.join(', ')}` }] };
    }
    if (['prototype', 'canvas', 'component', 'site'].includes(type)
        && hasNotebookManifest(root)) {
        for (const field of ['parentPath', 'folder']) {
            const candidate = values[field];
            if (typeof candidate === 'string' && (candidate.startsWith('/') || path.win32.isAbsolute(candidate))) {
                return { valid: false, errors: [{
                            field,
                            message: 'Parent must be a notebook-relative ordinary folder. Use an empty string or omit the field for the Notebook root.',
                        }] };
            }
        }
    }
    // 1. Normalize
    const normalized = normalizeValues(type, values);
    // 2. Schema validation
    const schemaErrors = validateSchema(type, normalized);
    if (schemaErrors.length > 0) {
        return { valid: false, errors: schemaErrors };
    }
    // 3. Semantic validation
    const semanticErrors = validateSemantic(type, normalized, root);
    if (semanticErrors.length > 0) {
        return { valid: false, errors: semanticErrors };
    }
    return { valid: true, normalized };
}
export { VALID_TYPES, loadSchema, resolvePrototypeDir, toPascalCase };
