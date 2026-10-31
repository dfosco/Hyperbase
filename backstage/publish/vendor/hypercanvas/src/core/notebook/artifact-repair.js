import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { NOTEBOOK_INFRASTRUCTURE_DIRECTORIES } from '../site/site.js';
import { artifactFolderLogicalName } from '../artifact/visibility.js';
import { inspectNotebook, NOTEBOOK_ARTIFACT_MARKER_FILE, writeNotebookManifest, } from './notebook.js';
const SUFFIX_KIND = {
    '.prototype': 'prototype', '.component': 'component', '.canvas': 'canvas', '.site': 'site',
};
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function repairError(code, message, status, metadata) {
    return Object.assign(new Error(message), { code, status, ...(metadata ? { metadata } : {}) });
}
function artifactKind(name) {
    for (const [suffix, kind] of Object.entries(SUFFIX_KIND)) {
        if (name.length > suffix.length && name.endsWith(suffix))
            return kind;
    }
    return null;
}
function isArtifactKind(value) {
    return value === 'prototype' || value === 'component' || value === 'canvas' || value === 'site';
}
function normalizedPath(value, field) {
    if (typeof value !== 'string' || !value || value.includes('\\') || value.startsWith('/') || path.posix.isAbsolute(value)) {
        throw repairError('INVALID_REPAIR_PATH', `${field} must be a normalized notebook-relative POSIX path.`, 422);
    }
    const parts = value.split('/');
    if (parts.some(part => !part || part === '.' || part === '..') || path.posix.normalize(value) !== value) {
        throw repairError('INVALID_REPAIR_PATH', `${field} must be a normalized notebook-relative POSIX path.`, 422);
    }
    return value;
}
function isInside(root, target) {
    const relative = path.relative(root, target);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}
