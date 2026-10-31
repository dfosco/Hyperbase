import { parse as parseJsonc } from 'jsonc-parser';
function parseConfig(raw) {
    if (raw === null || raw === undefined)
        return {};
    if (isRecord(raw))
        return raw;
    if (typeof raw !== 'string')
        return null;
    const errors = [];
    const parsed = parseJsonc(raw, errors);
    return errors.length === 0 && isRecord(parsed) ? parsed : null;
}
function withoutSiblingOrder(config) {
    const result = structuredClone(config);
    const notebook = result.notebook;
    if (isRecord(notebook)) {
        delete notebook.siblingOrder;
        if (Object.keys(notebook).length === 0)
            delete result.notebook;
    }
    return result;
}
function stableJson(value) {
    if (Array.isArray(value))
        return `[${value.map(stableJson).join(',')}]`;
    if (!isRecord(value))
        return JSON.stringify(value);
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
}
export function classifySiblingOrderConfigChange(previousRaw, nextRaw) {
    const previous = parseConfig(previousRaw);
    const next = parseConfig(nextRaw);
    if (!previous || !next)
        return 'other';
    const previousJson = stableJson(previous);
    const nextJson = stableJson(next);
    if (previousJson === nextJson)
        return 'unchanged';
    return stableJson(withoutSiblingOrder(previous)) === stableJson(withoutSiblingOrder(next))
        ? 'order-only'
        : 'other';
}
/** Each watcher owns its baseline so one plugin cannot consume another's change. */
export function createSiblingOrderChangeTracker(initialRaw) {
    let previousRaw = initialRaw;
    return {
        observe(nextRaw) {
            const result = classifySiblingOrderConfigChange(previousRaw, nextRaw);
            previousRaw = nextRaw;
            return result;
        },
    };
}
function refKey(ref) {
    return ref.kind === 'folder' ? `folder\0${ref.path}` : `artifact\0${ref.id}`;
}
export function isNotebookSiblingRef(value) {
    if (!isRecord(value))
        return false;
    if (value.kind === 'folder') {
        return typeof value.path === 'string' && value.path.length > 0
            && value.path === value.path.replaceAll('\\', '/')
            && !value.path.startsWith('/')
            && value.path.split('/').every(segment => segment !== '' && segment !== '.' && segment !== '..');
    }
    return value.kind === 'artifact' && typeof value.id === 'string' && value.id.trim().length > 0;
}
function compareText(left, right) {
    const foldedLeft = left.toLowerCase();
    const foldedRight = right.toLowerCase();
    if (foldedLeft < foldedRight)
        return -1;
    if (foldedLeft > foldedRight)
        return 1;
    if (left < right)
        return -1;
    if (left > right)
        return 1;
    return 0;
}
function defaultRank(sibling) {
    if (sibling.kind === 'artifact')
        return 4;
    switch (sibling.name.toLowerCase()) {
        case 'prototypes': return 0;
        case 'canvas': return 1;
        case 'sites': return 2;
        default: return 3;
    }
}
export function defaultNotebookSiblingOrder(siblings) {
    return [...siblings].sort((left, right) => defaultRank(left) - defaultRank(right)
        || compareText(left.name, right.name)
        || compareText(refKey(left.ref), refKey(right.ref)));
}
/** Apply a saved per-parent sequence, ignoring removed refs and appending new siblings by default rank. */
export function resolveNotebookSiblingOrder(siblings, savedOrder) {
    const defaults = defaultNotebookSiblingOrder(siblings);
    if (!Array.isArray(savedOrder))
        return defaults;
    const byRef = new Map();
    const ambiguousAliases = new Set();
    for (const sibling of siblings) {
        const keys = [refKey(sibling.ref), ...(sibling.kind === 'artifact'
                ? (sibling.legacyArtifactIds || []).map(id => refKey({ kind: 'artifact', id }))
                : [])];
        for (const key of keys) {
            if (byRef.has(key) && byRef.get(key) !== sibling) {
                byRef.delete(key);
                ambiguousAliases.add(key);
            }
            else if (!ambiguousAliases.has(key))
                byRef.set(key, sibling);
        }
    }
    const result = [];
    const seen = new Set();
    for (const ref of savedOrder) {
        if (!isNotebookSiblingRef(ref))
            continue;
        const key = refKey(ref);
        const sibling = ambiguousAliases.has(key) ? undefined : byRef.get(key);
        const canonicalKey = sibling ? refKey(sibling.ref) : null;
        if (sibling && canonicalKey && !seen.has(canonicalKey)) {
            result.push(sibling);
            seen.add(canonicalKey);
        }
    }
    for (const sibling of defaults) {
        const key = refKey(sibling.ref);
        if (!seen.has(key))
            result.push(sibling);
    }
    return result;
}
function sameOrder(left, right) {
    return left.length === right.length && left.every((ref, index) => refKey(ref) === refKey(right[index]));
}
/** Move one existing direct child before or after another direct child. */
export function applySiblingReorder(current, request) {
    if (typeof request.parentPath !== 'string'
        || (request.parentPath !== '' && (request.parentPath.startsWith('/')
            || request.parentPath.includes('\\')
            || request.parentPath.split('/').some(part => !part || part === '.' || part === '..')))) {
        throw new Error('Parent path must be a normalized notebook-relative POSIX path.');
    }
    if (!isNotebookSiblingRef(request.sibling)
        || (request.insertBefore !== undefined && !isNotebookSiblingRef(request.insertBefore))
        || (request.insertAfter !== undefined && !isNotebookSiblingRef(request.insertAfter))) {
        throw new Error('Sibling references must be valid folder paths or artifact IDs.');
    }
    if ((request.insertBefore === undefined) === (request.insertAfter === undefined)) {
        throw new Error('Exactly one of insertBefore or insertAfter is required.');
    }
    if (!Array.isArray(request.expectedSiblingOrder) || !request.expectedSiblingOrder.every(isNotebookSiblingRef)) {
        throw new Error('Expected sibling order must be a list of valid sibling references.');
    }
    if (!sameOrder(current, request.expectedSiblingOrder))
        throw Object.assign(new Error('Sibling order changed since it was read.'), { code: 'STALE_SIBLING_ORDER' });
    const sourceKey = refKey(request.sibling);
    const target = request.insertBefore ?? request.insertAfter;
    const targetKey = refKey(target);
    if (sourceKey === targetKey)
        throw new Error('A sibling cannot be ordered relative to itself.');
    if (new Set(current.map(refKey)).size !== current.length)
        throw new Error('Current sibling references are not unique.');
    if (!current.some(ref => refKey(ref) === sourceKey) || !current.some(ref => refKey(ref) === targetKey)) {
        throw Object.assign(new Error('Sibling and insertion target must both be direct children of parentPath.'), { code: 'INVALID_SIBLING_TARGET' });
    }
    const next = current.filter(ref => refKey(ref) !== sourceKey);
    const targetIndex = next.findIndex(ref => refKey(ref) === targetKey);
    next.splice(targetIndex + (request.insertAfter ? 1 : 0), 0, request.sibling);
    return next;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
