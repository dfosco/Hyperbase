export function normalizeNotebookArtifactMigrationAliases(value) {
    if (value === undefined)
        return {};
    if (!isRecord(value))
        return null;
    const aliases = {};
    if (value.legacyRoutes !== undefined) {
        if (!Array.isArray(value.legacyRoutes))
            return null;
        const seen = new Set();
        const routes = [];
        for (const entry of value.legacyRoutes) {
            if (!isRecord(entry) || typeof entry.from !== 'string' || typeof entry.targetPath !== 'string'
                || !isNotebookPathname(entry.from) || !isRelativeTargetPath(entry.targetPath) || seen.has(entry.from))
                return null;
            seen.add(entry.from);
            routes.push({ from: entry.from, targetPath: entry.targetPath });
        }
        aliases.legacyRoutes = routes;
    }
    if (value.legacyCanvasIds !== undefined) {
        if (!Array.isArray(value.legacyCanvasIds) || !value.legacyCanvasIds.every(item => typeof item === 'string' && item.trim())
            || new Set(value.legacyCanvasIds).size !== value.legacyCanvasIds.length)
            return null;
        aliases.legacyCanvasIds = [...value.legacyCanvasIds];
    }
    if (value.legacyScopes !== undefined) {
        if (!isRecord(value.legacyScopes) || typeof value.legacyScopes.prototype !== 'string'
            || !value.legacyScopes.prototype.trim()
            || (value.legacyScopes.folder !== undefined && (typeof value.legacyScopes.folder !== 'string' || !value.legacyScopes.folder.trim())))
            return null;
        aliases.legacyScopes = {
            prototype: value.legacyScopes.prototype,
            ...(typeof value.legacyScopes.folder === 'string' ? { folder: value.legacyScopes.folder } : {}),
        };
    }
    return aliases;
}
export function isNotebookPathname(value) {
    return value.startsWith('/') && value.length > 1 && !value.includes('?') && !value.includes('#')
        && !value.includes('\\') && !value.startsWith('//')
        && value.split('/').slice(1).every(segment => {
            if (!segment || segment === '.' || segment === '..')
                return false;
            let decoded = segment;
            try {
                decoded = decodeURIComponent(segment);
            }
            catch { /* malformed escapes stay literal */ }
            return !decoded.includes('?') && !decoded.includes('/') && !decoded.includes('\\')
                && !/^:[A-Za-z_$][A-Za-z0-9_$]*/.test(decoded);
        });
}
export function isRelativeTargetPath(value) {
    return value === '' || (!value.startsWith('/') && !value.includes('\\') && !value.includes('?') && !value.includes('#')
        && value.split('/').every(segment => segment && segment !== '.' && segment !== '..'));
}
function decodePathSegment(segment) {
    try {
        return decodeURIComponent(segment);
    }
    catch {
        return segment;
    }
}
function encodePathSegment(segment) {
    return encodeURIComponent(decodePathSegment(segment));
}
function pathSegments(value) {
    return value.split('/').filter(Boolean);
}
function routeSegmentKey(segment) {
    return decodePathSegment(segment).toLocaleLowerCase('en-US');
}
export function notebookRouteCollisionKey(value) {
    return `/${pathSegments(value).map(routeSegmentKey).join('/')}`;
}
export function canonicalNotebookRoutePath(value) {
    if (!isNotebookPathname(value))
        return null;
    return `/${pathSegments(value).map(encodePathSegment).join('/')}`;
}
/** Convert a canonical encoded artifact href into a literal static Router path. */
export function notebookArtifactCanonicalRoutePattern(route) {
    if (!isNotebookPathname(route) || canonicalNotebookRoutePath(route) !== route)
        return null;
    const segments = pathSegments(route);
    if (segments.length !== 1)
        return null;
    const firstSegment = segments[0];
    if (firstSegment === undefined)
        return null;
    const segment = decodePathSegment(firstSegment);
    if (!segment || segment.includes('?') || segment.includes('/') || segment.includes('\\')
        || /^:[A-Za-z_$][A-Za-z0-9_$]*/.test(segment))
        return null;
    return segment;
}
/** React Router path for a legacy root and all of its old descendants. */
export function notebookArtifactAliasRoutePath(alias) {
    const canonical = canonicalNotebookRoutePath(alias.from);
    if (!canonical)
        return null;
    const literalSegments = pathSegments(canonical).map(decodePathSegment);
    if (literalSegments.some(segment => segment.includes('?') || segment.includes('/') || segment.includes('\\')
        || /^:[A-Za-z_$][A-Za-z0-9_$]*/.test(segment)))
        return null;
    return `${literalSegments.join('/')}/*`;
}
export function resolveNotebookArtifactRouteAlias(pathname, alias, basePath = '/') {
    if (!isNotebookPathname(alias.from) || !isRelativeTargetPath(alias.targetPath)
        || !isNotebookPathname(alias.route))
        return null;
    const requestSegments = pathSegments(pathname);
    const baseSegments = pathSegments(basePath);
    const aliasSegments = pathSegments(alias.from);
    const routeSegments = pathSegments(alias.route);
    const prefixMatches = (left, right) => left.length >= right.length
        && right.every((segment, index) => routeSegmentKey(left[index] || '') === routeSegmentKey(segment));
    if (!prefixMatches(requestSegments, baseSegments))
        return null;
    const relativeSegments = requestSegments.slice(baseSegments.length);
    if (!prefixMatches(relativeSegments, aliasSegments))
        return null;
    const suffix = relativeSegments.slice(aliasSegments.length);
    const target = [...routeSegments.map(encodePathSegment), ...pathSegments(alias.targetPath).map(encodePathSegment), ...suffix];
    return `/${[...baseSegments, ...target].map(encodePathSegment).join('/')}`;
}
export function legacyNotebookCanvasIds(aliases) {
    return aliases?.legacyCanvasIds ? [...aliases.legacyCanvasIds] : [];
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
