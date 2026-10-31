import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { readNotebookGitBranch } from '../data/gitMetadata.js';
import { applyEdits, modify, parse as parseJsonc } from 'jsonc-parser';
import { resolveAppConfigPath, resolveAppConfigPrimaryWritePath } from '../configFile.js';
import { applyNavigationOperation } from './navigation.js';
import { inspectNotebook, NOTEBOOK_MANIFEST_FILE, resolveNotebookManifestPath, notebookPaths, writeNotebookManifest } from './notebook.js';
import { buildNotebookNavigationTree, readDirectNotebookSiblings } from './navigation-tree.js';
import { repairNestedNotebookArtifact } from './artifact-repair.js';
import { applyNotebookArtifactMigration, previewNotebookArtifactMigration, recoverNotebookArtifactMigration, } from './artifact-migration.js';
import { applySiblingReorder, isNotebookSiblingRef, resolveNotebookSiblingOrder, } from './sibling-order.js';
const locks = new Map();
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function errorField(error, key) {
    return isRecord(error) ? error[key] : undefined;
}
function pageType(value) {
    return value === 'prototype' || value === 'canvas' || value === 'component' || value === 'site' || value === 'doc';
}
function isSameTypeSet(groups, expected) {
    return groups.length === expected.length && new Set(groups).size === expected.length && expected.every(type => groups.includes(type));
}
function pageTypeList(value) {
    return Array.isArray(value) && value.every((item) => pageType(item));
}
function assertNavigationOperation(value) {
    const invalid = (message) => {
        throw Object.assign(new Error(message), { code: 'INVALID_NAVIGATION_OPERATION' });
    };
    if (!isRecord(value) || typeof value.type !== 'string') {
        return invalid(`Unknown navigation operation: ${String(isRecord(value) ? value.type || '' : '')}`);
    }
    switch (value.type) {
        case 'setMode':
            if (value.mode !== 'type' && value.mode !== 'files')
                return invalid('Mode must be type or files');
            return { type: 'setMode', mode: value.mode };
        case 'setSectionsEnabled':
            if (typeof value.enabled !== 'boolean')
                return invalid('Section visibility must be boolean');
            return { type: 'setSectionsEnabled', enabled: value.enabled };
        case 'reorderTypeGroups': {
            const groups = value.groups;
            // Group lists are exact sets: legacy Notebooks have four groups; Doc joins once Doc pages exist.
            const legacyTypes = ['prototype', 'canvas', 'component', 'site'];
            const allTypes = [...legacyTypes, 'doc'];
            if (!pageTypeList(groups) || !(isSameTypeSet(groups, legacyTypes) || isSameTypeSet(groups, allTypes))) {
                return invalid('Type group order must contain each page type once');
            }
            return { type: 'reorderTypeGroups', groups };
        }
        case 'movePage':
            if (value.layout === 'type') {
                if (!pageType(value.targetType))
                    return invalid('Target type must be a supported page type');
                return { type: 'movePage', layout: 'type', pageId: value.pageId, targetType: value.targetType, index: value.index };
            }
            if (value.layout === 'filesFlat')
                return { type: 'movePage', layout: 'filesFlat', pageId: value.pageId, index: value.index };
            if (value.layout === 'filesSections')
                return { type: 'movePage', layout: 'filesSections', pageId: value.pageId, sectionId: value.sectionId, index: value.index };
            return invalid('Layout must be type, filesFlat, or filesSections');
        case 'createSection':
            return { type: 'createSection', sectionId: value.sectionId, title: value.title, index: value.index };
        case 'renameSection':
            return { type: 'renameSection', sectionId: value.sectionId, title: value.title };
        case 'moveSection':
            return { type: 'moveSection', sectionId: value.sectionId, index: value.index };
        case 'removeSection':
            return { type: 'removeSection', sectionId: value.sectionId };
        case 'reorderSiblings': {
            if (typeof value.parentPath !== 'string' || !isNotebookSiblingRef(value.sibling)
                || !Array.isArray(value.expectedSiblingOrder) || !value.expectedSiblingOrder.every(isNotebookSiblingRef)
                || ((value.insertBefore === undefined) === (value.insertAfter === undefined))
                || (value.insertBefore !== undefined && !isNotebookSiblingRef(value.insertBefore))
                || (value.insertAfter !== undefined && !isNotebookSiblingRef(value.insertAfter))) {
                return invalid('Sibling reorder requires parentPath, sibling, expectedSiblingOrder, and a valid insertion target');
            }
            return {
                type: 'reorderSiblings',
                parentPath: value.parentPath,
                sibling: value.sibling,
                ...(value.insertBefore !== undefined ? { insertBefore: value.insertBefore } : {}),
                ...(value.insertAfter !== undefined ? { insertAfter: value.insertAfter } : {}),
                expectedSiblingOrder: value.expectedSiblingOrder,
            };
        }
        default:
            return invalid(`Unknown navigation operation: ${String(value.type || '')}`);
    }
}
function isInside(root, candidate) {
    const relative = path.relative(root, candidate);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}
