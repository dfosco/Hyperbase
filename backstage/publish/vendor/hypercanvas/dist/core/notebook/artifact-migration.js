import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { applyEdits, modify, parse as parseJsonc } from 'jsonc-parser';
import { toCanvasId } from '../canvas/identity.js';
import { resolveRuntimeDir } from '../runtimeDir.js';
import { NOTEBOOK_INFRASTRUCTURE_DIRECTORIES, siteConfigRelativePath } from '../site/site.js';
import { resolveAppConfigPath } from '../configFile.js';
import { normalizeNotebookArtifactMigrationAliases, notebookRouteCollisionKey } from './artifact-migration-aliases.js';
import { inspectNotebook, NOTEBOOK_ARTIFACT_MARKER_FILE, resolveNotebookManifestPath, notebookManifestRelativePath, } from './notebook.js';
const POLICY_VERSION = 'legacy-artifact-adoption-v1';
const JOURNAL_NAME = '.artifact-migration';
const SUFFIX = {
    '.prototype': 'prototype', '.component': 'component', '.canvas': 'canvas', '.site': 'site',
};
function isRecord(value) { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function fail(code, message, status = 409, metadata) {
    return Object.assign(new Error(message), { code, status, ...(metadata ? { metadata } : {}) });
}
function sha(value) { return createHash('sha256').update(value).digest('hex'); }
function stable(value) {
    if (Array.isArray(value))
        return `[${value.map(stable).join(',')}]`;
    if (!isRecord(value))
        return JSON.stringify(value);
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
}
function inside(root, target) {
    const relative = path.relative(root, target);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}
function normalizedRelative(value) {
    return value === '' || (!value.startsWith('/') && !value.includes('\\') && value.split('/').every(part => part && part !== '.' && part !== '..'));
}
function abs(root, relative) {
    if (!normalizedRelative(relative))
        throw fail('MIGRATION_UNSAFE_PATH', `Unsafe Notebook-relative path: ${relative}`, 422);
    const target = path.resolve(root, ...relative.split('/').filter(Boolean));
    if (!inside(root, target))
        throw fail('MIGRATION_UNSAFE_PATH', `Path escapes the Notebook: ${relative}`, 422);
    return target;
}
function safeChain(root, relative, allowMissing = false) {
    const target = abs(root, relative);
    let current = root;
    const parts = relative.split('/').filter(Boolean);
    for (const [index, part] of parts.entries()) {
        current = path.join(current, part);
        let stat;
        try {
            stat = fs.lstatSync(current);
        }
        catch (error) {
            if (allowMissing && index === parts.length - 1 && isRecord(error) && error.code === 'ENOENT')
                return target;
            throw error;
        }
        if (stat.isSymbolicLink())
            throw fail('MIGRATION_UNSAFE_PATH', `Symbolic links are not allowed in migration paths: ${parts.slice(0, index + 1).join('/')}`, 409);
        if (index < parts.length - 1 && !stat.isDirectory())
            throw fail('MIGRATION_UNSAFE_PATH', `Path component is not a directory: ${parts.slice(0, index + 1).join('/')}`, 409);
        if (!inside(root, fs.realpathSync.native(current)))
            throw fail('MIGRATION_UNSAFE_PATH', `Path resolves outside the Notebook: ${relative}`, 409);
    }
    return target;
}
function readRaw(file) { try {
    return fs.readFileSync(file, 'utf8');
}
catch (error) {
    if (isRecord(error) && error.code === 'ENOENT')
        return null;
    throw error;
} }
function hashPath(root, relative) {
    const target = safeChain(root, relative);
    const stat = fs.lstatSync(target);
    const entries = [];
    const walk = (file, rel) => {
        const current = fs.lstatSync(file);
        if (current.isSymbolicLink())
            throw fail('MIGRATION_UNSAFE_PATH', `Symbolic link in artifact input: ${rel}`, 409);
        if (current.isFile())
            entries.push([rel, sha(fs.readFileSync(file))]);
        else if (current.isDirectory()) {
            for (const entry of fs.readdirSync(file, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
                if (entry.isSymbolicLink())
                    throw fail('MIGRATION_UNSAFE_PATH', `Symbolic link in artifact input: ${rel}/${entry.name}`, 409);
                walk(path.join(file, entry.name), rel ? `${rel}/${entry.name}` : entry.name);
            }
        }
        else
            throw fail('MIGRATION_UNSAFE_PATH', `Unsupported special file in artifact input: ${rel}`, 409);
    };
    walk(target, '');
    return sha(stable({ type: stat.isDirectory() ? 'directory' : 'file', entries }));
}
function readMarker(folder) {
    const markerPath = path.join(folder, NOTEBOOK_ARTIFACT_MARKER_FILE);
    const raw = readRaw(markerPath);
    if (!raw)
        return {};
    const marker = JSON.parse(raw);
    if (!isRecord(marker) || marker.formatVersion !== 1 || typeof marker.id !== 'string' || !marker.id.trim()
        || !['prototype', 'component', 'canvas', 'site'].includes(String(marker.kind))) {
        throw fail('MIGRATION_CONFLICTS', `Invalid artifact marker at ${markerPath}.`, 409, { conflicts: [{ code: 'INVALID_ARTIFACT_IDENTITY', fromPath: markerPath }] });
    }
    return marker;
}
function encodePathSegment(segment) {
    let decoded = segment;
    try {
        decoded = decodeURIComponent(segment);
    }
    catch { /* encode raw percent signs as authored */ }
    return encodeURIComponent(decoded);
}
function encodePathname(value) {
    const pathname = value.replaceAll('\\', '/');
    const leadingSlash = pathname.startsWith('/');
    const segments = pathname.split('/').filter(Boolean).map(encodePathSegment);
    return `${leadingSlash ? '/' : ''}${segments.join('/')}` || '/';
}
function encodeRelativeRoutePath(value) {
    return value.split('/').filter(Boolean).map(encodePathSegment).join('/');
}
function routePathsOverlap(left, right) {
    return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}
function mergeMigrationAliases(existingValue, generatedValue, fromPath) {
    const existing = normalizeNotebookArtifactMigrationAliases(existingValue);
    const generated = normalizeNotebookArtifactMigrationAliases(generatedValue);
    if (!existing || !generated)
        throw fail('MIGRATION_CONFLICTS', `Migration aliases at ${fromPath} are malformed.`, 409);
    const routes = new Map();
    for (const alias of [...(existing.legacyRoutes || []), ...(generated.legacyRoutes || [])]) {
        const prior = routes.get(alias.from);
        if (prior !== undefined && prior !== alias.targetPath)
            throw fail('MIGRATION_ALIAS_CONFLICT', `Migration route alias ${alias.from} has conflicting destinations at ${fromPath}.`, 409);
        routes.set(alias.from, alias.targetPath);
    }
    const scopes = existing.legacyScopes || generated.legacyScopes;
    if (existing.legacyScopes && generated.legacyScopes
        && (existing.legacyScopes.prototype !== generated.legacyScopes.prototype
            || (existing.legacyScopes.folder && generated.legacyScopes.folder && existing.legacyScopes.folder !== generated.legacyScopes.folder))) {
        throw fail('MIGRATION_ALIAS_CONFLICT', `Migration scope aliases conflict at ${fromPath}.`, 409);
    }
    const legacyCanvasIds = [...new Set([...(existing.legacyCanvasIds || []), ...(generated.legacyCanvasIds || [])])];
    return {
        ...(routes.size ? { legacyRoutes: [...routes].map(([from, targetPath]) => ({ from, targetPath })) } : {}),
        ...(legacyCanvasIds.length ? { legacyCanvasIds } : {}),
        ...(scopes ? { legacyScopes: scopes } : {}),
    };
}
function migrationAliasesFor(item, root) {
    const legacyRoutes = [];
    const legacyCanvasIds = [];
    const legacyScopes = item.kind === 'prototype'
        ? (() => {
            const segments = item.fromPath.split('/');
            const group = segments.slice(1, -1).find(segment => segment.endsWith('.folder'));
            return { prototype: path.posix.basename(item.fromPath), ...(group ? { folder: group.slice(0, -'.folder'.length) } : {}) };
        })()
        : undefined;
    if (item.kind === 'prototype' && item.oldRoute && item.newRoute && item.oldRoute !== item.newRoute) {
        legacyRoutes.push({ from: item.oldRoute, targetPath: '' });
        const oldDirectory = abs(root, item.fromPath);
        const files = [];
        const walk = (directory) => {
            for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
                if (entry.isSymbolicLink())
                    throw fail('MIGRATION_UNSAFE_PATH', `Symbolic link in prototype ${item.fromPath}.`, 409);
                const full = path.join(directory, entry.name);
                if (entry.isDirectory())
                    walk(full);
                else if (entry.isFile() && entry.name.endsWith('.flow.json'))
                    files.push(full);
            }
        };
        walk(oldDirectory);
        for (const file of files) {
            let flow;
            try {
                flow = JSON.parse(fs.readFileSync(file, 'utf8'));
            }
            catch {
                continue;
            }
            if (!isRecord(flow) || typeof flow.route !== 'string' || !flow.route.trim())
                continue;
            const flowRoute = flow.route.trim().replace(/^\/+|\/+$/g, '');
            if (!flowRoute || flowRoute.split('/').some(part => part === '.' || part === '..'))
                continue;
            const oldFrom = encodePathname(`/${flowRoute}`);
            const relative = encodeRelativeRoutePath(flowRoute);
            if (!legacyRoutes.some(alias => alias.from === oldFrom))
                legacyRoutes.push({ from: oldFrom, targetPath: relative });
        }
    }
    if (item.kind === 'canvas' && item.payloadPath) {
        legacyCanvasIds.push(toCanvasId(item.fromPath));
    }
    return {
        ...(legacyRoutes.length ? { legacyRoutes } : {}),
        ...(legacyCanvasIds.length ? { legacyCanvasIds } : {}),
        ...(legacyScopes ? { legacyScopes } : {}),
    };
}
function contentOnlyPage(snapshot, page, root) {
    if (page.type === 'prototype' && typeof page.path === 'string' && page.path.startsWith('prototypes/')) {
        const fromPath = page.path;
        const logical = path.posix.basename(fromPath);
        const parent = path.posix.dirname(fromPath);
        const target = path.posix.join(parent, `${logical}.prototype`);
        return { kind: 'prototype', fromPath, toPath: target,
            oldRoute: encodePathname(typeof page.route === 'string' ? page.route : `/${logical}`),
            newRoute: encodePathname(`/${logical}.prototype`), pageId: typeof page.id === 'string' ? page.id : undefined };
    }
    if (page.type === 'canvas' && typeof page.path === 'string' && page.path.startsWith('canvas/') && page.path.endsWith('.canvas.jsonl')) {
        const filePath = page.path;
        const filename = path.posix.basename(filePath);
        const sourceParent = path.posix.dirname(filePath);
        const logical = filename.replace(/\.canvas\.jsonl$/, '');
        const folder = path.posix.join(sourceParent, `${logical}.canvas`);
        const target = path.posix.join(folder, filename);
        return { kind: 'canvas', fromPath: filePath, toPath: folder,
            oldRoute: encodePathname(typeof page.route === 'string' ? page.route : `/canvas/${logical}`),
            newRoute: encodePathname(`/canvas/${logical}`), pageId: typeof page.id === 'string' ? page.id : undefined, payloadPath: target };
    }
    if (page.type === 'site' && typeof page.siteId === 'string' && typeof page.id === 'string') {
        const siteId = page.siteId;
        const target = `${siteId}.site`;
        if (snapshot.artifacts.some(artifact => artifact.kind === 'site' && artifact.available
            && artifact.payloadPath && artifact.route === `/sites/${encodeURIComponent(siteId)}`))
            return null;
        const registryPath = siteConfigRelativePath(root);
        const registryRaw = readRaw(path.join(root, registryPath));
        if (registryRaw) {
            const registry = parseJsonc(registryRaw);
            const sites = isRecord(registry) && isRecord(registry.sites) ? registry.sites : null;
            if (sites && isRecord(sites[siteId])) {
                const descriptor = sites[siteId];
                const sourceHash = sha(stable(descriptor));
                const id = `artifact-site-${sha(`${siteId}\0${sourceHash}`).slice(0, 20)}`;
                return { kind: 'site', fromPath: registryPath, toPath: target,
                    oldRoute: encodePathname(typeof page.route === 'string' ? page.route : `/sites/${encodeURIComponent(siteId)}`),
                    newRoute: encodePathname(`/sites/${encodeURIComponent(siteId)}`), pageId: page.id, siteId,
                    sourceHash, id, sourceType: 'aggregate-site', descriptor };
            }
        }
        const legacyDescriptor = `sites/${siteId}.site.json`;
        if (fs.existsSync(path.join(root, legacyDescriptor))) {
            return { kind: 'site', fromPath: legacyDescriptor, toPath: target,
                oldRoute: encodePathname(typeof page.route === 'string' ? page.route : `/sites/${encodeURIComponent(siteId)}`),
                newRoute: encodePathname(`/sites/${encodeURIComponent(siteId)}`), pageId: page.id, siteId,
                sourceType: 'path', payloadPath: `${target}/site.config.json`,
                sourceHash: hashPath(root, legacyDescriptor), id: `artifact-site-${sha(`${siteId}\0${hashPath(root, legacyDescriptor)}`).slice(0, 20)}` };
        }
    }
    // Source-repository components are intentionally not inferred from their
    // `components/` directory. New suffix components are already canonical.
    return null;
}
function collectItems(root, snapshot) {
    const items = [];
    const conflicts = [];
    const canonicalRoutes = new Set(snapshot.artifacts.filter(item => item.available && item.route).map(item => notebookRouteCollisionKey(item.route)));
    const routeAliasOwners = new Map();
    for (const artifact of snapshot.artifacts) {
        if (!artifact.available)
            continue;
        for (const alias of artifact.migrationAliases?.legacyRoutes || []) {
            routeAliasOwners.set(notebookRouteCollisionKey(alias.from), artifact.folderPath);
        }
    }
    const targetPaths = new Set();
    for (const diagnostic of snapshot.diagnostics) {
        if (['NESTED_ARTIFACT', 'DUPLICATE_ARTIFACT_ID', 'ARTIFACT_ROUTE_CONFLICT', 'UNREPRESENTABLE_ARTIFACT_ROUTE', 'ARTIFACT_ROUTE_ALIAS_CONFLICT', 'ARTIFACT_CANVAS_ALIAS_CONFLICT', 'AMBIGUOUS_CANVAS_PAYLOAD', 'INVALID_ARTIFACT_IDENTITY', 'INVALID_ARTIFACT_MIGRATION_ALIASES', 'MALFORMED_ARTIFACT_PAYLOAD', 'INVALID_EXTERNAL_PROTOTYPE_URL'].includes(diagnostic.code)) {
            conflicts.push({ code: diagnostic.code, message: diagnostic.message, fromPath: diagnostic.path, ...(diagnostic.proposedDestination ? { toPath: diagnostic.proposedDestination } : {}) });
        }
    }
    const pages = snapshot.pages;
    for (const page of pages) {
        try {
            const candidate = contentOnlyPage(snapshot, page, root);
            if (!candidate)
                continue;
            safeChain(root, candidate.fromPath);
            const targetAbsolute = safeChain(root, candidate.toPath, true);
            if (candidate.kind === 'prototype') {
                const futureNestedArtifacts = snapshot.artifacts.filter(artifact => artifact.available
                    && artifact.folderPath.startsWith(`${candidate.fromPath}/`));
                for (const artifact of futureNestedArtifacts) {
                    const suffixPath = artifact.folderPath.slice(candidate.fromPath.length + 1);
                    conflicts.push({
                        code: 'MIGRATION_FUTURE_NESTED_ARTIFACT',
                        message: `Wrapping ${candidate.fromPath} as ${candidate.toPath} would nest the existing ${artifact.kind} artifact ${artifact.folderPath} at ${candidate.toPath}/${suffixPath}. Move the suffix artifact to an ordinary Notebook parent before migration.`,
                        fromPath: candidate.fromPath,
                        artifactPath: artifact.folderPath,
                        toPath: `${candidate.toPath}/${suffixPath}`,
                    });
                }
                if (futureNestedArtifacts.length)
                    continue;
            }
            if (candidate.kind === 'prototype') {
                const logicalName = path.posix.basename(candidate.toPath).replace(/\.prototype$/, '');
                if (!logicalName || logicalName.includes('?') || /^:[A-Za-z_$][A-Za-z0-9_$]*/.test(logicalName)) {
                    conflicts.push({
                        code: 'MIGRATION_UNREPRESENTABLE_ROUTE',
                        message: `Prototype route for ${candidate.toPath} cannot be represented as a safe static route. Rename the artifact before migration.`,
                        fromPath: candidate.fromPath,
                        toPath: candidate.toPath,
                        newRoute: candidate.newRoute,
                    });
                    continue;
                }
            }
            const occupiedPath = candidate.kind === 'canvas' ? candidate.payloadPath : candidate.toPath;
            const pathKey = candidate.toPath.toLocaleLowerCase('en-US');
            const existingArtifact = snapshot.artifacts.find(artifact => artifact.folderPath.toLocaleLowerCase('en-US') === pathKey);
            if (fs.existsSync(targetAbsolute) || targetPaths.has(pathKey) || existingArtifact) {
                conflicts.push({ code: 'MIGRATION_DESTINATION_OCCUPIED', message: `Migration destination is already occupied: ${candidate.toPath}`, fromPath: candidate.fromPath, toPath: candidate.toPath, occupiedPath: candidate.toPath });
                continue;
            }
            if (candidate.kind === 'canvas' && fs.existsSync(abs(root, occupiedPath))) {
                conflicts.push({ code: 'MIGRATION_DESTINATION_OCCUPIED', message: `Migration destination is already occupied: ${occupiedPath}`, fromPath: candidate.fromPath, toPath: candidate.toPath, occupiedPath });
                continue;
            }
            const routeKey = candidate.newRoute ? notebookRouteCollisionKey(candidate.newRoute) : null;
            if (routeKey && canonicalRoutes.has(routeKey)) {
                conflicts.push({ code: 'MIGRATION_ROUTE_CONFLICT', message: `Canonical route ${candidate.newRoute} is already in use.`, fromPath: candidate.fromPath, toPath: candidate.toPath, oldRoute: candidate.oldRoute, newRoute: candidate.newRoute });
                continue;
            }
            if (routeKey)
                canonicalRoutes.add(routeKey);
            targetPaths.add(pathKey);
            const candidateMarker = candidate.kind === 'prototype' ? readMarker(abs(root, candidate.fromPath)) : {};
            if (Object.keys(candidateMarker).length && candidateMarker.kind !== candidate.kind) {
                throw fail('MIGRATION_CONFLICTS', `Artifact marker at ${candidate.fromPath} declares kind ${String(candidateMarker.kind)} instead of ${candidate.kind}.`, 409);
            }
            const id = typeof candidateMarker.id === 'string' ? candidateMarker.id
                : typeof candidate.id === 'string' ? candidate.id
                    : typeof page.id === 'string' ? page.id : '';
            const itemBase = { ...candidate, id };
            const generatedAliases = candidate.kind === 'site' ? {} : migrationAliasesFor(itemBase, root);
            const aliases = mergeMigrationAliases(candidateMarker.migrationAliases, generatedAliases, candidate.fromPath);
            const marker = { ...candidateMarker, formatVersion: 1, id, kind: candidate.kind,
                ...(Object.keys(aliases).length ? { migrationAliases: aliases } : {}) };
            for (const alias of aliases.legacyRoutes || []) {
                const routeKey = notebookRouteCollisionKey(alias.from);
                const priorAlias = routeAliasOwners.get(routeKey);
                const firstSegment = routeKey.split('/').filter(Boolean)[0];
                const reserved = !firstSegment || ['workspace', 'viewfinder', 'create', 'sites', 'canvas', 'components', 'notebook', '_hypercanvas'].includes(firstSegment);
                const canonicalConflict = [...canonicalRoutes].some(route => routePathsOverlap(route, routeKey));
                const aliasConflict = [...routeAliasOwners.keys()].some(route => routePathsOverlap(route, routeKey));
                if (reserved || canonicalConflict || aliasConflict || priorAlias) {
                    conflicts.push({
                        code: 'MIGRATION_ROUTE_ALIAS_CONFLICT',
                        message: `Legacy route alias ${alias.from} conflicts with a canonical, reserved, or other migration route${priorAlias ? ` from ${priorAlias}` : ''}.`,
                        fromPath: candidate.fromPath,
                        toPath: candidate.toPath,
                        oldRoute: alias.from,
                    });
                }
                routeAliasOwners.set(routeKey, candidate.fromPath);
            }
            items.push({ ...itemBase, itemId: sha(stable(itemBase)).slice(0, 24), sourceHash: 'sourceHash' in candidate ? candidate.sourceHash : hashPath(root, candidate.fromPath), marker, aliases });
        }
        catch (error) {
            conflicts.push({ code: isRecord(error) && typeof error.code === 'string' ? error.code : 'MIGRATION_INPUT_INVALID', message: error instanceof Error ? error.message : String(error), fromPath: typeof page.path === 'string' ? page.path : undefined });
        }
    }
    return { items: items.sort((a, b) => a.fromPath.localeCompare(b.fromPath, 'en')), conflicts };
}
function revision(root) {
    const raw = fs.readFileSync(resolveNotebookManifestPath(root));
    return sha(raw);
}
function selectedConfig(root) {
    const selected = resolveAppConfigPath(root);
    if (!fs.existsSync(selected))
        return null;
    const relative = path.relative(root, selected).split(path.sep).join('/');
    return relative && !relative.startsWith('../') ? relative : null;
}
function planFor(rootValue, request) {
    const root = fs.realpathSync.native(rootValue);
    const snapshot = inspectNotebook(root);
    if (snapshot.status !== 'valid')
        throw fail('INVALID_NOTEBOOK', 'The active Notebook is not valid for migration.', 422, { diagnostics: snapshot.diagnostics });
    if (snapshot.manifest.id !== request.notebookId)
        throw fail('NOTEBOOK_SCOPE_CONFLICT', 'Notebook scope changed.', 409);
    const currentRevision = revision(root);
    if (currentRevision !== request.expectedRevision)
        throw fail('STALE_NOTEBOOK_REVISION', 'Notebook manifest changed since preview.', 409, { current: { revision: currentRevision } });
    const { items, conflicts } = collectItems(root, snapshot);
    const routeChanges = items.filter(item => item.oldRoute !== item.newRoute).map(item => ({ itemId: item.itemId, fromPath: item.fromPath, toPath: item.toPath, oldRoute: item.oldRoute, newRoute: item.newRoute }));
    const configPath = selectedConfig(root);
    const siteConfig = siteConfigRelativePath(root);
    const fingerprint = {
        policy: POLICY_VERSION,
        notebookId: request.notebookId,
        generation: request.generation,
        revision: currentRevision,
        items,
        config: configPath ? readRaw(path.join(root, configPath)) : null,
        siteRegistry: readRaw(path.join(root, siteConfig)),
        targetOccupancy: items.map(item => [item.toPath, fs.existsSync(path.join(root, ...item.toPath.split('/')))]),
    };
    const planDigest = sha(stable(fingerprint));
    const planId = sha(`${request.notebookId}\0${request.generation}\0${planDigest}`).slice(0, 24);
    const pendingRecovery = listJournals(root);
    if (pendingRecovery.length)
        throw fail('MIGRATION_RECOVERY_REQUIRED', 'Resolve the pending explicit migration journal before creating a new plan.', 409, { pendingRecovery });
    return { success: true, notebookId: request.notebookId, generation: request.generation, revision: currentRevision, planId, planDigest, items, routeChanges, conflicts, pendingRecovery: [] };
}
function runtimeMigrationRoot(root) { return path.join(resolveRuntimeDir(root), 'migrations', JOURNAL_NAME); }
function safeMigrationDirectory(root, create) {
    const directory = runtimeMigrationRoot(root);
    if (!inside(root, directory))
        throw fail('MIGRATION_UNSAFE_PATH', 'Migration journal directory escapes the Notebook.', 409);
    const relative = path.relative(root, directory);
    let current = root;
    for (const part of relative.split(path.sep).filter(Boolean)) {
        current = path.join(current, part);
        let stat;
        try {
            stat = fs.lstatSync(current);
        }
        catch (error) {
            if (!isRecord(error) || error.code !== 'ENOENT')
                throw error;
            if (!create)
                return null;
            fs.mkdirSync(current);
            stat = fs.lstatSync(current);
        }
        if (stat.isSymbolicLink() || !stat.isDirectory())
            throw fail('MIGRATION_UNSAFE_PATH', `Migration journal path is not a real directory: ${path.relative(root, current)}.`, 409);
        // Every component is checked with lstat above. Rejecting symbolic links is
        // sufficient here and avoids false escapes when the OS exposes the same
        // Notebook through both /var and /private/var paths.
    }
    return directory;
}
function listJournals(root) {
    const directory = safeMigrationDirectory(root, false);
    if (!directory)
        return [];
    try {
        const pending = [];
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            if (!entry.isDirectory() || entry.isSymbolicLink()) {
                pending.push({ migrationId: entry.name, state: 'invalid', code: 'MIGRATION_JOURNAL_INVALID', message: 'Migration journal entry must be a real directory.' });
                continue;
            }
            const file = path.join(directory, entry.name, 'journal.json');
            try {
                const value = JSON.parse(fs.readFileSync(file, 'utf8'));
                if (!isRecord(value) || value.migrationId !== entry.name || !Array.isArray(value.items) || typeof value.journalRevision !== 'string') {
                    pending.push({ migrationId: entry.name, state: 'invalid', code: 'MIGRATION_JOURNAL_INVALID' });
                    continue;
                }
                if (value.state !== 'completed' && value.state !== 'rolledBack') {
                    pending.push({ migrationId: entry.name, state: value.state, journalRevision: value.journalRevision });
                }
            }
            catch (error) {
                pending.push({ migrationId: entry.name, state: 'invalid', code: 'MIGRATION_JOURNAL_INVALID', message: error instanceof Error ? error.message : String(error) });
            }
        }
        return pending;
    }
    catch (error) {
        if (isRecord(error) && error.code === 'ENOENT')
            return [];
        throw error;
    }
}
function journalFile(root, id) { return path.join(runtimeMigrationRoot(root), id, 'journal.json'); }
function readJournal(root, id) {
    if (!/^[a-f0-9-]{16,64}$/i.test(id))
        throw fail('INVALID_MIGRATION_ID', 'Migration ID is invalid.', 422);
    const target = journalFile(root, id);
    const migrationRoot = runtimeMigrationRoot(root);
    if (!inside(migrationRoot, target))
        throw fail('MIGRATION_UNSAFE_PATH', 'Migration journal path is unsafe.', 422);
    safeMigrationDirectory(root, false);
    safeChain(root, path.relative(root, target).split(path.sep).join('/'));
    let journal;
    let raw;
    try {
        raw = fs.readFileSync(target, 'utf8');
    }
    catch (error) {
        if (isRecord(error) && error.code === 'ENOENT')
            throw fail('MIGRATION_JOURNAL_NOT_FOUND', `Migration journal ${id} is unavailable.`, 404);
        throw error;
    }
    try {
        journal = JSON.parse(raw);
    }
    catch (error) {
        throw fail('MIGRATION_JOURNAL_INVALID', `Migration journal ${id} is corrupt: ${error instanceof Error ? error.message : String(error)}.`, 409);
    }
    if (!isRecord(journal) || journal.migrationId !== id || !Array.isArray(journal.items) || typeof journal.journalRevision !== 'string')
        throw fail('MIGRATION_JOURNAL_INVALID', `Migration journal ${id} is invalid.`, 409);
    return journal;
}
function writeJournal(file, journal) {
    const revisionValue = sha(stable({ ...journal, journalRevision: undefined }));
    const next = { ...journal, journalRevision: revisionValue };
    const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, { flag: 'wx' });
    fs.renameSync(temporary, file);
    return next;
}
function copyPath(source, target) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(source, target, { recursive: true, errorOnExist: true, force: false, dereference: false });
}
function backupFiles(root, journalDir, paths) {
    const records = [];
    const backupRoot = path.join(journalDir, 'backup');
    for (const relative of [...new Set(paths.filter(Boolean))]) {
        const source = safeChain(root, relative);
        const stat = fs.lstatSync(source);
        if (stat.isSymbolicLink())
            throw fail('MIGRATION_UNSAFE_PATH', `Cannot back up symbolic link ${relative}.`, 409);
        const backup = path.join(backupRoot, ...relative.split('/'));
        copyPath(source, backup);
        records.push({ path: relative, backup: path.relative(journalDir, backup), hash: hashPath(root, relative), type: stat.isDirectory() ? 'directory' : 'file' });
    }
    return records;
}
function writeJsonAtomic(file, value) {
    const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
    fs.renameSync(temporary, file);
}
function fileContentHash(value) { return sha(stable({ type: 'file', entries: [['', sha(value)]] })); }
function writeControlledText(root, journalFilePath, journal, relative, content) {
    const hashes = isRecord(journal.controlledHashes) ? { ...journal.controlledHashes } : {};
    const allowed = Array.isArray(hashes[relative]) ? [...hashes[relative]] : [];
    const nextHash = fileContentHash(content);
    if (!allowed.includes(nextHash))
        allowed.push(nextHash);
    journal = updateJournal(journalFilePath, journal, { controlledHashes: { ...hashes, [relative]: allowed } });
    const absolute = safeChain(root, relative, true);
    const temporary = `${absolute}.${process.pid}.${randomUUID()}.tmp`;
    fs.writeFileSync(temporary, content, { flag: 'wx' });
    fs.renameSync(temporary, absolute);
    return journal;
}
function applyOrderAliases(root, item, journalFilePath, journal) {
    if (!item.pageId || !item.id || item.pageId === item.id)
        return journal;
    const configFile = selectedConfig(root);
    if (!configFile)
        return journal;
    const absolute = path.join(root, configFile);
    const raw = fs.readFileSync(absolute, 'utf8');
    const value = parseJsonc(raw);
    if (!isRecord(value))
        return journal;
    const notebook = isRecord(value.notebook) ? value.notebook : null;
    const siblingOrder = notebook && isRecord(notebook.siblingOrder) ? notebook.siblingOrder : null;
    if (!siblingOrder)
        return journal;
    const transform = (candidate) => Array.isArray(candidate) ? candidate.map(ref => isRecord(ref) && ref.kind === 'artifact' && ref.id === item.pageId ? { ...ref, id: item.id } : ref) : candidate;
    let next = raw;
    for (const [parent, order] of Object.entries(siblingOrder)) {
        if (!Array.isArray(order))
            continue;
        const updated = transform(order);
        if (stable(updated) !== stable(order))
            next = applyEdits(next, modify(next, ['notebook', 'siblingOrder', parent], updated, { formattingOptions: { insertSpaces: true, tabSize: 2, eol: next.includes('\r\n') ? '\r\n' : '\n' } }));
    }
    if (next !== raw)
        journal = writeControlledText(root, journalFilePath, journal, configFile, next);
    return journal;
}
function removeAggregateSite(root, item, journalFilePath, journal) {
    if (!item.siteId)
        return journal;
    const file = path.join(root, item.fromPath);
    if (!fs.existsSync(file))
        return journal;
    const raw = fs.readFileSync(file, 'utf8');
    const config = parseJsonc(raw);
    if (!isRecord(config) || !isRecord(config.sites) || !Object.hasOwn(config.sites, item.siteId))
        return journal;
    const next = applyEdits(raw, modify(raw, ['sites', item.siteId], undefined, { formattingOptions: { insertSpaces: true, tabSize: 2, eol: raw.includes('\r\n') ? '\r\n' : '\n' } }));
    return writeControlledText(root, journalFilePath, journal, item.fromPath, next);
}
function updateManifestForItem(root, item, journalFilePath, journal) {
    if (!item.pageId || item.kind === 'site')
        return journal;
    const file = resolveNotebookManifestPath(root);
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!isRecord(manifest) || !Array.isArray(manifest.pages))
        return journal;
    const pagePath = item.kind === 'canvas' ? item.payloadPath : item.toPath;
    const pages = manifest.pages.map(page => {
        if (!isRecord(page) || typeof page.path !== 'string')
            return page;
        if (page.id === item.pageId)
            return { ...page, path: pagePath, route: item.newRoute };
        if (item.kind === 'prototype' && page.path.startsWith(`${item.fromPath}/`)) {
            return { ...page, path: `${item.toPath}/${page.path.slice(item.fromPath.length + 1)}` };
        }
        return page;
    });
    return writeControlledText(root, journalFilePath, journal, notebookManifestRelativePath(root), `${JSON.stringify({ ...manifest, pages }, null, 2)}\n`);
}
function installStagedArtifact(root, item, journalFilePath, journal, journalDir) {
    const target = safeChain(root, item.toPath, true);
    const expectedTargets = isRecord(journal.expectedTargets) ? { ...journal.expectedTargets } : {};
    const stage = path.join(journalDir, 'staged', item.itemId);
    const stageRelative = path.relative(root, stage).split(path.sep).join('/');
    const source = safeChain(root, item.fromPath, true);
    if (!fs.existsSync(target)) {
        if (!fs.existsSync(source))
            throw fail('MIGRATION_RECOVERY_CONFLICT', `Migration source and destination are both missing: ${item.fromPath}.`, 409);
        if ('sourceHash' in item && hashPath(root, item.fromPath) !== item.sourceHash && item.sourceType !== 'aggregate-site') {
            throw fail('STALE_MIGRATION_SOURCE', `Migration source changed after preview: ${item.fromPath}.`, 409);
        }
        if (fs.existsSync(stage))
            fs.rmSync(stage, { recursive: true, force: true });
        fs.mkdirSync(path.dirname(stage), { recursive: true });
        fs.mkdirSync(stage, { recursive: false });
        if (item.kind === 'site' && item.sourceType === 'aggregate-site') {
            writeJsonAtomic(path.join(stage, 'site.config.json'), item.descriptor);
        }
        else if (item.kind === 'site' && item.sourceType === 'path') {
            copyPath(source, path.join(stage, 'site.config.json'));
        }
        else if (item.kind === 'canvas') {
            copyPath(source, path.join(stage, item.payloadPath ? path.posix.basename(item.payloadPath) : path.posix.basename(item.fromPath)));
        }
        else {
            for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
                const from = path.join(source, entry.name);
                const to = path.join(stage, entry.name);
                if (entry.isSymbolicLink())
                    throw fail('MIGRATION_UNSAFE_PATH', `Symbolic link in artifact input: ${item.fromPath}/${entry.name}`, 409);
                copyPath(from, to);
            }
        }
        writeJsonAtomic(path.join(stage, NOTEBOOK_ARTIFACT_MARKER_FILE), item.marker);
        const expectedHash = hashPath(root, stageRelative);
        journal = updateJournal(journalFilePath, journal, { expectedTargets: { ...expectedTargets, [item.toPath]: expectedHash } });
        fs.mkdirSync(path.dirname(target), { recursive: true });
        safeChain(root, item.toPath, true);
        fs.renameSync(stage, target);
        expectedTargets[item.toPath] = expectedHash;
    }
    else {
        const expectedHash = expectedTargets[item.toPath];
        if (typeof expectedHash !== 'string' || hashPath(root, item.toPath) !== expectedHash) {
            throw fail('MIGRATION_RECOVERY_CONFLICT', `Migration destination changed or is occupied: ${item.toPath}.`, 409, { occupiedPath: item.toPath, fromPath: item.fromPath, toPath: item.toPath });
        }
    }
    if (item.sourceType !== 'aggregate-site' && fs.existsSync(source)) {
        if (hashPath(root, item.fromPath) !== item.sourceHash)
            throw fail('MIGRATION_RECOVERY_CONFLICT', `Migration source changed after destination was installed: ${item.fromPath}.`, 409);
        fs.rmSync(source, { recursive: true, force: true });
    }
    return journal;
}
function applyItem(root, item, journalFilePath, journal, journalDir) {
    if (item.kind === 'site' && item.sourceType === 'aggregate-site') {
        journal = installStagedArtifact(root, item, journalFilePath, journal, journalDir);
        journal = removeAggregateSite(root, item, journalFilePath, journal);
        return applyOrderAliases(root, item, journalFilePath, journal);
    }
    if (item.kind === 'site' && item.sourceType === 'path') {
        journal = installStagedArtifact(root, item, journalFilePath, journal, journalDir);
        return applyOrderAliases(root, item, journalFilePath, journal);
    }
    journal = installStagedArtifact(root, item, journalFilePath, journal, journalDir);
    journal = applyOrderAliases(root, item, journalFilePath, journal);
    return updateManifestForItem(root, item, journalFilePath, journal);
}
function publicState(root) {
    const current = inspectNotebook(root);
    return current.status === 'valid' ? { revision: revision(root), pages: current.pages, artifacts: current.artifacts, diagnostics: current.diagnostics } : { diagnostics: current.diagnostics };
}
function completeItems(journal) { return Array.isArray(journal.completedItems) ? journal.completedItems.filter((item) => typeof item === 'string') : []; }
function updateJournal(file, journal, updates) { return writeJournal(file, { ...journal, ...updates, updatedAt: new Date().toISOString() }); }
function restoreBackups(root, journalDir, journalPath, originalJournal) {
    let journal = originalJournal;
    const backups = Array.isArray(journal.backups) ? journal.backups.filter(isRecord) : [];
    const controlledHashes = isRecord(journal.controlledHashes) ? journal.controlledHashes : {};
    const expectedTargets = isRecord(journal.expectedTargets) ? journal.expectedTargets : {};
    const items = Array.isArray(journal.items) ? journal.items.filter(isRecord) : [];
    const staged = path.join(journalDir, 'staged');
    const rollbackStaging = path.join(journalDir, 'rollback-staged');
    const rollbackStarted = journal.state === 'rollbackIntent';
    if (fs.existsSync(staged) && fs.lstatSync(staged).isSymbolicLink())
        throw fail('MIGRATION_RECOVERY_CONFLICT', 'Migration staging path became a symbolic link.', 409);
    if (fs.existsSync(rollbackStaging) && fs.lstatSync(rollbackStaging).isSymbolicLink())
        throw fail('MIGRATION_RECOVERY_CONFLICT', 'Rollback staging path became a symbolic link.', 409);
    const validatedBackups = [];
    // Validate every affected path before changing any user data. A write that
    // happened after our last checkpoint is accepted only when its exact hash
    // was durably recorded before the atomic replacement.
    for (const record of backups) {
        if (typeof record.path !== 'string' || typeof record.backup !== 'string')
            continue;
        const target = safeChain(root, record.path, true);
        const backup = path.resolve(journalDir, record.backup);
        if (!inside(journalDir, backup) || !fs.existsSync(backup) || fs.lstatSync(backup).isSymbolicLink())
            throw fail('MIGRATION_RECOVERY_CONFLICT', `Backup for ${record.path} is missing or unsafe.`, 409, { path: record.path });
        const backupRelative = path.relative(root, backup).split(path.sep).join('/');
        if (record.hash && hashPath(root, backupRelative) !== record.hash)
            throw fail('MIGRATION_RECOVERY_CONFLICT', `Backup for ${record.path} was changed.`, 409, { path: record.path });
        const restoreStage = path.join(rollbackStaging, ...record.path.split('/'));
        if (fs.existsSync(target)) {
            const currentHash = hashPath(root, record.path);
            const allowed = [record.hash, ...(Array.isArray(controlledHashes[record.path]) ? controlledHashes[record.path] : [])];
            if (!allowed.includes(currentHash))
                throw fail('MIGRATION_RECOVERY_CONFLICT', `Path changed after migration: ${record.path}.`, 409, { path: record.path });
        }
        else {
            const item = items.find(candidate => candidate.fromPath === record.path);
            const destinationPresent = item && typeof item.toPath === 'string' && expectedTargets[item.toPath] != null
                && fs.existsSync(safeChain(root, item.toPath))
                && hashPath(root, item.toPath) === expectedTargets[item.toPath];
            const stagePresent = rollbackStarted && fs.existsSync(restoreStage)
                && hashPath(root, path.relative(root, restoreStage).split(path.sep).join('/')) === record.hash;
            if (!destinationPresent && !stagePresent) {
                throw fail('MIGRATION_RECOVERY_CONFLICT', `Original path is missing and no verified migrated destination exists: ${record.path}.`, 409, { path: record.path });
            }
        }
        if (fs.existsSync(restoreStage)) {
            const stageRelative = path.relative(root, restoreStage).split(path.sep).join('/');
            if (hashPath(root, stageRelative) !== record.hash)
                throw fail('MIGRATION_RECOVERY_CONFLICT', `Rollback staging copy for ${record.path} was changed.`, 409, { path: record.path });
        }
        validatedBackups.push({ record, target, backup, restoreStage });
    }
    const validatedTargets = [];
    for (const item of items) {
        if (typeof item.toPath !== 'string')
            continue;
        const target = safeChain(root, item.toPath, true);
        const expected = expectedTargets[item.toPath];
        if (fs.existsSync(target) && (typeof expected !== 'string' || hashPath(root, item.toPath) !== expected)) {
            throw fail('MIGRATION_RECOVERY_CONFLICT', `Migration destination changed after apply: ${item.toPath}.`, 409, { path: item.toPath });
        }
        const backup = validatedBackups.find(entry => entry.record.path === item.fromPath);
        const sourceRestored = backup && fs.existsSync(backup.target) && hashPath(root, String(item.fromPath)) === backup.record.hash;
        const sourceStillOriginal = backup && fs.existsSync(backup.target) && sourceRestored;
        if (!fs.existsSync(target) && !sourceStillOriginal) {
            throw fail('MIGRATION_RECOVERY_CONFLICT', `Migration destination disappeared before rollback: ${item.toPath}.`, 409, { path: item.toPath });
        }
        validatedTargets.push({ item, target, ...(typeof item.fromPath === 'string' ? { sourcePath: item.fromPath } : {}) });
    }
    // The full read-only preflight above completes before staging or changing
    // Notebook paths. Staging preserves immutable backups and makes rollback
    // restartable across a crash between removal and rename.
    fs.mkdirSync(rollbackStaging, { recursive: true });
    for (const { record, backup, restoreStage } of validatedBackups) {
        if (fs.existsSync(restoreStage))
            continue;
        copyPath(backup, restoreStage);
        const stageRelative = path.relative(root, restoreStage).split(path.sep).join('/');
        if (hashPath(root, stageRelative) !== record.hash)
            throw fail('MIGRATION_RECOVERY_CONFLICT', `Could not stage a verified rollback copy for ${record.path}.`, 409, { path: record.path });
    }
    journal = updateJournal(journalPath, journal, { state: 'rollbackIntent' });
    for (const { record, target, restoreStage } of validatedBackups) {
        if (!fs.existsSync(target) || hashPath(root, String(record.path)) !== record.hash) {
            if (fs.existsSync(target))
                fs.rmSync(target, { recursive: true, force: true });
            fs.renameSync(restoreStage, target);
        }
        journal = updateJournal(journalPath, journal, {
            rollbackRestoredPaths: [...new Set([...(Array.isArray(journal.rollbackRestoredPaths) ? journal.rollbackRestoredPaths : []), String(record.path)])],
        });
    }
    for (const { item, target } of validatedTargets) {
        if (fs.existsSync(target))
            fs.rmSync(target, { recursive: true, force: true });
        journal = updateJournal(journalPath, journal, {
            rollbackRemovedTargets: [...new Set([...(Array.isArray(journal.rollbackRemovedTargets) ? journal.rollbackRemovedTargets : []), String(item.toPath)])],
        });
    }
    if (fs.existsSync(staged)) {
        fs.rmSync(staged, { recursive: true, force: true });
    }
    if (fs.existsSync(rollbackStaging))
        fs.rmSync(rollbackStaging, { recursive: true, force: true });
    return { journal, restored: validatedBackups.map(({ record }) => String(record.path)) };
}
export function previewNotebookArtifactMigration(root, request) {
    if (!request || typeof request.notebookId !== 'string' || !Number.isSafeInteger(request.generation) || request.generation < 0 || typeof request.expectedRevision !== 'string')
        throw fail('INVALID_MIGRATION_REQUEST', 'Notebook scope, generation and expectedRevision are required.', 400);
    return planFor(root, request);
}
export function applyNotebookArtifactMigration(rootValue, request) {
    const root = fs.realpathSync.native(rootValue);
    if (!request || typeof request.notebookId !== 'string' || !Number.isSafeInteger(request.generation) || request.generation < 0
        || typeof request.expectedRevision !== 'string' || typeof request.planId !== 'string' || typeof request.planDigest !== 'string'
        || typeof request.acceptRouteChanges !== 'boolean')
        throw fail('INVALID_MIGRATION_REQUEST', 'Notebook scope, generation, expectedRevision, planId, planDigest and acceptRouteChanges are required.', 400);
    const matchingCompleted = findCompletedPlan(root, request);
    if (matchingCompleted)
        return matchingCompleted;
    const preview = planFor(root, request);
    if (preview.conflicts.length)
        throw fail('MIGRATION_CONFLICTS', 'Migration preview contains conflicts. Resolve them before apply.', 409, { conflicts: preview.conflicts, current: preview });
    if (preview.planId !== request.planId || preview.planDigest !== request.planDigest)
        throw fail('STALE_MIGRATION_PLAN', 'Migration plan changed. Request a fresh preview.', 409, { current: preview });
    if (!preview.items.length)
        return { success: true, notebookId: request.notebookId, generation: request.generation, revision: preview.revision, migrationId: null, state: 'completed', backupPath: null, moved: [], current: publicState(root) };
    if (preview.routeChanges.length && request.acceptRouteChanges !== true)
        throw fail('ROUTE_CHANGES_NOT_ACCEPTED', 'This preview changes canonical routes. Re-run apply with acceptRouteChanges:true after reviewing those exact changes.', 409, { routeChanges: preview.routeChanges });
    const migrationId = randomUUID();
    const journalDir = path.join(runtimeMigrationRoot(root), migrationId);
    const file = path.join(journalDir, 'journal.json');
    safeMigrationDirectory(root, true);
    fs.mkdirSync(path.dirname(journalDir), { recursive: true });
    fs.mkdirSync(journalDir, { recursive: false });
    const paths = [notebookManifestRelativePath(root), ...(selectedConfig(root) ? [selectedConfig(root)] : []), siteConfigRelativePath(root), ...preview.items.map(item => item.fromPath)];
    const backups = backupFiles(root, journalDir, paths.filter(relative => fs.existsSync(path.join(root, ...relative.split('/')))));
    const controlledHashes = Object.fromEntries(backups.filter(record => record.type === 'file').map(record => [record.path, [record.hash]]));
    let journal = writeJournal(file, { migrationId, notebookId: request.notebookId, generation: request.generation, planId: request.planId, planDigest: request.planDigest, state: 'prepared', items: preview.items, backups, controlledHashes, expectedTargets: {}, completedItems: [], createdAt: new Date().toISOString() });
    journal = updateJournal(file, journal, { state: 'commitIntent' });
    const completed = [];
    try {
        for (const item of preview.items) {
            journal = applyItem(root, item, file, journal, journalDir);
            completed.push(item.itemId);
            journal = updateJournal(file, journal, { completedItems: [...completed] });
        }
        const current = inspectNotebook(root);
        if (current.status !== 'valid')
            throw fail('MIGRATION_RECONCILIATION_FAILED', 'Post-migration Notebook reconciliation failed.', 500, { diagnostics: current.diagnostics });
        const result = { success: true, notebookId: request.notebookId, generation: request.generation, revision: revision(root), migrationId, state: 'completed', backupPath: path.relative(root, path.join(journalDir, 'backup')), moved: preview.items.map(({ itemId, kind, id, fromPath, toPath }) => ({ itemId, kind, id, fromPath, toPath })), current: publicState(root) };
        journal = updateJournal(file, journal, { state: 'completed', completedItems: completed, result });
        return result;
    }
    catch (error) {
        const current = publicState(root);
        const physicallyInstalled = preview.items.filter(item => isRecord(journal.expectedTargets) && typeof journal.expectedTargets[item.toPath] === 'string'
            && fs.existsSync(path.join(root, ...item.toPath.split('/')))
            && hashPath(root, item.toPath) === journal.expectedTargets[item.toPath]).map(({ itemId, kind, id, fromPath, toPath }) => ({ itemId, kind, id, fromPath, toPath }));
        throw fail('MIGRATION_INTERRUPTED', error instanceof Error ? error.message : String(error), 500, { migrationId, state: journal.state, backupPath: path.relative(root, path.join(journalDir, 'backup')), moved: physicallyInstalled, movedAny: physicallyInstalled.length > 0, remainingItems: preview.items.filter(item => !physicallyInstalled.some(moved => moved.itemId === item.itemId)).map(item => item.itemId), diagnostics: current.diagnostics, current });
    }
}
export function recoverNotebookArtifactMigration(rootValue, request) {
    const root = fs.realpathSync.native(rootValue);
    if (!request || typeof request.notebookId !== 'string' || !Number.isSafeInteger(request.generation) || !request.migrationId || !request.expectedJournalRevision || !['resume', 'rollback'].includes(request.action))
        throw fail('INVALID_MIGRATION_RECOVERY_REQUEST', 'Notebook scope, migrationId, expectedJournalRevision and action are required.', 400);
    let journal = readJournal(root, request.migrationId);
    // The request generation is checked against the currently active Notebook
    // by the route before it reaches this service. The journal's generation is
    // historical provenance; a restart advances the runtime generation but
    // must not strand a pending journal for the same Notebook root and ID.
    if (journal.notebookId !== request.notebookId)
        throw fail('NOTEBOOK_SCOPE_CONFLICT', 'Migration journal belongs to a different Notebook.', 409);
    if (journal.journalRevision !== request.expectedJournalRevision)
        throw fail('STALE_MIGRATION_JOURNAL', 'Migration journal changed since it was read.', 409, { current: { migrationId: request.migrationId, state: journal.state, journalRevision: journal.journalRevision } });
    if (journal.state === 'completed')
        return { success: true, migrationId: request.migrationId, state: 'completed', backupPath: path.relative(root, path.dirname(journalFile(root, request.migrationId))), moved: journal.completedItems || [], restored: [], current: publicState(root) };
    const dir = path.dirname(journalFile(root, request.migrationId));
    if (request.action === 'rollback') {
        const rollback = restoreBackups(root, dir, journalFile(root, request.migrationId), journal);
        journal = rollback.journal;
        const restored = rollback.restored;
        journal = updateJournal(journalFile(root, request.migrationId), journal, { state: 'rolledBack', restored });
        return { success: true, migrationId: request.migrationId, state: journal.state, backupPath: path.relative(root, path.join(dir, 'backup')), moved: journal.completedItems || [], restored, current: publicState(root) };
    }
    if (journal.state === 'prepared')
        throw fail('MIGRATION_NOT_COMMITTING', 'A prepared migration has no committed changes; rollback it before starting a new preview.', 409, { current: journal });
    const completed = completeItems(journal);
    for (const value of journal.items) {
        if (!isRecord(value) || typeof value.itemId !== 'string' || completed.includes(value.itemId))
            continue;
        journal = applyItem(root, value, journalFile(root, request.migrationId), journal, dir);
        completed.push(value.itemId);
        journal = updateJournal(journalFile(root, request.migrationId), journal, { completedItems: completed });
    }
    const current = inspectNotebook(root);
    if (current.status !== 'valid')
        throw fail('MIGRATION_RECONCILIATION_FAILED', 'Post-recovery Notebook reconciliation failed.', 500, { migrationId: request.migrationId, state: journal.state, current: publicState(root) });
    journal = updateJournal(journalFile(root, request.migrationId), journal, { state: 'completed', completedItems: completed });
    return { success: true, migrationId: request.migrationId, state: journal.state, backupPath: path.relative(root, path.join(dir, 'backup')), moved: completed, restored: [], current: publicState(root) };
}
function findCompletedPlan(root, request) {
    const invalidJournals = listJournals(root).filter(entry => entry.state === 'invalid');
    if (invalidJournals.length) {
        throw fail('MIGRATION_RECOVERY_REQUIRED', 'An invalid migration journal must be inspected before continuing.', 409, { pendingRecovery: invalidJournals });
    }
    const directory = safeMigrationDirectory(root, false);
    if (!directory)
        return null;
    let entries;
    try {
        entries = fs.readdirSync(directory, { withFileTypes: true });
    }
    catch (error) {
        if (isRecord(error) && error.code === 'ENOENT')
            return null;
        throw error;
    }
    for (const entry of entries.filter(value => value.isDirectory())) {
        const journal = readJournal(root, entry.name);
        // A completed plan is an idempotency record, not a live session lease.
        // The route validates the caller against the current runtime generation;
        // a restart must still be able to replay the exact prior result.
        if (journal.notebookId !== request.notebookId
            || journal.planId !== request.planId || journal.planDigest !== request.planDigest)
            continue;
        if (journal.state === 'completed' && isRecord(journal.result))
            return journal.result;
    }
    return null;
}
export function migrationJournalRevision(root, migrationId) {
    return String(readJournal(fs.realpathSync.native(root), migrationId).journalRevision || '');
}
export const __artifactMigrationTest = { planFor, collectItems, safeChain, hashPath, readJournal, writeJournal, listJournals, SUFFIX, NOTEBOOK_INFRASTRUCTURE_DIRECTORIES };