function lstatOrNull(target) {
    try {
        return fs.lstatSync(target);
    }
    catch (error) {
        if (isRecord(error) && error.code === 'ENOENT')
            return null;
        throw error;
    }
}
function assertSafeDirectoryChain(root, relativePath, allowMissingLeaf = false) {
    const absolute = path.resolve(root, ...relativePath.split('/'));
    if (!isInside(root, absolute))
        throw repairError('INVALID_REPAIR_PATH', 'Artifact path resolves outside the active Notebook.', 422);
    const segments = relativePath ? relativePath.split('/') : [];
    let cursor = root;
    for (const [index, segment] of segments.entries()) {
        cursor = path.join(cursor, segment);
        const stat = lstatOrNull(cursor);
        if (!stat && allowMissingLeaf && index === segments.length - 1)
            return absolute;
        if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) {
            throw repairError('INVALID_REPAIR_PATH', `Artifact path component ${segments.slice(0, index + 1).join('/')} must be a real directory inside the Notebook.`, 422);
        }
        const real = fs.realpathSync.native(cursor);
        if (!isInside(root, real))
            throw repairError('INVALID_REPAIR_PATH', 'Artifact path resolves outside the active Notebook.', 422);
    }
    return absolute;
}
function markerIdentity(root, artifactPath, kind) {
    const markerPath = path.join(root, ...artifactPath.split('/'), NOTEBOOK_ARTIFACT_MARKER_FILE);
    const stat = lstatOrNull(markerPath);
    if (!stat)
        return { id: null, invalid: false };
    if (!stat.isFile() || stat.isSymbolicLink())
        return { id: null, invalid: true };
    try {
        const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
        if (!isRecord(marker) || marker.formatVersion !== 1 || typeof marker.id !== 'string' || !marker.id.trim() || marker.kind !== kind) {
            return { id: null, invalid: true };
        }
        return { id: marker.id, invalid: false };
    }
    catch {
        return { id: null, invalid: true };
    }
}
function scanPhysicalArtifacts(root) {
    const found = [];
    const walk = (directory, relative) => {
        let entries;
        try {
            entries = fs.readdirSync(directory, { withFileTypes: true });
        }
        catch {
            return;
        }
        entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
        for (const entry of entries) {
            if (entry.isSymbolicLink() || !entry.isDirectory() || NOTEBOOK_INFRASTRUCTURE_DIRECTORIES.has(entry.name))
                continue;
            const itemPath = relative ? `${relative}/${entry.name}` : entry.name;
            const kind = artifactKind(entry.name);
            if (kind) {
                const marker = markerIdentity(root, itemPath, kind);
                found.push({ kind, path: itemPath, markerId: marker.id, markerInvalid: marker.invalid });
            }
            walk(path.join(directory, entry.name), itemPath);
        }
    };
    walk(root, '');
    return found;
}
function registrationMatches(snapshot, artifact, payloadPath) {
    return snapshot.manifest.pages.filter(page => page.type === artifact.kind && typeof page.path === 'string'
        && (page.path.replaceAll('\\', '/') === artifact.path || page.path.replaceAll('\\', '/') === payloadPath));
}
function provisionalId(kind, originalPath) {
    const suffix = createHash('sha256').update(originalPath).digest('hex').slice(0, 20);
    return `artifact-${kind}-${suffix}`;
}
function readDiagnostic(snapshot, nested) {
    return snapshot.diagnostics.find(item => item.code === 'NESTED_ARTIFACT'
        && item.nestedArtifact?.kind === nested.kind && item.nestedArtifact.path === nested.path);
}
function staleRepair(snapshot) {
    return repairError('STALE_REPAIR_TARGET', 'The nested artifact or its closest valid destination changed. Reload the Notebook tree before repairing.', 409, { diagnostics: snapshot.diagnostics });
}
function physicalChain(artifactPath) {
    const components = artifactPath.split('/');
    const ancestors = [];
    for (let index = 1; index < components.length; index += 1) {
        const candidate = components.slice(0, index).join('/');
        if (artifactKind(path.posix.basename(candidate)))
            ancestors.push(candidate);
    }
    return ancestors;
}
function safeArtifactFolder(root, item) {
    return assertSafeDirectoryChain(root, item.path);
}
function writeMarker(folder, marker) {
    const target = path.join(folder, NOTEBOOK_ARTIFACT_MARKER_FILE);
    const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
    try {
        fs.writeFileSync(temporary, `${JSON.stringify(marker, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
        fs.renameSync(temporary, target);
    }
    finally {
        try {
            fs.rmSync(temporary, { force: true });
        }
        catch { /* handled by caller */ }
    }
}
function destinationPayloadPath(root, destination, kind) {
    const destinationAbsolute = path.join(root, ...destination.split('/'));
    if (kind === 'canvas') {
        const expected = `${artifactFolderLogicalName(path.posix.basename(destination))}.canvas.jsonl`;
        return fs.existsSync(path.join(destinationAbsolute, expected)) ? `${destination}/${expected}` : null;
    }
    if (kind === 'prototype') {
        const source = fs.readdirSync(destinationAbsolute).find(name => /^index\.(jsx|js|tsx|ts|mdx)$/.test(name));
        return source ? `${destination}/${source}` : null;
    }
    if (kind === 'component') {
        const logical = artifactFolderLogicalName(path.posix.basename(destination));
        const source = fs.readdirSync(destinationAbsolute).find(name => name.startsWith(`${logical}.story.`));
        return source ? `${destination}/${source}` : null;
    }
    return fs.existsSync(path.join(destinationAbsolute, 'site.config.json')) ? `${destination}/site.config.json` : null;
}
function sourcePayloadPath(root, artifactPath, kind) {
    const folder = path.join(root, ...artifactPath.split('/'));
    const basename = path.posix.basename(artifactPath);
    const logical = artifactFolderLogicalName(basename);
    const entries = fs.readdirSync(folder, { withFileTypes: true });
    let filename;
    if (kind === 'canvas')
        filename = `${logical}.canvas.jsonl`;
    else if (kind === 'component')
        filename = entries.find(entry => entry.isFile() && entry.name.startsWith(`${logical}.story.`))?.name;
    else if (kind === 'prototype')
        filename = entries.find(entry => entry.isFile() && /^index\.(jsx|js|tsx|ts|mdx)$/.test(entry.name))?.name
            || entries.find(entry => entry.isFile() && entry.name === `${logical}.prototype.json`)?.name;
    else
        filename = 'site.config.json';
    return filename && fs.existsSync(path.join(folder, filename)) ? `${artifactPath}/${filename}` : null;
}
/** Move a currently nested artifact to the closest ancestor outside every artifact boundary. */
export function repairNestedNotebookArtifact(rootInput, snapshotInput, request, { reconcile = writeNotebookManifest } = {}) {
    if (snapshotInput.status !== 'valid')
        throw repairError('INVALID_NOTEBOOK', 'The active Notebook catalog is invalid.', 422, { diagnostics: snapshotInput.diagnostics });
    const root = fs.realpathSync.native(rootInput);
    const nestedPath = normalizedPath(request?.nestedArtifact?.path, 'nestedArtifact.path');
    const containingPath = normalizedPath(request?.containingArtifact?.path, 'containingArtifact.path');
    const expectedDestination = normalizedPath(request?.expectedProposedDestination, 'expectedProposedDestination');
    const kind = request?.nestedArtifact?.kind;
    const containingKind = request?.containingArtifact?.kind;
    if (!isArtifactKind(kind) || !isArtifactKind(containingKind)) {
        throw repairError('INVALID_NESTED_ARTIFACT_REPAIR', 'Artifact kinds must be prototype, component, canvas, or site.', 400);
    }
    const currentDiagnostic = readDiagnostic(snapshotInput, { kind, path: nestedPath });
    if (!currentDiagnostic || currentDiagnostic.containingArtifact?.kind !== containingKind || currentDiagnostic.containingArtifact.path !== containingPath
        || currentDiagnostic.proposedDestination !== expectedDestination)
        throw staleRepair(snapshotInput);
    const nested = normalizedPath(currentDiagnostic.nestedArtifact?.path, 'nestedArtifact.path');
    const repairParentPath = currentDiagnostic.repairParentPath || '';
    const proposedDestination = normalizedPath(currentDiagnostic.proposedDestination, 'proposedDestination');
    const parentAbsolute = repairParentPath ? assertSafeDirectoryChain(root, normalizedPath(repairParentPath, 'repairParentPath')) : root;
    const ancestors = physicalChain(nested);
    if (ancestors.length === 0 || ancestors.at(-1) !== containingPath)
        throw staleRepair(snapshotInput);
    const expectedParent = path.posix.dirname(ancestors[0]);
    const computedParent = expectedParent === '.' ? '' : expectedParent;
    const computedDestination = path.posix.join(computedParent, path.posix.basename(nested));
    if (computedParent !== repairParentPath || computedDestination !== proposedDestination)
        throw staleRepair(snapshotInput);
    const physical = scanPhysicalArtifacts(root);
    const selected = physical.find(item => item.path === nested && item.kind === kind);
    if (!selected)
        throw staleRepair(snapshotInput);
    const sourceAbsolute = safeArtifactFolder(root, selected);
    const parentStat = fs.lstatSync(parentAbsolute);
    if (!parentStat.isDirectory() || parentStat.isSymbolicLink())
        throw repairError('INVALID_REPAIR_PATH', 'Repair parent must be a real directory inside the Notebook.', 422);
    if (!isInside(root, fs.realpathSync.native(parentAbsolute)))
        throw repairError('INVALID_REPAIR_PATH', 'Repair parent resolves outside the active Notebook.', 422);
    const destinationAbsolute = path.resolve(root, ...proposedDestination.split('/'));
    if (!isInside(root, destinationAbsolute))
        throw repairError('INVALID_REPAIR_PATH', 'Repair destination resolves outside the active Notebook.', 422);
    const occupied = lstatOrNull(destinationAbsolute);
    if (occupied)
        throw repairError('REPAIR_DESTINATION_OCCUPIED', `Repair destination already exists: ${proposedDestination}`, 409, { occupiedPath: proposedDestination });
    const selectedPayload = sourcePayloadPath(root, nested, kind);
    const registrations = registrationMatches(snapshotInput, selected, selectedPayload);
    const registeredIds = new Set(registrations.map(page => page.id).filter((id) => typeof id === 'string' && !!id.trim()));
    if (selected.markerInvalid || registeredIds.size > 1) {
        throw repairError('NESTED_ARTIFACT_IDENTITY_CONFLICT', `Artifact identity at ${nested} cannot be resolved without guessing.`, 409, { diagnostics: snapshotInput.diagnostics });
    }
    const registeredId = registeredIds.values().next().value;
    if (selected.markerId && registeredId && selected.markerId !== registeredId) {
        throw repairError('NESTED_ARTIFACT_IDENTITY_CONFLICT', `Artifact marker and registered page disagree for ${nested}.`, 409, { diagnostics: snapshotInput.diagnostics });
    }
    const id = selected.markerId || registeredId || provisionalId(kind, nested);
    for (const other of physical) {
        if (other.path === nested)
            continue;
        if (other.markerInvalid)
            continue;
        const otherPayload = sourcePayloadPath(root, other.path, other.kind);
        const matchingPages = registrationMatches(snapshotInput, other, otherPayload);
        const otherIds = new Set(matchingPages.map(page => page.id).filter((pageId) => typeof pageId === 'string' && !!pageId.trim()));
        if (otherIds.size > 1 || (other.markerId && otherIds.size === 1 && !otherIds.has(other.markerId))) {
            throw repairError('NESTED_ARTIFACT_IDENTITY_CONFLICT', `Artifact identity at ${other.path} cannot be resolved without guessing.`, 409, { diagnostics: snapshotInput.diagnostics });
        }
        const otherId = other.markerId || (otherIds.size === 1 ? otherIds.values().next().value : null) || provisionalId(other.kind, other.path);
        if (otherId === id) {
            throw repairError('NESTED_ARTIFACT_IDENTITY_CONFLICT', `Artifact identity "${id}" is also used by ${other.path}.`, 409, { diagnostics: snapshotInput.diagnostics });
        }
    }
    const pathMatches = new Set([nested, selectedPayload].filter((item) => typeof item === 'string'));
    const matchingPages = snapshotInput.manifest.pages.filter(page => page.type === kind && typeof page.path === 'string' && pathMatches.has(page.path.replaceAll('\\', '/')));
    if (matchingPages.length > 1)
        throw repairError('NESTED_ARTIFACT_IDENTITY_CONFLICT', `Multiple registered pages match ${nested}; repair was refused.`, 409, { diagnostics: snapshotInput.diagnostics });
    // Re-read the physical catalog immediately before the move. Inspection is read-only; it only makes the explicit repair action safer.
    const liveSnapshot = inspectNotebook(root);
    if (liveSnapshot.status !== 'valid')
        throw staleRepair(snapshotInput);
    const liveDiagnostic = readDiagnostic(liveSnapshot, { kind, path: nested });
    if (!liveDiagnostic || liveDiagnostic.containingArtifact?.kind !== containingKind || liveDiagnostic.containingArtifact.path !== containingPath
        || liveDiagnostic.repairParentPath !== repairParentPath || liveDiagnostic.proposedDestination !== proposedDestination)
        throw staleRepair(liveSnapshot);
    const liveSelected = scanPhysicalArtifacts(root).find(item => item.path === nested && item.kind === kind);
    if (!liveSelected || liveSelected.markerInvalid || liveSelected.markerId !== selected.markerId)
        throw staleRepair(liveSnapshot);
    safeArtifactFolder(root, liveSelected);
    if (lstatOrNull(destinationAbsolute)) {
        throw repairError('REPAIR_DESTINATION_OCCUPIED', `Repair destination already exists: ${proposedDestination}`, 409, { occupiedPath: proposedDestination });
    }
    // Reserve the exact target with an empty directory before rename. This makes an existing or concurrently created target fail closed.
    let reserved = false;
    let moved = false;
    try {
        fs.mkdirSync(destinationAbsolute);
        reserved = true;
        fs.renameSync(sourceAbsolute, destinationAbsolute);
        reserved = false;
        moved = true;
        const movedMarker = markerIdentity(root, proposedDestination, kind);
        if (!movedMarker.id)
            writeMarker(destinationAbsolute, { formatVersion: 1, id, kind });
        const newPayload = destinationPayloadPath(root, proposedDestination, kind);
        const pages = snapshotInput.manifest.pages.map(page => {
            if (page !== matchingPages[0])
                return page;
            const oldPagePath = typeof page.path === 'string' ? page.path.replaceAll('\\', '/') : '';
            const nextPath = oldPagePath === nested ? proposedDestination : newPayload || proposedDestination;
            return { ...page, id, path: nextPath };
        });
        const reconciled = reconcile(root, { ...snapshotInput.manifest, pages });
        if (reconciled.status !== 'valid')
            throw new Error('Notebook reconciliation returned an invalid catalog.');
        const repairedArtifact = reconciled.artifacts.find(item => item.folderPath === proposedDestination && item.kind === kind);
        const repairedId = repairedArtifact?.id || id;
        if (repairedId !== id)
            throw new Error('Reconciled artifact identity changed unexpectedly.');
        return {
            repaired: { id, kind, fromPath: nested, toPath: proposedDestination },
            repairParentPath,
            proposedDestination,
            diagnostics: reconciled.diagnostics,
        };
    }
    catch (error) {
        if (reserved) {
            try {
                fs.rmdirSync(destinationAbsolute);
            }
            catch { /* destination changed; preserve it */ }
        }
        if (moved) {
            let diagnostics = [];
            try {
                const current = inspectNotebook(root);
                diagnostics = current.diagnostics;
            }
            catch { /* error metadata still reports the committed location */ }
            throw repairError('NESTED_ARTIFACT_REPAIR_FAILED', error instanceof Error ? error.message : String(error), 500, {
                fromPath: nested, toPath: proposedDestination, moved: true, diagnostics,
            });
        }
        if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
            throw repairError('REPAIR_DESTINATION_OCCUPIED', `Repair destination already exists: ${proposedDestination}`, 409, { occupiedPath: proposedDestination });
        }
        throw repairError('NESTED_ARTIFACT_REPAIR_FAILED', error instanceof Error ? error.message : String(error), 500, {
            fromPath: nested, toPath: proposedDestination, moved: false, diagnostics: snapshotInput.diagnostics,
        });
    }
}
