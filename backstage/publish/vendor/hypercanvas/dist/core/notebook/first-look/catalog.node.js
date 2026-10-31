/**
 * Read-only catalog integration for portable first-look artifacts.
 *
 * Portable identity comes from the pinned descriptors and Canvas headers. The
 * legacy Hypercanvas reader keeps its markers, manifests, aggregate Sites, and
 * name routes. This module never writes. It maps scanner results into the
 * Notebook artifact shape, claims their folders away from the legacy reader,
 * and reports portable/legacy identity conflicts instead of choosing a winner.
 */
import fs from 'node:fs';
import path from 'node:path';
import { notebookRouteCollisionKey } from '../artifact-migration-aliases.js';
import { isFirstLookId } from './contract.js';
import { discoverFirstLookNotebook } from './discovery.node.js';
import { buildArtifactPath } from './routes.js';
// Same file name as the legacy Hypercanvas artifact marker (notebook.ts).
const LEGACY_ARTIFACT_MARKER_FILE = '.hypercanvas-artifact.json';
export const FIRST_LOOK_DIAGNOSTIC_SOURCE = 'first-look';
function tagged(diagnostic) {
    return { ...diagnostic, source: FIRST_LOOK_DIAGNOSTIC_SOURCE };
}
function routeFor(artifact) {
    if (!isFirstLookId(artifact.id))
        return null;
    try {
        return buildArtifactPath({ id: artifact.id, kind: artifact.kind, views: artifact.views });
    }
    catch {
        return null;
    }
}
// Legacy artifact folders use the artifact folder as their folderPath; a portable
// Doc uses its file path (or its wrapper folder when wrapped) as the folder.
function catalogFolderPath(artifact) {
    if (artifact.kind !== 'doc')
        return artifact.folderPath || artifact.path;
    return artifact.wrapped ? artifact.folderPath : artifact.path;
}
function toNotebookArtifact(artifact) {
    const diagnostics = artifact.diagnostics.map(tagged);
    return {
        id: artifact.id,
        kind: artifact.kind,
        folderPath: catalogFolderPath(artifact),
        payloadPath: artifact.payloadPath,
        title: artifact.title,
        route: routeFor(artifact),
        visible: true,
        available: artifact.available,
        portable: true,
        descriptorPath: artifact.descriptorPath,
        descriptor: artifact.descriptor ? structuredClone(artifact.descriptor) : undefined,
        ...(artifact.kind === 'prototype' ? {
            runtime: artifact.descriptor?.runtime && typeof artifact.descriptor.runtime === 'object'
                ? structuredClone(artifact.descriptor.runtime)
                : undefined,
            entry: artifact.entry,
            views: structuredClone(artifact.views),
        } : {}),
        references: [...artifact.references],
        resolvedReferences: [...(artifact.resolvedReferences ?? [])],
        diagnostics,
    };
}
/** Read the portable catalog. Pure reads only; no file is created, changed, or migrated. */
export function readPortableCatalog(root) {
    const discovery = discoverFirstLookNotebook(root);
    const artifacts = discovery.artifacts.map(toNotebookArtifact);
    const claimedLocators = new Set(artifacts.flatMap(artifact => [artifact.folderPath, artifact.payloadPath]
        .filter((value) => typeof value === 'string')));
    // Scanner-level diagnostics (nested artifacts, wrappers, unreadable folders) are not owned by one artifact.
    const attached = new Set(discovery.artifacts.flatMap(artifact => artifact.diagnostics));
    const scannerDiagnostics = discovery.diagnostics.filter(item => !attached.has(item)).map(tagged);
    return {
        artifacts,
        claimedLocators,
        diagnostics: [...artifacts.flatMap(artifact => artifact.diagnostics), ...scannerDiagnostics],
    };
}
function markFailed(artifact, diagnostic) {
    artifact.available = false;
    artifact.diagnostics.push(diagnostic);
}
function hasCode(artifact, code, id) {
    return artifact.diagnostics.some(item => item.code === code && (id === undefined || item.id === id));
}
/**
 * Compare a portable identity with a legacy `.hypercanvas-artifact.json` marker in
 * the same artifact folder. Mismatches and malformed markers block the artifact.
 */