function scopeConflict(message, state = null) {
    return Object.assign(new Error(message), { code: 'NOTEBOOK_SCOPE_CONFLICT', status: 409, state });
}
function revisionConflict(state) {
    return Object.assign(new Error('Notebook manifest changed since this layout was read.'), {
        code: 'STALE_NOTEBOOK_REVISION',
        status: 409,
        state,
    });
}
function siblingError(message, code = 'INVALID_SIBLING_ORDER', status = 422) {
    return Object.assign(new Error(message), { code, status });
}
function manifestRevision(file) {
    return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function currentScope(runtime, request = null) {
    const rawStatus = runtime.status?.();
    const status = isRecord(rawStatus) ? rawStatus : {};
    const notebook = isRecord(status.notebook) ? status.notebook : {};
    const manifest = isRecord(notebook.manifest) ? notebook.manifest : {};
    const id = manifest.id;
    const generation = status.generation;
    if (!status.active || typeof status.root !== 'string' || typeof id !== 'string')
        throw scopeConflict('There is no active Notebook.');
    if (request && (request.notebookId !== id || request.generation !== generation)) {
        throw scopeConflict('The active Notebook changed; reload its current navigation state.');
    }
    return { root: status.root, notebookId: id, generation };
}
function readState(runtime, request = null) {
    const scope = currentScope(runtime, request);
    const inspected = inspectNotebook(scope.root);
    if (!isRecord(inspected) || inspected.status !== 'valid' || !isRecord(inspected.manifest) || !Array.isArray(inspected.pages) || !Array.isArray(inspected.artifacts)) {
        throw Object.assign(new Error('The active Notebook catalog is invalid.'), {
            code: 'INVALID_NOTEBOOK',
            status: 422,
            detail: isRecord(inspected) ? inspected.diagnostics : undefined,
        });
    }
    const manifest = inspected.manifest;
    if (typeof manifest.id !== 'string')
        throw Object.assign(new Error('The active Notebook catalog is invalid.'), { code: 'INVALID_NOTEBOOK', status: 422, detail: inspected.diagnostics });
    const pages = [];
    for (const item of inspected.pages) {
        if (!isRecord(item) || typeof item.id !== 'string' || !pageType(item.type)) {
            throw Object.assign(new Error('The active Notebook catalog is invalid.'), { code: 'INVALID_NOTEBOOK', status: 422, detail: inspected.diagnostics });
        }
        pages.push({ ...item, id: item.id, type: item.type });
    }
    const notebook = {
        ...inspected,
        status: inspected.status,
        root: scope.root,
        manifest: { ...manifest, id: manifest.id, ...(typeof manifest.title === 'string' ? { title: manifest.title } : {}), navigation: manifest.navigation },
        pages,
        artifacts: inspected.artifacts,
        diagnostics: inspected.diagnostics,
    };
    const manifestPath = notebookPaths(scope.root).manifest;
    const revision = fs.existsSync(manifestPath)
        ? manifestRevision(manifestPath)
        : createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
    return {
        ...scope,
        notebook,
        revision,
    };
}
async function withNotebookLock(key, callback) {
    const previous = locks.get(key) || Promise.resolve();
    let release = () => { };
    const current = new Promise(resolve => { release = resolve; });
    locks.set(key, current);
    await previous.catch(() => { });
    try {
        return await callback();
    }
    finally {
        release();
        if (locks.get(key) === current)
            locks.delete(key);
    }
}
function siblingParentPath(value) {
    if (typeof value !== 'string' || (value !== '' && (value.startsWith('/') || value.includes('\\')
        || value.split('/').some(part => !part || part === '.' || part === '..')))) {
        throw siblingError('Parent path must be a normalized notebook-relative POSIX path.');
    }
    return value;
}
function readDirectSiblings(root, parentPath, inspected) {
    try {
        return readDirectNotebookSiblings(root, parentPath, inspected);
    }
    catch (error) {
        if (errorField(error, 'code') === 'INVALID_SIBLING_TARGET') {
            throw siblingError(typeof errorField(error, 'message') === 'string' ? errorField(error, 'message') : 'Sibling parent is invalid.', 'INVALID_SIBLING_TARGET', 422);
        }
        throw error;
    }
}
function readSiblingOrders(root) {
    const configPath = resolveAppConfigPath(root);
    let raw;
    try {
        raw = fs.readFileSync(configPath, 'utf8');
    }
    catch (error) {
        if (errorField(error, 'code') === 'ENOENT')
            return {};
        throw error;
    }
    const errors = [];
    const config = parseJsonc(raw, errors);
    if (errors.length || !isRecord(config))
        throw siblingError('Application config is malformed; sibling order cannot be read.', 'INVALID_NOTEBOOK_CONFIG');
    const notebook = isRecord(config.notebook) ? config.notebook : {};
    const order = isRecord(notebook.siblingOrder) ? notebook.siblingOrder : {};
    const result = {};
    for (const [parentPath, refs] of Object.entries(order)) {
        if (Array.isArray(refs))
            result[parentPath] = refs.filter(isNotebookSiblingRef);
    }
    return result;
}
function siblingOrderForParent(config, parentPath) {
    const notebook = isRecord(config.notebook) ? config.notebook : {};
    const order = isRecord(notebook.siblingOrder) ? notebook.siblingOrder : {};
    const refs = order[parentPath];
    return Array.isArray(refs) ? refs.filter(isNotebookSiblingRef) : undefined;
}
function sameSiblingOrder(left, right) {
    if (left === undefined || right === undefined)
        return left === right;
    return left.length === right.length && left.every((ref, index) => {
        const other = right[index];
        return other !== undefined && (ref.kind === 'folder' ? `folder\0${ref.path}` : `artifact\0${ref.id}`)
            === (other.kind === 'folder' ? `folder\0${other.path}` : `artifact\0${other.id}`);
    });
}
function assertOrdinaryConfigParent(root, filePath) {
    const parent = path.dirname(filePath);
    const relativeParent = path.relative(root, parent);
    if (relativeParent.startsWith('..') || path.isAbsolute(relativeParent)) {
        throw siblingError('Application config directory is outside the active Notebook.');
    }
    let current = root;
    for (const segment of relativeParent.split(path.sep).filter(Boolean)) {
        current = path.join(current, segment);
        let stat;
        try {
            stat = fs.lstatSync(current);
        }
        catch (error) {
            if (errorField(error, 'code') === 'ENOENT')
                throw siblingError('Application config directory does not exist.');
            throw error;
        }
        if (stat.isSymbolicLink() || !stat.isDirectory() || fs.realpathSync.native(current) !== current
            || !isInside(root, current)) {
            throw siblingError('Application config directory must be an ordinary directory inside the active Notebook.');
        }
    }
}
function persistSiblingOrders(root, parentPath, refs, expectedOrder) {
    const canonicalRoot = fs.realpathSync.native(root);
    const primaryPath = resolveAppConfigPrimaryWritePath(canonicalRoot);
    let sourcePath = resolveAppConfigPath(canonicalRoot);
    assertOrdinaryConfigParent(canonicalRoot, primaryPath);
    if (!isInside(canonicalRoot, primaryPath) || !isInside(canonicalRoot, sourcePath))
        throw siblingError('Application config path is outside the active Notebook.');
    try {
        if (fs.lstatSync(primaryPath).isSymbolicLink() || !isInside(canonicalRoot, fs.realpathSync.native(primaryPath))) {
            throw siblingError('Primary application config path resolves outside the active Notebook.');
        }
    }
    catch (error) {
        if (errorField(error, 'code') !== 'ENOENT')
            throw error;
    }
    try {
        if (fs.lstatSync(sourcePath).isSymbolicLink() || !isInside(canonicalRoot, fs.realpathSync.native(sourcePath))) {
            throw siblingError('Current application config path resolves outside the active Notebook.');
        }
    }
    catch (error) {
        if (errorField(error, 'code') !== 'ENOENT')
            throw error;
    }
    let raw;
    try {
        raw = fs.readFileSync(sourcePath, 'utf8');
    }
    catch (error) {
        if (errorField(error, 'code') === 'ENOENT')
            raw = '{\n}\n';
        else
            throw error;
    }
    const errors = [];
    const config = parseJsonc(raw, errors);
    if (errors.length || !isRecord(config))
        throw siblingError('Application config changed to malformed JSON; sibling order was not written.', 'INVALID_NOTEBOOK_CONFIG');
    const saved = siblingOrderForParent(config, parentPath);
    const inspected = inspectNotebook(canonicalRoot);
    if (!isRecord(inspected) || inspected.status !== 'valid')
        throw siblingError('The active Notebook catalog is invalid.', 'INVALID_NOTEBOOK', 422);
    const currentSiblings = resolveNotebookSiblingOrder(readDirectSiblings(canonicalRoot, parentPath, inspected), saved).map(item => item.ref);
    if (currentSiblings.length !== expectedOrder.length || currentSiblings.some((ref, index) => {
        const expected = expectedOrder[index];
        return !expected || (ref.kind === 'folder' ? `folder\0${ref.path}` : `artifact\0${ref.id}`)
            !== (expected.kind === 'folder' ? `folder\0${expected.path}` : `artifact\0${expected.id}`);
    }))
        throw siblingError('Sibling order changed while the request was being processed.', 'STALE_SIBLING_ORDER', 409);
    // Rebase onto the latest effective config so edits to unrelated settings (or
    // sibling orders in other parents) made during catalog validation survive.
    sourcePath = resolveAppConfigPath(canonicalRoot);
    try {
        if (fs.lstatSync(sourcePath).isSymbolicLink() || !isInside(canonicalRoot, fs.realpathSync.native(sourcePath))) {
            throw siblingError('Current application config path resolves outside the active Notebook.');
        }
    }
    catch (error) {
        if (errorField(error, 'code') !== 'ENOENT')
            throw error;
    }
    let latestRaw;
    try {
        latestRaw = fs.readFileSync(sourcePath, 'utf8');
    }
    catch (error) {
        if (errorField(error, 'code') === 'ENOENT')
            latestRaw = '{\n}\n';
        else
            throw error;
    }
    const latestErrors = [];
    const latestConfig = parseJsonc(latestRaw, latestErrors);
    if (latestErrors.length || !isRecord(latestConfig))
        throw siblingError('Application config changed to malformed JSON; sibling order was not written.', 'INVALID_NOTEBOOK_CONFIG');
    if (!sameSiblingOrder(saved, siblingOrderForParent(latestConfig, parentPath))) {
        throw siblingError('Sibling order config changed while the request was being processed.', 'STALE_SIBLING_ORDER', 409);
    }
    const edits = modify(latestRaw, ['notebook', 'siblingOrder', parentPath], refs, { formattingOptions: { insertSpaces: true, tabSize: 2, eol: latestRaw.includes('\r\n') ? '\r\n' : '\n' } });
    const next = applyEdits(latestRaw, edits);
    const temporary = `${primaryPath}.${process.pid}.${randomUUID()}.tmp`;
    try {
        fs.writeFileSync(temporary, next, { encoding: 'utf8', flag: 'wx' });
        let currentRaw;
        try {
            currentRaw = fs.readFileSync(sourcePath, 'utf8');
        }
        catch (error) {
            if (errorField(error, 'code') !== 'ENOENT')
                throw error;
            currentRaw = '{\n}\n';
        }
        if (resolveAppConfigPath(canonicalRoot) !== sourcePath || currentRaw !== latestRaw) {
            throw siblingError('Application config changed while sibling order was being written.', 'STALE_SIBLING_ORDER', 409);
        }
        fs.renameSync(temporary, primaryPath);
    }
    finally {
        try {
            fs.rmSync(temporary, { force: true });
        }
        catch { /* the atomic rename already succeeded */ }
    }
}
async function readReconciledState(runtime) {
    const first = readState(runtime);
    if (!first.notebook.needsPageRegistration && !first.notebook.needsNavigationRepair)
        return first;
    return withNotebookLock(first.notebookId, () => {
        const current = readState(runtime);
        if (current.notebook.needsPageRegistration || current.notebook.needsNavigationRepair) {
            // This GET path is the explicit catalog reconciliation boundary. The
            // writer persists both the reconciled manifest and stable artifact IDs;
            // inspectNotebook itself remains read-only.
            writeNotebookManifest(current.root, current.notebook.manifest);
            runtime?.refreshNotebook?.();
        }
        return readState(runtime);
    });
}
function atomicWriteManifest(root, manifest) {
    const canonicalRoot = fs.realpathSync.native(root);
    const target = resolveNotebookManifestPath(canonicalRoot);
    if (!isInside(canonicalRoot, target))
        throw scopeConflict('Notebook manifest path is outside the active Notebook.');
    try {
        if (fs.lstatSync(target).isSymbolicLink() || !isInside(canonicalRoot, fs.realpathSync.native(target))) {
            throw scopeConflict('Notebook manifest path resolves outside the active Notebook.');
        }
    }
    catch (error) {
        if (errorField(error, 'code') !== 'ENOENT')
            throw error;
    }
    const temporary = path.join(path.dirname(target), `${NOTEBOOK_MANIFEST_FILE}.${process.pid}.${randomUUID()}.tmp`);
    try {
        fs.writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
        fs.renameSync(temporary, target);
    }
    finally {
        try {
            fs.rmSync(temporary, { force: true });
        }
        catch { /* the atomic rename already succeeded */ }
    }
}
function sendFailure(res, sendJson, error) {
    const errorStatus = errorField(error, 'status');
    const code = errorField(error, 'code');
    const message = errorField(error, 'message');
    const detail = errorField(error, 'detail');
    const state = errorField(error, 'state');
    const metadata = errorField(error, 'metadata');
    const status = typeof errorStatus === 'number' && Number.isInteger(errorStatus) ? errorStatus
        : ['INVALID_NAVIGATION_OPERATION', 'INVALID_NOTEBOOK'].includes(typeof code === 'string' ? code : '') ? 422 : 500;
    return sendJson(res, status, {
        error: { code: typeof code === 'string' && code ? code : 'NOTEBOOK_NAVIGATION_FAILED', message: typeof message === 'string' && message ? message : 'Notebook navigation failed.' },
        ...(detail ? { diagnostics: detail } : {}),
        ...(state ? { current: state } : {}),
        ...(isRecord(metadata) ? metadata : {}),
    });
}
/** Notebook-scoped page catalog and revision-guarded layout routes. */
export function createNotebookNavigationRoutes({ runtime, sendJson, eventSender = () => { }, repairArtifact = repairNestedNotebookArtifact }) {
    return async function notebookNavigationRoutes(_req, res, { body = {}, path: requestPath = '/', method }) {
        try {
            if (!runtime)
                throw scopeConflict('There is no active Notebook.');
            const pathname = (requestPath.split('?', 1)[0] ?? '').replace(/\/$/, '') || '/';
            if (method === 'GET' && pathname === '/branch') {
                const scope = currentScope(runtime);
                return sendJson(res, 200, { ...scope, ...readNotebookGitBranch(scope.root) });
            }
            if (method === 'GET' && pathname === '/pages') {
                const state = await readReconciledState(runtime);
                return sendJson(res, 200, {
                    title: state.notebook.manifest.title || 'Notebook',
                    description: typeof state.notebook.manifest.description === 'string' ? state.notebook.manifest.description : '',
                    notebookId: state.notebookId,
                    generation: state.generation,
                    revision: state.revision,
                    pages: state.notebook.pages,
                    diagnostics: state.notebook.diagnostics,
                });
            }
            if (method === 'POST' && pathname === '/metadata') {
                if (!isRecord(body) || typeof body.notebookId !== 'string' || !Number.isSafeInteger(body.generation)
                    || typeof body.expectedRevision !== 'string' || typeof body.title !== 'string' || !body.title.trim()
                    || typeof body.description !== 'string') {
                    return sendJson(res, 400, { error: { code: 'INVALID_NOTEBOOK_METADATA', message: 'Notebook scope, a nonempty title, and description are required.' } });
                }
                const title = body.title.trim();
                const description = body.description.trim();
                const committed = await withNotebookLock(body.notebookId, () => {
                    const current = readState(runtime, body);
                    if (current.revision !== body.expectedRevision)
                        throw revisionConflict(current);
                    atomicWriteManifest(current.root, { ...current.notebook.manifest, title, description });
                    const updated = readState(runtime, body);
                    runtime.refreshNotebook?.();
                    return updated;
                });
                return sendJson(res, 200, { title, description, notebookId: committed.notebookId, generation: committed.generation, revision: committed.revision });
            }
            if (method === 'POST' && pathname === '/repair') {
                if (!isRecord(body) || typeof body.notebookId !== 'string' || typeof body.generation !== 'number' || !Number.isSafeInteger(body.generation)
                    || typeof body.expectedRevision !== 'string' || !isRecord(body.nestedArtifact) || typeof body.nestedArtifact.kind !== 'string'
                    || typeof body.nestedArtifact.path !== 'string' || !isRecord(body.containingArtifact)
                    || typeof body.containingArtifact.kind !== 'string' || typeof body.containingArtifact.path !== 'string'
                    || typeof body.expectedProposedDestination !== 'string') {
                    return sendJson(res, 400, { error: { code: 'INVALID_NESTED_ARTIFACT_REPAIR', message: 'Notebook scope, expectedRevision, nestedArtifact, containingArtifact, and expectedProposedDestination are required.' } });
                }
                const committed = await withNotebookLock(body.notebookId, () => {
                    const current = readState(runtime, body);
                    if (current.revision !== body.expectedRevision)
                        throw revisionConflict(current);
                    const result = repairArtifact(current.root, current.notebook, body);
                    runtime?.refreshNotebook?.();
                    const updated = readState(runtime, body);
                    try {
                        eventSender({
                            type: 'custom',
                            event: 'storyboard:notebook-artifact-repaired',
                            data: { notebookId: updated.notebookId, generation: updated.generation, revision: updated.revision, repaired: result.repaired },
                        });
                    }
                    catch { /* persistence succeeds even if a connected client cannot be notified */ }
                    return { ...result, notebookId: updated.notebookId, generation: updated.generation, revision: updated.revision };
                }).catch((error) => {
                    const metadata = errorField(error, 'metadata');
                    if (errorField(error, 'code') === 'NESTED_ARTIFACT_REPAIR_FAILED' && isRecord(metadata) && metadata.moved === true) {
                        try {
                            const current = readState(runtime);
                            metadata.current = { notebookId: current.notebookId, generation: current.generation, revision: current.revision,
                                pages: current.notebook.pages, artifacts: current.notebook.artifacts, diagnostics: current.notebook.diagnostics };
                        }
                        catch {
                            metadata.current = null;
                        }
                    }
                    throw error;
                });
                return sendJson(res, 200, { success: true, ...committed });
            }
            if (method === 'POST' && pathname.startsWith('/migration/')) {
                const action = pathname.slice('/migration/'.length);
                if (action === 'preview') {
                    if (!isRecord(body) || typeof body.notebookId !== 'string' || typeof body.generation !== 'number'
                        || !Number.isSafeInteger(body.generation) || typeof body.expectedRevision !== 'string') {
                        return sendJson(res, 400, { error: { code: 'INVALID_MIGRATION_REQUEST', message: 'Notebook scope, generation and expectedRevision are required.' } });
                    }
                    const preview = await withNotebookLock(body.notebookId, () => {
                        const current = readState(runtime, body);
                        if (current.revision !== body.expectedRevision)
                            throw revisionConflict(current);
                        return previewNotebookArtifactMigration(current.root, body);
                    });
                    return sendJson(res, 200, preview);
                }
                if (action === 'apply') {
                    if (!isRecord(body) || typeof body.notebookId !== 'string' || typeof body.generation !== 'number'
                        || !Number.isSafeInteger(body.generation) || typeof body.expectedRevision !== 'string'
                        || typeof body.planId !== 'string' || typeof body.planDigest !== 'string' || typeof body.acceptRouteChanges !== 'boolean') {
                        return sendJson(res, 400, { error: { code: 'INVALID_MIGRATION_APPLY_REQUEST', message: 'Notebook scope, expectedRevision, planId, planDigest and acceptRouteChanges are required.' } });
                    }
                    const result = await withNotebookLock(body.notebookId, () => {
                        const current = readState(runtime, body);
                        try {
                            const applied = applyNotebookArtifactMigration(current.root, body);
                            runtime.refreshNotebook?.();
                            return applied;
                        }
                        catch (error) {
                            const metadata = errorField(error, 'metadata');
                            if (errorField(error, 'code') === 'MIGRATION_INTERRUPTED' && isRecord(metadata) && metadata.movedAny === true) {
                                runtime.refreshNotebook?.();
                                try {
                                    const updated = readState(runtime);
                                    metadata.current = { notebookId: updated.notebookId, generation: updated.generation, revision: updated.revision,
                                        pages: updated.notebook.pages, artifacts: updated.notebook.artifacts, diagnostics: updated.notebook.diagnostics };
                                }
                                catch {
                                    metadata.current = null;
                                }
                            }
                            throw error;
                        }
                    });
                    return sendJson(res, 200, result);
                }
                if (action === 'recover') {
                    if (!isRecord(body) || typeof body.notebookId !== 'string' || typeof body.generation !== 'number'
                        || !Number.isSafeInteger(body.generation) || typeof body.migrationId !== 'string'
                        || typeof body.expectedJournalRevision !== 'string' || (body.action !== 'resume' && body.action !== 'rollback')) {
                        return sendJson(res, 400, { error: { code: 'INVALID_MIGRATION_RECOVERY_REQUEST', message: 'Notebook scope, migrationId, expectedJournalRevision and action are required.' } });
                    }
                    const result = await withNotebookLock(body.notebookId, () => {
                        const current = currentScope(runtime, body);
                        const recovered = recoverNotebookArtifactMigration(current.root, body);
                        runtime.refreshNotebook?.();
                        return recovered;
                    });
                    return sendJson(res, 200, result);
                }
            }
            if (method === 'GET' && pathname === '/navigation') {
                const state = await readReconciledState(runtime);
                return sendJson(res, 200, {
                    title: state.notebook.manifest.title || 'Notebook',
                    notebookId: state.notebookId,
                    generation: state.generation,
                    revision: state.revision,
                    navigation: state.notebook.manifest.navigation,
                    tree: buildNotebookNavigationTree(state.root, state.notebook, readSiblingOrders(state.root)),
                    diagnostics: state.notebook.diagnostics,
                });
            }
            if (method === 'POST' && pathname === '/navigation') {
                if (!isRecord(body) || typeof body.notebookId !== 'string' || typeof body.generation !== 'number' || !Number.isInteger(body.generation)
                    || typeof body.expectedRevision !== 'string' || !body.operation) {
                    return sendJson(res, 400, { error: { code: 'INVALID_NAVIGATION_REQUEST', message: 'notebookId, generation, expectedRevision, and operation are required.' } });
                }
                const committed = await withNotebookLock(body.notebookId, () => {
                    const current = readState(runtime, body);
                    if (current.revision !== body.expectedRevision)
                        throw revisionConflict(current);
                    const operation = assertNavigationOperation(body.operation);
                    if (operation.type === 'reorderSiblings') {
                        const parentPath = siblingParentPath(operation.parentPath);
                        const siblingItems = readDirectSiblings(current.root, parentPath, current.notebook);
                        const saved = readSiblingOrders(current.root)[parentPath];
                        const currentOrder = resolveNotebookSiblingOrder(siblingItems, saved).map(item => item.ref);
                        let nextOrder;
                        try {
                            nextOrder = applySiblingReorder(currentOrder, { ...operation, parentPath });
                        }
                        catch (error) {
                            if (errorField(error, 'code') === 'STALE_SIBLING_ORDER') {
                                throw Object.assign(error instanceof Error ? error : new Error('Sibling order changed.'), { status: 409 });
                            }
                            if (errorField(error, 'code') === 'INVALID_SIBLING_TARGET') {
                                throw siblingError(typeof errorField(error, 'message') === 'string' ? errorField(error, 'message') : 'Sibling target is invalid.', 'INVALID_SIBLING_TARGET', 422);
                            }
                            throw siblingError(typeof errorField(error, 'message') === 'string' ? errorField(error, 'message') : 'Sibling reorder is invalid.');
                        }
                        const beforeWrite = readState(runtime, body);
                        if (beforeWrite.revision !== body.expectedRevision)
                            throw revisionConflict(beforeWrite);
                        persistSiblingOrders(beforeWrite.root, parentPath, nextOrder, currentOrder);
                        try {
                            eventSender({
                                type: 'custom',
                                event: 'storyboard:notebook-order-changed',
                                data: { notebookId: current.notebookId, generation: current.generation, parentPath, siblingOrder: nextOrder },
                            });
                        }
                        catch { /* persistence succeeds even if a connected client cannot be notified */ }
                        return { siblingOrder: nextOrder, revision: current.revision, notebookId: current.notebookId, generation: current.generation };
                    }
                    const navigation = applyNavigationOperation(current.notebook.manifest.navigation, current.notebook.pages, operation);
                    const beforeWrite = readState(runtime, body);
                    if (beforeWrite.revision !== body.expectedRevision)
                        throw revisionConflict(beforeWrite);
                    const nextManifest = { ...beforeWrite.notebook.manifest, navigation };
                    atomicWriteManifest(beforeWrite.root, nextManifest);
                    const updated = readState(runtime, body);
                    runtime?.refreshNotebook?.();
                    try {
                        eventSender({
                            type: 'custom',
                            event: 'storyboard:notebook-layout-updated',
                            data: { notebookId: updated.notebookId, generation: updated.generation, revision: updated.revision, navigation },
                        });
                    }
                    catch { /* persistence succeeds even if a connected client cannot be notified */ }
                    return updated;
                });
                if ('siblingOrder' in committed) {
                    return sendJson(res, 200, {
                        notebookId: committed.notebookId,
                        generation: committed.generation,
                        revision: committed.revision,
                        siblingOrder: committed.siblingOrder,
                    });
                }
                return sendJson(res, 200, {
                    notebookId: committed.notebookId,
                    generation: committed.generation,
                    revision: committed.revision,
                    navigation: committed.notebook.manifest.navigation,
                });
            }
            return sendJson(res, 404, { error: { code: 'ROUTE_NOT_FOUND', message: `Unknown Notebook navigation route: ${method} ${pathname}` } });
        }
        catch (error) {
            return sendFailure(res, sendJson, error);
        }
    };
}
export const __test = { atomicWriteManifest, manifestRevision, withNotebookLock };
