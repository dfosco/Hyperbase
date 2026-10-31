/** Resolves a dot-notation path against an object. */
export function getByPath(obj, path) {
    if (obj == null || typeof path !== 'string' || path === '')
        return undefined;
    const segments = path.split('.');
    let current = obj;
    for (const segment of segments) {
        if (current == null || typeof current !== 'object')
            return undefined;
        current = Reflect.get(current, segment);
    }
    return current;
}
/** Deep-clone arrays and plain objects while preserving the caller's type. */
export function deepClone(val) {
    if (Array.isArray(val))
        return val.map((item) => deepClone(item));
    if (val !== null && typeof val === 'object') {
        const out = {};
        for (const key of Object.keys(val))
            out[key] = deepClone(Reflect.get(val, key));
        return out;
    }
    return val;
}
/** Set a value at a dot-notation path inside an object, mutating it. */
export function setByPath(obj, path, value) {
    const segments = path.split('.');
    // Override params can come from the URL, so refuse prototype traversal.
    if (segments.some((segment) => ['__proto__', 'constructor', 'prototype'].includes(segment)))
        return;
    let current = obj;
    for (let i = 0; i < segments.length - 1; i++) {
        const segment = segments[i];
        const next = current[segment];
        if (next == null || typeof next !== 'object') {
            current[segment] = /^\d+$/.test(segments[i + 1]) ? [] : {};
        }
        current = current[segment];
    }
    const finalSegment = segments[segments.length - 1];
    if (finalSegment !== undefined)
        current[finalSegment] = value;
}