export function reportMarkerConflicts(root, artifacts) {
    const found = [];
    for (const artifact of artifacts) {
        // Only folders carry markers. A direct Doc file has no folder, so it is skipped.
        if (artifact.kind === 'doc' && !artifact.folderPath.endsWith('.doc'))
            continue;
        const markerPath = path.join(root, artifact.folderPath, LEGACY_ARTIFACT_MARKER_FILE);
        let markerStat;
        try {
            markerStat = fs.lstatSync(markerPath);
        }
        catch {
            continue;
        }
        const markerRelative = `${artifact.folderPath}/${LEGACY_ARTIFACT_MARKER_FILE}`;
        if (!markerStat.isFile()) {
            const item = tagged({
                code: 'INVALID_ARTIFACT_IDENTITY',
                message: `Legacy identity marker ${markerRelative} must be a regular file. Remove it or replace it with a matching portable identity.`,
                path: markerRelative,
            });
            markFailed(artifact, item);
            found.push(item);
            continue;
        }
        let marker;
        try {
            marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
        }
        catch {
            const item = tagged({
                code: 'INVALID_ARTIFACT_IDENTITY',
                message: `Legacy identity marker ${markerRelative} is not valid JSON. Repair it before opening this artifact.`,
                path: markerRelative,
            });
            markFailed(artifact, item);
            found.push(item);
            continue;
        }
        const record = typeof marker === 'object' && marker !== null && !Array.isArray(marker) ? marker : {};
        if (typeof record.id !== 'string' || !record.id.trim())
            continue;
        if (artifact.id !== null && record.id !== artifact.id) {
            const item = tagged({
                code: 'ARTIFACT_IDENTITY_CONFLICT',
                message: `Portable id "${artifact.id}" at ${artifact.folderPath} conflicts with legacy marker id "${record.id}". Resolve the conflict before using either identity.`,
                path: artifact.folderPath,
                id: artifact.id,
                legacyId: record.id,
            });
            markFailed(artifact, item);
            found.push(item);
        }
    }
    return found;
}
/**
 * A legacy manifest page registered at a portable artifact's path is superseded by
 * the portable artifact. A different page ID is an identity conflict.
 */
export function supersededRegistrations(artifacts, pages) {
    const diagnostics = [];
    const kept = pages.filter(page => {
        const locator = typeof page.path === 'string' ? page.path.replaceAll('\\', '/') : null;
        if (!locator)
            return true;
        const owner = artifacts.find(artifact => artifact.kind === page.type && (artifact.kind === 'doc'
            ? locator === artifact.payloadPath
            : locator === artifact.folderPath || locator === artifact.payloadPath));
        if (!owner)
            return true;
        if (typeof page.id === 'string' && owner.id !== null && page.id !== owner.id) {
            const item = tagged({
                code: 'ARTIFACT_IDENTITY_CONFLICT',
                message: `Legacy page registration "${page.id}" at ${locator} conflicts with portable id "${owner.id}". Resolve the conflict before using either identity.`,
                path: owner.folderPath,
                id: owner.id,
                legacyId: page.id,
            });
            markFailed(owner, item);
            diagnostics.push(item);
        }
        return false;
    });
    return { pages: kept, diagnostics };
}
/** Duplicate IDs and canonical route collisions across portable and legacy artifacts. */
export function reportCrossCatalogConflicts(artifacts) {
    const found = [];
    const byId = new Map();
    for (const artifact of artifacts) {
        if (typeof artifact.id !== 'string')
            continue;
        byId.set(artifact.id, [...(byId.get(artifact.id) ?? []), artifact]);
    }
    for (const [id, matches] of byId) {
        if (matches.length < 2 || !matches.some(artifact => artifact.portable === true))
            continue;
        const paths = matches.map(match => match.folderPath);
        for (const artifact of matches) {
            if (hasCode(artifact, 'DUPLICATE_ARTIFACT_ID', id))
                continue;
            const item = tagged({
                code: 'DUPLICATE_ARTIFACT_ID',
                message: `Artifact identity "${id}" is shared by ${paths.join(' and ')}; assign distinct IDs before using either artifact.`,
                path: artifact.folderPath,
                id,
                paths,
            });
            markFailed(artifact, item);
            found.push(item);
        }
    }
    const byRoute = new Map();
    for (const artifact of artifacts) {
        if (!artifact.available || !artifact.route)
            continue;
        const key = notebookRouteCollisionKey(artifact.route);
        byRoute.set(key, [...(byRoute.get(key) ?? []), artifact]);
    }
    for (const matches of byRoute.values()) {
        if (matches.length < 2 || !matches.some(artifact => artifact.portable === true))
            continue;
        const routes = [...new Set(matches.map(match => match.route))];
        for (const artifact of matches) {
            const item = tagged({
                code: 'ARTIFACT_ROUTE_CONFLICT',
                message: `Canonical artifact route${routes.length === 1 ? '' : 's'} ${routes.map(route => `"${route}"`).join(' / ')} conflict across ${matches.map(match => match.folderPath).join(' and ')}; re-route these artifacts before use.`,
                path: artifact.folderPath,
            });
            markFailed(artifact, item);
            found.push(item);
        }
    }
    return found;
}
/** Manifest-shaped page records for portable artifacts; they are in-memory only and never persisted. */
export function portablePageRecords(artifacts) {
    return artifacts.flatMap(artifact => {
        if (typeof artifact.id !== 'string')
            return [];
        const pagePath = artifact.kind === 'canvas' || artifact.kind === 'doc' ? artifact.payloadPath : artifact.folderPath;
        if (!pagePath)
            return [];
        const record = {
            id: artifact.id,
            type: artifact.kind,
            title: artifact.title,
            path: pagePath,
            route: artifact.route,
            portable: true,
            ...(artifact.kind === 'site' ? { siteId: artifact.id } : {}),
        };
        return [{ record, artifact }];
    });
}
/** A stable in-memory notebook ID for a folder that has portable artifacts but no manifest. */
export function portableNotebookId(root) {
    const base = path.basename(root).replace(/[^A-Za-z0-9._:-]+/g, '-').replace(/^[^A-Za-z0-9]+/, '');
    return isFirstLookId(base) ? `notebook-${base}` : 'notebook-portable';
}
